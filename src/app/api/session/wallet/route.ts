/**
 * POST /api/session/wallet — associa uma wallet Solana à sessão atual,
 * criando o `User` se necessário (ou reaproveitando o usuário da sessão
 * atual, se ainda não tiver wallet), e grava o cookie de sessão.
 */

import bs58 from "bs58";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId, setSessionUser } from "@/lib/session";
import { jsonOk, readJsonBody, withErrorHandling } from "@/app/api/_lib/http";
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
