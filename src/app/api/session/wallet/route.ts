/**
 * POST /api/session/wallet: associa uma wallet Solana à sessão atual,
 * criando o `User` se necessário (ou reaproveitando o usuário da sessão
 * atual, se ainda não tiver wallet), e grava o cookie de sessão.
 *
 * DELETE /api/session/wallet: desassocia a wallet do usuário da sessão e
 * encerra a sessão. Como a wallet é a identidade principal do perfil, isto
 * não apaga nada: contribuições e credenciais já emitidas continuam
 * existindo no banco e on-chain, associadas ao endereço antigo. Só o
 * vínculo entre esta sessão/perfil e a wallet é desfeito.
 */

import bs58 from "bs58";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearSession, getSessionUserId, requireUser, setSessionUser } from "@/lib/session";
import { HttpError, jsonOk, readJsonBody, withErrorHandling } from "@/app/api/_lib/http";
import { serializeUser } from "@/app/api/_lib/serializers";
import { generateWalletHandle } from "@/app/api/_lib/handle";

function isValidSolanaAddress(value: string): boolean {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  wallet: z
    .string()
    .min(32)
    .max(44)
    .refine(isValidSolanaAddress, "Endereço de wallet Solana inválido."),
});

export const POST = withErrorHandling(async (request) => {
  const body = bodySchema.parse(await readJsonBody(request));
  const { wallet } = body;

  let user = await db.user.findUnique({ where: { wallet } });

  if (!user) {
    const sessionUserId = await getSessionUserId();
    if (sessionUserId) {
      const current = await db.user.findUnique({ where: { id: sessionUserId } });
      if (current && !current.wallet) {
        user = await db.user.update({ where: { id: current.id }, data: { wallet } });
      }
    }
  }

  if (!user) {
    const handle = await generateWalletHandle(wallet);
    user = await db.user.create({ data: { wallet, handle } });
  }

  await setSessionUser(user.id);

  return jsonOk(serializeUser(user));
});

export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }
  if (!user.wallet) {
    throw new HttpError("VALIDATION_ERROR", "Nenhuma wallet conectada a esta conta.");
  }

  await db.user.update({ where: { id: user.id }, data: { wallet: null } });
  await clearSession();

  return jsonOk({ walletDisconnected: true });
});
