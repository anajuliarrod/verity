/**
 * Regras do Verification Engine (seção 5 do VERITY_BRIEF.md). Cada regra é
 * uma função pura, sem I/O: `(ctx) => VerificationRuleResult`. Nenhuma regra
 * chama rede ou banco — todo dado necessário já está em `RuleContext`.
 */

import type { VerificationRuleResult } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import type {
  ValidatedCommitRaw,
  ValidatedIssueRaw,
  ValidatedPullRequestRaw,
} from "./schemas";

export interface RuleContext<TRaw> {
  raw: TRaw;
  githubUsername: string;
  repoOwner: string;
  repoName: string;
}

export type Rule<TRaw> = (ctx: RuleContext<TRaw>) => VerificationRuleResult;

function sameLogin(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sameRepo(
  raw: { repoOwner: string; repoName: string },
  declared: { repoOwner: string; repoName: string },
): boolean {
  return (
    sameLogin(raw.repoOwner, declared.repoOwner) &&
    sameLogin(raw.repoName, declared.repoName)
  );
}

// ---------------------------------------------------------------------------
// PULL_REQUEST
// ---------------------------------------------------------------------------

export const prAuthorMatch: Rule<ValidatedPullRequestRaw> = (ctx) => {
  const passed = sameLogin(ctx.raw.authorLogin, ctx.githubUsername);
  return {
    id: "author_match",
    label: "Autoria confirmada",
    passed,
    detail: passed
      ? `O PR #${ctx.raw.number} foi aberto por @${ctx.raw.authorLogin}, o mesmo GitHub vinculado à conta.`
      : `O PR #${ctx.raw.number} foi aberto por @${ctx.raw.authorLogin}, que não corresponde ao GitHub vinculado (@${ctx.githubUsername}).`,
  };
};

export const prRepoMatch: Rule<ValidatedPullRequestRaw> = (ctx) => {
  const passed = sameRepo(ctx.raw, ctx);
  return {
    id: "repo_match",
    label: "Repositório confirmado",
    passed,
    detail: passed
      ? `O PR pertence ao repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`
      : `O PR pertence a ${ctx.raw.repoOwner}/${ctx.raw.repoName}, diferente do repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`,
  };
};

export const prIsMerged: Rule<ValidatedPullRequestRaw> = (ctx) => {
  const passed = ctx.raw.merged && ctx.raw.mergedAt !== null;
  return {
    id: "is_merged",
    label: "Pull Request mergeado",
    passed,
    detail: passed
      ? `PR #${ctx.raw.number} foi mergeado em ${formatDate(ctx.raw.mergedAt as string)}.`
      : `Este PR ainda está ${ctx.raw.state === "open" ? "aberto" : "fechado sem merge"}, não pode ser credenciado.`,
  };
};

/** Informativa: não bloqueia (weight 0). Sinaliza contribuição externa genuína. */
export const prNotSelfMergedForkOnly: Rule<ValidatedPullRequestRaw> = (ctx) => {
  const passed = !ctx.raw.authorIsRepoOwner;
  return {
    id: "not_self_merged_fork_only",
    label: "Contribuição externa",
    passed,
    weight: 0,
    detail: passed
      ? `PR feito em ${ctx.repoOwner}/${ctx.repoName}, um repositório que não é do próprio autor.`
      : `PR feito no próprio repositório do autor (${ctx.repoOwner}/${ctx.repoName}) — sinal informativo, não bloqueia a verificação.`,
  };
};

export const prHasContent: Rule<ValidatedPullRequestRaw> = (ctx) => {
  const total = ctx.raw.additions + ctx.raw.deletions;
  const passed = total > 0;
  return {
    id: "has_content",
    label: "Conteúdo alterado",
    passed,
    detail: passed
      ? `PR #${ctx.raw.number} alterou ${ctx.raw.additions} linhas adicionadas e ${ctx.raw.deletions} removidas.`
      : `PR #${ctx.raw.number} não apresenta alterações de conteúdo (0 linhas adicionadas ou removidas).`,
  };
};

// ---------------------------------------------------------------------------
// COMMIT
// ---------------------------------------------------------------------------

export const commitAuthorMatch: Rule<ValidatedCommitRaw> = (ctx) => {
  const passed = sameLogin(ctx.raw.authorLogin, ctx.githubUsername);
  return {
    id: "author_match",
    label: "Autoria confirmada",
    passed,
    detail: passed
      ? `Commit ${ctx.raw.sha.slice(0, 7)} feito por @${ctx.raw.authorLogin}, o mesmo GitHub vinculado à conta.`
      : `Commit ${ctx.raw.sha.slice(0, 7)} foi feito por @${ctx.raw.authorLogin}, que não corresponde ao GitHub vinculado (@${ctx.githubUsername}).`,
  };
};

export const commitRepoMatch: Rule<ValidatedCommitRaw> = (ctx) => {
  const passed = sameRepo(ctx.raw, ctx);
  return {
    id: "repo_match",
    label: "Repositório confirmado",
    passed,
    detail: passed
      ? `O commit pertence ao repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`
      : `O commit pertence a ${ctx.raw.repoOwner}/${ctx.raw.repoName}, diferente do repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`,
  };
};

export const commitOnDefaultBranch: Rule<ValidatedCommitRaw> = (ctx) => {
  const passed = sameLogin(ctx.raw.branch, ctx.raw.defaultBranch);
  return {
    id: "on_default_branch",
    label: "Branch padrão",
    passed,
    detail: passed
      ? `Commit está na branch padrão do repositório (${ctx.raw.defaultBranch}).`
      : `Commit está na branch "${ctx.raw.branch}", diferente da branch padrão "${ctx.raw.defaultBranch}".`,
  };
};

export const commitHasContent: Rule<ValidatedCommitRaw> = (ctx) => {
  const total = ctx.raw.additions + ctx.raw.deletions;
  const passed = total > 0;
  return {
    id: "has_content",
    label: "Conteúdo alterado",
    passed,
    detail: passed
      ? `Commit alterou ${ctx.raw.additions} linhas adicionadas e ${ctx.raw.deletions} removidas.`
      : `Commit não apresenta alterações de conteúdo (0 linhas adicionadas ou removidas).`,
  };
};

// ---------------------------------------------------------------------------
// ISSUE
// ---------------------------------------------------------------------------

export const issueAuthorMatch: Rule<ValidatedIssueRaw> = (ctx) => {
  const passed = sameLogin(ctx.raw.authorLogin, ctx.githubUsername);
  return {
    id: "author_match",
    label: "Autoria confirmada",
    passed,
    detail: passed
      ? `A issue #${ctx.raw.number} foi aberta por @${ctx.raw.authorLogin}, o mesmo GitHub vinculado à conta.`
      : `A issue #${ctx.raw.number} foi aberta por @${ctx.raw.authorLogin}, que não corresponde ao GitHub vinculado (@${ctx.githubUsername}).`,
  };
};

export const issueRepoMatch: Rule<ValidatedIssueRaw> = (ctx) => {
  const passed = sameRepo(ctx.raw, ctx);
  return {
    id: "repo_match",
    label: "Repositório confirmado",
    passed,
    detail: passed
      ? `A issue pertence ao repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`
      : `A issue pertence a ${ctx.raw.repoOwner}/${ctx.raw.repoName}, diferente do repositório declarado ${ctx.repoOwner}/${ctx.repoName}.`,
  };
};

export const issueIsClosed: Rule<ValidatedIssueRaw> = (ctx) => {
  const passed = ctx.raw.state === "closed";
  return {
    id: "is_closed",
    label: "Issue fechada",
    passed,
    detail: passed
      ? `Issue #${ctx.raw.number} está fechada.`
      : `Issue #${ctx.raw.number} ainda está aberta, não pode ser credenciada.`,
  };
};
