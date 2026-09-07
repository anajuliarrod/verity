/**
 * Busca e normaliza contribuições reais do GitHub: PRs e issues via
 * `/search/issues`, commits via `/users/{username}/events/public`
 * (PushEvent). Guarda o payload bruto relevante em `raw` para o
 * Verification Engine.
 *
 * Fallback: em modo demo, ou se a chamada real falhar (rate limit, erro de
 * rede), cai para `getDemoContributions()` e marca a origem — nunca deixa a
 * tela quebrar.
 */

import { isDemoMode } from "@/lib/env";
import { getDemoContributions } from "@/lib/demo";
import type {
  CommitRaw,
  IssueRaw,
  NormalizedContribution,
  PullRequestRaw,
} from "@/lib/github/types";
import { GithubApiError, getOctokit, mapGithubError, mapWithConcurrency } from "./client";

export type ContributionSourceOrigin = "live" | "demo";

export interface FetchContributionsResult {
  contributions: NormalizedContribution[];
  origin: ContributionSourceOrigin;
  warning: string | null;
}

interface SearchIssueItem {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  repository_url: string;
  user: { login: string } | null;
  created_at: string;
  pull_request?: { merged_at?: string | null } | undefined;
}

interface PublicEventCommit {
  sha: string;
  message: string;
  author?: { name?: string; email?: string } | null;
}

interface PublicEvent {
  type: string;
  created_at: string;
  repo: { name: string };
  payload: { ref?: string; commits?: PublicEventCommit[] };
}

function parseRepoFromApiUrl(repositoryUrl: string): { owner: string; name: string } {
  const parts = repositoryUrl.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  const owner = parts.pop() ?? "";
  return { owner, name };
}

async function fetchPullRequestDetail(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<{ mergedAt: string | null; additions: number; deletions: number } | null> {
  try {
    const octokit = getOctokit();
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner, repo, pull_number: pullNumber },
    );
    return {
      mergedAt: response.data.merged_at,
      additions: response.data.additions,
      deletions: response.data.deletions,
    };
  } catch {
    // Degrada por item: um PR sem detalhe não deve derrubar a busca inteira.
    return null;
  }
}

async function searchPullRequests(username: string): Promise<NormalizedContribution[]> {
  const octokit = getOctokit();
  const response = await octokit.request("GET /search/issues", {
    q: `author:${username} type:pr`,
    per_page: 15,
    sort: "created",
    order: "desc",
  });
  const items = response.data.items as unknown as SearchIssueItem[];

  return mapWithConcurrency(items, 3, async (item): Promise<NormalizedContribution> => {
    const { owner, name } = parseRepoFromApiUrl(item.repository_url);
    const detail = await fetchPullRequestDetail(owner, name, item.number);
    const authorLogin = item.user?.login ?? username;
    const mergedAt = detail?.mergedAt ?? item.pull_request?.merged_at ?? null;

    const raw: PullRequestRaw = {
      kind: "pull_request",
      number: item.number,
      state: item.state,
      merged: mergedAt !== null,
      mergedAt,
      authorLogin,
      additions: detail?.additions ?? 0,
      deletions: detail?.deletions ?? 0,
      repoOwner: owner,
      repoName: name,
      authorIsRepoOwner: owner.toLowerCase() === authorLogin.toLowerCase(),
    };

    return {
      source: "github",
      repoOwner: owner,
      repoName: name,
      type: "PULL_REQUEST",
      externalId: String(item.number),
      title: item.title,
      url: item.html_url,
      occurredAt: item.created_at,
      raw,
    };
  });
}

async function searchIssues(username: string): Promise<NormalizedContribution[]> {
  const octokit = getOctokit();
  const response = await octokit.request("GET /search/issues", {
    q: `author:${username} type:issue`,
    per_page: 15,
    sort: "created",
    order: "desc",
  });
  const items = response.data.items as unknown as SearchIssueItem[];

  return items.map((item): NormalizedContribution => {
    const { owner, name } = parseRepoFromApiUrl(item.repository_url);
    const raw: IssueRaw = {
      kind: "issue",
      number: item.number,
      state: item.state,
      authorLogin: item.user?.login ?? username,
      repoOwner: owner,
      repoName: name,
    };
    return {
      source: "github",
      repoOwner: owner,
      repoName: name,
      type: "ISSUE",
      externalId: String(item.number),
      title: item.title,
      url: item.html_url,
      occurredAt: item.created_at,
      raw,
    };
  });
}

