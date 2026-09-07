"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ContributionRow } from "@/components/app/ContributionRow";
import { GithubLinkCard } from "@/components/app/GithubLinkCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StepFlow, type StepFlowStep } from "@/components/app/StepFlow";
import { useHealth } from "@/components/app/useHealth";
import { useVerityProgress } from "@/components/app/useVerityProgress";
import { useWalletAddress } from "@/components/app/useWalletAddress";
import { IconGitBranch, IconShieldCheck, IconUser } from "@/components/app/icons";
import { ConnectWalletButton, WalletBadge } from "@/components/wallet";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  ApiError,
  getContributions,
  issueAttestation,
  linkWallet,
  verifyContribution,
} from "@/lib/api-client";
import type { StepId, VerityContribution, VerityUser } from "@/lib/types";

function publicProfileUrl(handle: string): string {
  if (typeof window === "undefined") return `/p/${handle}`;
  return `${window.location.origin}/p/${handle}`;
}

export default function DashboardPage() {
  useDocumentTitle("Perfil");

  const router = useRouter();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { address, connected } = useWalletAddress();
  const { health } = useHealth();
  const { toast } = useToast();

  const [user, setUser] = useState<VerityUser | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const linkedAddressRef = useRef<string | null>(null);

  const [contributions, setContributions] = useState<VerityContribution[] | null>(null);
  const [contribLoading, setContribLoading] = useState(false);
  const [contribError, setContribError] = useState<string | null>(null);

  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [issuingIds, setIssuingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!address || linkedAddressRef.current === address) return;
    linkedAddressRef.current = address;
    setUserLoading(true);
    setUserError(null);
    linkWallet(address)
      .then(setUser)
      .catch((cause: unknown) => {
        setUserError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível associar sua wallet agora.",
        );
      })
      .finally(() => setUserLoading(false));
  }, [address]);

  useEffect(() => {
    if (!user) return;
    setContribLoading(true);
    setContribError(null);
    getContributions()
      .then(setContributions)
      .catch((cause: unknown) => {
        setContribError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar suas contribuições agora.",
        );
      })
      .finally(() => setContribLoading(false));
  }, [user]);

  async function handleVerify(id: string) {
    setVerifyingIds((current) => new Set(current).add(id));
    try {
      const updated = await verifyContribution(id);
      setContributions((current) => current?.map((c) => (c.id === id ? updated : c)) ?? current);
      toast({
        title: updated.status === "VERIFIED" ? "Contribuição verificada" : "Verificação concluída",
        description:
          updated.status === "VERIFIED"
            ? "Todas as regras passaram."
            : "Nem todas as regras passaram. Veja os detalhes na linha.",
        tone: updated.status === "VERIFIED" ? "success" : "default",
      });
    } catch (cause) {
      toast({
        title: "Não foi possível verificar",
        description: cause instanceof ApiError ? cause.message : "Tente novamente em instantes.",
        tone: "error",
      });
    } finally {
      setVerifyingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleIssueAttestation(id: string) {
    setIssuingIds((current) => new Set(current).add(id));
    try {
      const attestation = await issueAttestation(id);
      setContributions(
        (current) => current?.map((c) => (c.id === id ? { ...c, attestation } : c)) ?? current,
      );
      toast({
        title: "Credencial emitida",
        description:
          attestation.mode === "mock"
            ? "Emitida em modo demonstração (sem transação real na Solana)."
            : `Registrada na Solana ${attestation.network} via ${attestation.mode}.`,
        tone: "success",
      });
    } catch (cause) {
      toast({
        title: "Não foi possível emitir a credencial",
        description: cause instanceof ApiError ? cause.message : "Tente novamente em instantes.",
        tone: "error",
      });
    } finally {
      setIssuingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  }

  const progress = useVerityProgress({ connected, user, contributions });

  function handleStepAction(id: StepId) {
    switch (id) {
      case "connect_wallet":
        setWalletModalVisible(true);
        return;
      case "connect_github": {
        const section = document.getElementById("github-link-section");
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => {
          document.getElementById("github-username")?.focus();
        }, 400);
        return;
      }
      case "find_contributions":
      case "verify_contribution":
      case "issue_attestation":
        router.push("/contributions");
        return;
    }
  }

  const stepFlowSteps: StepFlowStep[] = progress.steps.map((step) => ({
    ...step,
    onAction: () => handleStepAction(step.id),
  }));

  const stats = {
    found: contributions?.length ?? 0,
    verified: contributions?.filter((c) => c.status === "VERIFIED").length ?? 0,
    issued: contributions?.filter((c) => c.attestation).length ?? 0,
  };

  const oauthAvailable = health?.githubOAuth ?? false;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Perfil"
        description="Acompanhe seu progresso, do vínculo da wallet à credencial na Solana."
      />

      <Card>
        <StepFlow steps={stepFlowSteps} />
      </Card>

      {!connected && (
        <EmptyState
          icon={<IconUser />}
          title="Conecte sua wallet para começar"
          description="Sua wallet Solana é a identidade que recebe as credenciais de contribuição. Nada é publicado até você verificar e emitir de forma explícita."
          action={<ConnectWalletButton />}
        />
      )}

      {connected && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={user?.name ?? "Você"} src={user?.avatarUrl} size={48} />
                <div>
                  {userLoading ? (
                    <Skeleton className="h-5 w-40" />
                  ) : (
                    <p className="font-display text-lg font-semibold text-verity-ink">
                      {user?.name ?? "Novo por aqui"}
                    </p>
                  )}
                  <p className="text-sm text-verity-ink-muted">
                    {user?.headline ?? "Adicione uma headline em Configurações"}
                  </p>
                </div>
              </div>
              <WalletBadge />
            </div>

            {userError && (
              <p role="alert" className="mt-4 text-sm text-red-600">
                {userError}
              </p>
            )}

            {user && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-verity-border pt-4 text-sm">
                <Link
                  href="/settings"
                  className="focus-ring rounded-input font-medium text-verity-primary hover:underline"
                >
                  Gerenciar wallet e GitHub em Configurações
                </Link>
                <span aria-hidden="true" className="text-verity-border">
                  ·
                </span>
                <CopyButton
                  value={publicProfileUrl(user.handle)}
                  label="Copiar link do perfil"
                  copiedLabel="Link copiado"
                />
                <Link
                  href={`/p/${user.handle}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-input border border-verity-border bg-white px-2.5 py-1 text-xs font-medium text-verity-ink-muted transition-colors hover:bg-verity-bg"
                >
                  Ver perfil público
                </Link>
              </div>
            )}
          </Card>

          {!userLoading && user && !user.githubUsername && (
            <div id="github-link-section">
              <GithubLinkCard oauthAvailable={oauthAvailable} onLinked={setUser} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Contribuições encontradas" value={stats.found} loading={contribLoading} />
            <StatCard label="Verificadas" value={stats.verified} loading={contribLoading} />
            <StatCard label="Credenciais emitidas" value={stats.issued} loading={contribLoading} />
          </div>

          {user?.githubUsername && (
            <Card>
              <CardHeader>
                <CardTitle>Últimas contribuições</CardTitle>
                <Link href="/contributions" className="focus-ring rounded-input text-sm font-medium text-verity-primary hover:underline">
                  Ver todas
                </Link>
              </CardHeader>
              <CardContent>
                {contribLoading && (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                )}

                {!contribLoading && contribError && (
                  <p role="alert" className="text-sm text-red-600">
                    {contribError}
                  </p>
                )}

                {!contribLoading && !contribError && contributions && contributions.length === 0 && (
                  <EmptyState
                    icon={<IconGitBranch />}
                    title="Nenhuma contribuição encontrada ainda"
                    description="Sincronize com o GitHub na página de Contribuições para buscarmos PRs, commits e issues elegíveis."
                  />
                )}

                {!contribLoading && !contribError && contributions && contributions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {contributions.slice(0, 4).map((contribution) => (
                      <ContributionRow
                        key={contribution.id}
                        contribution={contribution}
                        verifying={verifyingIds.has(contribution.id)}
                        issuing={issuingIds.has(contribution.id)}
                        onVerify={handleVerify}
                        onIssueAttestation={handleIssueAttestation}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-verity-tint text-verity-primary">
          <IconShieldCheck className="h-4 w-4" />
        </span>
        <div>
          {loading ? (
            <Skeleton className="h-6 w-10" />
          ) : (
            <p className="font-display text-2xl font-bold text-verity-ink">{value}</p>
          )}
          <p className="text-xs text-verity-ink-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}
