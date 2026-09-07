/**
 * Geração de `handle` (slug do perfil público) único, a partir do GitHub
 * username ou de um slug derivado da wallet.
 */

import { db } from "@/lib/db";

/** Prefixo usado para handles auto-gerados a partir da wallet, sem GitHub vinculado ainda. */
const WALLET_HANDLE_PREFIX = "w-";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function isWalletDerivedHandle(handle: string): boolean {
  return handle.startsWith(WALLET_HANDLE_PREFIX);
}

async function firstAvailableHandle(base: string): Promise<string> {
  const safeBase = base || "user";
  let candidate = safeBase;
  let attempt = 1;
  // `select` explícito: evita depender de colunas aditivas recém-adicionadas
  // ao schema (ex.: `previousHandle`) que podem ainda não existir no banco
  // no momento do deploy, já que o Prisma seleciona todas as colunas do
  // model por padrão quando nenhum `select` é informado.
  while (
    await db.user.findUnique({ where: { handle: candidate }, select: { id: true } })
  ) {
    attempt += 1;
    candidate = `${safeBase}-${attempt}`;
  }
  return candidate;
}

/** Handle derivado da wallet (usado antes de vincular GitHub). */
export async function generateWalletHandle(wallet: string): Promise<string> {
  const base = `${WALLET_HANDLE_PREFIX}${slugify(wallet.slice(0, 8))}`;
  return firstAvailableHandle(base);
}

/** Handle derivado do GitHub username. */
export async function generateGithubHandle(githubUsername: string): Promise<string> {
  const base = slugify(githubUsername);
  return firstAvailableHandle(base);
}
