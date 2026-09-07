/**
 * Dataset determinístico de demonstração: o coração do "zero-setup".
 *
 * Persona: Emanuelly (handle `emanuelly`), estudante de Engenharia de
 * Software. Contribuições plausíveis em projetos open source conhecidos,
 * com datas relativas a hoje, sem `Math.random()`: mesma entrada, mesma
 * saída. Um dos PRs fica propositalmente aberto (não merged) para que a
 * régua de verificação mostre uma rejeição real na demo.
 *
 * Produz o mesmo formato normalizado (`NormalizedContribution`) que
 * `src/lib/github/contributions.ts` produziria a partir da API real, para
 * que o resto do sistema não saiba a diferença.
 */

import type {
  CommitRaw,
  IssueRaw,
  NormalizedContribution,
  PullRequestRaw,
} from "@/lib/github/types";

export const DEMO_USER = {
  handle: "emanuelly",
  githubUsername: "emanuelly",
  name: "Emanuelly",
  headline: "Estudante de Engenharia de Software",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
  /**
   * Endereço devnet dedicado à persona de demonstração (sem chave privada
   * guardada em lugar nenhum do repositório: só a chave pública é usada,
   * como sujeito da credencial). Gerado uma vez com `solana-keygen new`.
   */
  wallet: "87iNCozKxZ4sB3XjFwyPZEa1K5x4iezC9QxrJdhP4uge",
} as const;

/** Data determinística: `daysAgo` dias antes de hoje, sempre ao meio-dia UTC. */
function isoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

interface DemoPullRequestSeed {
  repoOwner: string;
  repoName: string;
  number: number;
  title: string;
  daysAgo: number;
  state: "open" | "closed";
  merged: boolean;
  additions: number;
  deletions: number;
}

interface DemoCommitSeed {
  repoOwner: string;
  repoName: string;
  sha: string;
  title: string;
  daysAgo: number;
  branch: string;
  defaultBranch: string;
  additions: number;
  deletions: number;
}

interface DemoIssueSeed {
  repoOwner: string;
  repoName: string;
  number: number;
  title: string;
  daysAgo: number;
  state: "open" | "closed";
}

const PULL_REQUESTS: DemoPullRequestSeed[] = [
  {
    repoOwner: "facebook",
    repoName: "react",
    number: 28451,
    title: "docs: fix stale closure example in useEffect guide",
    daysAgo: 62,
    state: "closed",
    merged: true,
    additions: 12,
    deletions: 4,
  },
  {
    repoOwner: "vercel",
    repoName: "next.js",
    number: 61890,
    title: "docs: clarify dynamic route matching for catch-all segments",
    daysAgo: 45,
    state: "closed",
    merged: true,
    additions: 8,
    deletions: 2,
  },
  {
    repoOwner: "prisma",
    repoName: "prisma",
    number: 23150,
    title: "fix(client): correct type inference for nested include on SQLite",
    daysAgo: 30,
    state: "closed",
    merged: true,
    additions: 34,
    deletions: 6,
  },
  {
    repoOwner: "microsoft",
    repoName: "TypeScript",
    number: 56780,
    title: "fix: improve error message for excess property check on unions",
    daysAgo: 15,
    state: "closed",
    merged: true,
    additions: 22,
    deletions: 5,
  },
  {
    repoOwner: "tailwindlabs",
    repoName: "tailwindcss",
    number: 14200,
    title: "feat: add container query variant helper",
    daysAgo: 5,
    state: "open",
    merged: false,
    additions: 51,
    deletions: 3,
  },
];

const COMMITS: DemoCommitSeed[] = [
  {
    repoOwner: "microsoft",
    repoName: "vscode",
    sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
    title: "Fix off-by-one error in terminal scrollback buffer",
    daysAgo: 20,
    branch: "main",
    defaultBranch: "main",
    additions: 6,
    deletions: 2,
  },
];

const ISSUES: DemoIssueSeed[] = [
  {
    repoOwner: "nodejs",
    repoName: "node",
    number: 50233,
    title:
      "Unexpected behavior in fs.promises.readdir with withFileTypes on large directories",
    daysAgo: 90,
    state: "closed",
  },
];

/**
 * Retorna o dataset de demonstração normalizado, atribuindo `githubUsername`
 * como autor de todas as contribuições (para que as regras de autoria
 * passem nas que devem passar).
 */
export function getDemoContributions(
  githubUsername: string,
): NormalizedContribution[] {
  const username = githubUsername.trim() || DEMO_USER.githubUsername;

  const prContributions: NormalizedContribution[] = PULL_REQUESTS.map(
    (seed): NormalizedContribution => {
      const raw: PullRequestRaw = {
        kind: "pull_request",
        number: seed.number,
        state: seed.state,
        merged: seed.merged,
        mergedAt: seed.merged ? isoDaysAgo(seed.daysAgo - 1) : null,
        authorLogin: username,
        additions: seed.additions,
        deletions: seed.deletions,
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
        authorIsRepoOwner: false,
      };
      return {
        source: "github",
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
        type: "PULL_REQUEST",
        externalId: String(seed.number),
        title: seed.title,
        url: `https://github.com/${seed.repoOwner}/${seed.repoName}/pull/${seed.number}`,
        occurredAt: isoDaysAgo(seed.daysAgo),
        raw,
      };
    },
  );

  const commitContributions: NormalizedContribution[] = COMMITS.map(
    (seed): NormalizedContribution => {
      const raw: CommitRaw = {
        kind: "commit",
        sha: seed.sha,
        authorLogin: username,
        authorEmail: null,
        branch: seed.branch,
        defaultBranch: seed.defaultBranch,
        additions: seed.additions,
        deletions: seed.deletions,
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
      };
      return {
        source: "github",
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
        type: "COMMIT",
        externalId: seed.sha,
        title: seed.title,
        url: `https://github.com/${seed.repoOwner}/${seed.repoName}/commit/${seed.sha}`,
        occurredAt: isoDaysAgo(seed.daysAgo),
        raw,
      };
    },
  );

  const issueContributions: NormalizedContribution[] = ISSUES.map(
    (seed): NormalizedContribution => {
      const raw: IssueRaw = {
        kind: "issue",
        number: seed.number,
        state: seed.state,
        authorLogin: username,
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
      };
      return {
        source: "github",
        repoOwner: seed.repoOwner,
        repoName: seed.repoName,
        type: "ISSUE",
        externalId: String(seed.number),
        title: seed.title,
        url: `https://github.com/${seed.repoOwner}/${seed.repoName}/issues/${seed.number}`,
        occurredAt: isoDaysAgo(seed.daysAgo),
        raw,
      };
    },
  );

  return [...prContributions, ...commitContributions, ...issueContributions].sort(
    (a, b) => (a.occurredAt < b.occurredAt ? 1 : -1),
  );
}
