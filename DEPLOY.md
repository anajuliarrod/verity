# Verity: plano de deploy

Este documento nasceu como um plano executável para colocar o Verity no ar. **O deploy já aconteceu**: o app está publicado na Vercel (`https://verity-seven-xi.vercel.app`) com Postgres gerenciado pelo Neon, o `prisma/schema.prisma` já usa `provider = "postgresql"` com `DATABASE_URL`/`DIRECT_URL`, e o repositório já está no GitHub (`https://github.com/anajuliarrod/verity`, público). O texto original abaixo foi mantido como referência técnica (as explicações de *por quê* continuam corretas), mas partes que descreviam passos futuros ("trocar o provider", "inicializar o git") já foram executadas; onde isso importa, uma nota de auditoria abaixo marca o que já está feito e o que uma auditoria em `2026-09-07` encontrou quebrado em produção.

## Status desta auditoria (2026-09-07)

Testado com `curl` direto contra a URL de produção, não é suposição.

Registro histórico do que foi encontrado mais cedo neste mesmo dia (mantido porque explica a causa
raiz, mas já corrigido, ver a atualização logo abaixo):

- Landing e as páginas internas (`/dashboard`, `/contributions`, `/credentials`, `/settings`,
  `/p/emanuelly`, `/verify/<id>`) respondiam HTTP 200.
- `GET /api/health` respondia `ok: true`, `modes.db: "connected"`, `modes.solana: "sas"`.
- **Banco de produção sem schema aplicado.** `GET /api/profile/emanuelly` e `GET
  /api/attestations/:id` (e por extensão qualquer rota que tocasse `User`/`Contribution`/`Attestation`)
  respondiam `500 INTERNAL_ERROR`. Verificado diretamente contra o Postgres de produção (mesmas
  credenciais do `.env` local, branch `production` do Neon): `SELECT table_name FROM
  information_schema.tables WHERE table_schema = 'public'` retornava **zero linhas**. O `SELECT 1` do
  health check passava porque não depende de nenhuma tabela existir; qualquer query real falhava.
- Causa mais provável: o `.env` local (que replica as credenciais de produção) tinha
  `DATABASE_URL_UNPOOLED`, não `DIRECT_URL` (nome que `prisma/schema.prisma` exige para
  `migrate`/`db push`). Sem essa variável com o nome certo, o comando que deveria ter criado o
  schema em produção falhava, e aparentemente ninguém notou porque `next build` não depende do banco
  para compilar.
- `src/lib/session.ts` foi corrigido nesta auditoria: o fallback de segredo de sessão
  (`"verity-poc-dev-session-secret-fallback-2026"`, já identificado como risco crítico pela seção 3
  original abaixo) agora só é usado fora de produção. Em produção, sem `VERITY_SESSION_SECRET`
  configurada, qualquer operação de sessão (login por wallet, vínculo de GitHub, emissão de
  attestation) falha explicitamente em vez de aceitar o segredo público conhecido.
- Rate limiting simples (em memória, por IP) foi adicionado nas duas rotas identificadas na seção
  6.1 abaixo (`POST /api/auth/github/link` e `GET /api/contributions?refresh=1`).

### Atualização, mais tarde no mesmo dia: migration e seed aplicados em produção

`npx prisma migrate deploy` rodou com sucesso contra o Postgres de produção do Neon, aplicando a
migration `20260907142615_init`, a partir de uma máquina local com acesso direto às credenciais de
produção (fora do sandbox que bloqueou essa escrita mais cedo neste mesmo dia). Em seguida, `npm
run db:seed` populou o banco: seis contribuições verificadas, uma reprovada, uma attestation `sas`
real e cinco `mock`.

Confirmado com `curl` contra a URL de produção depois dessas duas execuções:

- `GET /api/profile/emanuelly` responde HTTP 200 com dados reais (antes respondia `500`).
- `GET /api/attestations/cmtrco3960006va31l2h7ak97` responde `verification.onChain: true` e
  `verification.matches: true`.
- `GET /verify/cmtrco3960006va31l2h7ak97` responde HTTP 200.

E confirmado diretamente contra o RPC da devnet (`https://api.devnet.solana.com`), sem depender da
aplicação nem do Explorer: a conta `6HbyFVWJs5WPZiem6YF5JLLqzt3THCTBF4hdShCKgEUR` existe, tem 338
bytes, é `owner`ed pelo programa do Solana Attestation Service
(`22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`), contém em texto `verity.poc.v1` e `VERIFIED`, e a
transação `28xqQjKmvDwQ1TULXfJUvPHGdP31Yj1bGzQeTxoZ2hhfFdTRYrJZQ2YQL31JzsuxTg7qezF2YHobV83aFAvevD2j`
está confirmada com `err: null`, consumindo 6118 de 200000 unidades de computação. Ver "Prova
on-chain" no README para os três links que se confirmam mutuamente (página de verificação da
aplicação, transação no Explorer, conta do PDA no Explorer).

Sobre `DIRECT_URL` na Vercel: como a migration foi aplicada rodando o comando a partir de uma
máquina local (não como parte do build da própria Vercel), a ausência dessa variável no ambiente
da Vercel deixou de ser um bloqueio hoje. Ela permanece uma **recomendação**, não mais uma
pendência crítica: se algum dia a equipe quiser rodar `prisma migrate deploy` automaticamente como
parte do pipeline de build/deploy (seção 8.1), `DIRECT_URL` com o nome exato volta a ser
obrigatória na Vercel, pelo mesmo motivo original (seção 2.4). Enquanto migrações continuarem
sendo aplicadas manualmente a partir de uma máquina com as credenciais corretas, não há
urgência em configurá-la lá.

Sobre o consumo de SOL: o emissor de devnet usado em produção
(`ApnZZgybYK9fNQKuzpMuG5zxTmFnrKMtdcyD3V4AECKC`) ficou com aproximadamente 0,178 SOL de saldo depois
deste seed (`getBalance` via RPC). Cada seed com emissão real (ou seja, rodado contra um banco sem
attestation `sas` prévia para a primeira contribuição elegível) consome cerca de 0,0024 SOL desse
saldo. Ver o aviso sobre `demo:reset` no README e a seção 2.5 abaixo para o mecanismo exato.

**Pendência que continua aberta**: confirmar `VERITY_SESSION_SECRET` na Vercel e redeployar.
Migration e seed não dependem dessa variável, então ela segue pendente independentemente do que foi
resolvido acima. Como o repositório é público, o fallback conhecido no código-fonte continua sendo
o segredo efetivamente em uso pelo deploy ativo até essa variável ser definida e um novo deploy
publicado; até lá, sessão por wallet, vínculo de GitHub e emissão de attestation em produção
dependem desse segredo público, em vez de falharem explicitamente como o código já prevê.

---

## 1. Recomendação principal

**Vercel para a aplicação Next.js, Neon para o Postgres gerenciado.**

