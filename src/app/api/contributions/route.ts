/**
 * GET /api/contributions?refresh=1: lista as contribuições do usuário da
 * sessão. Com `refresh=1`, busca no GitHub (real ou demo) e faz upsert
 * idempotente respeitando a chave composta única do schema: re-sincronizar
 * nunca duplica nem apaga um status já verificado (o upsert não toca em
 * `status`/`evidence`).
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fetchContributions } from "@/lib/github/contributions";
import type { ContributionStatus, ContributionType } from "@/lib/types";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";
import { serializeContribution } from "@/app/api/_lib/serializers";
import { enforceRateLimit } from "@/app/api/_lib/rateLimit";

const STATUS_VALUES: readonly ContributionStatus[] = ["PENDING", "VERIFIED", "REJECTED"];
const TYPE_VALUES: readonly ContributionType[] = [
  "PULL_REQUEST",
  "COMMIT",
  "ISSUE",
  "REVIEW",
];

const querySchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((value) => value === "1" || value === "true"),
  status: z.enum(STATUS_VALUES as [ContributionStatus, ...ContributionStatus[]]).optional(),
  type: z.enum(TYPE_VALUES as [ContributionType, ...ContributionType[]]).optional(),
  repo: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
});

export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }

  const url = new URL(request.url);
  const filters = querySchema.parse({
    refresh: url.searchParams.get("refresh") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    repo: url.searchParams.get("repo") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  if (filters.refresh && user.githubUsername) {
    // Em modo demo `fetchContributions` não sai para a rede, mas fora do
    // modo demo esta rota chama a API real do GitHub por trás de
    // `refresh=1`. Limite conservador por IP para não deixar um único
    // cliente esgotar a cota anônima compartilhada por toda a aplicação.
    enforceRateLimit(request, "contributions-refresh", 10, 5 * 60 * 1000);
    const { contributions } = await fetchContributions(user.githubUsername);
    for (const contribution of contributions) {
      await db.contribution.upsert({
        where: {
          userId_source_repoOwner_repoName_type_externalId: {
            userId: user.id,
            source: contribution.source,
            repoOwner: contribution.repoOwner,
            repoName: contribution.repoName,
            type: contribution.type,
            externalId: contribution.externalId,
          },
        },
        update: {
          title: contribution.title,
          url: contribution.url,
          occurredAt: new Date(contribution.occurredAt),
          raw: JSON.stringify(contribution.raw),
        },
        create: {
          userId: user.id,
          source: contribution.source,
          repoOwner: contribution.repoOwner,
          repoName: contribution.repoName,
          type: contribution.type,
          externalId: contribution.externalId,
          title: contribution.title,
          url: contribution.url,
          occurredAt: new Date(contribution.occurredAt),
          raw: JSON.stringify(contribution.raw),
          status: "PENDING",
        },
      });
    }
  }

  const repoFilter = filters.repo?.includes("/") ? filters.repo.split("/") : null;

  const records = await db.contribution.findMany({
    where: {
      userId: user.id,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(repoFilter
        ? { repoOwner: repoFilter[0], repoName: repoFilter[1] }
        : filters.repo
          ? { repoName: filters.repo }
          : {}),
      ...(filters.search ? { title: { contains: filters.search } } : {}),
    },
    include: { attestation: true },
    orderBy: { occurredAt: "desc" },
  });

  return jsonOk(records.map(serializeContribution));
});
