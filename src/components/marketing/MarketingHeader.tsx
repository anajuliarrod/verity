import Link from "next/link";
import { VerityLogo } from "@/components/brand/VerityLogo";
import { Button } from "@/components/ui/Button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-verity-border bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 md:px-8">
        <Link href="/" className="focus-ring rounded-input">
          <VerityLogo size="sm" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/p/emanuelly"
            className="focus-ring hidden rounded-input px-2 py-1.5 text-sm font-medium text-verity-ink-muted hover:text-verity-ink sm:inline-block"
          >
            Perfil de exemplo
          </Link>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Conectar wallet
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
