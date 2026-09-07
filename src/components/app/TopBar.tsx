import Link from "next/link";
import type { ReactNode } from "react";
import { VerityLogo } from "@/components/brand/VerityLogo";
import { IconMenu } from "./icons";

export interface TopBarProps {
  onMenuClick?: () => void;
  rightSlot?: ReactNode;
}

export function TopBar({ onMenuClick, rightSlot }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-verity-border bg-white/80 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="focus-ring shrink-0 rounded-input p-1.5 text-verity-ink-muted hover:bg-verity-tint md:hidden"
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" className="focus-ring shrink-0 rounded-input">
          <VerityLogo size="sm" />
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Link
          href="/"
          className="focus-ring hidden shrink-0 whitespace-nowrap rounded-input text-sm font-medium text-verity-ink-muted hover:text-verity-primary sm:inline-flex"
        >
          Sobre a VERITY
        </Link>
        {rightSlot}
      </div>
    </header>
  );
}