Justificativa curta: o projeto já é um Next.js App Router puro, sem servidor customizado, sem WebSocket próprio no lado da aplicação (o único WebSocket é o RPC subscriptions da Solana, que é client-to-RPC-externo, não passa pelo servidor da app) e sem processos de background. Isso é exatamente o caso de uso central da Vercel: build zero-config a partir de `package.json` (`next build`), preview deployments automáticos por PR (útil para o ideathon, onde o time provavelmente vai iterar rápido), HTTPS e domínio grátis em `*.vercel.app`, e integração nativa com Neon (Postgres serverless com free tier real) direto do marketplace da própria Vercel.

Trade-off que estou aceitando conscientemente: Vercel roda a aplicação em funções serverless, não em um processo Node de longa duração. Isso tem duas implicações diretas neste código:

- Prisma em serverless precisa de connection pooling (ver seção 2), senão esgota conexões do Postgres sob qualquer concorrência.
- O `getIssuerSigner()` em `src/lib/solana/issuer.ts` usa um cache em memória de módulo (`cachedIssuer`). Em serverless esse cache não é compartilhado entre invocações/instâncias frias, então cada cold start volta a decodificar a chave. Isso é barato (é só `bs58.decode` + `createKeyPairSignerFromBytes`), então não é um problema real de performance, mas explica por que não adianta tratar esse cache como singleton "de verdade" em produção.

Alternativas consideradas e por que não são a recomendação agora:

- **Railway**: também é zero-config, e tem a vantagem de rodar um processo Node persistente (sem cold start, sem armadilha de connection pooling do Prisma). É uma boa alternativa se a equipe sentir dor com o pooling do Postgres na Vercel. Custo inicial comparável (free trial com crédito, depois pago por uso).
- **Render**: parecido com Railway, free tier de web service dorme após inatividade (cold start de ~30s a ~1min), o que é ruim especificamente durante uma apresentação ao vivo. Por isso não é a primeira escolha para o cenário "demo na hora".
- **Fly.io**: mais controle (regiões, Postgres próprio via Fly Postgres), mas exige mais configuração manual (`fly.toml`, Dockerfile ou buildpack) para um ganho que o protótipo não precisa agora.
- **VPS (ex.: DigitalOcean/Hetzner droplet)**: full controle, mas exige provisionar Node, reverse proxy, certificado TLS, systemd/PM2 e todo o trabalho de deploy manual à mão. É desproporcional para um protótipo de ideathon com um único serviço stateless.

Se em algum momento o projeto quiser rodar migrações longas, jobs em background (ex.: sincronização periódica de contribuições do GitHub sem depender do usuário clicar em "refresh"), ou processos de indexação Solana, Railway ou Fly.io passam a ser mais adequados que Vercel, porque oferecem processo persistente. Registro isso como decisão em aberto para depois do ideathon, não para agora.

---

## 2. Migração de SQLite para Postgres gerenciado

### 2.1 Provedor: Neon

Neon é a recomendação porque tem free tier funcional (sem cartão de crédito para o tier gratuito), branching de banco (útil para preview deployments da Vercel, cada PR pode ganhar seu próprio branch de banco), e integração de um clique no marketplace da Vercel, que já provisiona as variáveis de ambiente automaticamente. Supabase é uma alternativa equivalente (também tem free tier e Postgres puro), mas carrega funcionalidades que o Verity não usa hoje (auth, storage, realtime), então Neon é mais direto para o escopo atual.

### 2.2 Trocar o provider no schema

Arquivo: `prisma/schema.prisma`. O repositório já usa este formato:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Trocar para:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Isso já está aplicado no repositório atual. O próximo passo é apontar `DATABASE_URL` e `DIRECT_URL` para o banco do Neon e gerar a primeira migration.

Ponto de atenção: o schema atual não usa nenhum tipo ou SQL específico de SQLite, exatamente como o comentário do arquivo já registra ("Sem SQL cru dependente de dialeto"). Os campos `String` livres usados para `evidence`, `raw` e `payload` (JSON serializado como texto) funcionam sem alteração em Postgres. Não há necessidade de migrar esses campos para o tipo `Json` nativo do Postgres agora; é uma melhoria futura, não um bloqueio.

### 2.3 `prisma migrate` versus `db push`

