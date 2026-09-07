/**
 * Leitura tipada das variáveis de ambiente (seção 8 do VERITY_BRIEF.md) e
 * flags derivadas de modo demo. Nenhuma variável é obrigatória além de
 * `DATABASE_URL` (filosofia zero-setup: tudo que falta vira degradação
 * graciosa, nunca erro fatal).
 */

type SolanaCluster = "devnet" | "testnet" | "mainnet-beta";
type DemoModeSetting = "auto" | "on" | "off";

function readString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const env = {
  databaseUrl: readString(process.env.DATABASE_URL),

  solanaCluster: (readString(process.env.NEXT_PUBLIC_SOLANA_CLUSTER) ??
    "devnet") as SolanaCluster,
  solanaRpc: readString(process.env.NEXT_PUBLIC_SOLANA_RPC),

  githubClientId: readString(process.env.GITHUB_CLIENT_ID),
  githubClientSecret: readString(process.env.GITHUB_CLIENT_SECRET),
  githubToken: readString(process.env.GITHUB_TOKEN),

  verityIssuerSecretKey: readString(process.env.VERITY_ISSUER_SECRET_KEY),

  demoModeSetting: (readString(process.env.NEXT_PUBLIC_DEMO_MODE) ??
    "auto") as DemoModeSetting,
} as const;

/** OAuth do GitHub só liga se client id e secret estiverem presentes. */
export const isGithubOAuthEnabled = Boolean(
  env.githubClientId && env.githubClientSecret,
);

/** Attestation real (SAS) só liga se houver chave de emissão configurada. */
export const isRealAttestationEnabled = Boolean(env.verityIssuerSecretKey);

/**
 * Modo demo determinístico: "on" força, "off" força desligar, "auto" liga
 * sozinho quando as integrações reais essenciais (GitHub token e emissão
 * real) não estão configuradas.
 */
export const isDemoMode: boolean =
  env.demoModeSetting === "on"
    ? true
    : env.demoModeSetting === "off"
      ? false
      : !env.githubToken && !isRealAttestationEnabled;

export function githubApiMode(): "live" | "token" | "demo" {
  if (isDemoMode) return "demo";
  return env.githubToken ? "token" : "live";
}

export function solanaAttestationMode(): "sas" | "memo" | "mock" {
  if (isRealAttestationEnabled) return "sas";
  if (isDemoMode) return "mock";
  return "memo";
}

/**
 * Descobre a URL base pública da aplicação sem exigir configuração manual.
 * Ordem de precedência:
 * 1. `NEXT_PUBLIC_APP_URL`, quando definida (sobrescreve a detecção automática).
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` ou `VERCEL_URL`, injetadas pela própria
 *    Vercel em toda build (sem o esquema na frente, por isso prefixamos com
 *    `https://`).
 * 3. `http://localhost:PORT` (porta 3000 por padrão), só como último recurso
 *    em desenvolvimento local.
 */
export function getAppBaseUrl(): string {
  const explicit = readString(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost =
    readString(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    readString(process.env.VERCEL_URL);
  if (vercelHost) return `https://${vercelHost}`;

  const port = readString(process.env.PORT) ?? "3000";
  return `http://localhost:${port}`;
}
