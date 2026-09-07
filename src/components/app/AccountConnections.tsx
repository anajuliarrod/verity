"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useVerityWallet } from "@/components/wallet";
import { ApiError, apiFetch } from "@/lib/api-client";
import { truncateAddress } from "@/lib/utils";
import type { VerityUser } from "@/lib/types";
import { IconAlert, IconGithub, IconWallet, IconXCircle } from "./icons";

export interface AccountConnectionsProps {
  user: VerityUser;
  onUpdated: (user: VerityUser) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Diálogo de confirmação acessível: foco preso, fechável por Escape, foco
// devolvido ao elemento que abriu o diálogo ao fechar.
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  open: boolean;
  titleId: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  titleId,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function getFocusable(): HTMLElement[] {
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      return nodes ? Array.from(nodes) : [];
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-verity-ink/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-card border border-verity-border bg-white p-5 shadow-brand"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <IconAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-base font-semibold text-verity-ink">
              {title}
            </h2>
            <div className="mt-1.5 text-sm text-verity-ink-muted">{description}</div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="dark" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountConnections
// ---------------------------------------------------------------------------

/**
 * Mostra a wallet conectada e o GitHub vinculado, com ações destrutivas
 * (desconectar wallet, desvincular GitHub) sempre protegidas por um diálogo
 * de confirmação que explica a consequência antes de executar.
 */
export function AccountConnections({ user, onUpdated, className }: AccountConnectionsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { disconnect: disconnectWalletAdapter } = useVerityWallet();

  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [disconnectingWallet, setDisconnectingWallet] = useState(false);
  const [unlinkingGithub, setUnlinkingGithub] = useState(false);

  async function handleDisconnectWallet() {
    setDisconnectingWallet(true);
    try {
      await apiFetch("/api/session/wallet", { method: "DELETE" });
      // Desconecta também a carteira no navegador: sem isto, o
      // reconhecimento automático do wallet-adapter recriaria o vínculo na
      // próxima vez que esta página montar.
      await disconnectWalletAdapter();
      setWalletDialogOpen(false);
      toast({
        title: "Wallet desconectada.",
        description: "Sua sessão foi encerrada.",
        tone: "success",
      });
      router.push("/");
      router.refresh();
    } catch (cause) {
      toast({
        title: "Não foi possível desconectar a wallet.",
        description: cause instanceof ApiError ? cause.message : "Tente novamente em instantes.",
        tone: "error",
      });
    } finally {
      setDisconnectingWallet(false);
    }
  }

  async function handleUnlinkGithub() {
    setUnlinkingGithub(true);
    try {
      const updated = await apiFetch<VerityUser>("/api/auth/github/link", { method: "DELETE" });
      onUpdated(updated);
      setGithubDialogOpen(false);
      toast({ title: "GitHub desvinculado.", tone: "success" });
    } catch (cause) {
      toast({
        title: "Não foi possível desvincular o GitHub.",
        description: cause instanceof ApiError ? cause.message : "Tente novamente em instantes.",
        tone: "error",
      });
    } finally {
      setUnlinkingGithub(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Conexões da conta</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-verity-border">
          <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5 text-sm text-verity-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verity-tint text-verity-primary">
                <IconWallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium">Wallet Solana</p>
                <p className="truncate text-xs text-verity-ink-muted">
                  {user.wallet ? truncateAddress(user.wallet) : "Nenhuma wallet conectada"}
                </p>
              </div>
            </div>
            {user.wallet && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setWalletDialogOpen(true)}
              >
                <IconXCircle className="h-4 w-4" />
                Desconectar
              </Button>
            )}
          </li>

          <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5 text-sm text-verity-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-verity-tint text-verity-primary">
                <IconGithub className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-medium">GitHub</p>
                <p className="truncate text-xs text-verity-ink-muted">
                  {user.githubUsername ? `@${user.githubUsername}` : "Nenhuma conta vinculada"}
                </p>
              </div>
              {user.githubUsername && <Badge tone="verified">Vinculado</Badge>}
            </div>
            {user.githubUsername && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setGithubDialogOpen(true)}
              >
                <IconXCircle className="h-4 w-4" />
                Desvincular
              </Button>
            )}
          </li>
        </ul>
      </CardContent>

      <ConfirmDialog
        open={walletDialogOpen}
        titleId="confirm-disconnect-wallet"
        title="Desconectar wallet?"
        description={
          <>
            As credenciais já emitidas continuam existindo na Solana e associadas ao
            endereço{" "}
            <strong className="text-verity-ink">
              {user.wallet ? truncateAddress(user.wallet) : ""}
            </strong>
            : nada é apagado on-chain. Seu perfil, porém, deixa de estar ligado a essa
            wallet e sua sessão atual será encerrada. Para continuar usando o VERITY,
            você precisará conectar uma wallet novamente.
          </>
        }
        confirmLabel="Desconectar"
        loading={disconnectingWallet}
        onConfirm={handleDisconnectWallet}
        onCancel={() => setWalletDialogOpen(false)}
      />

      <ConfirmDialog
        open={githubDialogOpen}
        titleId="confirm-unlink-github"
        title="Desvincular GitHub?"
        description={
          <>
            As contribuições e credenciais já importadas de{" "}
            <strong className="text-verity-ink">
              {user.githubUsername ? `@${user.githubUsername}` : "sua conta"}
            </strong>{" "}
            continuam no seu histórico e permanecem válidas: elas não são apagadas.
            Depois de desvincular, o VERITY para de buscar novas contribuições até que
            você vincule um GitHub novamente.
          </>
        }
        confirmLabel="Desvincular"
        loading={unlinkingGithub}
        onConfirm={handleUnlinkGithub}
        onCancel={() => setGithubDialogOpen(false)}
      />
    </Card>
  );
}
