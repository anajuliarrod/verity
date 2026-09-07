/**
 * GET /api/profile/:handle — perfil público de reputação. Sem sessão. Só
 * expõe contribuições com status `VERIFIED` (com suas attestations) e
 * nenhum dado sensível.
 */

import { db } from "@/lib/db";
import type { PublicProfile } from "@/lib/types";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";
import { serializeContribution } from "@/app/api/_lib/serializers";

export const GET = withErrorHandling(async (_request, context) => {
  const { params } = context as { params: Promise<{ handle: string }> };
  const { handle } = await params;

  const user = await db.user.findUnique({ where: { handle } });
  if (!user) {
    throw new HttpError("NOT_FOUND", "Perfil não encontrado.");
  }

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

  const profile: PublicProfile = {
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

  return jsonOk(profile);
});
