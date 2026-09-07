/**
 * GET /api/profile/:handle: perfil público de reputação. Sem sessão. A
 * montagem do perfil vive em `src/lib/server/profile.ts`, reutilizada
 * também pela página `src/app/p/[handle]/page.tsx` (Server Component) para
 * evitar que ela precise chamar esta mesma rota por HTTP.
 */

import { getPublicProfile } from "@/lib/server/profile";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";

export const GET = withErrorHandling(async (_request, context) => {
  const { params } = context as { params: Promise<{ handle: string }> };
  const { handle } = await params;

  const profile = await getPublicProfile(handle);
  if (!profile) {
    throw new HttpError("NOT_FOUND", "Perfil não encontrado.");
  }

  return jsonOk(profile);
});
