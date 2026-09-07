/**
 * Formato normalizado interno de contribuições vindas do GitHub (real ou
 * demo). Não faz parte do contrato compartilhado em `src/lib/types.ts`
 * (que é o DTO já persistido/exposto pela API). Este é o formato
 * pré-persistência produzido tanto pelo cliente GitHub real quanto pelo
 * dataset determinístico de demonstração, para que o resto do sistema não
 * saiba a diferença entre as duas origens.
 *
 * `raw` segue um formato discriminado por `kind`, consumido pelo
 * Verification Engine (`src/lib/verification/`).
 */

import type { ContributionType } from "@/lib/types";

export interface PullRequestRaw {
  kind: "pull_request";
  number: number;
  state: "open" | "closed";
  merged: boolean;
  mergedAt: string | null;
  authorLogin: string;
  additions: number;
  deletions: number;
  repoOwner: string;
  repoName: string;
  /** true quando o PR foi aberto no próprio repositório do autor (não é uma contribuição externa). */
  authorIsRepoOwner: boolean;
}

export interface CommitRaw {
  kind: "commit";
  sha: string;
  authorLogin: string;
  authorEmail: string | null;
  branch: string;
  defaultBranch: string;
  additions: number;
  deletions: number;
  repoOwner: string;
  repoName: string;
}

export interface IssueRaw {
  kind: "issue";
  number: number;
  state: "open" | "closed";
  authorLogin: string;
  repoOwner: string;
  repoName: string;
}

export type ContributionRaw = PullRequestRaw | CommitRaw | IssueRaw;

/** Contribuição já normalizada, pronta para upsert no banco. */
export interface NormalizedContribution {
  source: "github";
  repoOwner: string;
  repoName: string;
  type: ContributionType;
  externalId: string;
  title: string;
  url: string;
  /** ISO 8601 */
  occurredAt: string;
  raw: ContributionRaw;
}
