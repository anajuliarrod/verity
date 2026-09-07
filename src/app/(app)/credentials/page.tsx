"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CredentialCard } from "@/components/app/CredentialCard";
import { IconExternalLink, IconShieldCheck } from "@/components/app/icons";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, getContributions } from "@/lib/api-client";
import type { VerityAttestation, VerityContribution } from "@/lib/types";

function publicVerifyUrl(id: string): string {
  if (typeof window === "undefined") return `/verify/${id}`;
  return `${window.location.origin}/verify/${id}`;
}

export default function CredentialsPage() {
  const [contributions, setContributions] = useState<VerityContribution[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    load();
  }, []);

  const attestations: VerityAttestation[] = useMemo(
    () =>
      (contributions ?? [])
        .map((contribution) => contribution.attestation)
        .filter((attestation): attestation is VerityAttestation => attestation !== null),
    [contributions],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-verity-ink">Credenciais</h1>
        <p className="mt-1 text-sm text-verity-ink-muted">
          Suas Proof of Contribution, associadas à sua wallet e verificáveis por qualquer pessoa.
        </p>
      </div>

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
          description="Verifique uma contribuição em Contribuições e emita a Proof of Contribution — ela aparece aqui, associada à sua wallet."
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
