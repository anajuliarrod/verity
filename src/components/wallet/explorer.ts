/**
 * Helper puro para montar links do Solana Explorer no cliente. Deliberadamente
 * duplicado (e não importado) de `src/lib/solana/connection.ts`: aquele módulo
 * inicializa clientes `@solana/kit` no top-level e não deve entrar no bundle
 * client-side. Este arquivo não importa nenhuma pilha Solana, só monta string.
 */
export function explorerAddressUrl(address: string, cluster: string): string {
  const suffix = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
