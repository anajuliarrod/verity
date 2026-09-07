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

## Demonstração local

Pré-requisitos: Node 20 ou superior, npm, e um banco Postgres alcançável (o schema usa
`provider = "postgresql"`, não há mais fallback automático para SQLite). O caminho mais rápido é
criar um projeto gratuito no [Neon](https://neon.tech) (sem cartão de crédito) e copiar as duas
connection strings que ele fornece (pooler e direta).

```bash
cp .env.example .env
# editar .env: preencher DATABASE_URL (pooler do Neon) e DIRECT_URL (conexão direta)
npm install
npm run db:push && npm run db:seed
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Com o banco preenchido pelo seed,
`/p/emanuelly` mostra um perfil com contribuições verificadas e credenciais emitidas. As demais
integrações (GitHub, Solana) continuam com degradação automática e não exigem configuração
adicional: sem `VERITY_ISSUER_SECRET_KEY` a emissão cai para o modo `mock`, e sem `GITHUB_TOKEN` as
chamadas à API do GitHub seguem anônimas (ou em modo demo, se `NEXT_PUBLIC_DEMO_MODE` estiver
`on`/`auto` sem token).

Para recriar o banco do zero:

```bash
npm run demo:reset
```

**Atenção antes de rodar `demo:reset` ou `db:seed` com um emissor real configurado**: o script
apaga e recria o banco por completo (`prisma db push --force-reset`) e depois roda o seed de novo.
Como o seed só reaproveita uma attestation real quando encontra uma já registrada no banco para
aquela contribuição, e o reset apaga esse registro, a primeira contribuição verificada emite uma
attestation nova de verdade na Solana devnet a cada `demo:reset`, com `VERITY_ISSUER_SECRET_KEY`
configurada. Isso consome SOL de devnet do emissor e gera uma assinatura diferente da vez anterior,
invalidando qualquer transação ou PDA já citados em documentação (ver seção "Prova on-chain"
abaixo). Sem `VERITY_ISSUER_SECRET_KEY` configurada, o reset não gasta SOL nenhum: toda emissão cai
no modo `mock`.

**Nota de honestidade sobre este README**: o projeto começou com Prisma+SQLite, o que permitia um
`npm install && npm run dev` verdadeiramente sem nenhuma credencial. Depois da migração para
Postgres (Neon), esse zero-setup total deixou de existir: um banco Postgres alcançável (mesmo que
gratuito) é hoje um pré-requisito real para rodar o projeto localmente ou em produção. O restante
das integrações (GitHub, Solana) continua opcional, com degradação automática.

---

## Deploy em produção

A aplicação está publicada na Vercel, com Postgres gerenciado pelo Neon:

**[https://verity-seven-xi.vercel.app](https://verity-seven-xi.vercel.app)**

Status confirmado em `2026-09-07`, testado diretamente com `curl` contra a URL acima e contra o RPC
público da devnet (`https://api.devnet.solana.com`), não é suposição nem alegação da própria
aplicação:

- Landing (`/`) e as páginas `/dashboard`, `/contributions`, `/credentials`, `/settings`,
  `/p/emanuelly` e `/verify/<id>` respondem HTTP 200 (a casca da aplicação carrega).
- `GET /api/health` responde `ok`, com `modes.db: "connected"` e `modes.solana: "sas"` (há uma
  chave de emissor real configurada em produção).
- **O schema do banco de produção foi aplicado e o banco foi semeado.** `npx prisma migrate
  deploy` rodou com sucesso contra o Postgres de produção do Neon (migration
  `20260907142615_init`), seguido de `npm run db:seed`. Como resultado, `GET
  /api/profile/emanuelly` responde HTTP 200 com dados reais (a persona de demonstração completa,
  com seis contribuições verificadas e uma reprovada), e `GET /api/attestations/:id` responde
  `verification.onChain: true` e `verification.matches: true` para a credencial real. A
  demonstração completa descrita em "Roteiro de demonstração" já funciona direto na URL de
  produção, não só localmente; ver a seção "Prova on-chain" abaixo para a credencial real
  verificada em produção, com transação e conta confirmadas diretamente no RPC da devnet.
- **Pendência restante**: confirmar a variável `VERITY_SESSION_SECRET` na Vercel e redeployar.
  Como o repositório é público, o valor de fallback usado quando essa variável está ausente é
  visível no código-fonte; enquanto o deploy ativo não tiver `VERITY_SESSION_SECRET` definida e
  redeployada, sessão por wallet, vínculo de GitHub e emissão de attestation continuam expostas a
  esse fallback conhecido, em vez de falharem explicitamente como o código já prevê para produção
  (ver `DEPLOY.md`, seção 3). É a única ação de configuração que ainda falta para fechar esse
  ponto.

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
   compartilhado (`src/lib/types.ts`) e Prisma com Postgres (`prisma/schema.prisma`, banco gerenciado
   pelo Neon em produção, com `DATABASE_URL` apontando para o pooler e `DIRECT_URL` para a conexão
   direta, usada pelas migrações).
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

O banco de produção, semeado em `2026-09-07` por `npm run db:seed` contra o Postgres do Neon,
contém uma attestation real em devnet, emitida pelo fluxo completo da aplicação (não por script
isolado), para a contribuição `microsoft/TypeScript#56780` da persona de demonstração Emanuelly.
Três verificações independentes confirmam a mesma credencial e se checam mutuamente:

1. **Página pública de verificação, na própria aplicação em produção:**
   [`https://verity-seven-xi.vercel.app/verify/cmtrco3960006va31l2h7ak97`](https://verity-seven-xi.vercel.app/verify/cmtrco3960006va31l2h7ak97)
2. **Transação (assinatura), no Solana Explorer:**
   [`28xqQjKmvDwQ1TULXfJUvPHGdP31Yj1bGzQeTxoZ2hhfFdTRYrJZQ2YQL31JzsuxTg7qezF2YHobV83aFAvevD2j`](https://explorer.solana.com/tx/28xqQjKmvDwQ1TULXfJUvPHGdP31Yj1bGzQeTxoZ2hhfFdTRYrJZQ2YQL31JzsuxTg7qezF2YHobV83aFAvevD2j?cluster=devnet)
3. **Conta do Attestation PDA, também no Solana Explorer:**
   [`6HbyFVWJs5WPZiem6YF5JLLqzt3THCTBF4hdShCKgEUR`](https://explorer.solana.com/address/6HbyFVWJs5WPZiem6YF5JLLqzt3THCTBF4hdShCKgEUR?cluster=devnet)

Validado em `2026-09-07` consultando o RPC da devnet diretamente (não apenas a interface do
Explorer ou a aplicação): a transação está confirmada, sem erro (`err: null`), consumindo 6118 de
200000 unidades de computação disponíveis; a conta do PDA tem 338 bytes, pertence ao programa do
Solana Attestation Service (`22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`) e contém em texto os
campos `verity.poc.v1` e `VERIFIED`, com o hash de evidência
`3b768105980bfea7575acd57c7385b99823ba7ed8286ec5892822b2a09ee4bc4` codificado nos dados on-chain,
igual ao hash retornado por `GET /api/attestations/cmtrco3960006va31l2h7ak97` em produção.

Esse valor muda sempre que o banco é reinicializado com uma base nova (ver aviso sobre
`demo:reset` em "Demonstração local"), então trate esta seção como um snapshot do seed mais
recente aplicado em produção, não como um identificador permanente. O emissor de devnet usado em
produção (`ApnZZgybYK9fNQKuzpMuG5zxTmFnrKMtdcyD3V4AECKC`) ficou com aproximadamente 0,178 SOL após
este seed; cada seed com emissão real consome cerca de 0,0024 SOL desse saldo.

As outras cinco credenciais da Emanuelly são emitidas em modo `mock` de propósito, para não gastar
SOL de devnet a cada `npm run db:seed`, e aparecem claramente rotuladas como "modo demonstração"
na interface, nunca disfarçadas de reais.

Qualquer pessoa pode reproduzir essa checagem sem confiar no banco da aplicação: a página
`/verify/[attestationId]` rederiva o PDA a partir do emissor e do schema `verity.poc.v1` e compara
o hash on-chain com o hash gravado localmente. É a mesma lógica de `verifyOnChain()`
(`src/lib/solana/verifyAttestation.ts`), exposta publicamente em `GET /api/attestations/:id`, que
retorna `verification.onChain: true` e `verification.matches: true` quando a checagem confere,
conforme observado ao consultar essa rota diretamente em produção.

Esta transação e este PDA são permanentes na devnet independente de qualquer banco de dados
(Solana não "esquece" uma conta confirmada). O que depende do banco é conseguir *ver* essa
attestation pela interface: em produção, ela já aparece em `/p/emanuelly`, porque o banco foi
migrado e semeado nesta rodada (ver "Deploy em produção" acima).

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

`DATABASE_URL` e `DIRECT_URL` são obrigatórias (Postgres, ver seção "Deploy em produção" acima).
Todas as outras variáveis são opcionais: o que faltar se traduz em degradação automática, nunca em
um erro fatal, com uma única exceção de segurança (`VERITY_SESSION_SECRET`, detalhada abaixo).

| Variável | Ausente | Preenchida |
|---|---|---|
| `DATABASE_URL` | **Obrigatória.** Sem ela o Prisma não conecta a nenhum banco. Deve apontar para o pooler do Postgres (Neon: endpoint com `-pooler` no host). | Aponta para o banco Postgres usado em runtime. |
| `DIRECT_URL` | **Obrigatória para rodar migrações** (`db push`/`migrate`). Deve apontar para a conexão direta (sem pooler) do mesmo banco. | Usada só por `prisma migrate`/`db push`, nunca em runtime. |
| `VERITY_SESSION_SECRET` | Em desenvolvimento, usa um valor fixo só para não travar o zero-setup local. **Em produção (`NODE_ENV=production`), a ausência desta variável faz o app falhar explicitamente** ao assinar/validar sessão, em vez de usar esse valor conhecido publicamente neste repositório. | Segredo usado para assinar o cookie de sessão. Gerar com `openssl rand -hex 32`. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` | Rede usada para etiquetar e exibir as credenciais |
| `NEXT_PUBLIC_SOLANA_RPC` | RPC público de devnet (mais lento, sujeito a limite de requisições) | Endpoint dedicado (Helius, QuickNode, entre outros), mais rápido e estável |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth desativado; vínculo manual por username | Habilita "Conectar com GitHub" via OAuth real na tela de vínculo |
| `GITHUB_TOKEN` | Chamadas públicas ao GitHub sem autenticação (cerca de 60 requisições por hora) | Aumenta o limite de requisições da API do GitHub |
| `VERITY_ISSUER_SECRET_KEY` | Emissão cai para o modo `memo` ou `mock` | Liga o modo `sas`, com attestations reais via Solana Attestation Service |
| `NEXT_PUBLIC_DEMO_MODE` | `auto`, decide sozinho a partir das variáveis acima | `on` força o dataset determinístico do GitHub mesmo com `VERITY_ISSUER_SECRET_KEY` configurada; `off` força tentar as integrações reais mesmo sem estarem prontas |

O arquivo `.env` está listado em `.gitignore` (com exceção de `.env.example`, que documenta os
valores padrão, sem nenhum segredo real). Uma chave de emissor real, string de conexão com senha,
ou `VERITY_SESSION_SECRET` real nunca devem ser commitados. O histórico do git deste repositório
(público) foi auditado e nenhum segredo real foi encontrado em nenhum commit.

---

## Escopo do MVP

**Dentro do escopo:**
- Motor de verificação determinístico para Pull Request, commit e issue.
- Emissão real de attestations via Solana Attestation Service em devnet, com degradação
  automática para memo e depois para mock.
- Verificação pública independente, que rederiva o PDA e recompara o hash em vez de confiar
  cegamente no banco de dados.
- Fluxo 100% navegável sem nenhuma credencial de GitHub ou Solana configurada (só o Postgres é
  obrigatório, ver "Variáveis de ambiente").
- Migration inicial versionada em `prisma/migrations/`, já aplicada em produção via `prisma migrate
  deploy`, para que produção use esse comando em vez de `db push` daqui em diante.
- Rate limiting simples, em memória e por IP, nas duas rotas que chamam a API pública do GitHub
  (`POST /api/auth/github/link` e `GET /api/contributions?refresh=1`), para não deixar um único
  cliente esgotar a cota anônima compartilhada por toda a aplicação.

**Fora do escopo (limitações conhecidas):**
- Sem suporte a mainnet. Tudo roda em devnet; não há avaliação de custo ou segurança para
  produção.
- O rate limiting acima é em memória por instância serverless, não distribuído: é uma proteção
  básica contra abuso casual, não um limite garantido sob múltiplas instâncias simultâneas da
  Vercel. Um limite real exigiria um store compartilhado (ex. Upstash Redis), fora de escopo aqui
  por exigir uma dependência/infra nova.
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
