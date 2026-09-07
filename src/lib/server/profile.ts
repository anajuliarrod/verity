/**
 * Montagem do perfil público de reputação, direto da camada de dados.
 *
 * Extraído de `GET /api/profile/:handle` para que a página
 * `src/app/p/[handle]/page.tsx` (um Server Component) possa buscar os
 * mesmos dados sem dar a volta desnecessária de chamar a própria API por
 * HTTP. A rota de API continua existindo e chama esta mesma função: o
 * comportamento observável de `GET /api/profile/:handle` não muda.
 *
 * Só expõe contribuições com status `VERIFIED` (com suas attestations) e
 * nenhum dado sensível, igual à rota original.
 */

import { db } from "@/lib/db";
import type { PublicProfile } from "@/lib/types";
import { serializeContribution } from "@/app/api/_lib/serializers";

/** Retorna `null` quando não existe usuário com este handle. */
export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  const user = await db.user.findUnique({ where: { handle } });
  if (!user) return null;

  const [totalContributions, verifiedRecords] = await Promise.all([
    db.contribution.count({ where: { userId: user.id } }),
    db.contribution.findMany({
      where: { userId: user.id, status: "VERIFIED" },
      include: { attestation: true },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const verifiedContributions = verifiedRecords.map(serializeContribution);
  const projectsCount = new Set(
    verifiedRecords.map((record) => `${record.repoOwner}/${record.repoName}`),
  ).size;

  return {
    handle: user.handle,
    name: user.name,
    headline: user.headline,
    avatarUrl: user.avatarUrl,
    wallet: user.wallet,
    githubUsername: user.githubUsername,
    verifiedContributions,
    stats: {
      totalContributions,
      verifiedCount: verifiedContributions.length,
      projectsCount,
    },
  };
}
