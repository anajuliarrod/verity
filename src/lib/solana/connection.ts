/**
 * Conexão Solana server-side via `@solana/kit` (ex-web3.js v2). Não importe
 * este módulo em componentes client (`src/components/wallet/**`) — ele
 * inicializa clientes RPC no top-level e não deve entrar no bundle client.
 */
import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { env } from "@/lib/env";

const DEFAULT_DEVNET_HTTP = "https://api.devnet.solana.com";
const DEFAULT_DEVNET_WS = "wss://api.devnet.solana.com";

function httpToWs(url: string): string {
  return url.replace(/^http/, "ws");
}

const rpcUrl = env.solanaRpc ?? DEFAULT_DEVNET_HTTP;
const rpcWsUrl = env.solanaRpc ? httpToWs(env.solanaRpc) : DEFAULT_DEVNET_WS;

/** Cliente RPC devnet. A rede da Verity é fixa em devnet (seção 0 do brief). */
export const rpc = createSolanaRpc(devnet(rpcUrl));

/** Cliente de RPC subscriptions (websocket), usado para confirmar transações. */
export const rpcSubscriptions = createSolanaRpcSubscriptions(devnet(rpcWsUrl));

const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

export type ExplorerKind = "tx" | "address";

/** Monta um link do Solana Explorer apontando para a rede configurada. */
export function explorerUrl(value: string, kind: ExplorerKind = "tx"): string {
  const path = kind === "tx" ? "tx" : "address";
  const suffix =
    env.solanaCluster === "mainnet-beta" ? "" : `?cluster=${env.solanaCluster}`;
  return `https://explorer.solana.com/${path}/${value}${suffix}`;
}

/**
 * Constrói, assina (com `feePayer` como único signer) e envia uma transação
 * com as instruções fornecidas, aguardando confirmação. Lança em caso de
 * falha — os chamadores (em `attest.ts`) tratam a degradação graciosa.
 */
export async function sendInstructions(
  feePayer: KeyPairSigner,
  instructions: readonly Instruction[],
): Promise<{ signature: string }> {
  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
  );

  const signedTransaction = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signedTransaction);

  // A transação foi construída com `setTransactionMessageLifetimeUsingBlockhash`
  // logo acima, então sabemos que ela tem lifetime de blockhash — mas a
  // assinatura genérica de `signTransactionMessageWithSigners` não preserva
  // esse refinamento de tipo, daí a asserção explícita.
  assertIsTransactionWithBlockhashLifetime(signedTransaction);
  await sendAndConfirmTransaction(signedTransaction, { commitment: "confirmed" });

  return { signature };
}
