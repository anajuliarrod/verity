import Link from "next/link";
import type { ReactNode } from "react";
import { VerityLogo } from "@/components/brand/VerityLogo";

export interface PublicShellProps {
  children: ReactNode;
}

/** Layout público (sem sidebar), usado em perfis e páginas de verificação. */
export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-verity-bg">
      <a
        href="#conteudo-principal"
        className="focus-ring sr-only rounded-input bg-white px-4 py-2 text-sm font-medium text-verity-primary shadow-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <header className="flex h-16 items-center border-b border-verity-border bg-white px-4 md:px-8">
        <Link href="/" className="focus-ring rounded-input">
          <VerityLogo size="sm" />
        </Link>
      </header>
      <main id="conteudo-principal" className="flex-1 px-4 py-10 md:px-8">
        {children}
      </main>
      <footer className="border-t border-verity-border px-4 py-6 text-center text-xs text-verity-ink-muted md:px-8">
        Verificado por{" "}
        <span className="font-display font-semibold text-verity-ink">VERITY</span> · Solana
        devnet
      </footer>
    </div>
  );
}
