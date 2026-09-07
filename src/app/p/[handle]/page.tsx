import type { ComponentType, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/app/PublicShell";
import {
  IconChevronRight,
  IconCommit,
  IconGithub,
  IconIssue,
  IconPullRequest,
  IconReview,
  IconShieldCheck,
  IconUser,
  IconWallet,
  type IconProps,
} from "@/components/app/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ApiError, getProfile } from "@/lib/api-client";
import type { ContributionType, PublicProfile } from "@/lib/types";
import { formatDate, truncateAddress } from "@/lib/utils";

interface PageProps {
  params: Promise<{ handle: string }>;
}

type ProfileResult =
  | { status: "ok"; profile: PublicProfile }
  | { status: "not_found" }
  | { status: "error"; message: string };

async function loadProfile(handle: string): Promise<ProfileResult> {
  try {
    const profile = await getProfile(handle);
    return { status: "ok", profile };
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === "NOT_FOUND") {
      return { status: "not_found" };
    }
    return {
      status: "error",
      message:
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar este perfil agora.",
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const result = await loadProfile(handle);
  const title =
    result.status === "ok"
      ? `${result.profile.name ?? `@${handle}`} · VERITY`
      : `Perfil @${handle} · VERITY`;
  const description =
    result.status === "ok"
      ? `${result.profile.stats.verifiedCount} contribuição(ões) verificada(s) na Solana: reputação portátil de ${result.profile.name ?? `@${handle}`}.`
      : "Perfil de reputação verificável do VERITY.";

  return {
    title,
    description,
    openGraph: { title, description, images: ["/brand/verity-keyvisual.png"] },
  };
}

const TYPE_ICON: Record<ContributionType, ComponentType<IconProps>> = {
  PULL_REQUEST: IconPullRequest,
  COMMIT: IconCommit,
  ISSUE: IconIssue,
  REVIEW: IconReview,
};

const TYPE_LABEL: Record<ContributionType, string> = {
  PULL_REQUEST: "Pull Request",
  COMMIT: "Commit",
  ISSUE: "Issue",
  REVIEW: "Review",
};

export default async function PublicProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const result = await loadProfile(handle);

  if (result.status === "not_found") {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<IconUser />}
            title={`Perfil @${handle} não encontrado`}
            description="Confira se o link está correto. Perfis públicos só existem depois que a wallet é conectada pela primeira vez."
          />
        </div>
      </PublicShell>
    );
  }

  if (result.status === "error") {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<IconUser />}
            title="Não foi possível carregar este perfil"
            description={result.message}
          />
        </div>
      </PublicShell>
    );
  }

  const { profile } = result;
  const firstAttestationId = profile.verifiedContributions.find(
    (contribution) => contribution.attestation,
  )?.attestation?.id;

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="rounded-card border border-verity-border bg-white p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={profile.name} src={profile.avatarUrl} size={64} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-bold text-verity-ink">
                {profile.name ?? `@${profile.handle}`}
              </h1>
              {profile.headline && (
                <p className="text-sm text-verity-ink-muted">{profile.headline}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-verity-ink-muted">
                {profile.wallet && (
                  <span className="inline-flex items-center gap-1.5">
                    <IconWallet className="h-3.5 w-3.5" />
                    {truncateAddress(profile.wallet)}
                  </span>
                )}
                {profile.githubUsername && (
                  <a
                    href={`https://github.com/${profile.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-input hover:text-verity-primary"
                  >
                    <IconGithub className="h-3.5 w-3.5" />@{profile.githubUsername}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-verity-border pt-5 text-center">
            <StatBlock label="Contribuições" value={profile.stats.totalContributions} />
            <StatBlock label="Verificadas" value={profile.stats.verifiedCount} />
            <StatBlock label="Projetos" value={profile.stats.projectsCount} />
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg font-semibold text-verity-ink">
            Contribuições verificadas
          </h2>

          {profile.verifiedContributions.length === 0 ? (
            <EmptyState
              icon={<IconShieldCheck />}
              title="Nenhuma credencial verificada ainda"
              description="Assim que uma contribuição for verificada e a credencial emitida, ela aparece aqui publicamente."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {profile.verifiedContributions.map((contribution) => {
                const Icon = TYPE_ICON[contribution.type];
                const href = contribution.attestation
                  ? `/verify/${contribution.attestation.id}`
                  : contribution.url;
                return (
                  <li key={contribution.id}>
                    <Link
                      href={href}
                      target={contribution.attestation ? undefined : "_blank"}
                      rel={contribution.attestation ? undefined : "noopener noreferrer"}
                      className="focus-ring flex items-center gap-3 rounded-card border border-verity-border bg-white p-4 transition-colors hover:border-verity-primary/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verity-tint text-verity-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-verity-ink">
                          {contribution.title}
                        </p>
                        <p className="truncate text-xs text-verity-ink-muted">
                          {contribution.repoOwner}/{contribution.repoName} ·{" "}
                          {TYPE_LABEL[contribution.type]} · {formatDate(contribution.occurredAt)}
                        </p>
                      </div>
                      <VerifiedBadge className="hidden sm:inline-flex" />
                      <IconChevronRight className="h-4 w-4 shrink-0 text-verity-ink-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {firstAttestationId && (
          <div className="flex justify-center">
            <Link href={`/verify/${firstAttestationId}`}>
              <Button variant="primary" size="lg">
                Verificar reputação
              </Button>
            </Link>
          </div>
        )}
      </div>
    </PublicShell>
  );
}

function StatBlock({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div>
      <p className="font-display text-xl font-bold text-verity-ink">{value}</p>
      <p className="text-xs text-verity-ink-muted">{label}</p>
    </div>
  );
}
