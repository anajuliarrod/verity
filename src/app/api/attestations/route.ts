/**
 * POST /api/attestations — emite a attestation de uma contribuição já
 * `VERIFIED` do usuário da sessão. Rejeita se a contribuição não existir,
 * não pertencer ao usuário, não estiver verificada, ou já tiver attestation.
 * A emissão em si (sas -> memo -> mock) é feita por `issueAttestation`
 * (`src/lib/solana/attest.ts`), que nunca lança para o chamador.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { issueAttestation, AttestationInputError } from "@/lib/solana/attest";
import { HttpError, jsonOk, readJsonBody, withErrorHandling } from "@/app/api/_lib/http";
import { serializeAttestation } from "@/app/api/_lib/serializers";

const bodySchema = z.object({
  contributionId: z.string().min(1, "contributionId é obrigatório."),
});

export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }

  const { contributionId } = bodySchema.parse(await readJsonBody(request));

  const contribution = await db.contribution.findUnique({
    where: { id: contributionId },
    include: { attestation: true },
  });

  if (!contribution) {
    throw new HttpError("NOT_FOUND", "Contribuição não encontrada.");
  }
  if (contribution.userId !== user.id) {
    throw new HttpError(
      "UNAUTHORIZED",
      "Esta contribuição não pertence ao usuário da sessão atual.",
    );
  }
  if (contribution.status !== "VERIFIED") {
    throw new HttpError(
      "VALIDATION_ERROR",
      "A contribuição precisa estar verificada antes de emitir a credencial.",
    );
  }
  if (contribution.attestation) {
    throw new HttpError(
      "CONFLICT",
      "Esta contribuição já possui uma attestation emitida.",
    );
  }
  if (!user.wallet) {
    throw new HttpError(
      "VALIDATION_ERROR",
      "Conecte uma wallet Solana antes de emitir a credencial.",
    );
  }

  let issued;
  try {
    issued = await issueAttestation({ contributionId });
  } catch (error) {
    if (error instanceof AttestationInputError) {
      throw new HttpError("VALIDATION_ERROR", error.message);
    }
    throw new HttpError(
      "SOLANA_ERROR",
      "Não foi possível emitir a attestation no momento.",
    );
  }

  const attestation = await db.attestation.create({
    data: {
      contributionId,
      issuer: issued.issuer,
      issuerPubkey: issued.issuerPubkey,
      subjectWallet: issued.subjectWallet,
      network: issued.network,
      mode: issued.mode,
      signature: issued.signature,
      attestationPda: issued.attestationPda,
      explorerUrl: issued.explorerUrl,
      payload: JSON.stringify(issued.payload),
    },
  });

  return jsonOk(serializeAttestation(attestation), 201);
});
