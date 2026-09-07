/**
 * Validação em runtime do payload `raw` (JSON persistido em `Contribution.raw`)
 * antes de rodar as regras do Verification Engine. `raw` chega como
 * `unknown` (JSON.parse de uma coluna de texto). Nunca confiamos nele sem
 * checar a forma primeiro.
 */

import { z } from "zod";

const pullRequestRawSchema = z.object({
  kind: z.literal("pull_request"),
  number: z.number(),
  state: z.enum(["open", "closed"]),
  merged: z.boolean(),
  mergedAt: z.string().nullable(),
  authorLogin: z.string(),
  additions: z.number(),
  deletions: z.number(),
  repoOwner: z.string(),
  repoName: z.string(),
  authorIsRepoOwner: z.boolean(),
});

const commitRawSchema = z.object({
  kind: z.literal("commit"),
  sha: z.string(),
  authorLogin: z.string(),
  authorEmail: z.string().nullable(),
  branch: z.string(),
  defaultBranch: z.string(),
  additions: z.number(),
  deletions: z.number(),
  repoOwner: z.string(),
  repoName: z.string(),
});

const issueRawSchema = z.object({
  kind: z.literal("issue"),
  number: z.number(),
  state: z.enum(["open", "closed"]),
  authorLogin: z.string(),
  repoOwner: z.string(),
  repoName: z.string(),
});

export const contributionRawSchema = z.discriminatedUnion("kind", [
  pullRequestRawSchema,
  commitRawSchema,
  issueRawSchema,
]);

export type ValidatedPullRequestRaw = z.infer<typeof pullRequestRawSchema>;
export type ValidatedCommitRaw = z.infer<typeof commitRawSchema>;
export type ValidatedIssueRaw = z.infer<typeof issueRawSchema>;
