/**
 * Cliente HTTP tipado para o contrato de API da Verity (seção 4 do
 * VERITY_BRIEF.md). Desembrulha `ApiResponse<T>` e lança `ApiError` com o
 * `code` tipado em caso de falha, para que a UI trate cada situação
 * (não encontrado, não autorizado, etc.) de forma específica.
 *
 * As rotas de API são construídas por outro agente em paralelo e podem
 * ainda não existir. Todo helper aqui é seguro de chamar antes disso: a
 * falha vira um `ApiError` tratável pela UI, nunca uma exceção não tratada.
 */

import { getAppBaseUrl } from "@/lib/env";
import type {
  ApiErrorCode,
  ApiResponse,
  AttestationPublicView,
  ContributionFilters,
  HealthStatus,
  PublicProfile,
  VerityAttestation,
  VerityContribution,
  VerityUser,
} from "@/lib/types";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/**
 * Resolve a URL de uma rota de API. No navegador, um caminho relativo já
 * basta. No servidor, `fetch` exige uma URL absoluta: usamos a base
 * descoberta automaticamente por `getAppBaseUrl()` (ver `src/lib/env.ts`).
 *
 * Nota: Server Components que só precisam ler dados que a própria API já
 * expõe devem preferir chamar a camada de dados diretamente (veja
 * `src/lib/server/`), sem passar por `fetch`. Este cliente HTTP é para uso
 * no navegador (ou em integrações externas de fato remotas).
 */
function resolveUrl(path: string): string {
  if (typeof window !== "undefined") return path;
  return `${getAppBaseUrl()}${path}`;
}

export interface ApiFetchInit extends RequestInit {
  /** Desativa o cache do Next.js para chamadas de servidor sensíveis a tempo real. */
  noStore?: boolean;
}

export async function apiFetch<T>(
  path: string,
  init?: ApiFetchInit,
): Promise<T> {
  const { noStore, ...rest } = init ?? {};

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      ...rest,
      cache: noStore ? "no-store" : rest.cache,
      headers: {
        "Content-Type": "application/json",
        ...rest.headers,
      },
    });
  } catch {
    throw new ApiError(
      "INTERNAL_ERROR",
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    );
  }

  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      "INTERNAL_ERROR",
      `Resposta inválida do servidor (HTTP ${response.status}).`,
    );
  }

  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message);
  }

  return json.data;
}

function buildQuery(params: Record<string, string | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

// ---------------------------------------------------------------------------
// Sessão / wallet
// ---------------------------------------------------------------------------

/** Associa a wallet conectada à sessão atual; cria ou retorna o `User`. */
export function linkWallet(wallet: string): Promise<VerityUser> {
  return apiFetch<VerityUser>("/api/session/wallet", {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

/** Vincula um usuário do GitHub manualmente (fluxo sem OAuth). */
export function linkGithub(username: string): Promise<VerityUser> {
  return apiFetch<VerityUser>("/api/auth/github/link", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function githubOAuthStartUrl(): string {
  return "/api/auth/github/start";
}

// ---------------------------------------------------------------------------
// Contribuições
// ---------------------------------------------------------------------------

export interface GetContributionsOptions {
  /** Se `true`, força uma nova busca no GitHub antes de listar. */
  refresh?: boolean;
}

export function getContributions(
  options: GetContributionsOptions = {},
): Promise<VerityContribution[]> {
  const query = buildQuery({ refresh: options.refresh });
  return apiFetch<VerityContribution[]>(`/api/contributions${query}`, {
    noStore: true,
  });
}

/** Aplica os filtros do lado do cliente sobre uma lista já carregada. */
export function filterContributions(
  contributions: VerityContribution[],
  filters: ContributionFilters,
): VerityContribution[] {
  return contributions.filter((contribution) => {
    if (filters.status && contribution.status !== filters.status) return false;
    if (filters.type && contribution.type !== filters.type) return false;
    if (
      filters.repo &&
      !`${contribution.repoOwner}/${contribution.repoName}`
        .toLowerCase()
        .includes(filters.repo.toLowerCase())
    ) {
      return false;
    }
    if (filters.search) {
      const haystack =
        `${contribution.title} ${contribution.repoOwner}/${contribution.repoName}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}

export function verifyContribution(id: string): Promise<VerityContribution> {
  return apiFetch<VerityContribution>(`/api/contributions/${id}/verify`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Attestations / credenciais
// ---------------------------------------------------------------------------

export function issueAttestation(
  contributionId: string,
): Promise<VerityAttestation> {
  return apiFetch<VerityAttestation>("/api/attestations", {
    method: "POST",
    body: JSON.stringify({ contributionId }),
  });
}

/** Visão pública completa: attestation + contribuição + checagem on-chain independente. */
export function getAttestation(id: string): Promise<AttestationPublicView> {
  return apiFetch<AttestationPublicView>(`/api/attestations/${id}`, {
    noStore: true,
  });
}

// ---------------------------------------------------------------------------
// Perfil público / saúde do sistema
// ---------------------------------------------------------------------------

export function getProfile(handle: string): Promise<PublicProfile> {
  return apiFetch<PublicProfile>(`/api/profile/${handle}`, { noStore: true });
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/api/health", { noStore: true });
}
