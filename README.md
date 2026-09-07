# VERITY

**Seu trabalho. Verificado.**

Currículos e perfis afirmam contribuição em projetos open source, mas não provam nada: qualquer
pessoa pode escrever "contribuí para o React" sem que isso seja checado. A VERITY resolve esse
problema transformando contribuições reais no GitHub (Pull Requests, commits e issues) em
credenciais verificáveis, associadas a uma wallet Solana e auditáveis por qualquer terceiro sem
depender da palavra de quem afirma tê-las feito. Cada credencial carrega o hash da evidência que a
originou e, quando emitida on-chain, pode ser reconferida diretamente na rede, sem confiar no banco
de dados da aplicação.

---

## Demonstração (3 comandos, sem Docker, sem credenciais)

Pré-requisitos: Node 20 ou superior e npm.

```bash
npm install
npm run db:push && npm run db:seed
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). A aplicação sobe 100% navegável em modo
demonstração: `/p/emanuelly` já mostra um perfil com contribuições verificadas e credenciais
emitidas, sem nenhuma variável de ambiente configurada. Este fluxo foi validado de ponta a ponta
neste repositório: build de produção (`npm run build` seguido de `npm run start`), checagem de
tipos (`npm run typecheck`) e as rotas `/`, `/p/emanuelly` e `/api/health` respondendo HTTP 200
com dados reais do banco semeado.

Para recriar o banco do zero:

```bash
npm run demo:reset
```

---

## O que o protótipo faz hoje

- Conecta uma wallet Solana (Phantom, Solflare ou outra compatível com `@solana/wallet-adapter`)
  e associa o endereço à sessão do usuário.
- Vincula um usuário do GitHub, por OAuth (quando configurado) ou por vínculo manual digitando o
  username, sem exigir login.
- Sincroniza contribuições do GitHub (Pull Requests, commits e issues) via API pública ou via
  dataset determinístico de demonstração.
- Roda um motor de verificação determinístico (nada de heurística ou IA) sobre cada contribuição,
  produzindo veredito `VERIFIED` ou `REJECTED` com o motivo explícito de cada regra.
- Emite uma credencial ("Proof of Contribution") na Solana para contribuições verificadas, com
  degradação automática entre três modos de emissão (detalhados abaixo).
- Publica um perfil público (`/p/[handle]`) e uma página de verificação pública
  (`/verify/[attestationId]`) que qualquer terceiro pode abrir sem conta, e que reconsulta a
  Solana ao vivo em vez de confiar apenas no banco local.

---

## Arquitetura

Um único deploy Next.js 15 (App Router), TypeScript em modo strict e Tailwind v4, organizado em
quatro camadas:

1. **Fundação**: design system (`src/components/ui`, `src/components/brand`), contrato de tipos
   compartilhado (`src/lib/types.ts`) e Prisma com SQLite (`prisma/schema.prisma`, com schema
   pronto para trocar para Postgres apenas mudando o provider e `DATABASE_URL`).
2. **Backend**: sessão por cookie (`src/lib/session.ts`), cliente GitHub com OAuth opcional
   (`src/lib/github/**`), motor de verificação determinístico (`src/lib/verification/**`),
   dataset de demonstração (`src/lib/demo/**`) e rotas REST (`src/app/api/**`).
3. **Solana**: carteira no navegador (`src/components/wallet/**`), emissão e verificação de
   attestations usando `@solana/kit` e `sas-lib` (`src/lib/solana/**`), e uma extensão opcional
   e isolada com `solana-agent-kit` (`src/lib/agent/**`), que resume o saldo do emissor em
   linguagem natural e não está no caminho crítico da aplicação.
4. **Frontend**: landing, dashboard, contribuições, credenciais, configurações, perfil público
   (`/p/[handle]`) e verificação pública (`/verify/[attestationId]`).

### Fluxo do usuário

```
Conectar wallet -> Conectar GitHub -> Contribuições encontradas ->
Verification Engine -> Contribuição validada -> Emitir attestation ->
Solana -> Credencial na wallet -> Perfil público verificável por terceiros
```

O componente `StepFlow` (`src/components/app/StepFlow.tsx`) exibe esse progresso em cinco passos
no dashboard: conectar wallet, conectar GitHub, encontrar contribuições, verificar e emitir
credencial.

---

## Verification Engine

Motor de regras determinístico: mesma entrada produz sempre a mesma saída, sem heurística nem
modelo de linguagem envolvido. Uma contribuição só se torna `VERIFIED` quando todas as regras
bloqueantes passam; regras com `weight: 0` são apenas informativas e não bloqueiam o veredito. O
resultado completo (cada regra avaliada, mais um hash SHA-256 da evidência) é gravado em
`Contribution.evidence` e depois embutido no payload da credencial.

| Tipo | Regras |
|---|---|
| `PULL_REQUEST` | `author_match`, `repo_match`, `is_merged`, `not_self_merged_fork_only` (informativa), `has_content` |
| `COMMIT` | `author_match`, `repo_match`, `on_default_branch`, `has_content` |
| `ISSUE` | `author_match`, `repo_match`, `is_closed` |

Implementação: `src/lib/verification/rules.ts` (regras puras, sem I/O) e
`src/lib/verification/index.ts` (orquestração e cálculo do hash de evidência).

**Exemplo real de contribuição reprovada.** O dataset de demonstração inclui de propósito uma
contribuição que não deve passar: o PR `tailwindlabs/tailwindcss#14200` está semeado como aberto,
sem merge. Ao rodar a verificação sobre ele, a regra `is_merged` falha, conforme confirmado neste
repositório consultando o banco semeado:

```json
{
  "id": "is_merged",
  "label": "Pull Request mergeado",
  "passed": false,
  "detail": "Este PR ainda está aberto, não pode ser credenciado."
}
```

A contribuição resulta em `REJECTED`, mesmo com as outras quatro regras passando (`author_match`,
`repo_match`, `not_self_merged_fork_only`, `has_content`). A reprovação é seletiva e explicável,
não um bloqueio genérico: é a prova de que a verificação é real, e que nem toda contribuição
sincronizada vira credencial.

---

## Modos de emissão da attestation

A emissão degrada de forma automática, sempre nesta ordem, e a interface sempre indica qual modo
foi usado. Um mock nunca é apresentado como se fosse uma prova on-chain real.

| Modo | Quando é ativado | O que acontece |
|---|---|---|
| `sas` | `VERITY_ISSUER_SECRET_KEY` configurada e com saldo em devnet | Attestation real via Solana Attestation Service: cria `Credential` e `Schema` uma vez (idempotente) e depois uma `Attestation` on-chain por credencial, com PDA derivado deterministicamente a partir do id da contribuição. |
| `memo` | Emissor configurado, mas a tentativa `sas` falhou | Transação real na devnet usando o Memo Program, carregando `verity.poc.v1:<hash>`. Assinatura real, sem PDA de attestation. |
| `mock` | Nenhum emissor configurado (padrão em modo zero-setup) | Assinatura simulada e determinística (SHA-256 do hash, sem tocar a rede), rotulada como "modo demonstração" em toda a interface pública. |

### Como ativar o modo `sas`

```bash
solana-keygen new --no-bip39-passphrase --outfile issuer.json
solana airdrop 1 $(solana-keygen pubkey issuer.json) --url devnet
```

Recomenda-se gerar uma chave dedicada apenas para emissão em devnet, nunca reaproveitar uma chave
pessoal. Se o faucet estiver limitando pedidos, uma alternativa é transferir SOL de devnet de outra
carteira já financiada:

```bash
solana transfer --allow-unfunded-recipient $(solana-keygen pubkey issuer.json) 0.2 --url devnet
```

Em seguida, colar o conteúdo do array de bytes de `issuer.json` (ou a chave em base58) na variável
`VERITY_ISSUER_SECRET_KEY`, no arquivo `.env`. Configurar essa variável liga automaticamente o modo
`sas`. Como isso também tende a desligar o modo demo do GitHub por padrão (`NEXT_PUBLIC_DEMO_MODE`
em `auto` passa a tentar a API pública real), quem quiser manter o dataset determinístico do GitHub
junto com emissão real na Solana pode forçar:

```
NEXT_PUBLIC_DEMO_MODE="on"
```

### Como ativar o modo `memo`

O mesmo processo do modo `sas` acima, mas numa situação em que o programa SAS não esteja
disponível no cluster de destino. Na prática, em devnet o modo `sas` funciona na maioria dos casos;
`memo` é o degrau de segurança para quando ele não funciona.

---

## Prova on-chain

O banco semeado por `npm run db:seed` contém uma attestation real em devnet, emitida pelo fluxo
completo da aplicação (não por script isolado), para a contribuição
`microsoft/TypeScript#56780` da persona de demonstração Emanuelly:

- **Transação (assinatura):**
  [`z98gfn9J9xDEfnWWrzkVaHajoxPnRYdXVDwGzyGia8uSrHfGrJzWPdrBy3gWU8cYsHevuZBYLWLNW5o2Jf8oQCt`](https://explorer.solana.com/tx/z98gfn9J9xDEfnWWrzkVaHajoxPnRYdXVDwGzyGia8uSrHfGrJzWPdrBy3gWU8cYsHevuZBYLWLNW5o2Jf8oQCt?cluster=devnet)
- **Attestation PDA:**
  [`CQtWQDHmBm4fZJyWw8TRF6nT9QvpgcvZq4mTiwFYoRTk`](https://explorer.solana.com/address/CQtWQDHmBm4fZJyWw8TRF6nT9QvpgcvZq4mTiwFYoRTk?cluster=devnet)

Snapshot validado em `2026-09-07` após `npm run demo:reset`: a transação está confirmada, sem erro,
e a conta do PDA pertence ao programa do Solana Attestation Service, com os campos `verity.poc.v1`
e `VERIFIED` codificados nos dados on-chain.

Esse valor muda sempre que o demo é reinicializado com uma base nova, então trate esta seção como
um snapshot do último reset, não como um identificador permanente.

As outras cinco credenciais da Emanuelly são emitidas em modo `mock` de propósito, para não gastar
SOL de devnet a cada `npm run db:seed`, e aparecem claramente rotuladas como "modo demonstração"
na interface, nunca disfarçadas de reais.

Qualquer pessoa pode reproduzir essa checagem sem confiar no banco da aplicação: a página
`/verify/[attestationId]` rederiva o PDA a partir do emissor e do schema `verity.poc.v1` e compara
o hash on-chain com o hash gravado localmente. É a mesma lógica de `verifyOnChain()`
(`src/lib/solana/verifyAttestation.ts`), exposta publicamente em `GET /api/attestations/:id`, que
retorna `verification.onChain: true` e `verification.matches: true` quando a checagem confere,
conforme observado ao consultar essa rota localmente durante a validação deste README.

---

## Roteiro de demonstração

1. **Landing (`/`)**: apresenta a proposta em uma frase, "transformar contribuição digital
   verificável em credencial portátil, na Solana". O botão "Ver perfil de exemplo" leva a
   `/p/emanuelly`.
2. **Perfil público (`/p/emanuelly`)**: o produto do ponto de vista de quem verifica, sem precisar
   de conta. Mostra reputação com seis credenciais verificadas, wallet truncada e GitHub vinculado.
   Clicar em qualquer contribuição verificada.
3. **`/verify/[attestationId]`**: a página que sustenta a proposta central. Mostrar o veredito
   ("Credencial válida"), a seção "Checagem on-chain" (que reconsulta a Solana ao vivo em vez de
   confiar no banco), o link "Ver no Explorer" abrindo a transação real em devnet, e o hash de
   evidência com o payload JSON completo, deixando claro que apenas o hash vai para a cadeia, nunca
   dado sensível. Abrir também uma credencial em modo `mock` para mostrar o aviso de "modo
   demonstração": a honestidade do rótulo é o ponto central dessa tela.
4. Voltar para `/dashboard` com uma wallet de devnet conectada e mostrar o `StepFlow` de cinco
   passos. Vincular o GitHub (fluxo manual, sem OAuth, funciona sem credencial nenhuma).
5. **`/contributions`**: clicar em "Sincronizar com GitHub" (usa o dataset determinístico em modo
   demo, ou a API real quando configurada). Expandir a linha do PR
   `tailwindlabs/tailwindcss#14200` e clicar em "Verificar": este é o momento central da
   demonstração, porque a régua reprova a contribuição ao vivo, com o motivo explícito ("Este PR
   ainda está aberto, não pode ser credenciado"), provando que a verificação é real e não
   decorativa. Em seguida, verificar uma contribuição elegível (qualquer PR mergeado) e mostrar o
   veredito `VERIFIED`.
6. Clicar em "Emitir credencial" na contribuição recém verificada, narrando a degradação
   automática `sas -> memo -> mock` enquanto a chamada roda.
7. **`/credentials`**: a credencial recém emitida aparece no grid, com o cartão escuro "Proof of
   Contribution", o modo de emissão e ações para copiar o link público ou abrir no Explorer.
8. Fechar voltando para `/verify/[attestationId]` da credencial recém emitida, reforçando que
   qualquer terceiro pode conferir essa prova de forma independente.

---

## Variáveis de ambiente

Nenhuma variável é obrigatória além de `DATABASE_URL`, que já tem um valor padrão funcional. Tudo
que falta se traduz em degradação automática, nunca em um erro fatal.

| Variável | Ausente (padrão) | Preenchida |
|---|---|---|
| `DATABASE_URL` | Sempre tem um padrão: `file:./dev.db` | Aponta para outro banco (por exemplo, Postgres em produção) |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` | Rede usada para etiquetar e exibir as credenciais |
| `NEXT_PUBLIC_SOLANA_RPC` | RPC público de devnet (mais lento, sujeito a limite de requisições) | Endpoint dedicado (Helius, QuickNode, entre outros), mais rápido e estável |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth desativado; vínculo manual por username | Habilita "Conectar com GitHub" via OAuth real na tela de vínculo |
| `GITHUB_TOKEN` | Chamadas públicas ao GitHub sem autenticação (cerca de 60 requisições por hora) | Aumenta o limite de requisições da API do GitHub |
| `VERITY_ISSUER_SECRET_KEY` | Emissão cai para o modo `memo` ou `mock` | Liga o modo `sas`, com attestations reais via Solana Attestation Service |
| `NEXT_PUBLIC_DEMO_MODE` | `auto`, decide sozinho a partir das variáveis acima | `on` força o dataset determinístico do GitHub mesmo com `VERITY_ISSUER_SECRET_KEY` configurada; `off` força tentar as integrações reais mesmo sem estarem prontas |

O arquivo `.env` está listado em `.gitignore` (com exceção de `.env.example`, que documenta os
valores padrão). Uma chave de emissor real nunca deve ser commitada.

---

## Escopo do MVP

**Dentro do escopo:**
- Motor de verificação determinístico para Pull Request, commit e issue.
- Emissão real de attestations via Solana Attestation Service em devnet, com degradação
  automática para memo e depois para mock.
- Verificação pública independente, que rederiva o PDA e recompara o hash em vez de confiar
  cegamente no banco de dados.
- Fluxo 100% navegável sem nenhuma credencial configurada.

**Fora do escopo (limitações conhecidas):**
- Sem suporte a mainnet. Tudo roda em devnet; não há avaliação de custo ou segurança para
  produção.
- Sem revogação de credencial. Uma attestation emitida não pode ser invalidada pela aplicação
  (o Solana Attestation Service suporta revogação, mas isso não foi implementado aqui).
- Sem regras de verificação para o tipo `REVIEW`, apesar de esse tipo existir no contrato de
  dados (`ContributionType`, em `src/lib/types.ts`); não há regras definidas para reviews de PR
  ainda.
- O OAuth do GitHub é opcional e não foi testado com um GitHub App real neste ambiente; o vínculo
  manual (o usuário digita o username) é o caminho testado e garantido.
- Sem paginação em `/contributions` nem em `/api/contributions`: assume-se um volume pequeno de
  contribuições por usuário, adequado a um protótipo de ideathon.
- Sem testes automatizados (unitários ou end-to-end) além da validação manual descrita neste
  README. A garantia de qualidade vem de checagem de tipos e lint estritos, além de verificação
  manual ponta a ponta.
- `solana-agent-kit` (`src/lib/agent/`) é uma camada opcional e experimental: resume o saldo do
  emissor em linguagem natural, não está no caminho crítico da aplicação e não é usada pela
  interface.

---

## Qualidade

- `npm run typecheck` e `npm run build` passam sem erros, conforme validado durante a preparação
  deste README.
- TypeScript em modo strict, sem `any` em código de produção.
- Estados de carregamento, vazio e erro em toda tela que busca dados; nenhuma tela quebra sem
  wallet conectada ou sem GitHub vinculado.
- Layout responsivo de 360px até desktop, com foco visível (`:focus-visible`) consistente com a
  identidade da marca.
