import type { ReactNode } from "react";
import {
  IconGitBranch,
  IconGithub,
  IconShieldCheck,
  IconWallet,
} from "@/components/app/icons";
import { VerityMark } from "@/components/brand/VerityMark";

interface Step {
  title: string;
  description: string;
  icon: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Conectar wallet",
    description: "O estudante conecta uma wallet Solana: a identidade portátil da credencial.",
    icon: <IconWallet className="h-5 w-5" />,
  },
  {
    title: "Conectar GitHub",
    description: "Vincula o usuário do GitHub, com ou sem OAuth, para localizarmos suas contribuições.",
    icon: <IconGithub className="h-5 w-5" />,
  },
  {
    title: "Contribuições encontradas",
    description: "A Verity busca Pull Requests, commits e issues elegíveis automaticamente.",
    icon: <IconGitBranch className="h-5 w-5" />,
  },
  {
    title: "Verification Engine",
    description: "Regras determinísticas conferem autoria, repositório e status, sem heurística.",
    icon: <IconShieldCheck className="h-5 w-5" />,
  },
  {
    title: "Credencial na Solana",
    description: "A contribuição validada vira uma Proof of Contribution, verificável por qualquer pessoa.",
    icon: <VerityMark size={20} />,
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-verity-ink">
          Como funciona
        </h2>
        <p className="mt-3 text-verity-ink-muted">
          Do commit à credencial verificável na blockchain, em cinco passos.
        </p>
      </div>

      <ol className="relative mt-12">
        <div
          aria-hidden="true"
          className="absolute left-6 top-6 hidden h-0.5 bg-verity-border md:right-6 md:left-6 md:block"
        />
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative flex gap-4 md:flex-1 md:flex-col md:items-center md:text-center">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-verity-border bg-white text-verity-primary shadow-brand">
                {step.icon}
              </span>
              <div className="md:mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-verity-primary">
                  Passo {index + 1}
                </p>
                <p className="mt-1 font-display text-base font-semibold text-verity-ink">
                  {step.title}
                </p>
                <p className="mt-1 max-w-[13rem] text-sm text-verity-ink-muted md:mx-auto">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </div>
      </ol>
    </section>
  );
}
