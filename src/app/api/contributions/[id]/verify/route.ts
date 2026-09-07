/**
 * POST /api/contributions/:id/verify: roda o Verification Engine sobre uma
 * contribuição do usuário da sessão, persiste `status` + `evidence` e
 * devolve a `VerityContribution` atualizada. Rejeita se a contribuição não
 * pertence ao usuário da sessão.
 */

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { verifyContribution } from "@/lib/verification";
import type { ContributionType } from "@/lib/types";
import { HttpError, jsonOk, withErrorHandling } from "@/app/api/_lib/http";
import { serializeContribution } from "@/app/api/_lib/serializers";

function safeParseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const POST = withErrorHandling(async (request, context) => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  const contribution = await db.contribution.findUnique({
    where: { id },
    include: { attestation: true },
  });

  if (!contribution) {
    throw new HttpError("NOT_FOUND", "Contribuição não encontrada.");
  }
  if (contribution.userId !== user.id) {
    throw new HttpError(
      "UNAUTHORIZED",
      "Esta contribuição não pertence ao usuário da sessão atual.",
    );
  }

  const result = verifyContribution(
    {
      type: contribution.type as ContributionType,
      repoOwner: contribution.repoOwner,
      repoName: contribution.repoName,
      raw: safeParseJson(contribution.raw),
    },
    { githubUsername: user.githubUsername },
  );

  const updated = await db.contribution.update({
    where: { id },
    data: { status: result.status, evidence: JSON.stringify(result) },
    include: { attestation: true },
  });

  return jsonOk(serializeContribution(updated));
});
