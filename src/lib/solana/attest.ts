/**
 * Núcleo de emissão de attestations. `issueAttestation({ contributionId })`
 * degrada graciosamente nesta ordem, nunca lançando para o chamador de UI:
 *
 *   1. `sas`  — Solana Attestation Service real em devnet (via `sas-lib`).
 *   2. `memo` — transação devnet com o Memo Program, carregando o hash
 *               canônico do payload (`verity.poc.v1:<hash>`).
 *   3. `mock` — assinatura determinística simulada (sem chave configurada),
 *               sempre marcada como `mode: "mock"` para a UI avisar que é
 *               modo demonstração.
 *
 * Cada degrau registra o motivo da falha do degrau anterior em
 * `diagnostics`, para a API/UI poderem explicar o que aconteceu.
 */
import { createHash } from "crypto";
import bs58 from "bs58";
import {
  address,
  getUtf8Encoder,
  type Account,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  deriveAttestationPda,
  deriveCredentialPda,
  deriveSchemaPda,
  fetchMaybeCredential,
  fetchMaybeSchema,
  fetchSchema,
  getCreateAttestationInstruction,
  getCreateCredentialInstruction,
  getCreateSchemaInstruction,
  serializeAttestationData,
  type Schema,
} from "sas-lib";
import { db } from "@/lib/db";
import { env, isRealAttestationEnabled } from "@/lib/env";
import type {
  AttestationMode,
  ContributionType,
  CredentialPayload,
  VerificationResult,
} from "@/lib/types";
import { buildCredentialPayload, hashPayload } from "./credential";
import { getIssuerSigner } from "./issuer";
import { explorerUrl, rpc, sendInstructions } from "./connection";

/** Nome do Credential (issuer) da Verity no SAS. Só os 32 primeiros bytes contam para a PDA. */
export const ISSUER_CREDENTIAL_NAME = "Verity Proof of Contribution";
export const SCHEMA_NAME = "verity.poc.v1";
export const SCHEMA_VERSION = 1;
/** Layout compacto do schema SAS: 4 campos, todos `String` (código 12). */
const SCHEMA_LAYOUT = [12, 12, 12, 12];
const SCHEMA_FIELD_NAMES = ["schema", "status", "evidenceHash", "payloadHash"];

