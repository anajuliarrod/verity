"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { IconClose, IconGitBranch, IconShieldCheck, IconSettings, IconUser } from "./icons";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Perfil", icon: IconUser },
  { href: "/contributions", label: "Contribuições", icon: IconGitBranch },
  { href: "/credentials", label: "Credenciais", icon: IconShieldCheck },
  { href: "/settings", label: "Configurações", icon: IconSettings },
];

export interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-verity-ink/30 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-verity-border bg-[#FCFBFF] p-4 transition-transform md:static md:z-auto md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between md:hidden">
          <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-verity-ink">
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="focus-ring rounded-input p-1 text-verity-ink-muted hover:bg-verity-tint"
          >
            <IconClose />
          </button>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-verity-tint text-verity-primary"
                    : "text-verity-ink-muted hover:bg-verity-bg hover:text-verity-ink",
                )}
              >
                <Icon className={active ? "text-verity-primary" : "text-verity-ink-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="md:hidden">
          <div className="my-2 border-t border-verity-border" />
          <Link
            href="/"
            onClick={onClose}
            className="focus-ring flex items-center gap-3 rounded-input px-3 py-2.5 text-sm font-medium text-verity-ink-muted hover:bg-verity-bg hover:text-verity-ink"
          >
            Sobre a VERITY
          </Link>
        </div>
      </aside>
    </>
  );
}
