/**
 * Rate limit simples em memória, por IP, para as rotas que chamam a API
 * pública do GitHub (`/api/auth/github/link`, e `/api/contributions` quando
 * `refresh=1` sai do modo demo). Sem dependência nova.
 *
 * Importante: isso NÃO é um rate limit distribuído. Cada instância
 * serverless da Vercel tem sua própria memória, então o limite real em
 * produção é "N requisições por IP por instância quente", não um limite
 * global. Ainda assim, é uma proteção simples e sem custo contra abuso
 * casual (ex.: um script que chama a rota em loop), o suficiente para o
 * volume de um protótipo de ideathon. Para um limite real e distribuído,
 * seria necessário um store compartilhado (ex. Upstash Redis), fora de
 * escopo aqui por exigir uma dependência/infra nova.
 */

import { HttpError } from "@/app/api/_lib/http";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Evita crescimento ilimitado do Map em uma instância de vida longa. */
function pruneExpired(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Lança `HttpError("RATE_LIMITED", ...)` (-> HTTP 429) se o IP do request
 * exceder `limit` chamadas em `windowMs` para a `scope` informada.
 */
export function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): void {
  const now = Date.now();
  pruneExpired(now);

  const key = `${scope}:${clientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new HttpError(
      "RATE_LIMITED",
      "Muitas requisições em pouco tempo. Aguarde alguns minutos e tente novamente.",
    );
  }

  bucket.count += 1;
}
