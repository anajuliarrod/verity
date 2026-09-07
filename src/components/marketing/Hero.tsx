import Link from "next/link";
import { VerityLogo } from "@/components/brand/VerityLogo";
import { Button } from "@/components/ui/Button";
import { HeroScene } from "./HeroScene";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-verity-blob opacity-70 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-14 sm:px-6 md:grid-cols-2 md:items-center md:px-8 md:py-24">
        <div>
          <VerityLogo showTagline size="md" />

          <h1 className="mt-8 font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
            <span className="block text-verity-ink">Seu currículo diz</span>
            <span className="block text-verity-ink">o que você fez.</span>
            <span className="block text-verity-primary">O Verity ajuda</span>
            <span className="block text-verity-primary">a provar.</span>
          </h1>

          <p className="mt-6 max-w-md text-base text-verity-ink-muted sm:text-lg">
            Conecte sua wallet e seu GitHub. A Verity transforma contribuições
            reais — Pull Requests, commits, issues — em credenciais
            verificáveis, registradas na Solana e portáteis para qualquer
            recrutador conferir.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Conectar wallet
              </Button>
            </Link>
            <Link href="/p/emanuelly">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Ver perfil de exemplo
              </Button>
            </Link>
          </div>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}