async function resolveDefaultBranch(
  owner: string,
  repo: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = `${owner}/${repo}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const octokit = getOctokit();
    const response = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    const defaultBranch = response.data.default_branch || "main";
    cache.set(key, defaultBranch);
    return defaultBranch;
  } catch {
    return "main";
  }
}

async function fetchCommitStats(
  owner: string,
  repo: string,
  sha: string,
): Promise<{ additions: number; deletions: number } | null> {
  try {
    const octokit = getOctokit();
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/commits/{ref}",
      { owner, repo, ref: sha },
    );
    return {
      additions: response.data.stats?.additions ?? 0,
      deletions: response.data.stats?.deletions ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchRecentCommits(username: string): Promise<NormalizedContribution[]> {
  const octokit = getOctokit();
  const response = await octokit.request("GET /users/{username}/events/public", {
    username,
    per_page: 30,
  });
  const events = response.data as unknown as PublicEvent[];
  const pushEvents = events.filter((event) => event.type === "PushEvent").slice(0, 8);
  const defaultBranchCache = new Map<string, string>();

  const results = await mapWithConcurrency(
    pushEvents,
    3,
    async (event): Promise<NormalizedContribution | null> => {
      const [owner, name] = event.repo.name.split("/");
      const commit = event.payload.commits?.[event.payload.commits.length - 1];
      if (!commit || !owner || !name) return null;

      const branch = event.payload.ref?.replace("refs/heads/", "") ?? "main";
      const [defaultBranch, stats] = await Promise.all([
        resolveDefaultBranch(owner, name, defaultBranchCache),
        fetchCommitStats(owner, name, commit.sha),
      ]);

      const raw: CommitRaw = {
        kind: "commit",
        sha: commit.sha,
        authorLogin: username,
        authorEmail: commit.author?.email ?? null,
        branch,
        defaultBranch,
        additions: stats?.additions ?? 0,
        deletions: stats?.deletions ?? 0,
        repoOwner: owner,
        repoName: name,
      };

      return {
        source: "github",
        repoOwner: owner,
        repoName: name,
        type: "COMMIT",
        externalId: commit.sha,
        title: commit.message.split("\n")[0] || commit.sha,
        url: `https://github.com/${owner}/${name}/commit/${commit.sha}`,
        occurredAt: event.created_at,
        raw,
      };
    },
  );

  return results.filter((item): item is NormalizedContribution => item !== null);
}

async function fetchLiveContributions(username: string): Promise<NormalizedContribution[]> {
  try {
    const [pullRequests, issues, commits] = await Promise.all([
      searchPullRequests(username),
      searchIssues(username),
      fetchRecentCommits(username),
    ]);
    return [...pullRequests, ...issues, ...commits].sort((a, b) =>
      a.occurredAt < b.occurredAt ? 1 : -1,
    );
  } catch (error) {
    throw mapGithubError(error);
  }
}

/**
 * Ponto de entrada único: busca contribuições reais do GitHub, com fallback
 * automático e transparente para o dataset de demonstração.
 */
export async function fetchContributions(
  username: string,
): Promise<FetchContributionsResult> {
  if (isDemoMode) {
    return { contributions: getDemoContributions(username), origin: "demo", warning: null };
  }

  try {
    const contributions = await fetchLiveContributions(username);
    return { contributions, origin: "live", warning: null };
  } catch (error) {
    const mapped = error instanceof GithubApiError ? error : mapGithubError(error);
    const warning =
      mapped.code === "RATE_LIMITED"
        ? "Limite de requisições do GitHub atingido — exibindo dados de demonstração."
        : mapped.code === "NOT_FOUND"
          ? "Usuário do GitHub não encontrado — exibindo dados de demonstração."
          : "Não foi possível buscar contribuições reais do GitHub — exibindo dados de demonstração.";
    return { contributions: getDemoContributions(username), origin: "demo", warning };
  }
}