**Atualização da auditoria de 2026-09-07**: o `package.json` ainda só tinha o script `db:push`, e não havia nenhuma pasta `prisma/migrations/` no repositório, o que indica que só `db push` foi usado até agora (nunca `migrate`). Essa auditoria gerou a migration baseline sem precisar de acesso a nenhum banco (`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, que só lê o arquivo de schema), então ela já está commitável em `prisma/migrations/<timestamp>_init/migration.sql` + `prisma/migrations/migration_lock.toml`. Isso destrava o caminho abaixo sem precisar rodar `prisma migrate dev` contra um banco de verdade primeiro.

Texto original mantido como referência do racional:

O `package.json` hoje só tem o script `db:push` (`prisma db push`). Para produção, a recomendação é trocar para `prisma migrate deploy`, porque `db push` não gera histórico de migração (não versiona o schema, força alinhamento imperativo). Passo a passo, agora que a migration inicial já existe:

```bash
# 1. Commitar a pasta prisma/migrations no git (já gerada nesta auditoria).

# 2. Em produção (CI/CD ou manualmente, com DATABASE_URL + DIRECT_URL de produção):
npx prisma migrate deploy
```

`prisma migrate deploy` é idempotente e seguro para rodar em cada deploy (não pede confirmação interativa, não tenta gerar uma nova migration, só aplica as que faltam). É essa a chamada que deve entrar em um passo de build/release do pipeline, não `db push`, que continua útil apenas para iteração local rápida. Esse é exatamente o comando pendente para destravar a produção hoje: o banco do Neon está sem nenhuma tabela (ver "Status desta auditoria" no topo deste arquivo).

### 2.4 Connection pooling em serverless: a armadilha

Isto é a armadilha clássica de Prisma + Vercel, e vale explicar por quê. Cada invocação de função serverless na Vercel pode subir uma instância nova, e cada instância do Prisma Client abre seu próprio pool de conexões TCP com o Postgres. Sob tráfego concorrente (múltiplas invocações simultâneas, que é o comportamento normal do App Router mesmo com poucos usuários, já que cada rota de API é uma função separada), isso esgota rapidamente o limite de conexões do Postgres, que no Neon free tier costuma ser baixo.

A solução padrão, que o Neon já resolve nativamente, é usar duas URLs distintas:

- `DATABASE_URL`: aponta para o **pooler** do Neon (endpoint com `-pooler` no host, protocolo PgBouncer em modo transaction). É essa URL que o Prisma Client usa em runtime, para todas as queries da aplicação.
- `DIRECT_URL`: aponta para a conexão **direta** ao Postgres, sem pooler. É essa URL que `prisma migrate deploy` precisa usar, porque o PgBouncer em modo transaction não suporta os comandos DDL que uma migração eventualmente precisa (`SET search_path`, prepared statements de metadados etc.).

O Neon fornece as duas strings de conexão automaticamente no painel do projeto (uma com `-pooler`, outra sem). O `directUrl` no bloco `datasource` (seção 2.2) é exatamente o mecanismo do Prisma para essa separação: `migrate` usa `directUrl` quando presente, o client em runtime usa `url`.

Sem isso, o sintoma típico em produção é erro `too many connections` ou `FATAL: remaining connection slots are reserved` sob qualquer carga simultânea, mesmo baixa.

### 2.5 Semear o banco de demonstração em produção

O script existente é `npm run db:seed` (`tsx prisma/seed.ts`), que faz upsert idempotente do usuário demo (`DEMO_USER`) e de contribuições determinísticas, emitindo attestations reais só para a primeira (respeitando o `VERITY_ISSUER_SECRET_KEY` configurado) e `mock` para as demais, exatamente para não gastar SOL de devnet a cada seed.

Nuance importante: isso é idempotente por banco, não por reset. Rodar `demo:reset` recria a base do zero (`prisma db push --force-reset`), apagando o registro de attestation existente; na sequência, `prisma/seed.ts` não encontra `existingAttestation` para a primeira contribuição elegível e chama `issueAttestation()` sem `forceMode`, o que emite uma attestation nova de verdade na Solana devnet (gastando SOL do emissor) sempre que `VERITY_ISSUER_SECRET_KEY` está configurada. Por isso, qualquer transação ou PDA citada em documentação deve ser tratada como snapshot do último seed, nunca como valor permanente.

**Correção sugerida (não aplicada nesta limpeza, arquivo é de outro agente)**: em `prisma/seed.ts`, a linha `const forceMode = realAttestationIssued ? "mock" : undefined;` (dentro do laço principal) é o ponto exato que decide emitir uma attestation real. Trocar essa condição para também exigir um opt-in explícito, por exemplo `const forceMode = realAttestationIssued || !process.env.VERITY_SEED_ISSUE_REAL ? "mock" : undefined;`, faria `db:seed`/`demo:reset` cair em modo `mock` por padrão (sem gastar SOL nem gerar assinatura nova), reservando a emissão real em devnet para quando alguém definir `VERITY_SEED_ISSUE_REAL=1` de propósito, ao preparar uma nova prova on-chain para a documentação. Isso preserva o comportamento atual para quem quiser uma attestation real, mas deixa de gastar SOL do emissor a cada reset acidental.

Para rodar contra o Postgres de produção:

```bash
DATABASE_URL="<connection string do pooler do Neon>" DIRECT_URL="<conexão direta do Neon>" npm run db:seed
```

Rodar isso uma vez manualmente após o primeiro `prisma migrate deploy`, a partir de uma máquina com acesso à `DATABASE_URL` de produção (não precisa ser dentro do pipeline de CI, dado que é uma operação pontual e idempotente, mas pode virar um job manual do GitHub Actions com `workflow_dispatch` se a equipe preferir repetibilidade controlada). Como o seed é idempotente (upsert por chave única), é seguro rodar de novo se for preciso resetar o estado da demo.

**Nota da auditoria de 2026-09-07**: `prisma/seed.ts` não depende de nenhum SQL específico de dialeto (só usa o Prisma Client), então roda em Postgres sem alteração. **Atualização, mais tarde no mesmo dia**: tanto `migrate deploy` quanto `db:seed` já rodaram com sucesso contra a `DATABASE_URL`/`DIRECT_URL` de produção reais (ver "Status desta auditoria" no topo deste arquivo); o banco de produção está migrado e semeado, com uma attestation `sas` real e cinco `mock`.

---

## 3. Variáveis de ambiente em produção

Lista baseada em `src/lib/env.ts` e `.env.example`, variável por variável, com o que acontece se ficar vazia:

| Variável | Se vazia em produção | Ação recomendada |
|---|---|---|
| `DATABASE_URL` | Se ficar apontando para `file:./dev.db`, o Prisma não conseguirá falar com o schema Postgres em produção. Em Vercel, isso quebra o app porque o filesystem não é persistente. | **Obrigatória.** Definir com a connection string do pooler do Neon (seção 2.4). |
| `DIRECT_URL` | Necessária para `prisma migrate deploy` e para o fluxo de migração do Neon. Sem ela na Vercel, migrações rodadas como parte do build/deploy podem falhar ou tentar usar o pooler para DDL. **Atualizado em 2026-09-07**: deixou de ser um bloqueio hoje porque a migration foi aplicada com sucesso rodando `prisma migrate deploy` a partir de uma máquina local com a conexão direta correta, fora do fluxo de build da Vercel (ver "Status desta auditoria" no topo deste arquivo). | **Recomendada**, não mais uma pendência crítica: definir na Vercel com a conexão direta do mesmo banco só volta a ser necessário se a equipe passar a rodar migrações automaticamente como parte do pipeline de build/deploy (seção 8.1). Enquanto migrações continuarem sendo aplicadas manualmente, não é urgente. |
| `VERITY_SESSION_SECRET` | **Este é o item mais importante desta seção.** `src/lib/session.ts` tinha um fallback hardcoded (`"verity-poc-dev-session-secret-fallback-2026"`), usado sempre que a env var não estava configurada, inclusive em produção. Esse fallback é público (está no código-fonte, que é um repositório público). Um agravante confirmado nesta auditoria: o `userId` necessário para forjar o cookie de outra pessoa não precisa ser adivinhado, ele aparece em respostas públicas (`serializeContribution` inclui `userId`, exposto por `GET /api/profile/:handle` e `GET /api/attestations/:id`, ambas sem autenticação). **Corrigido nesta auditoria** (2026-09-07): `resolveSessionSecret()` em `session.ts` agora lança erro explícito quando `NODE_ENV === "production"` e a env var está vazia, em vez de cair silenciosamente no fallback conhecido. A checagem é lazy (só roda quando uma sessão é de fato assinada/validada), para não arriscar quebrar a etapa de coleta de dados de rota do `next build`. | **Obrigatória antes de expor publicamente.** Gerar um valor aleatório forte: `openssl rand -hex 32`. Configurar como env var secreta na Vercel. Com a correção de código já aplicada, se essa variável não estiver configurada em produção, o sintoma passa a ser erro 500 nas rotas de sessão (visível), não mais uma falha de segurança silenciosa. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Default `"devnet"` (linha 19-20 de `env.ts`). Comportamento correto e intencional para esta fase do projeto. | Manter `devnet`. Não definir como `mainnet-beta` (ver seção 5). |
| `NEXT_PUBLIC_SOLANA_RPC` | Vazia = usa o RPC público de devnet (`https://api.devnet.solana.com`, hardcoded em `src/lib/solana/connection.ts:24`). Funciona, mas é compartilhado publicamente e sujeito a rate limit agressivo, o que pode quebrar a emissão de attestation bem na hora da demo se muita gente estiver testando o devnet ao mesmo tempo. | Recomendado configurar um RPC dedicado (Helius ou QuickNode têm free tier de devnet) para não depender do RPC público na hora da apresentação. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Vazias = `isGithubOAuthEnabled` fica `false` (`env.ts:34-36`), e o fluxo cai para vínculo manual por username em `/api/auth/github/link`. É uma degradação graciosa por design, não um erro. | Ver seção 4 para decidir se vale configurar OAuth real para a demo. |
| `GITHUB_TOKEN` | Vazia = chamadas à API do GitHub sem autenticação, limite baixo (~60 req/h por IP, e esse IP é compartilhado por toda a infraestrutura da Vercel na região, o que é pior do que parece). Também ativa `isDemoMode` automaticamente quando `demoModeSetting` está em `"auto"` (regra em `env.ts:46-51`: modo demo liga sozinho se não há `githubToken` **e** não há emissão real configurada). | Fortemente recomendado configurar um Personal Access Token (mesmo sem escopos, um token classic vazio já sobe o limite para 5000 req/h) para a app não cair em modo demo sem querer, e para não ficar refém do rate limit compartilhado da Vercel. |
| `VERITY_ISSUER_SECRET_KEY` | Vazia = `isRealAttestationEnabled` é `false`, emissão cai direto para o modo `memo` (se der para enviar transação, mas sem chave não há signer, então cai para `mock`, ver `src/lib/solana/issuer.ts` e `attest.ts:288-303`). Ou seja, sem essa variável a emissão de attestation é sempre simulada (`mock`), nunca on-chain. | Ver seção 5 para gerar e configurar. Decisão de produto: se a demo quer mostrar attestation real on-chain, esta variável é obrigatória. |
| `NEXT_PUBLIC_DEMO_MODE` | Vazia = `"auto"`, que decide sozinho com base nas duas variáveis acima. | Manter `"auto"` é razoável. Se a equipe quiser forçar modo demo determinístico para a apresentação (evitar qualquer dependência de rede externa no momento da demo), definir `"on"` explicitamente é uma escolha de produto válida, coordenada com quem vai apresentar. |

Resumo do único bloqueio real de segurança nesta seção: **`VERITY_SESSION_SECRET` tem que ser definida antes do primeiro deploy público**, porque o fallback é conhecido publicamente no código-fonte.

---

## 4. GitHub OAuth em produção

O código já suporta OAuth real (`src/app/api/auth/github/start/route.ts` e `.../callback/route.ts`), condicionado a `isGithubOAuthEnabled`.

### 4.1 Registrar o OAuth App

No GitHub: `Settings → Developer settings → OAuth Apps → New OAuth App`.

- **Homepage URL**: a URL de produção (ex.: `https://verity.vercel.app` ou o domínio customizado).
- **Authorization callback URL**: precisa ser **exatamente** o caminho que o código monta. Em `src/app/api/auth/github/start/route.ts:35-36`:

```ts
const origin = new URL(request.url).origin;
const redirectUri = `${origin}/api/auth/github/callback`;
```

Ou seja, a URL de callback a registrar no GitHub é:

```
https://<seu-dominio>/api/auth/github/callback
```

Se o domínio de produção mudar (ex.: preview deployments da Vercel, cada um com uma URL `*.vercel.app` diferente), o OAuth App só vai funcionar no domínio exato cadastrado. Para múltiplos ambientes (produção + previews), ou usar um domínio fixo (recomendado: configurar o domínio customizado, ver seção 7, e usar OAuth apenas em produção) ou registrar OAuth Apps separados por ambiente.

### 4.2 Escopo usado

`src/lib/github/oauth.ts:11`: `const OAUTH_SCOPE = "read:user"`. Escopo mínimo, sem acesso a repositórios privados nem a dados além do perfil público. Nada a mudar aqui, é o comportamento correto para o que o produto precisa (ler login, nome, avatar do usuário autenticado).

### 4.3 O que muda em relação ao vínculo manual

Sem OAuth configurado, `/api/auth/github/link` (POST) deixa o usuário digitar um username do GitHub livremente, sem prova de posse da conta: qualquer pessoa pode "se vincular" ao username de outra pessoa (o código só valida que o username existe publicamente via `GET /users/{username}`, não que quem está preenchendo o formulário é o dono). Com OAuth ativo, o vínculo passa a exigir login real na conta do GitHub (o `callback/route.ts` grava `githubUsername`/`githubId` a partir do usuário autenticado retornado pela API do GitHub, não de um campo de formulário), o que fecha essa lacuna de identidade.

Para uma demo de ideathon, o vínculo manual é aceitável e é o comportamento "zero-setup" intencional do projeto. Mas se a apresentação envolver mostrar a régua de verificação como prova de identidade real (não só de conteúdo), vale a pena configurar OAuth antes da demo.

Variáveis a configurar na Vercel: `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` do OAuth App criado.

---

## 5. Chave do emissor Solana

### 5.1 Gerar um keypair dedicado

Não reutilizar nenhuma chave pessoal. Gerar uma nova, exclusiva para este app:

```bash
# Usando a Solana CLI (solana-keygen)
solana-keygen new --outfile ./verity-issuer.json --no-bip39-passphrase

# Isso imprime o endereço público (pubkey) do keypair recém-criado.
```

O arquivo `verity-issuer.json` é um array JSON de 64 bytes (secret key + public key concatenados), formato que `parseSecretKeyBytes` em `src/lib/solana/issuer.ts:13-30` já sabe ler diretamente (aceita tanto esse array `[...]` quanto uma string base58, via `bs58.decode`).

**Não commitar este arquivo.** Ele já cairia sob o padrão `*.json` não coberto pelo `.gitignore` atual (o `.gitignore` não exclui `*.json` genericamente), então adicionar explicitamente ao `.gitignore` antes de gerar o arquivo dentro do repositório, ou gerá-lo fora da árvore do projeto.

### 5.2 Financiar em devnet

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2 <pubkey-do-issuer>
```

O airdrop de devnet tem rate limit por IP/endereço; se falhar, usar um faucet web alternativo (ex. `https://faucet.solana.com`) ou tentar novamente após alguns minutos. 2 SOL de devnet é generoso para o volume de transações de uma demo (cada `create_credential`, `create_schema` e `create_attestation` custa frações de SOL em rent/fees; `create_credential` e `create_schema` só rodam uma vez cada, por serem idempotentes via `fetchMaybeCredential`/`fetchMaybeSchema` em `src/lib/solana/attest.ts:96-140`).

### 5.3 Armazenar o segredo com segurança na Vercel

```bash
# Via CLI, ou pelo painel: Project Settings → Environment Variables
vercel env add VERITY_ISSUER_SECRET_KEY production
# Colar o conteúdo do array JSON (ou a versão base58) quando solicitado.
```

Marcar a variável como sensível/"Sensitive" no painel da Vercel (oculta o valor na UI após salvo). Não expor via `NEXT_PUBLIC_*` (o código já não faz isso: `env.verityIssuerSecretKey` lê `process.env.VERITY_ISSUER_SECRET_KEY` sem o prefixo `NEXT_PUBLIC_`, então nunca vaza para o bundle client, o que está correto).

Depois de gerar e configurar o keypair, apagar o arquivo local (`verity-issuer.json`) ou movê-lo para um cofre de senhas da equipe (1Password, Bitwarden), não deixá-lo solto no filesystem de quem fez o setup.

### 5.4 Rotação

Se o segredo vazar (ex.: commitado por engano, exposto em log): gerar um novo keypair, atualizar `VERITY_ISSUER_SECRET_KEY` na Vercel, redeployar. O novo issuer vai criar um novo `Credential` PDA (a derivação em `deriveCredentialPda` depende de `authority: issuer.address`), então attestations emitidas pelo issuer antigo continuam válidas on-chain (são imutáveis por natureza do Solana), mas o app passa a emitir sob uma nova identidade de credential a partir da rotação. Isso é aceitável para um protótipo; não há hoje mecanismo de "credential versioning" no código, e não é necessário construir um para esta fase.

### 5.5 Por que não mainnet nesta fase

Trocar para mainnet-beta exigiria mudar `NEXT_PUBLIC_SOLANA_CLUSTER` e financiar o issuer com SOL real, não devnet. Não é recomendado agora, por três motivos concretos:

1. **Custo de rent real**: cada `Attestation` criada via `getCreateAttestationInstruction` é uma conta on-chain nova, que paga rent-exempt deposit em SOL real (o `Credential` e o `Schema` também, mas só uma vez cada). Em devnet isso é gratuito via airdrop; em mainnet é dinheiro de verdade por conta criada, e o app cria uma conta por contribuição atestada, sem limite hoje.
2. **Risco operacional**: o keypair emissor paga (`payer: issuer`) todas as transações. Em mainnet, qualquer bug de loop ou abuso (ex.: alguém automatizando chamadas a `POST /api/attestations`, que não tem rate limiting, ver seção 6) converte diretamente em gasto de fundos reais, sem trava.
3. **Estágio do produto**: o VERITY_BRIEF.md e o próprio schema tratam devnet como a rede padrão do protótipo. Não há necessidade de prova de valor real em mainnet para um ideathon; devnet já demonstra a mecânica completa (emissão real on-chain, PDAs, explorer links) sem custo nem risco financeiro.

Decisão em aberto, fora do escopo deste plano: se o projeto avançar para produção real pós-ideathon, mainnet exigiria também rate limiting, um orçamento de rent monitorado, e provavelmente um modelo de quem paga a rent (o usuário final via wallet própria, não o issuer central).

---

## 6. Checklist de segurança pré-publicação

Investigação feita lendo o código (não é uma lista genérica). Para cada item do enunciado, confirmo ou refuto com base no que encontrei:

### 6.1 CONFIRMADO: ausência de rate limiting

Não existe nenhum middleware (`find` por `middleware.ts`/`middleware.tsx` não retornou nada), nenhuma dependência de rate limiting no `package.json`, e nenhuma checagem de limite por IP/usuário em nenhuma rota de `src/app/api/**`. Rotas que disparam chamadas à API do GitHub sem qualquer limite próprio:

- `GET /api/contributions?refresh=1` (`src/app/api/contributions/route.ts`): a cada chamada com `refresh=1`, busca contribuições no GitHub via `fetchContributions`. Sem cooldown, um usuário autenticado (ou um script batendo repetidamente no endpoint) pode esgotar o `GITHUB_TOKEN` compartilhado de toda a aplicação.
- `POST /api/auth/github/link` (`src/app/api/auth/github/link/route.ts`): chama `GET /users/{username}` a cada requisição.

**Severidade: alta**, especificamente porque `GITHUB_TOKEN` é um recurso compartilhado por toda a instância (não é per-user): um único cliente abusivo pode derrubar a funcionalidade de sincronização de contribuições para todos os usuários simultaneamente, inclusive durante a apresentação.

**Correção sugerida**: adicionar rate limiting simples por IP+rota antes de expor publicamente. Para o estágio do projeto, a opção de menor esforço é o Vercel Firewall (regras de rate limit no painel do projeto, sem alterar código) ou `@upstash/ratelimit` com Redis do marketplace da Vercel (grátis no tier inicial) aplicado nas rotas listadas acima e em `POST /api/attestations`.

**Atualização da auditoria de 2026-09-07**: implementado um rate limit mínimo, sem dependência nova, em `src/app/api/_lib/rateLimit.ts`, aplicado às duas rotas acima (10 requisições por IP a cada 5 minutos). É em memória, por instância serverless, não distribuído: não substitui a recomendação acima (Vercel Firewall ou Upstash) para um limite garantido sob múltiplas instâncias simultâneas, mas já corta o abuso casual (um script em loop simples) sem custo nem infraestrutura nova. `POST /api/attestations` continua sem rate limit (fora do escopo desta auditoria, que focou nas rotas que chamam o GitHub; ver seção 5.5 sobre o mesmo gap em relação a gasto de rent do issuer).

### 6.2 REFUTADO (parcialmente): CSRF em rotas POST além do state do OAuth

O enunciado pede para investigar rotas POST além do `state` do OAuth. Encontrei: `POST /api/session/wallet`, `POST /api/auth/github/link`, `POST /api/contributions/[id]/verify`, `POST /api/attestations`. Nenhuma delas tem token CSRF explícito (nenhum double-submit cookie, nenhum header customizado exigido).

Porém, o cookie de sessão (`verity_session`, `src/lib/session.ts:63-69`) é gravado com `sameSite: "lax"`. Sob `SameSite=Lax`, navegadores modernos não anexam o cookie em requisições cross-site que usam métodos não seguros (POST incluso) originadas de outro site, seja via `fetch`/XHR cross-origin, seja via submissão de formulário HTML cross-site. Isso cobre o vetor clássico de CSRF (um site malicioso fazendo o navegador da vítima disparar um POST autenticado) para todas as rotas listadas, mesmo sem token CSRF dedicado.

**Severidade real: baixa a moderada**, não a alta que o enunciado sugeria como possibilidade. O gap não é "CSRF explorável hoje", é "falta de defesa em profundidade": se algum dia a configuração de cookie mudar para `sameSite: "none"` (necessário, por exemplo, se o app for embutido em iframe de outro domínio, o que não é o caso hoje), a proteção desaparece silenciosamente porque não há uma segunda camada.

**Correção sugerida**: não é bloqueante para o ideathon. Como melhoria futura, considerar um token CSRF de dupla submissão (cookie + header) nas rotas mutáveis, especialmente antes de qualquer mudança de `sameSite`.

### 6.3 REFUTADO: "sessão por cookie sem expiração explícita"

`src/lib/session.ts:63-69` grava o cookie com `maxAge: MAX_AGE_SECONDS`, onde `MAX_AGE_SECONDS = 60 * 60 * 24 * 30` (30 dias, linha 17). Ou seja, **há expiração explícita no cookie**, contrariando a hipótese do enunciado.

Nuance real que encontrei e que vale registrar: o token dentro do cookie (`<userId>.<hmac>`, gerado por `encodeToken` em `session.ts:32-34`) não carrega timestamp de emissão nem de expiração próprios; é o navegador que descarta o cookie após 30 dias via `maxAge`, não o servidor. Se alguém extrair o valor do cookie diretamente (ex.: via um ataque de XSS, que é um vetor separado, não coberto aqui) e reenviar via `curl` com o header `Cookie` manualmente, `decodeToken` (linhas 36-50) aceita o token para sempre, sem checar idade. Não há revogação de sessão individual: a única forma de invalidar sessões existentes em massa é rotacionar `VERITY_SESSION_SECRET`.

**Severidade: baixa**, dado que o vetor de exfiltração do cookie (XSS) não foi identificado no código auditado (não há `dangerouslySetInnerHTML` nem injeção de HTML não sanitizado visível nas rotas revisadas), e o cookie é `httpOnly` (não acessível via `document.cookie`/JS no cliente, `session.ts:64`). Registrado como observação, não como bloqueio.

### 6.4 CONFIRMADO (com nuance importante): vulnerabilidades transitivas de `@solana/wallet-adapter-wallets`

`npm audit --omit=dev` reporta 112 vulnerabilidades (21 low, 71 moderate, 19 high, 1 critical) na árvore de dependências de produção. A cadeia principal remonta a `@solana/wallet-adapter-wallets` (declarado em `package.json`), que traz consigo integrações com dezenas de carteiras (Keystone, Particle Network, WalletConnect/Reown, etc.), cada uma com sua própria árvore pesada, incluindo `viem`, `ws` (alta severidade: exaustão de memória e disclosure de memória não inicializada) e `protobufjs` (crítica).

**Nuance confirmada lendo o código**: `src/components/wallet/SolanaProvider.tsx` **não importa** `@solana/wallet-adapter-wallets` em nenhum lugar. O comentário do próprio arquivo (linhas 7-10) explica a decisão de design: `WalletProvider` é instanciado com `wallets={[]}` (linha 32), contando com a detecção automática de carteiras via Wallet Standard (Phantom, Solflare, Backpack expõem a si mesmas ao `window`, sem precisar de adapters registrados manualmente). Busquei `wallet-adapter-wallets` em todo `src/` e o único resultado é esse comentário; não há `import` real do pacote.

Isso significa que, embora a dependência exista em `package.json`/`package-lock.json` (e portanto seja sinalizada pelo `npm audit` e potencialmente pelo bundler se não houver tree-shaking perfeito), o código das carteiras vulneráveis (WalletConnect, viem, Keystone, Particle) não é referenciado por nenhum módulo do app, então não deveria ser incluído no bundle final do Next.js (que faz tree-shaking por import). O risco real fica concentrado em risco de cadeia de suprimentos no momento de instalação (`npm install` baixando pacotes com vulnerabilidades conhecidas), não em superfície de ataque em runtime no navegador do usuário final.

**Severidade: moderada** (risco de supply chain, não de exploração direta em produção). **Correção sugerida**: como o pacote não é usado, a melhoria mais limpa é removê-lo de `package.json` (fora do escopo deste agente de deploy, que não deve tocar `package.json`; registrar como recomendação para quem cuida de dependências). Enquanto isso não acontece, não é um bloqueador para o deploy do protótipo, mas deve constar como item de dívida técnica conhecida.

### 6.5 Resumo do checklist

| Item | Status | Severidade | Bloqueia deploy do protótipo? |
|---|---|---|---|
| Rate limiting ausente nas rotas que chamam a API do GitHub | Confirmado; mitigado nesta auditoria (rate limit em memória, ver 6.1) | Alta (era) / Baixa-moderada (com a mitigação) | Não, com a mitigação aplicada |
| CSRF sem token dedicado além do `state` do OAuth | Confirmado, mas mitigado por `SameSite=Lax` | Baixa/moderada | Não |
| Sessão sem expiração explícita | Refutado (há `maxAge` de 30 dias) | Baixa (nuance: token sem timestamp próprio) | Não |
| Vulnerabilidades transitivas de `@solana/wallet-adapter-wallets` | Confirmado no `npm audit`, mas código não importa o pacote | Moderada (supply chain, não runtime) | Não |
| `VERITY_SESSION_SECRET` sem valor em produção | Confirmado; **corrigido no código nesta auditoria** (falha explícita em produção sem a env var, em vez de fallback silencioso) | Era crítica; agora depende só de configurar a env var na Vercel | **Sim, ainda bloqueia hoje** (sem ela, o deploy ativo depende do fallback público conhecido no código-fonte) |
| Banco de produção sem schema aplicado (achado nesta auditoria, fora da lista original) | **Resolvido no mesmo dia**: `prisma migrate deploy` e `npm run db:seed` rodaram com sucesso contra o Postgres de produção, confirmado com `curl` e diretamente contra o RPC da devnet (seção "Status desta auditoria", no topo deste arquivo) | Era crítica | **Não, já resolvido** |

Um item ainda bloqueia um deploy público plenamente seguro hoje: `VERITY_SESSION_SECRET` não confirmada na Vercel (ver "Pendência que continua aberta", no topo deste arquivo). O schema do Postgres de produção já foi aplicado e o banco já foi semeado, então esse bloqueio anterior está resolvido. Os demais itens seguem dívida técnica documentada, aceitável para o estágio de protótipo de ideathon, desde que a demo seja uma janela curta e controlada de exposição pública.

---

## 7. Domínio, HTTPS e observabilidade

### 7.1 Domínio e HTTPS

A Vercel já provisiona um domínio `<projeto>.vercel.app` com HTTPS automático (certificado gerenciado) no primeiro deploy, sem nenhuma configuração. Para um domínio customizado (ex.: `verity.app` ou subdomínio de um domínio já existente da equipe):

```
Vercel → Project → Settings → Domains → Add
```

Seguir as instruções de DNS (registro `A`/`CNAME` conforme o painel indicar). O certificado TLS é emitido e renovado automaticamente pela Vercel (Let's Encrypt por baixo). Se o domínio customizado for usado, lembrar de recadastrar a **Authorization callback URL** do OAuth App do GitHub (seção 4.1) para o novo domínio, senão o login quebra.

### 7.2 Logs e monitoramento mínimo viável

O código já loga erros inesperados de forma consistente via `console.error` em pontos estratégicos: `withErrorHandling` em `src/app/api/_lib/http.ts:60` (captura qualquer erro não tratado em qualquer rota que use esse wrapper) e o catch do callback OAuth em `src/app/api/auth/github/callback/route.ts:89`. Isso já é suficiente para aparecer nos **Vercel Logs / Runtime Logs** (painel do projeto, aba "Logs", filtrável por função/rota), sem nenhuma configuração adicional: a Vercel captura `stdout`/`stderr` de toda função automaticamente.

Para o mínimo viável de observabilidade sem adicionar dependências novas:

1. Habilitar **Vercel Analytics** (gratuito no tier hobby, um clique no painel) para ter visão de tráfego e Web Vitals.
2. Configurar um **alerta de erro** simples: a Vercel permite integração com Slack/email para notificar deploys com falha; para erros em runtime, o caminho mais simples sem novas dependências é revisar `/api/health` periodicamente (seção 7.3).

### 7.3 Como saber se a emissão de attestations está falhando

A rota `GET /api/health` (`src/app/api/health/route.ts`) já expõe exatamente isso, sem precisar de nenhuma ferramenta externa: retorna `modes.solana` (via `solanaAttestationMode()`, que reflete se o app está em `sas`, `memo` ou `mock`), `modes.github`, `modes.db` (com um `SELECT 1` real contra o banco), `githubOAuth` e `demoMode`. Além disso, cada resposta de `POST /api/attestations` bem-sucedida inclui o campo `diagnostics` (montado em `src/lib/solana/attest.ts:281-323`), que registra em texto legível cada degrau tentado e o motivo de cada degradação, por exemplo informando que o modo `sas` falhou com determinado erro e por isso a emissão seguiu para o modo `memo`.

Para a demo, a checagem mais direta é:

```bash
curl https://<seu-dominio>/api/health | jq
```

Se `modes.solana` estiver como `"mock"` quando o esperado era `"sas"`, o `VERITY_ISSUER_SECRET_KEY` não está configurado ou é inválido (seção 5). Recomendo rodar esse `curl` como parte do checklist pré-apresentação (seção 10).

Para algo mais robusto que um `curl` manual, um uptime monitor externo gratuito (ex.: UptimeRobot, Better Uptime free tier) apontando para `/api/health` com checagem a cada 5 minutos, com alerta se `ok: false`, é suficiente para o estágio atual e não exige nenhuma mudança de código.

---

## 8. Pipeline de CI/CD mínimo

**Atualização da auditoria de 2026-09-07**: o repositório já é git, já está no GitHub
(`https://github.com/anajuliarrod/verity.git`, **público**) e já está conectado à Vercel (deploy
automático confirmado via API do GitHub: existe um `deployment` com `creator: vercel[bot]` no
repositório). O passo de inicialização abaixo é só histórico/referência, não precisa ser refeito.
O que **não existe ainda** é o workflow de CI (`.github/workflows/`, seção 8.1): não há nenhum
arquivo nessa pasta neste repositório hoje, então typecheck/lint/build só rodam quando alguém roda
manualmente ou como parte do build da própria Vercel (que roda `next build`, mas não roda
`typecheck`/`lint` como gate separado).

Texto original (passos de inicialização, já executados):

```bash
cd /home/inteli/Documentos/verity
git init
git add .
git commit -m "Initial commit: Verity prototype"

# Criar o repositório remoto no GitHub (via gh CLI, ajustar visibilidade conforme necessário)
gh repo create verity --private --source=. --remote=origin

git push -u origin main
```

Se o branch padrão local não for `main` (verificar com `git branch`), renomear antes do push: `git branch -M main`.

### 8.1 Workflow do GitHub Actions

Criar `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Typecheck, lint e build
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: "file:./dev.db"
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build
```

Notas sobre este workflow, específicas deste projeto:

- `DATABASE_URL="file:./dev.db"` é suficiente para o CI porque `next build` não precisa de um banco real conectado (o Prisma Client só precisa ser gerado via `prisma generate`, que lê o schema, não o banco). Não é necessário provisionar um Postgres de teste só para o build passar.
- `npx prisma generate` precisa rodar antes de `typecheck`/`build` num ambiente limpo. **Atualização de 2026-09-07**: `package.json` agora tem `"postinstall": "prisma generate"` explícito (adicionado nesta auditoria), então `npm ci`/`npm install` já garante isso sem depender do comportamento implícito do pacote `@prisma/client`. O passo explícito abaixo no workflow de CI continua uma boa prática de defesa em profundidade, mesmo com o `postinstall` em vigor.
- Não incluí testes automatizados no workflow porque não há framework de teste configurado no `package.json` hoje (sem `jest`, `vitest`, ou script `test`). Se isso mudar, adicionar um passo `npm test` entre lint e build.

### 8.2 Deploy automático

Depois do primeiro push, conectar o repositório à Vercel:

```bash
npx vercel link
npx vercel env pull .env.local   # opcional, para sincronizar env vars localmente
```

Ou, mais simples: importar o repositório direto no painel da Vercel (`New Project → Import Git Repository`), que já configura deploy automático a cada push em `main` (produção) e preview deployment a cada PR, sem YAML adicional (a Vercel não usa GitHub Actions para isso, tem seu próprio sistema de deploy integrado ao GitHub via app/webhook). O workflow acima cobre qualidade de código (typecheck/lint/build) como gate antes do merge; o deploy em si fica a cargo da integração nativa Vercel-GitHub.

Se a equipe preferir gatear o deploy pelo sucesso do CI (não depender só da integração automática da Vercel), configurar a branch `main` como protegida no GitHub, exigindo o check `Typecheck, lint e build` como obrigatório antes do merge de PRs.

---

## 9. Custos estimados (caminho recomendado)

Cenário gratuito, viável para o ideathon inteiro:

- **Vercel Hobby**: gratuito. Suficiente para o tráfego esperado de uma demo/avaliação de ideathon. Limitações relevantes: sem SLA, domínios `*.vercel.app` ou customizado próprio (grátis), execução de função serverless limitada a 100 GB-horas/mês e 10s de timeout por função no plano hobby (mais que suficiente para as rotas atuais, que não fazem processamento pesado).
- **Neon free tier**: gratuito. 1 projeto, ~0.5 GB de armazenamento, autosuspend após inatividade (o banco "dorme" e acorda na primeira query, com alguns segundos de latência na primeira requisição após um período ocioso, o que é aceitável para uma demo, mas vale testar antes da apresentação para não ser pego de surpresa).
- **Solana devnet**: gratuito (airdrop de SOL de teste, sem valor real).
- **GitHub OAuth App**: gratuito, sem limite de uso relevante para este volume.
- **GitHub Personal Access Token**: gratuito, sobe o rate limit da API do GitHub de 60 para 5000 req/h.

Custo total do cenário gratuito: **R$ 0/mês**, com as limitações de autosuspend do Neon e ausência de SLA formal da Vercel Hobby, que são aceitáveis para um protótipo de ideathon.

Se o projeto crescer além do ideathon e precisar de uso comercial ou tráfego maior:

- **Vercel Pro**: US$ 20/mês por membro do time, adiciona SLA, mais execução, analytics avançado, e permite uso comercial dentro dos termos (o plano Hobby é restrito a uso não comercial).
- **Neon Launch** (tier pago): a partir de ~US$ 19/mês, remove os limites de autosuspend agressivo e aumenta armazenamento/compute.

Não há custo de RPC Solana dedicado no cenário gratuito (RPC público de devnet); se for configurado um RPC dedicado (Helius/QuickNode) para evitar rate limit na demo, os tiers gratuitos desses provedores também cobrem o volume esperado sem custo.

---

## 10. Plano de rollback e o que fazer se a demo quebrar ao vivo

### 10.1 Rollback de deploy

A Vercel mantém todo deploy anterior acessível e promovível a produção instantaneamente, sem rebuild:

```bash
# Listar deploys recentes
npx vercel ls

# Promover um deploy anterior específico para produção
npx vercel promote <deployment-url>
```

Ou pelo painel: `Deployments → (deploy anterior estável) → Promote to Production`. Isso troca o alias de produção para os arquivos estáticos/funções já buildados do deploy anterior, em segundos, sem depender de `git revert` nem de novo build.

### 10.2 Rollback de banco de dados

Como a recomendação é `prisma migrate deploy` (seção 2.3), cada migração tem um registro em `prisma/migrations/`. Se uma migração recente quebrar algo, o caminho seguro é escrever e aplicar uma nova migração corretiva (`prisma migrate dev --name fix_x` localmente, depois `migrate deploy` em produção), não reverter destrutivamente o schema em produção sob pressão de tempo. Para o cenário específico de "a demo quebra e não há tempo de investigar": usar o rollback de deploy (10.1) para voltar ao último estado da aplicação que era compatível com o schema atual do banco, já que mudanças de schema em produção devem ser raras e planejadas para esta fase do projeto, não feitas às pressas durante uma janela de demo.

### 10.3 Se a demo quebrar ao vivo, na hora

Ordem de ação recomendada, do mais rápido/seguro para o mais custoso:

1. **Checar `/api/health` primeiro.** Um `curl` rápido no `/api/health` (seção 7.3) diagnostica em segundos se o problema é banco (`modes.db: "unreachable"`), GitHub (`modes.github`) ou Solana (`modes.solana` caiu para `"mock"` inesperadamente).
2. **Forçar modo demo determinístico.** Se o problema é uma integração externa instável (GitHub rate limit, RPC de devnet lento/fora do ar), a saída mais rápida sem precisar investigar a causa raiz é setar `NEXT_PUBLIC_DEMO_MODE=on` na Vercel e redeployar (ou, melhor, ter essa variável já preparada com antecedência para trocar em segundos pelo painel, que aplica no próximo deploy/redeploy, não em runtime imediato: por isso, é mais seguro já ter testado esse modo antes da apresentação do que trocar às pressas ao vivo). O app foi desenhado exatamente para essa degradação graciosa; usar isso a favor da demo é legítimo, não é "trapaça", é o comportamento documentado do produto.
3. **Rollback de deploy (10.1)** se a quebra foi introduzida por um push recente e o estado anterior era estável. É a ação mais rápida disponível (segundos), e não depende de entender a causa raiz.
4. **Ter um vídeo/gravação de backup da demo funcionando**, gravado em ensaio prévio. Isso não é uma solução de engenharia, é uma rede de segurança de apresentação: se nada acima resolver a tempo, mostrar a gravação e explicar verbalmente o que está sendo investigado é preferível a continuar tentando consertar ao vivo perante a banca.

Recomendação prática: rodar o ensaio da apresentação contra a URL de produção real (não `localhost`) pelo menos uma vez antes do dia do ideathon, exatamente para descobrir problemas de configuração de produção (variáveis de ambiente, cold start do Neon, rate limit de RPC) com antecedência, não durante a avaliação.

---

## 11. Arquivos de tooling do Neon/Copilot na raiz (achado da auditoria de 2026-09-07)

Apareceram na raiz do repositório quatro artefatos que não fazem parte do código da aplicação, gerados ao usar o GitHub Copilot com as skills do Neon para provisionar o banco e conectar a Vercel:

- **`.neon`** (arquivo, não pasta): JSON com `orgId`/`projectId`/`branch` do projeto Neon vinculado. Não contém segredo (nenhuma senha ou connection string), só identificadores do projeto. Já está no `.gitignore`, não tracked. Nada a fazer.
- **`.claude/skills/**`**: cópia local das skills do Neon para agentes (`neon`, `neon-postgres`, `neon-functions` etc., baixadas de `neondatabase/agent-skills`). Não é importado por nenhum código da aplicação. Já está no `.gitignore` (`.claude/`), não tracked. Nada a fazer.
- **`skills-lock.json`**: lockfile de quais skills acima foram instaladas e de qual hash/versão. Mesma natureza do ponto anterior, tooling de agente, não app. Já está no `.gitignore`, não tracked. Nada a fazer.
- **`neon.ts`**: config vazio (`export default defineConfig({})`) do pacote `@neon/config`, usado por ferramentas de CLI do Neon (ex. Neon Local Connect) para descobrir o projeto/branch a partir do repositório. Confirmado por `grep` que **nenhum arquivo em `src/`, `prisma/` ou `next.config.ts` importa `neon.ts`**; ele não faz parte do bundle da aplicação. **Atualizado na limpeza de 2026-09-07**: `neon.ts` foi adicionado ao `.gitignore` e destrackeado com `git rm --cached neon.ts` (o arquivo continua no disco, só saiu do índice do git), trazendo consistência com os outros três artefatos de tooling listados acima.
- Nota adicional (**resolvida na limpeza de 2026-09-07**): `@neon/config` e `@neon/env` estavam em `dependencies` no `package.json`, mesmo sem serem usados pelo app em runtime (só por `neon.ts`, que também não é usado). Foram movidos para `devDependencies`.
- **Duplicata de assets de marca (achado e resolvido na limpeza de 2026-09-07)**: a pasta `brand/` na raiz do repositório continha `verity-keyvisual.png` e `verity-mark.png`, idênticos byte a byte (MD5 conferido) aos mesmos arquivos em `public/brand/`. Só `public/brand/` é servido pela aplicação (Next.js expõe o conteúdo de `public/` na raiz da URL; todo import real no código usa o caminho `/brand/...`, que resolve para `public/brand/`). Nenhuma referência em `src/`, `public/`, `README.md` ou `DEPLOY.md` apontava para a pasta `brand/` da raiz (o único texto que menciona `brand/verity-mark.png` sem a barra inicial é um comentário de documentação em `src/components/brand/VerityMark.tsx`, citando o arquivo de origem do SVG recriado, não um import real). A pasta `brand/` da raiz foi removida do repositório (`git rm -r brand/`).

---

## Referências rápidas de arquivos citados neste plano

- `package.json`: scripts de build (`build`, `start`, `lint`, `typecheck`, `postinstall`, `db:push`, `db:migrate:deploy`, `db:seed`)
- `prisma/schema.prisma`: schema atual (Postgres/Neon, `DATABASE_URL` + `DIRECT_URL`)
- `prisma/migrations/`: migration baseline gerada nesta auditoria (2026-09-07), ainda não aplicada em produção
- `prisma/seed.ts`: seed idempotente do usuário demo (compatível com Postgres, testado só em ambiente local/dev nesta auditoria)
- `src/lib/env.ts`: leitura de variáveis de ambiente e flags derivadas
- `src/lib/session.ts`: sessão por cookie HMAC; fallback de segredo restrito a fora de produção desde 2026-09-07
- `src/app/api/_lib/rateLimit.ts`: rate limit simples em memória, adicionado em 2026-09-07
- `src/lib/solana/issuer.ts`: carregamento do keypair emissor
- `src/lib/solana/attest.ts`: degradação `sas` → `memo` → `mock`
- `src/lib/solana/connection.ts`: RPC devnet, envio de transações
- `src/lib/github/oauth.ts`: OAuth flow, escopo `read:user`
- `src/app/api/auth/github/start/route.ts` e `.../callback/route.ts`: fluxo OAuth, `state` CSRF
- `src/app/api/auth/github/link/route.ts`: vínculo manual de username, agora com rate limit
- `src/app/api/health/route.ts`: status de modos (github/solana/db)
- `src/app/api/_lib/http.ts`: wrapper de erro padrão das rotas
- `src/components/wallet/SolanaProvider.tsx`: confirma que `@solana/wallet-adapter-wallets` não é importado
- `.env.example`: lista de variáveis, agora incluindo `VERITY_SESSION_SECRET`
- `neon.ts`, `.neon`, `skills-lock.json`, `.claude/`: artefatos de tooling do Neon/Copilot, não usados pela aplicação (seção 11)
