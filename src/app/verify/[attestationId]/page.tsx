import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CredentialCard } from "@/components/app/CredentialCard";
import { PublicShell } from "@/components/app/PublicShell";
import {
  IconAlert,
  IconCheckCircle,
  IconExternalLink,
  IconGithub,
  IconShieldCheck,
  IconXCircle,
} from "@/components/app/icons";
import { CopyButton } from "@/components/ui/CopyButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPublicAttestationView } from "@/lib/server/attestation";
import type { AttestationPublicView } from "@/lib/types";
import { cn, formatDateTime, truncateAddress } from "@/lib/utils";

interface PageProps {
  params: Promise<{ attestationId: string }>;
}

type Result =
  | { status: "ok"; view: AttestationPublicView }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Busca a attestation direto da camada de dados
 * (`src/lib/server/attestation.ts`), sem passar por `fetch`: este é um
 * Server Component, então chamar a própria API por HTTP seria uma volta
 * desnecessária (e, em produção, uma fonte de bugs de resolução de URL).
 */
async function loadAttestation(id: string): Promise<Result> {
  try {
    const view = await getPublicAttestationView(id);
    if (!view) {
      return { status: "not_found" };
    }
    return { status: "ok", view };
  } catch {
    return {
      status: "error",
      message: "Não foi possível verificar esta credencial agora.",
    };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { attestationId } = await params;
  const result = await loadAttestation(attestationId);
  const title =
    result.status === "ok"
      ? `Credencial verificada: ${result.view.attestation.payload.project} · VERITY`
      : "Verificar credencial · VERITY";
  const description =
    result.status === "ok"
      ? `Proof of Contribution: ${result.view.attestation.payload.contribution} em ${result.view.attestation.payload.project}, verificada na Solana.`
      : "Verificação pública de credencial VERITY.";

  return {
    title,
    description,
    openGraph: { title, description, images: ["/brand/verity-keyvisual.png"] },
  };
}

export default async function VerifyAttestationPage({ params }: PageProps) {
  const { attestationId } = await params;
  const result = await loadAttestation(attestationId);

  if (result.status === "not_found") {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<IconShieldCheck />}
            title="Credencial não encontrada"
            description={`Não encontramos nenhuma attestation com o identificador "${attestationId}". Verifique o link ou tente novamente mais tarde.`}
          />
        </div>
      </PublicShell>
    );
  }

  if (result.status === "error") {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl">
          <EmptyState
            icon={<IconAlert />}
            title="Não foi possível verificar esta credencial agora"
            description={result.message}
          />
        </div>
      </PublicShell>
    );
  }

  const { attestation, verification } = result.view;
  const { payload } = attestation;
  const isValid = payload.status === "VERIFIED";

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <VerdictBanner valid={isValid} status={payload.status} />

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <CredentialCard attestation={attestation} />

          <div className="flex flex-col gap-4">
            <Section title="O que foi verificado">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field label="Projeto" value={payload.project} />
                <Field label="Contribuição" value={payload.contribution} />
                <Field label="Ocorreu em" value={formatDateTime(payload.occurredAt)} />
                <Field label="Verificado em" value={formatDateTime(payload.verifiedAt)} />
                <Field label="Emissor" value={attestation.issuer} />
                <Field label="Wallet do autor" value={truncateAddress(attestation.subjectWallet)} />
              </dl>
              <a
                href={payload.contributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-input border border-verity-border bg-white px-3 py-1.5 text-sm font-medium text-verity-ink-muted hover:bg-verity-bg"
              >
                <IconGithub className="h-4 w-4" />
                Ver contribuição original no GitHub
                <IconExternalLink className="h-3.5 w-3.5" />
              </a>
            </Section>

            <Section title="Checagem on-chain">
              {attestation.mode === "mock" ? (
                <div className="flex items-start gap-2.5 rounded-input border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Esta credencial está em <strong>modo demonstração</strong>: a assinatura é
                    simulada e não corresponde a uma transação real na Solana.
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-input border px-3 py-3 text-sm",
                    verification.onChain && verification.matches
                      ? "border-verity-verified-bg bg-verity-verified-bg/60 text-verity-ink"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {verification.onChain && verification.matches ? (
                    <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-verity-verified" />
                  ) : (
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      Assinatura registrada na Solana {attestation.network} (modo {attestation.mode}).
                    </p>
                    <p className="mt-1 text-xs text-verity-ink-muted">
                      Reconferido diretamente na rede em {formatDateTime(verification.checkedAt)}:{" "}
                      {verification.detail}
                    </p>
                    {attestation.signature && (
                      <p className="mt-2 break-all font-mono text-xs text-verity-ink-muted">
                        {attestation.signature}
                      </p>
                    )}
                    {attestation.explorerUrl && (
                      <a
                        href={attestation.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring mt-2 inline-flex items-center gap-1 text-sm font-medium text-verity-primary hover:underline"
                      >
                        Ver no Explorer <IconExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Section>

            <Section title="Hash de evidência">
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded-input bg-verity-bg px-2.5 py-1.5 text-xs text-verity-ink">
                  {payload.evidenceHash}
                </code>
                <CopyButton value={payload.evidenceHash} label="Copiar hash" copiedLabel="Copiado" />
              </div>
              <p className="mt-2 text-xs text-verity-ink-muted">
                SHA-256 do snapshot das regras de verificação. Nenhum conteúdo do projeto ou dado
                sensível foi publicado. Apenas este hash e os metadados acima vão para a Solana.
              </p>
            </Section>

            <Section title="Payload completo da credencial">
              <pre className="overflow-x-auto rounded-input bg-verity-night-deep p-3 text-xs text-white/85">
                <code>{JSON.stringify(payload, null, 2)}</code>
              </pre>
            </Section>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

function VerdictBanner({
  valid,
  status,
}: {
  valid: boolean;
  status: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border p-5",
        valid
          ? "border-transparent bg-verity-verified-bg text-verity-verified"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {valid ? (
        <IconCheckCircle className="h-7 w-7 shrink-0" />
      ) : (
        <IconXCircle className="h-7 w-7 shrink-0" />
      )}
      <div>
        <p className="font-display text-lg font-bold">
          {valid ? "Credencial válida" : `Status: ${status}`}
        </p>
        <p className="text-sm opacity-90">
          {valid
            ? "Esta contribuição foi verificada pela Verity e a credencial está associada à wallet abaixo."
            : "Esta credencial não está com status verificado."}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-verity-border bg-white p-4">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-verity-ink-muted">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-verity-ink-muted">{label}</dt>
      <dd className="font-medium text-verity-ink">{value}</dd>
    </div>
  );
}
