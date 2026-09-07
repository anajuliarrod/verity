/**
 * Releitura pública de uma attestation e checagem contra o estado real da
 * rede Solana. É o que dá credibilidade à página `/verify/[attestationId]`:
 * mesmo alguém sem acesso ao banco da Verity pode reproduzir esta checagem
 * a partir do PDA (`sas`) ou da assinatura da transação (`memo`).
 */
import { address, signature as toSignature } from "@solana/kit";
import {
  deriveCredentialPda,
  deriveSchemaPda,
  deserializeAttestationData,
  fetchMaybeAttestation,
  fetchMaybeSchema,
} from "sas-lib";
import { db } from "@/lib/db";
import type {
  AttestationMode,
  CredentialPayload,
  VerifyOnChainResult,
} from "@/lib/types";
import { hashPayload } from "./credential";
import { rpc } from "./connection";
import { ISSUER_CREDENTIAL_NAME, SCHEMA_NAME, SCHEMA_VERSION } from "./attest";

export type { VerifyOnChainResult } from "@/lib/types";

interface SasAttestationData {
  schema: string;
  status: string;
  evidenceHash: string;
  payloadHash: string;
}

function now(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function verifySas(
  attestationPda: string,
  issuerPubkey: string,
  expectedPayloadHash: string,
  expectedEvidenceHash: string,
): Promise<VerifyOnChainResult> {
  const [credentialPda] = await deriveCredentialPda({
    authority: address(issuerPubkey),
    name: ISSUER_CREDENTIAL_NAME,
  });
  const [schemaPda] = await deriveSchemaPda({
    credential: credentialPda,
    name: SCHEMA_NAME,
    version: SCHEMA_VERSION,
  });

  const maybeSchema = await fetchMaybeSchema(rpc, schemaPda);
  if (!maybeSchema.exists) {
    return {
      onChain: false,
      matches: false,
      checkedAt: now(),
      detail:
        "Schema verity.poc.v1 não encontrado on-chain para este emissor.",
    };
  }

  const maybeAttestation = await fetchMaybeAttestation(
    rpc,
    address(attestationPda),
  );
  if (!maybeAttestation.exists) {
    return {
      onChain: false,
      matches: false,
      checkedAt: now(),
      detail: "Attestation PDA não encontrada on-chain.",
    };
  }

  const data = deserializeAttestationData<SasAttestationData>(
    maybeSchema.data,
    Uint8Array.from(maybeAttestation.data.data),
  );

  const matches =
    data.payloadHash === expectedPayloadHash &&
    data.evidenceHash === expectedEvidenceHash;

  return {
    onChain: true,
    matches,
    checkedAt: now(),
    detail: matches
      ? "Attestation encontrada on-chain e o hash confere com a credencial armazenada."
      : "Attestation encontrada on-chain, mas o hash não confere com a credencial armazenada.",
  };
}

async function verifyMemo(
  txSignature: string,
  expectedPayloadHash: string,
): Promise<VerifyOnChainResult> {
  const expectedMemo = `${SCHEMA_NAME}:${expectedPayloadHash}`;
  const transaction = await rpc
    .getTransaction(toSignature(txSignature), {
      encoding: "json",
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    })
    .send();

  if (!transaction) {
    return {
      onChain: false,
      matches: false,
      checkedAt: now(),
      detail:
        "Transação não encontrada on-chain (pode ainda não ter sido indexada pelo RPC).",
    };
  }

  const logs = transaction.meta?.logMessages ?? [];
  const matches = logs.some((line) => line.includes(expectedMemo));

  return {
    onChain: true,
    matches,
    checkedAt: now(),
    detail: matches
      ? "Transação encontrada on-chain e o memo confere com o hash da credencial."
      : "Transação encontrada on-chain, mas o memo não confere com o hash esperado.",
  };
}

/** Verifica a attestation `attestationId` contra o estado real da rede Solana. */
export async function verifyOnChain(
  attestationId: string,
): Promise<VerifyOnChainResult> {
  const attestation = await db.attestation.findUnique({
    where: { id: attestationId },
  });

  if (!attestation) {
    return {
      onChain: false,
      matches: false,
      checkedAt: now(),
      detail: "Attestation não encontrada.",
    };
  }

  const payload = JSON.parse(attestation.payload) as CredentialPayload;
  const expectedPayloadHash = hashPayload(payload);
  const mode = attestation.mode as AttestationMode;

  try {
    if (
      mode === "sas" &&
      attestation.attestationPda &&
      attestation.issuerPubkey
    ) {
      return await verifySas(
        attestation.attestationPda,
        attestation.issuerPubkey,
        expectedPayloadHash,
        payload.evidenceHash,
      );
    }

    if (mode === "memo" && attestation.signature) {
      return await verifyMemo(attestation.signature, expectedPayloadHash);
    }
  } catch (error) {
    return {
      onChain: false,
      matches: false,
      checkedAt: now(),
      detail: `Falha ao consultar a rede Solana: ${errorMessage(error)}`,
    };
  }

  return {
    onChain: false,
    matches: false,
    checkedAt: now(),
    detail:
      "Modo demonstração (mock): esta credencial não possui dado on-chain real para verificar.",
  };
}
