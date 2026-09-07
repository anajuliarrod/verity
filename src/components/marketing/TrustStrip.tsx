import { IconCheckCircle, IconXCircle } from "@/components/app/icons";

const ON_CHAIN = [
  "O hash SHA-256 da evidência da verificação",
  "Metadados mínimos: projeto (owner/repo), tipo de contribuição e datas",
  "O status da verificação (verificada) e a wallet do autor",
  "O emissor da credencial (Verity Proof of Contribution)",
];

const NEVER_ON_CHAIN = [
  "O conteúdo do projeto: código-fonte, diffs, arquivos",
  "O texto completo de Pull Requests, commits ou issues",
  "Dados pessoais além da wallet pública conectada",
  "Tokens de acesso, credenciais ou segredos de qualquer tipo",
];

export function TrustStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:px-8 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-[-0.02em] text-verity-ink">
          Privacidade por padrão
        </h2>
        <p className="mt-3 text-verity-ink-muted">
          A Solana guarda a prova, não o conteúdo. Só o essencial para verificar
          vai on-chain — o resto fica com você.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-verity-border bg-white p-6">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-verity-ink">
            <IconCheckCircle className="h-5 w-5 text-verity-verified" />
            O que vai para a Solana
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {ON_CHAIN.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-verity-ink-muted">
                <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-verity-verified" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-verity-border bg-white p-6">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-verity-ink">
            <IconXCircle className="h-5 w-5 text-red-500" />
            O que nunca vai on-chain
          </h3>
          <ul className="mt-4 flex flex-col gap-3">
            {NEVER_ON_CHAIN.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-verity-ink-muted">
                <IconXCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
