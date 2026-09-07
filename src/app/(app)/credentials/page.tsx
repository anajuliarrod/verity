"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { CredentialCard } from "@/components/app/CredentialCard";
import { PageHeader } from "@/components/app/PageHeader";
import { StepFlowCompact } from "@/components/app/StepFlow";
import { useVerityProgress } from "@/components/app/useVerityProgress";
import { useWalletAddress } from "@/components/app/useWalletAddress";
import { IconExternalLink, IconShieldCheck } from "@/components/app/icons";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectWalletButton } from "@/components/wallet";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { ApiError, getContributions, linkWallet } from "@/lib/api-client";
import type { StepId, VerityAttestation, VerityContribution, VerityUser } from "@/lib/types";

function publicVerifyUrl(id: string): string {
  if (typeof window === "undefined") return `/verify/${id}`;
  return `${window.location.origin}/verify/${id}`;
}

function publicProfileUrl(handle: string): string {
  if (typeof window === "undefined") return `/p/${handle}`;
  return `${window.location.origin}/p/${handle}`;
}

export default function CredentialsPage() {
  useDocumentTitle("Credenciais");

  const router = useRouter();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { address, connected } = useWalletAddress();

  const [user, setUser] = useState<VerityUser | null>(null);
  const linkedAddressRef = useRef<string | null>(null);

  const [contributions, setContributions] = useState<VerityContribution[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Usado só para calcular o passo atual do StepFlowCompact e o link do
  // perfil público: best-effort, nunca bloqueia a listagem de credenciais.
  useEffect(() => {
    if (!address || linkedAddressRef.current === address) return;
    linkedAddressRef.current = address;
    linkWallet(address)
      .then(setUser)
      .catch(() => {
        // Sem impacto na tela: a wallet já está conectada de qualquer forma.
      });
  }, [address]);

  function load() {
    setLoading(true);
    setError(null);
    getContributions()
      .then(setContributions)
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar suas credenciais agora.",
        );
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!connected) return;
    load();
  }, [connected]);

  const attestations: VerityAttestation[] = useMemo(
    () =>
      (contributions ?? [])
        .map((contribution) => contribution.attestation)
        .filter((attestation): attestation is VerityAttestation => attestation !== null),
    [contributions],
  );

  const progress = useVerityProgress({ connected, user, contributions });

  function handleStepAction(id: StepId) {
    switch (id) {
      case "connect_wallet":
        setWalletModalVisible(true);
        return;
      case "connect_github":
        router.push("/dashboard");
        return;
      case "find_contributions":
      case "verify_contribution":
      case "issue_attestation":
        router.push("/contributions");
        return;
    }
  }

  const currentStep = progress.current;
  const compactStep = currentStep
    ? { ...currentStep, onAction: () => handleStepAction(currentStep.id) }
    : null;

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader
          title="Credenciais"
          description="Suas Proof of Contribution, associadas à sua wallet e verificáveis por qualquer pessoa."
        />
        <EmptyState
          icon={<IconShieldCheck />}
          title="Conecte sua wallet para ver suas credenciais"
          description="Sua wallet Solana é a identidade que recebe as credenciais de contribuição. Conecte para continuar de onde parou."
          action={<ConnectWalletButton />}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Credenciais"
        description="Suas Proof of Contribution, associadas à sua wallet e verificáveis por qualquer pessoa."
        action={
          user?.handle ? (
            <>
              <CopyButton
                value={publicProfileUrl(user.handle)}
                label="Copiar link do perfil"
                copiedLabel="Link copiado"
              />
              <Link href={`/p/${user.handle}`}>
                <Button variant="secondary" size="sm">
                  Ver perfil público
                </Button>
              </Link>
            </>
          ) : undefined
        }
      />

      {compactStep && <StepFlowCompact step={compactStep} />}

      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {!loading && error && (
        <EmptyState
          icon={<IconShieldCheck />}
          title="Não foi possível carregar suas credenciais"
          description={error}
          action={
            <Button variant="secondary" onClick={load}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!loading && !error && attestations.length === 0 && (
        <EmptyState
          icon={<IconShieldCheck />}
          title="Nenhuma credencial emitida ainda"
          description="Verifique uma contribuição em Contribuições e emita a Proof of Contribution. Ela aparece aqui, associada à sua wallet."
        />
      )}

      {!loading && !error && attestations.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {attestations.map((attestation) => (
            <CredentialCard
              key={attestation.id}
              attestation={attestation}
              footer={
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton value={publicVerifyUrl(attestation.id)} label="Copiar link" copiedLabel="Link copiado" />
                  {attestation.explorerUrl && (
                    <a
                      href={attestation.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-input border border-verity-border bg-white px-2.5 py-1 text-xs font-medium text-verity-ink-muted transition-colors hover:bg-verity-bg"
                    >
                      Ver no Explorer <IconExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Link
                    href={`/verify/${attestation.id}`}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-input border border-verity-border bg-white px-2.5 py-1 text-xs font-medium text-verity-ink-muted transition-colors hover:bg-verity-bg"
                  >
                    Ver detalhes
                  </Link>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
