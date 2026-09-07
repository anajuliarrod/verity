/**
 * Sessão leve baseada em cookie httpOnly, sem lib externa de auth.
 *
 * O cookie `verity_session` guarda `<userId>.<hmac>`. O HMAC é assinado com
 * um segredo derivado de env (com fallback estável em dev, para que o app
 * funcione sem nenhuma configuração — filosofia zero-setup). Isso não é
 * criptografia de dados sensíveis: apenas garante que o cookie não pode ser
 * forjado/adulterado no cliente.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

const COOKIE_NAME = "verity_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

/**
 * Fallback estável para dev/ideathon: não é secreto, mas evita que o app
 * quebre quando `VERITY_SESSION_SECRET` não está configurado. Em produção,
 * configure a env var para um valor real.
 */
const SESSION_SECRET =
  process.env.VERITY_SESSION_SECRET?.trim() ||
  "verity-poc-dev-session-secret-fallback-2026";

function sign(userId: string): string {
  return createHmac("sha256", SESSION_SECRET).update(userId).digest("hex");
}

function encodeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function decodeToken(token: string): string | null {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const userId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = sign(userId);

  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  return userId;
}

/** Lê o `userId` da sessão atual, validando a assinatura do cookie. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeToken(token);
}

/** Grava a sessão do usuário no cookie httpOnly. */
export async function setSessionUser(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encodeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Remove a sessão (logout). */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Retorna o `User` do Prisma associado à sessão atual, ou `null`. */
export async function requireUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}
