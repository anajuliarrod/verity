import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { CredentialCard } from "@/components/app/CredentialCard";
import { IconChevronRight, IconShieldCheck, IconSettings, IconUser } from "@/components/app/icons";
import type { VerityAttestation } from "@/lib/types";

const PREVIEW_ROWS = [
  { icon: "🐙", title: "Contribuição no GitHub", subtitle: "Open Source Project" },
  { icon: "🎓", title: "Projeto Acadêmico", subtitle: "Universidade Federal" },
  { icon: "⭐", title: "Hackathon", subtitle: "Tech for Good" },
];

/** Payload ilustrativo, usado só para renderizar a cena da landing. */
const HERO_ATTESTATION: VerityAttestation = {
  id: "hero-demo",
  contributionId: "hero-demo",
  issuer: "Verity Proof of Contribution",
  issuerPubkey: null,
  subjectWallet: "7xKXtg2CW9qkStGnBcHKu9UjTLvGf6nBRAxhCk8xQ3zJ",
  network: "devnet",
  mode: "mock",
  signature: null,
  attestationPda: null,
  explorerUrl: null,
  payload: {
    schema: "verity.poc.v1",
    type: "GitHub Contribution",
    subject: "7xKXtg2CW9qkStGnBcHKu9UjTLvGf6nBRAxhCk8xQ3zJ",
    issuer: "Verity Proof of Contribution",
    project: "verity-labs/core",
    contribution: "Pull Request #128",
    contributionUrl: "https://github.com/verity-labs/core/pull/128",
    occurredAt: "2026-08-02T00:00:00.000Z",
    verifiedAt: "2026-08-03T00:00:00.000Z",
    evidenceHash: "3f9ac21e7b9d4f6c8e0a5d3b2c1f0e9d",
    status: "VERIFIED",
  },
  issuedAt: "2026-08-03T00:00:00.000Z",
};

/**
 * Recriação em HTML/CSS da cena do key visual: mock do dashboard num card
 * branco elevado, com o cartão escuro de credencial flutuando sobre o
 * canto inferior esquerdo. Puramente decorativo (aria-hidden) — o
 * conteúdo real da página está no texto do Hero.
 */
export function HeroScene() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md pb-14 md:max-w-none md:pb-20">
      <div className="relative overflow-hidden rounded-card border border-verity-border bg-white p-4 shadow-brand sm:p-6">
        <div className="flex gap-4">
          <nav className="hidden w-32 shrink-0 flex-col gap-1 border-r border-verity-border pr-3 sm:flex">
            <span className="flex items-center gap-2 rounded-input bg-verity-tint px-2.5 py-2 text-xs font-semibold text-verity-primary">
              <IconUser className="h-3.5 w-3.5" /> Perfil
            </span>
            <span className="flex items-center gap-2 rounded-input px-2.5 py-2 text-xs font-medium text-verity-ink-muted">
              <IconShieldCheck className="h-3.5 w-3.5" /> Credenciais
            </span>
            <span className="flex items-center gap-2 rounded-input px-2.5 py-2 text-xs font-medium text-verity-ink-muted">
              <IconSettings className="h-3.5 w-3.5" /> Configurações
            </span>
          </nav>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Avatar name="Emanuelly" size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-verity-ink">Emanuelly</p>
                <p className="truncate text-xs text-verity-ink-muted">
                  Estudante de Engenharia de Software
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-verity-ink-muted">
              Credenciais verificadas
            </p>

            <ul className="mt-2 flex flex-col gap-1.5">
              {PREVIEW_ROWS.map((row) => (
                <li
                  key={row.title}
                  className="flex items-center gap-2.5 rounded-input border border-verity-border px-2.5 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-verity-tint text-sm">
                    {row.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-verity-ink">{row.title}</p>
                    <p className="truncate text-[11px] text-verity-ink-muted">{row.subtitle}</p>
                  </div>
                  <VerifiedBadge className="hidden py-0.5 text-[10px] sm:inline-flex" />
                  <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-verity-ink-muted" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 -left-3 w-56 sm:-bottom-10 sm:-left-8 sm:w-64">
        <CredentialCard attestation={HERO_ATTESTATION} />
      </div>
    </div>
  );
}
