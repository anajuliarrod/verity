"use client";

import { useEffect, useRef, useState } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui";
import { cn, truncateAddress } from "@/lib/utils";
import { useVerityWallet } from "./useVerityWallet";
import { explorerAddressUrl } from "./explorer";

function IconWallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export interface ConnectWalletButtonProps {
  className?: string;
}

/**
 * Botão de conexão de wallet na identidade visual da Verity (não o botão
 * roxo padrão do wallet-adapter). Desconectado: abre o modal de seleção de
 * carteira. Conectado: mostra endereço truncado + menu (copiar, explorer,
 * desconectar).
 */
export function ConnectWalletButton({ className }: ConnectWalletButtonProps) {
  const { address, connected, connecting, cluster, disconnect } =
    useVerityWallet();
  const { setVisible } = useWalletModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!connected || !address) {
    return (
      <Button
        type="button"
        variant="primary"
        loading={connecting}
        onClick={() => setVisible(true)}
        className={className}
      >
        <IconWallet />
        Conectar wallet
      </Button>
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard indisponível: falha silenciosa.
    }
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <span className="h-2 w-2 rounded-full bg-verity-verified" aria-hidden="true" />
        {truncateAddress(address)}
        <IconChevronDown />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-card border border-verity-border bg-white py-1 shadow-brand"
        >
          <div className="border-b border-verity-border px-3 py-2">
            <p className="text-xs text-verity-ink-muted">Conectado ({cluster})</p>
            <p className="truncate text-sm font-medium text-verity-ink">
              {address}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-verity-ink hover:bg-verity-tint"
          >
            {copied ? "Endereço copiado" : "Copiar endereço"}
          </button>
          <a
            role="menuitem"
            href={explorerAddressUrl(address, cluster)}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center px-3 py-2 text-left text-sm text-verity-ink hover:bg-verity-tint"
          >
            Ver no Explorer
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              void disconnect();
            }}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
