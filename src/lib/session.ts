/**
 * Sessão leve baseada em cookie httpOnly, sem lib externa de auth.
 *
 * O cookie `verity_session` guarda `<userId>.<hmac>`. O HMAC é assinado com
 * um segredo derivado de env (com fallback estável apenas em dev, para que o
 * app funcione sem nenhuma configuração, filosofia zero-setup). Isso não é
 * criptografia de dados sensíveis: apenas garante que o cookie não pode ser
 * forjado/adulterado no cliente.
 *
 * Este arquivo, como todo o repositório, é público. Por isso o fallback só
 * pode existir fora de produção: se o valor fosse usado em produção sem
 * `VERITY_SESSION_SECRET` configurado, qualquer pessoa que leia este código
 * poderia forjar o cookie de sessão de qualquer usuário (userId é
 * previsível: aparece em respostas públicas como `/api/profile/:handle`).
 * Por isso o app falha explicitamente ao iniciar em produção sem o segredo.
 */

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

const COOKIE_NAME = "verity_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dias

/**
 * Fallback estável, usado só fora de produção (dev/ideathon local), para que
 * o app funcione sem nenhuma configuração. Nunca usado quando
 * `NODE_ENV === "production"`: nesse caso a ausência de
 * `VERITY_SESSION_SECRET` é um erro fatal, não uma degradação silenciosa,
 * porque o repositório é público e o fallback é conhecido por qualquer um.
 */
const DEV_FALLBACK_SECRET = "verity-poc-dev-session-secret-fallback-2026";

/**
 * Resolvida sob demanda (não no carregamento do módulo) para não arriscar
 * quebrar a fase de build do Next.js (`next build` roda com
 * `NODE_ENV=production` e importa rotas para coletar metadados, sem
 * necessariamente ter as env vars de runtime disponíveis). O erro deve
 * acontecer quando uma sessão é de fato assinada/validada em produção, não
 * ao empacotar o código.
 */
function resolveSessionSecret(): string {
  const configured = process.env.VERITY_SESSION_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VERITY_SESSION_SECRET não está configurado em produção. Como este " +
        "repositório é público, o fallback de desenvolvimento é conhecido " +
        "por qualquer pessoa e permitiria forjar sessão de qualquer " +
        "usuário. Configure a env var na Vercel antes de servir tráfego " +
        "(gere um valor com `openssl rand -hex 32`).",
    );
  }

  return DEV_FALLBACK_SECRET;
}

function sign(userId: string): string {
  return createHmac("sha256", resolveSessionSecret()).update(userId).digest("hex");
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
