/**
 * Cliente base sobre `octokit`. Usa `GITHUB_TOKEN` quando presente (maior
 * rate limit), senão cai para a API pública anônima. Erros de rede/HTTP são
 * mapeados para um `GithubApiError` tipado, tratando 403/429 (rate limit) e
 * 404 explicitamente.
 */

import { Octokit } from "octokit";
import { env } from "@/lib/env";
import type { ApiErrorCode } from "@/lib/types";

export class GithubApiError extends Error {
  readonly code: Extract<ApiErrorCode, "RATE_LIMITED" | "NOT_FOUND" | "GITHUB_ERROR">;

  constructor(
    code: GithubApiError["code"],
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GithubApiError";
    this.code = code;
  }
}

let cachedClient: Octokit | null = null;

/** Instância singleton do Octokit, autenticada se `GITHUB_TOKEN` estiver configurado. */
export function getOctokit(): Octokit {
  if (!cachedClient) {
    cachedClient = env.githubToken
      ? new Octokit({ auth: env.githubToken })
      : new Octokit();
  }
  return cachedClient;
}

interface OctokitHttpErrorShape {
  status?: number;
  message?: string;
}

function isOctokitHttpError(error: unknown): error is OctokitHttpErrorShape {
  return typeof error === "object" && error !== null && "status" in error;
}

/** Mapeia qualquer erro do Octokit/fetch para um `GithubApiError` tipado. */
export function mapGithubError(error: unknown): GithubApiError {
  if (error instanceof GithubApiError) return error;

  if (isOctokitHttpError(error)) {
    const status = error.status;
    if (status === 404) {
      return new GithubApiError("NOT_FOUND", "Recurso não encontrado no GitHub.", {
        cause: error,
      });
    }
    if (status === 403 || status === 429) {
      return new GithubApiError(
        "RATE_LIMITED",
        "Limite de requisições da API do GitHub foi atingido.",
        { cause: error },
      );
    }
    return new GithubApiError(
      "GITHUB_ERROR",
      error.message ?? "Erro ao comunicar com o GitHub.",
      { cause: error },
    );
  }

  return new GithubApiError(
    "GITHUB_ERROR",
    "Erro desconhecido ao comunicar com o GitHub.",
    { cause: error },
  );
}

/**
 * Executa `items` através de `fn` com concorrência limitada, para não
 * estourar o rate limit da API do GitHub com chamadas paralelas demais.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await fn(items[currentIndex] as T, currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
