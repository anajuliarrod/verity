"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export interface AppShellProps {
  children: ReactNode;
  rightSlot?: ReactNode;
}

export function AppShell({ children, rightSlot }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-verity-bg">
      <a
        href="#conteudo-principal"
        className="focus-ring sr-only rounded-input bg-white px-4 py-2 text-sm font-medium text-verity-primary shadow-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} rightSlot={rightSlot} />
        <main id="conteudo-principal" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
