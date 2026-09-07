/**
 * Extensão OPCIONAL via `solana-agent-kit`, isolada e fora do caminho
 * crítico da Verity (seção 0/2 do brief). Nenhum outro módulo deve
 * depender desta capacidade para funcionar. Ela é só um "bônus" que
 * resume o estado do emissor em linguagem natural e permite pedir airdrop
 * em devnet a partir de um agente conversacional.
 *
 * `solana-agent-kit` e suas dependências pesadas (`@solana/web3.js`,
 * `@langchain/core`, `@openai/agents`, `ai`) só são carregadas via
 * `import()` dinâmico dentro de `getVerityAgent()`, nunca no topo do
 * módulo. Assim, ninguém paga o custo de bundle por importar este
 * arquivo, e a ausência/incompatibilidade da lib nunca quebra o build ou
 * o app: o pior caso é `getVerityAgent()` resolver para `null`.
 */
import { env } from "@/lib/env";
import { explorerUrl } from "@/lib/solana/connection";

export interface VerityAgentSummary {
  issuerPubkey: string;
  balanceSol: number;
  cluster: string;
  narrative: string;
}

export interface AttestationSummaryInput {
  mode: "sas" | "memo" | "mock";
  subjectWallet: string;
  project: string;
}

export interface VerityAgent {
  /** Saldo devnet do emissor + um resumo em linguagem natural. */
  getIssuerStatus(): Promise<VerityAgentSummary>;
  /** Pede um airdrop devnet para o emissor. Só funciona em devnet. */
  requestDevnetAirdrop(
    sol?: number,
  ): Promise<{ signature: string; explorerUrl: string } | null>;
  /** Resume o estado on-chain de uma credencial em linguagem natural. */
  summarizeAttestation(input: AttestationSummaryInput): string;
}

function parseJsonArraySecretKey(trimmed: string): Uint8Array | null {
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "number")) {
      return Uint8Array.from(parsed as number[]);
    }
  } catch {
    return null;
  }
  return null;
}

async function buildAgent(): Promise<VerityAgent | null> {
  const raw = env.verityIssuerSecretKey;
  if (!raw) return null;

  try {
    const [{ SolanaAgentKit, KeypairWallet }, web3, bs58Module] =
      await Promise.all([
        import("solana-agent-kit"),
        import("@solana/web3.js"),
        import("bs58"),
      ]);
    const bs58 = bs58Module.default;
    const trimmed = raw.trim();

    let bytes: Uint8Array | null;
    try {
      bytes = trimmed.startsWith("[")
        ? parseJsonArraySecretKey(trimmed)
        : bs58.decode(trimmed);
    } catch {
      bytes = null;
    }
    if (!bytes || bytes.length !== 64) return null;

    const keypair = web3.Keypair.fromSecretKey(bytes);
    const rpcUrl = env.solanaRpc ?? "https://api.devnet.solana.com";
    const wallet = new KeypairWallet(keypair, rpcUrl);
    const agentKit = new SolanaAgentKit(wallet, rpcUrl, {});

    return {
      async getIssuerStatus(): Promise<VerityAgentSummary> {
        const lamports = await agentKit.connection.getBalance(
          keypair.publicKey,
        );
        const balanceSol = lamports / 1_000_000_000;
        const narrative =
          balanceSol > 0
            ? `O emissor da Verity tem ${balanceSol.toFixed(4)} SOL em ${env.solanaCluster}, suficiente para emitir attestations.`
            : `O emissor da Verity está sem saldo em ${env.solanaCluster}. Peça um airdrop antes de emitir attestations reais.`;

        return {
          issuerPubkey: keypair.publicKey.toBase58(),
          balanceSol,
          cluster: env.solanaCluster,
          narrative,
        };
      },

      async requestDevnetAirdrop(sol = 1) {
        if (env.solanaCluster !== "devnet") return null;
        try {
          const signature = await agentKit.connection.requestAirdrop(
            keypair.publicKey,
            Math.floor(sol * 1_000_000_000),
          );
          return { signature, explorerUrl: explorerUrl(signature, "tx") };
        } catch {
          return null;
        }
      },

      summarizeAttestation(input: AttestationSummaryInput): string {
        const label =
          input.mode === "sas"
            ? "registrada on-chain via Solana Attestation Service"
            : input.mode === "memo"
              ? "registrada on-chain via uma transação com Memo Program"
              : "gerada em modo demonstração, sem registro on-chain real";
        return `A contribuição em ${input.project} foi ${label}, associada à wallet ${input.subjectWallet}.`;
      },
    };
  } catch {
    // `solana-agent-kit` ausente, incompatível, ou falhou ao inicializar.
    // A capacidade é opcional, então degradamos para `null` silenciosamente.
    return null;
  }
}

let cachedAgent: Promise<VerityAgent | null> | null = null;

/** Retorna a extensão opcional do agente Solana, ou `null` se indisponível. */
export function getVerityAgent(): Promise<VerityAgent | null> {
  if (!cachedAgent) cachedAgent = buildAgent();
  return cachedAgent;
}
