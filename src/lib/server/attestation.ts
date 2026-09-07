/**
 * Montagem da visão pública de uma attestation, direto da camada de dados.
 *
 * Extraído de `GET /api/attestations/:id` para que a página
 * `src/app/verify/[attestationId]/page.tsx` (um Server Component) possa
 * buscar os mesmos dados sem dar a volta desnecessária de chamar a própria
 * API por HTTP. A rota de API continua existindo e chama esta mesma
 * função: o comportamento observável de `GET /api/attestations/:id` não
 * muda, incluindo a checagem on-chain independente via `verifyOnChain`.
 */

import { db } from "@/lib/db";
import { verifyOnChain } from "@/lib/solana/verifyAttestation";
import type { AttestationPublicView } from "@/lib/types";
import {
  serializeAttestation,
  serializeContribution,
} from "@/app/api/_lib/serializers";

/** Retorna `null` quando não existe attestation com este id. */
export async function getPublicAttestationView(
  id: string,
): Promise<AttestationPublicView | null> {
  const attestation = await db.attestation.findUnique({
    where: { id },
    include: { contribution: { include: { attestation: true } } },
  });

  if (!attestation) return null;

  const verification = await verifyOnChain(id);

  return {
    attestation: serializeAttestation(attestation),
    contribution: serializeContribution(attestation.contribution),
    verification,
  };
}
