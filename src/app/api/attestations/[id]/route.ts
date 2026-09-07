/**
 * GET /api/attestations/:id — rota pública (sem sessão) usada pela página
 * `/verify/[attestationId]`. Devolve a attestation, a contribuição associada
 * e o resultado da checagem on-chain (`verifyOnChain`), para que qualquer
 * terceiro possa validar a credencial de forma independente.
 */

import { db } from "@/lib/db";
import { verifyOnChain } from "@/lib/solana/verifyAttestation";
import type { AttestationPublicView } from "@/lib/types";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";
import {
  serializeAttestation,
  serializeContribution,
} from "@/app/api/_lib/serializers";

export const GET = withErrorHandling(async (_request, context) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  const attestation = await db.attestation.findUnique({
    where: { id },
    include: { contribution: { include: { attestation: true } } },
  });

  if (!attestation) {
    throw new HttpError("NOT_FOUND", "Attestation não encontrada.");
  }

  const verification = await verifyOnChain(id);

  const view: AttestationPublicView = {
    attestation: serializeAttestation(attestation),
    contribution: serializeContribution(attestation.contribution),
    verification,
  };

  return jsonOk(view);
});
