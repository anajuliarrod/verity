"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GithubLinkCard } from "@/components/app/GithubLinkCard";
import { IconGithub, IconSettings, IconWallet } from "@/components/app/icons";
import { useHealth } from "@/components/app/useHealth";
import { useWalletAddress } from "@/components/app/useWalletAddress";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectWalletButton, WalletBadge } from "@/components/wallet";
import { ApiError, linkWallet } from "@/lib/api-client";
import type { AttestationMode, HealthStatus, VerityUser } from "@/lib/types";

function publicProfileUrl(handle: string): string {
  if (typeof window === "undefined") return `/p/${handle}`;
  return `${window.location.origin}/p/${handle}`;
}

const GITHUB_MODE_LABEL: Record<HealthStatus["modes"]["github"], string> = {
  live: "API pública do GitHub",
  token: "API do GitHub com token",
  demo: "Dados de demonstração",
};

const SOLANA_MODE_LABEL: Record<AttestationMode, string> = {
  sas: "Solana Attestation Service (real)",
  memo: "Memo Program na devnet (real)",
  mock: "Assinatura simulada (demonstração)",
};

export default function SettingsPage() {
  const { address, connected } = useWalletAddress();
  const { health, loading: healthLoading, error: healthError } = useHealth();

  const [user, setUser] = useState<VerityUser | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const linkedAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address || linkedAddressRef.current === address) return;
    linkedAddressRef.current = address;
    setUserLoading(true);
    setUserError(null);
    linkWallet(address)
      .then(setUser)
      .catch((cause: unknown) => {
        setUserError(
          cause instanceof ApiError ? cause.message : "Não foi possível carregar sua conta agora.",
        );
      })
      .finally(() => setUserLoading(false));
  }, [address]);

  const oauthAvailable = health?.githubOAuth ?? false;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-verity-ink">Configurações</h1>
        <p className="mt-1 text-sm text-verity-ink-muted">
          Wallet, GitHub, perfil público e diagnóstico das integrações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <WalletBadge />
              <ConnectWalletButton />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">Nenhuma wallet conectada.</p>
              <ConnectWalletButton />
            </div>
          )}
          {userError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {userError}
            </p>
          )}
        </CardContent>
      </Card>

      {connected && (
        <>
          {userLoading && <Skeleton className="h-40 w-full" />}

          {!userLoading && user && !user.githubUsername && (
            <GithubLinkCard oauthAvailable={oauthAvailable} onLinked={setUser} />
          )}

          {!userLoading && user && user.githubUsername && (
            <Card>
              <CardHeader>
                <CardTitle>GitHub</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-verity-ink">
                  <IconGithub className="h-4 w-4 text-verity-ink-muted" />
                  <span className="font-medium">@{user.githubUsername}</span>
                  <Badge tone="verified">Vinculado</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {!userLoading && user && (
            <Card>
              <CardHeader>
                <CardTitle>Perfil público</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Qualquer pessoa pode conferir suas credenciais verificadas neste link:
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/p/${user.handle}`}
                    className="focus-ring truncate rounded-input border border-verity-border bg-verity-bg px-3 py-2 text-sm text-verity-ink hover:text-verity-primary"
                  >
                    {publicProfileUrl(user.handle)}
                  </Link>
                  <CopyButton value={publicProfileUrl(user.handle)} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Diagnóstico das integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm">
            Cada integração roda em modo real ou de demonstração, dependendo das credenciais
            configuradas no servidor — nunca quebra a experiência.
          </p>

          {healthLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!healthLoading && healthError && (
            <p role="alert" className="text-sm text-red-600">
              {healthError}
            </p>
          )}

          {!healthLoading && !healthError && health && (
            <ul className="flex flex-col divide-y divide-verity-border">
              <DiagnosticRow
                icon={<IconGithub className="h-4 w-4" />}
                label="GitHub"
                value={GITHUB_MODE_LABEL[health.modes.github]}
                ok={health.modes.github !== "demo"}
              />
              <DiagnosticRow
                icon={<IconWallet className="h-4 w-4" />}
                label="Solana"
                value={SOLANA_MODE_LABEL[health.modes.solana]}
                ok={health.modes.solana !== "mock"}
              />
              <DiagnosticRow
                icon={<IconSettings className="h-4 w-4" />}
                label="Banco de dados"
                value={health.modes.db === "connected" ? "Conectado" : "Indisponível"}
                ok={health.modes.db === "connected"}
              />
            </ul>
          )}

          {!healthLoading && !healthError && health && (
            <p className="mt-4 text-xs text-verity-ink-muted">
              {health.demoMode
                ? "O sistema está em modo demonstração — dados plausíveis e determinísticos, sem depender de credenciais externas."
                : "Integrações reais configuradas."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DiagnosticRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2.5 text-sm text-verity-ink">
        <span className="text-verity-ink-muted">{icon}</span>
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${ok ? "bg-verity-verified" : "bg-amber-500"}`}
        />
        <span className="text-sm text-verity-ink-muted">{value}</span>
      </div>
    </li>
  );
}