const MEMO_PROGRAM_ADDRESS = address(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export class AttestationInputError extends Error {}

export interface IssueAttestationResult {
  mode: AttestationMode;
  issuer: "Verity Proof of Contribution";
  issuerPubkey: string | null;
  subjectWallet: string;
  network: string;
  signature: string | null;
  attestationPda: string | null;
  explorerUrl: string | null;
  payload: CredentialPayload;
  /** Trilha legível do que foi tentado e por que houve degradação. */
  diagnostics: string[];
}

interface OnChainResult {
  mode: AttestationMode;
  issuerPubkey: string | null;
  signature: string | null;
  attestationPda: string | null;
  explorerUrl: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Deriva um nonce determinístico (e sem colisão) a partir do id da contribuição. */
function deriveNonceAddress(contributionId: string): Address {
  const hash = createHash("sha256").update(contributionId).digest();
  return address(bs58.encode(hash));
}

/** Garante (de forma idempotente) o Credential e o Schema `verity.poc.v1` do emissor. */
async function ensureCredentialAndSchema(
  issuer: KeyPairSigner,
): Promise<{ credential: Address; schema: Address; schemaAccount: Account<Schema> }> {
  const [credentialPda] = await deriveCredentialPda({
    authority: issuer.address,
    name: ISSUER_CREDENTIAL_NAME,
  });

  const maybeCredential = await fetchMaybeCredential(rpc, credentialPda);
  if (!maybeCredential.exists) {
    const createCredentialIx = getCreateCredentialInstruction({
      payer: issuer,
      credential: credentialPda,
      authority: issuer,
      name: ISSUER_CREDENTIAL_NAME,
      signers: [issuer.address],
    });
    await sendInstructions(issuer, [createCredentialIx]);
  }

  const [schemaPda] = await deriveSchemaPda({
    credential: credentialPda,
    name: SCHEMA_NAME,
    version: SCHEMA_VERSION,
  });

  const maybeSchema = await fetchMaybeSchema(rpc, schemaPda);
  if (!maybeSchema.exists) {
    const createSchemaIx = getCreateSchemaInstruction({
      payer: issuer,
      authority: issuer,
      credential: credentialPda,
      schema: schemaPda,
      name: SCHEMA_NAME,
      description: "Verity Proof of Contribution — GitHub v1",
      layout: Uint8Array.from(SCHEMA_LAYOUT),
      fieldNames: SCHEMA_FIELD_NAMES,
    });
    await sendInstructions(issuer, [createSchemaIx]);
  }

  const schemaAccount = await fetchSchema(rpc, schemaPda);
  return { credential: credentialPda, schema: schemaPda, schemaAccount };
}

async function attemptSas(
  payload: CredentialPayload,
  payloadHash: string,
  contributionId: string,
): Promise<OnChainResult> {
  const issuer = await getIssuerSigner();
  if (!issuer) {
    throw new Error("VERITY_ISSUER_SECRET_KEY não configurada ou inválida");
  }

  const { credential, schema, schemaAccount } =
    await ensureCredentialAndSchema(issuer);
  const nonce = deriveNonceAddress(contributionId);
  const [attestationPda] = await deriveAttestationPda({
    credential,
    schema,
    nonce,
  });

  const data = serializeAttestationData(schemaAccount.data, {
    schema: payload.schema,
    status: payload.status,
    evidenceHash: payload.evidenceHash,
    payloadHash,
  });

  const createAttestationIx = getCreateAttestationInstruction({
    payer: issuer,
    authority: issuer,
    credential,
    schema,
    attestation: attestationPda,
    nonce,
    data,
    expiry: BigInt(0),
  });

  const { signature } = await sendInstructions(issuer, [createAttestationIx]);

  return {
    mode: "sas",
    issuerPubkey: issuer.address,
    signature,
    attestationPda,
    explorerUrl: explorerUrl(signature, "tx"),
  };
}

async function attemptMemo(payloadHash: string): Promise<OnChainResult> {
  const issuer = await getIssuerSigner();
  if (!issuer) {
    throw new Error(
      "VERITY_ISSUER_SECRET_KEY não configurada — modo memo requer uma keypair com SOL de devnet",
    );
  }

  const memoText = `${SCHEMA_NAME}:${payloadHash}`;
  const instruction: Instruction = {
    programAddress: MEMO_PROGRAM_ADDRESS,
    data: getUtf8Encoder().encode(memoText),
  };

  const { signature } = await sendInstructions(issuer, [instruction]);

  return {
    mode: "memo",
    issuerPubkey: issuer.address,
    signature,
    attestationPda: null,
    explorerUrl: explorerUrl(signature, "tx"),
  };
}

/** Assinatura simulada, determinística a partir do hash — plausível, nunca on-chain. */
function buildMockResult(payloadHash: string): OnChainResult {
  const first = createHash("sha256").update(`verity-mock:${payloadHash}`).digest();
  const second = createHash("sha256").update(first).digest();
  const signature = bs58.encode(Buffer.concat([first, second]));

  return {
    mode: "mock",
    issuerPubkey: null,
    signature,
    attestationPda: null,
    explorerUrl: null,
  };
}

/**
 * Emite a attestation de uma contribuição já verificada. Recarrega a
 * contribuição e o usuário do banco a partir do id (contrato da seção 6 do
 * brief), monta o payload da credencial e tenta sas -> memo -> mock.
 *
 * `forceMode: "mock"` pula as tentativas on-chain mesmo com um emissor
 * configurado — usado pelo seed de demonstração para não gastar SOL/tempo
 * de devnet emitindo várias transações reais a cada `npm run db:seed`.
 */
export async function issueAttestation({
  contributionId,
  forceMode,
}: {
  contributionId: string;
  forceMode?: "mock";
}): Promise<IssueAttestationResult> {
  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { user: true },
  });

  if (!contribution) {
    throw new AttestationInputError("Contribuição não encontrada");
  }
  if (contribution.status !== "VERIFIED") {
    throw new AttestationInputError("Contribuição ainda não foi verificada");
  }
  if (!contribution.user.wallet) {
    throw new AttestationInputError("Usuário sem wallet conectada");
  }
  if (!contribution.evidence) {
    throw new AttestationInputError(
      "Contribuição sem evidência de verificação",
    );
  }

  const verification = JSON.parse(contribution.evidence) as VerificationResult;
  const payload = buildCredentialPayload(
    {
      repoOwner: contribution.repoOwner,
      repoName: contribution.repoName,
      type: contribution.type as ContributionType,
      externalId: contribution.externalId,
      url: contribution.url,
      occurredAt: contribution.occurredAt,
    },
    { wallet: contribution.user.wallet },
    verification,
  );
  const payloadHash = hashPayload(payload);

  const diagnostics: string[] = [];
  let result: OnChainResult | null = null;

  if (forceMode === "mock") {
    diagnostics.push(
      "mock: modo forçado pelo chamador (seed de demonstração) — nenhuma tentativa on-chain foi feita.",
    );
  } else if (isRealAttestationEnabled) {
    try {
      result = await attemptSas(payload, payloadHash, contributionId);
      diagnostics.push(
        "sas: attestation criada on-chain via Solana Attestation Service.",
      );
    } catch (error) {
      diagnostics.push(
        `sas: falhou (${errorMessage(error)}) — tentando modo memo.`,
      );
    }
  } else {
    diagnostics.push(
      "sas: ignorado — VERITY_ISSUER_SECRET_KEY não configurada.",
    );
  }

  if (!result && forceMode !== "mock") {
    try {
      result = await attemptMemo(payloadHash);
      diagnostics.push(
        "memo: transação enviada com sucesso via Memo Program.",
      );
    } catch (error) {
      diagnostics.push(
        `memo: falhou (${errorMessage(error)}) — usando modo mock.`,
      );
    }
  }

  if (!result) {
    result = buildMockResult(payloadHash);
    diagnostics.push(
      "mock: nenhum emissor configurado ou disponível — assinatura simulada gerada apenas para demonstração.",
    );
  }

  return {
    ...result,
    issuer: "Verity Proof of Contribution",
    subjectWallet: contribution.user.wallet,
    network: env.solanaCluster,
    payload,
    diagnostics,
  };
}
