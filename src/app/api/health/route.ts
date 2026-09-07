/**
 * GET /api/health — status dos modos de operação (github/solana/db) e do
 * modo demo. Não requer sessão. `modes.solana` vem de
 * `solanaAttestationMode()` (src/lib/env.ts) — este arquivo nunca importa de
 * `src/lib/solana/`, que é de outro agente.
 */

import { db } from "@/lib/db";
import {
  githubApiMode,
  isDemoMode,
  isGithubOAuthEnabled,
  solanaAttestationMode,
} from "@/lib/env";
import type { HealthStatus } from "@/lib/types";
import { jsonOk, withErrorHandling } from "@/app/api/_lib/http";

export const GET = withErrorHandling(async () => {
  let dbStatus: HealthStatus["modes"]["db"] = "connected";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "unreachable";
  }

  const status: HealthStatus = {
    ok: dbStatus === "connected",
    modes: {
      github: githubApiMode(),
      solana: solanaAttestationMode(),
      db: dbStatus,
    },
    githubOAuth: isGithubOAuthEnabled,
    demoMode: isDemoMode,
    timestamp: new Date().toISOString(),
  };

  return jsonOk(status);
});
