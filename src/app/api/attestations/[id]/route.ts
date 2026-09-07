/**
 * GET /api/attestations/:id: rota pública (sem sessão) usada pela página
 * `/verify/[attestationId]`. Devolve a attestation, a contribuição associada
 * e o resultado da checagem on-chain (`verifyOnChain`), para que qualquer
 * terceiro possa validar a credencial de forma independente. A montagem
 * vive em `src/lib/server/attestation.ts`, reutilizada também pela página
 * (Server Component) para evitar que ela precise chamar esta mesma rota
 * por HTTP.
 */

import { getPublicAttestationView } from "@/lib/server/attestation";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";

export const GET = withErrorHandling(async (_request, context) => {
  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  const view = await getPublicAttestationView(id);
  if (!view) {
    throw new HttpError("NOT_FOUND", "Attestation não encontrada.");
  }

  return jsonOk(view);
});
