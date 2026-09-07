/**
 * Verification Engine — orquestra as regras puras de `rules.ts` sobre uma
 * contribuição e devolve um `VerificationResult` determinístico (mesma
 * entrada, mesma saída). A contribuição só vira `VERIFIED` se todas as
 * regras bloqueantes (weight !== 0) passarem.
 */

import type {
  ContributionStatus,
  ContributionType,
  VerificationResult,
  VerificationRuleResult,
} from "@/lib/types";
import { sha256Hex } from "@/lib/utils";
import { contributionRawSchema } from "./schemas";
import {
  commitAuthorMatch,
  commitHasContent,
  commitOnDefaultBranch,
  commitRepoMatch,
  issueAuthorMatch,
  issueIsClosed,
  issueRepoMatch,
  prAuthorMatch,
  prHasContent,
  prIsMerged,
  prNotSelfMergedForkOnly,
  prRepoMatch,
} from "./rules";

export interface VerifiableContribution {
  type: ContributionType;
  repoOwner: string;
  repoName: string;
  /** JSON já parseado (não a string bruta da coluna do banco). */
  raw: Record<string, unknown> | null;
}

export interface VerifiableUser {
  githubUsername: string | null;
}

/** Serialização estável (chaves ordenadas) — `JSON.stringify` não garante ordem. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(",")}}`;
}

function singleRuleResult(
  status: ContributionStatus,
  rule: VerificationRuleResult,
  evaluatedAt: string,
  contribution: VerifiableContribution,
): VerificationResult {
  return buildResult(status, [rule], evaluatedAt, contribution);
}

function buildResult(
  status: ContributionStatus,
  rules: VerificationRuleResult[],
  evaluatedAt: string,
  contribution: VerifiableContribution,
): VerificationResult {
  const snapshot = {
    status,
    type: contribution.type,
    repoOwner: contribution.repoOwner,
    repoName: contribution.repoName,
    evaluatedAt,
    rules: rules.map((rule) => ({
      id: rule.id,
      passed: rule.passed,
      weight: rule.weight ?? 1,
    })),
  };
  const evidenceHash = sha256Hex(stableStringify(snapshot));
  return { status, rules, evaluatedAt, evidenceHash };
}

/**
 * Roda o Verification Engine sobre uma contribuição e devolve o resultado
 * completo (regras + hash de evidência). Não faz I/O — persistir o
 * resultado é responsabilidade de quem chama.
 */
export function verifyContribution(
  contribution: VerifiableContribution,
  user: VerifiableUser,
): VerificationResult {
  const evaluatedAt = new Date().toISOString();

  if (!user.githubUsername) {
    return singleRuleResult(
      "REJECTED",
      {
        id: "github_linked",
        label: "GitHub vinculado",
        passed: false,
        detail: "Nenhuma conta do GitHub está vinculada a este usuário.",
      },
      evaluatedAt,
      contribution,
    );
  }

  const parsedRaw = contributionRawSchema.safeParse(contribution.raw);
  if (!parsedRaw.success) {
    return singleRuleResult(
      "REJECTED",
      {
        id: "data_integrity",
        label: "Dados íntegros",
        passed: false,
        detail:
          "Dados brutos desta contribuição estão ausentes ou incompletos para verificação.",
      },
      evaluatedAt,
      contribution,
    );
  }

  const raw = parsedRaw.data;
  const base = {
    githubUsername: user.githubUsername,
    repoOwner: contribution.repoOwner,
    repoName: contribution.repoName,
  };

  let rules: VerificationRuleResult[];

  if (contribution.type === "PULL_REQUEST" && raw.kind === "pull_request") {
    const ctx = { ...base, raw };
    rules = [
      prAuthorMatch(ctx),
      prRepoMatch(ctx),
      prIsMerged(ctx),
      prNotSelfMergedForkOnly(ctx),
      prHasContent(ctx),
    ];
  } else if (contribution.type === "COMMIT" && raw.kind === "commit") {
    const ctx = { ...base, raw };
    rules = [
      commitAuthorMatch(ctx),
      commitRepoMatch(ctx),
      commitOnDefaultBranch(ctx),
      commitHasContent(ctx),
    ];
  } else if (contribution.type === "ISSUE" && raw.kind === "issue") {
    const ctx = { ...base, raw };
    rules = [issueAuthorMatch(ctx), issueRepoMatch(ctx), issueIsClosed(ctx)];
  } else {
    rules = [
      {
        id: "supported_type",
        label: "Tipo suportado",
        passed: false,
        detail: `Contribuições do tipo "${contribution.type}" ainda não têm regras de verificação definidas.`,
      },
    ];
  }

  const blockingRules = rules.filter((rule) => (rule.weight ?? 1) !== 0);
  const status: ContributionStatus = blockingRules.every((rule) => rule.passed)
    ? "VERIFIED"
    : "REJECTED";

  return buildResult(status, rules, evaluatedAt, contribution);
}
