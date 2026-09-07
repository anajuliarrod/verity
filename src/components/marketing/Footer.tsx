import Link from "next/link";
import { VerityLogo } from "@/components/brand/VerityLogo";

export function Footer() {
  return (
    <footer className="border-t border-verity-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left md:px-8">
        <VerityLogo size="sm" />
        <p className="text-sm text-verity-ink-muted">
          Proof of Contribution na Solana devnet ·{" "}
          <Link href="/p/emanuelly" className="focus-ring rounded-input font-medium text-verity-primary hover:underline">
            Ver perfil de exemplo
          </Link>
        </p>
      </div>
    </footer>
  );
}
