"use client";

import { useEffect, useMemo, useState } from "react";
import { ContributionRow } from "@/components/app/ContributionRow";
import { IconGitBranch, IconRefresh } from "@/components/app/icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ApiError,
  filterContributions,
  getContributions,
  issueAttestation,
  verifyContribution,
} from "@/lib/api-client";
import type { ContributionStatus, VerityContribution } from "@/lib/types";

type StatusFilter = "all" | ContributionStatus;

const STATUS_PILLS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "VERIFIED", label: "Verificadas" },
  { value: "REJECTED", label: "Rejeitadas" },
];

export default function ContributionsPage() {
  const { toast } = useToast();

  const [contributions, setContributions] = useState<VerityContribution[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [issuingIds, setIssuingIds] = useState<Set<string>>(new Set());

  function load(refresh: boolean) {
    const setBusy = refresh ? setSyncing : setLoading;
    setBusy(true);
    setError(null);
    getContributions({ refresh })
      .then(setContributions)
      .catch((cause: unknown) => {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível carregar suas contribuições agora.",
        );
      })
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    load(false);
  }, []);

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
            : "Nem todas as regras passaram — expanda a linha para ver os detalhes.",
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

  const filtered = useMemo(() => {
    if (!contributions) return [];
    return filterContributions(contributions, {
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search.trim() || undefined,
    });
  }, [contributions, statusFilter, search]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-verity-ink">Contribuições</h1>
          <p className="mt-1 text-sm text-verity-ink-muted">
            Verifique suas contribuições e emita credenciais para as aprovadas.
          </p>
        </div>
        <Button variant="secondary" loading={syncing} onClick={() => load(true)}>
          <IconRefresh className="h-4 w-4" />
          Sincronizar com GitHub
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {STATUS_PILLS.map((pill) => (
            <Pill
              key={pill.value}
              active={statusFilter === pill.value}
              onClick={() => setStatusFilter(pill.value)}
            >
              {pill.label}
            </Pill>
          ))}
        </div>
        <label className="relative sm:w-64">
          <span className="sr-only">Buscar por repositório</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por repositório..."
            className="focus-ring h-10 w-full rounded-input border border-verity-border bg-white px-3 text-sm text-verity-ink placeholder:text-verity-ink-muted"
          />
        </label>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && (
        <EmptyState
          icon={<IconGitBranch />}
          title="Não foi possível carregar suas contribuições"
          description={error}
          action={
            <Button variant="secondary" onClick={() => load(false)}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {!loading && !error && contributions && contributions.length === 0 && (
        <EmptyState
          icon={<IconGitBranch />}
          title="Nenhuma contribuição encontrada ainda"
          description="Vincule seu GitHub no Perfil e sincronize para buscarmos Pull Requests, commits e issues elegíveis para verificação."
        />
      )}

      {!loading && !error && contributions && contributions.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<IconGitBranch />}
          title="Nenhuma contribuição corresponde aos filtros"
          description="Tente outro status ou limpe a busca por repositório."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((contribution) => (
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
    </div>
  );
}
