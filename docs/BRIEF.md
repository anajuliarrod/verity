# VERITY — Brief técnico e de marca (fonte da verdade para todos os agentes)

> **Seu trabalho. Verificado.**
> Proof of Contribution: transformar contribuição digital verificável em credencial
> portátil, associada à wallet do estudante e verificável por terceiros na Solana.

Este arquivo é a fonte da verdade. **Leia antes de escrever qualquer código.**
Não altere este arquivo sem instrução explícita do orquestrador.

---

## 0. Decisões já tomadas (não re-decidir)

| Tema | Decisão |
|---|---|
| App | **Next.js 15 (App Router) + TypeScript strict + Tailwind v4** — um único deploy |
| Runtime | Node 24 (já instalado). Gerenciador: **npm** (não há pnpm/yarn na máquina) |
| DB | **Prisma + SQLite** por padrão (`file:./dev.db`), schema **Postgres-ready** (trocar provider) |
| Solana core | **@solana/kit** (ex-web3.js v2) + **sas-lib** (Solana Attestation Service) + `@solana/wallet-adapter-*` |
| Solana extra | **solana-agent-kit** numa camada isolada e opcional (`src/lib/agent/`), nunca no caminho crítico |
| Rede | **devnet** |
| GitHub | API pública (funciona sem credencial) + **OAuth opcional** via `.env` |
| Filosofia | **Zero-setup**: `npm install && npm run dev` tem que abrir um protótipo 100% navegável, sem Docker, sem chave, sem wallet. Tudo que é "real" é um upgrade opcional por env var. |

**Regra de ouro do ideathon:** nenhuma tela pode quebrar por falta de credencial.
Toda integração externa tem modo `demo` determinístico com dados plausíveis.

---

## 1. Identidade visual (extraída dos PNGs em `/brand/`)

Cores medidas pixel a pixel das imagens originais. Use exatamente estes valores.

```
/* Marca */
--verity-primary:      #754CFF;  /* roxo do headline e dos CTAs */
--verity-primary-hover:#6438FF;
--verity-violet-mid:   #8E53FD;  /* meio do gradiente do logo */
--verity-violet-deep:  #3C09D2;  /* dobra escura do logo */
--verity-violet-light: #CBB6FB;  /* highlight do logo */
--verity-tint:         #F0E3FF;  /* preenchimento suave / chips */
--verity-blob:         #DBD2FD;  /* blob decorativo do hero */
--verity-blob-soft:    #E6E2FD;

/* Neutros */
--verity-bg:           #F8F9FD;  /* fundo geral, levemente azulado */
--verity-surface:      #FFFFFF;
--verity-ink:          #0B0B1F;  /* títulos */
--verity-ink-muted:    #5B5B77;  /* texto secundário */
--verity-border:       #E8E6F5;

/* Superfície escura (cartão de credencial) */
--verity-night:        #181558;  /* medido no cartão "Proof of Contribution" */
--verity-night-deep:   #070939;
--verity-night-2:      #221E6B;

/* Estado verificado */
--verity-verified:     #10B981;
--verity-verified-bg:  #DBF6EF;  /* medido no badge "Verificado" */

/* Solana accent (só no selo de rede) */
--solana-teal:  #14F195;
--solana-purple:#9945FF;
```

**Gradiente da marca:** `linear-gradient(135deg,#CBB6FB 0%,#8E53FD 45%,#3C09D2 100%)`
**Gradiente do cartão escuro:** `linear-gradient(140deg,#221E6B 0%,#181558 55%,#070939 100%)`

### Tipografia
- Display/headings: geométrica pesada, tracking apertado — **Outfit** (fallback: Poppins, system-ui).
  Headline do hero: `font-weight:700`, `letter-spacing:-0.03em`, `line-height:1.05`.
- Corpo/UI: **Inter**.
- Wordmark `VERITY`: caixa alta, `font-weight:700`, `letter-spacing:0.22em`.
- Tagline `Seu trabalho. Verificado.`: `letter-spacing:0.14em`, cor `--verity-primary`, tamanho pequeno.

### Logo
`/brand/image copy.png` é o símbolo (V com sparkle) em 500×500.
`/brand/image.png` é o key visual completo (referência de layout do hero).
- Copiar ambos para `public/brand/`.
- **Recriar o símbolo como SVG** em `src/components/brand/VerityMark.tsx`:
  um "V" de duas fitas com gradiente da marca (fita esquerda clara→média, fita direita
  clara→profunda, sombra `--verity-violet-deep` na dobra interna) + estrela de 4 pontas
  (sparkle) no canto superior direito. Prop `size` e `variant: 'gradient' | 'mono'`.
  O PNG fica como fallback/OG image, o SVG é o que renderiza na UI.

### Linguagem visual
- Cantos: `--radius-card: 16px`, `--radius-pill: 999px`, inputs `12px`.
- Sombras suaves e difusas, tom roxo: `0 8px 32px rgba(117,76,255,.10)`.
- Cards brancos sobre `--verity-bg`, borda `1px solid --verity-border`.
- Badge "Verificado": pill verde, bg `--verity-verified-bg`, texto `--verity-verified`, ícone ✓.
- Hero: blob lavanda difuso no canto superior direito (`--verity-blob`, blur alto).
- Sidebar do app: fundo branco/`#FCFBFF`, item ativo com bg `--verity-tint` e texto primário.
- **Português (pt-BR)** em toda a UI. Termos técnicos (Pull Request, commit, wallet, attestation) em inglês.
- Acessibilidade: contraste AA, foco visível com anel `--verity-primary`, tudo navegável por teclado.

---

## 2. Estrutura de pastas (contrato de ownership)

```
verity/
  brand/                       # PNGs originais (mover para cá)
  prisma/schema.prisma
  prisma/seed.ts
  public/brand/
  src/
    app/
      layout.tsx  globals.css
      page.tsx                     # landing
      (app)/dashboard/page.tsx
      (app)/contributions/page.tsx
      (app)/credentials/page.tsx
      (app)/settings/page.tsx
      p/[handle]/page.tsx          # perfil público de reputação
      verify/[attestationId]/page.tsx  # verificação pública da credencial
      api/...                      # ver seção 4
    components/
      brand/       # VerityMark, Wordmark, Logo
      ui/          # Button, Card, Badge, Pill, Avatar, Skeleton, EmptyState, Tabs, Toast
      app/         # Sidebar, TopBar, ContributionRow, CredentialCard, StepFlow, VerifiedBadge
      wallet/      # WalletProvider, ConnectWalletButton, WalletBadge
      marketing/   # Hero, HowItWorks, TrustStrip, Footer
    lib/
      types.ts        # contratos compartilhados (fonte da verdade dos tipos)
      db.ts           # PrismaClient singleton
      env.ts          # leitura/validação de env + flags de modo demo
      utils.ts        # cn(), formatadores de data, truncamento de endereço
      github/         # cliente GitHub + OAuth + normalização
      verification/   # verification engine (regras determinísticas)
      solana/         # @solana/kit, SAS, emissão e leitura de attestations
      agent/          # solana-agent-kit (opcional, isolado)
      demo/           # dataset determinístico de demonstração
```

---

## 3. Modelo de dados (Prisma)

```prisma
model User {
  id             String  @id @default(cuid())
  wallet         String? @unique
  githubUsername String? @unique
  githubId       String? @unique
  name           String?
  headline       String?      // "Estudante de Engenharia de Software"
  avatarUrl      String?
  handle         String  @unique   // slug do perfil público
  createdAt      DateTime @default(now())
  contributions  Contribution[]
}

model Contribution {
  id           String  @id @default(cuid())
  userId       String
  source       String              // "github"
  repoOwner    String
  repoName     String
  type         String              // PULL_REQUEST | COMMIT | ISSUE | REVIEW
  externalId   String              // "42" (PR number) ou SHA
  title        String
  url          String
  occurredAt   DateTime
  status       String  @default("PENDING")  // PENDING|VERIFIED|REJECTED
  evidence     String?             // JSON: resultado das regras
  raw          String?             // JSON: payload bruto normalizado
  attestation  Attestation?
  user         User @relation(fields:[userId], references:[id])
  @@unique([userId, source, repoOwner, repoName, type, externalId])
}

model Attestation {
  id             String  @id @default(cuid())
  contributionId String  @unique
  issuer         String              // "Verity Proof of Contribution"
  issuerPubkey   String?
  subjectWallet  String
  network        String  @default("devnet")
  mode           String  @default("mock")   // "sas" | "memo" | "mock"
  signature      String?             // tx signature
  attestationPda String?
  explorerUrl    String?
  payload        String              // JSON da credencial
  issuedAt       DateTime @default(now())
  contribution   Contribution @relation(fields:[contributionId], references:[id])
}
```

Trocar para Postgres = mudar `provider` e `DATABASE_URL`. Sem SQL cru dependente de dialeto.

---

## 4. Contrato de API (REST, `src/app/api/`)

Todas retornam `{ ok: true, data }` ou `{ ok: false, error: { code, message } }`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/session/wallet` | associa wallet à sessão, cria/retorna User |
| GET | `/api/auth/github/start` | inicia OAuth (se configurado) |
| GET | `/api/auth/github/callback` | callback OAuth |
| POST | `/api/auth/github/link` | vincula username manualmente (modo sem OAuth) |
| GET | `/api/contributions?refresh=1` | lista contribuições do usuário; `refresh` busca no GitHub |
| POST | `/api/contributions/:id/verify` | roda o Verification Engine numa contribuição |
| POST | `/api/attestations` | emite attestation (body: `{ contributionId }`) |
| GET | `/api/attestations/:id` | dados públicos da credencial |
| GET | `/api/profile/:handle` | perfil público + credenciais verificadas |
| GET | `/api/health` | status dos modos (github/solana/db) |

---

## 5. Verification Engine — regras do MVP

Determinístico, sem heurística. Cada regra devolve `{ id, label, passed, detail }`.
A contribuição só vira `VERIFIED` se **todas** as regras aplicáveis passarem.

**PULL_REQUEST**
1. `author_match` — autor do PR == GitHub username vinculado ao usuário
2. `repo_match` — PR pertence ao repositório declarado
3. `is_merged` — `merged_at != null`
4. `not_self_merged_fork_only` — PR feito num repo que não é do próprio autor (informativo, não bloqueia; marca `weight`)
5. `has_content` — `additions + deletions > 0`

**COMMIT**: `author_match` (login ou e-mail verificado), `repo_match`, `on_default_branch`, `has_content`

**ISSUE**: `author_match`, `repo_match`, `is_closed`

O resultado inteiro (regras + timestamps + snapshot da evidência) é gravado em
`Contribution.evidence` e depois embutido no payload da attestation.

---

## 6. Payload da credencial (o que vai para a Solana)

```json
{
  "schema": "verity.poc.v1",
  "type": "GitHub Contribution",
  "subject": "<wallet>",
  "issuer": "Verity Proof of Contribution",
  "project": "owner/repo",
  "contribution": "Pull Request #42",
  "contributionUrl": "https://github.com/...",
  "occurredAt": "2026-01-12T00:00:00.000Z",
  "verifiedAt": "2026-09-06T00:00:00.000Z",
  "evidenceHash": "<sha256 do evidence JSON>",
  "status": "VERIFIED"
}
```

On-chain vai o **hash + metadados mínimos**, nunca dados sensíveis nem o conteúdo do projeto.

**Modos de emissão (degradação graciosa, nesta ordem):**
1. `sas` — SAS real em devnet (precisa `VERITY_ISSUER_SECRET_KEY` com SOL) → PDA + signature reais
2. `memo` — transação com Memo Program em devnet carregando o hash → signature real
3. `mock` — assinatura determinística simulada, marcada claramente na UI como "modo demonstração"

A UI **sempre** mostra qual modo foi usado. Nunca fingir que um mock é on-chain real.

---

## 7. Fluxo do usuário (o que a demo precisa provar)

```
Conectar Wallet → Conectar GitHub → Contribuições encontradas →
Verification Engine → Contribuição validada → Emitir Attestation →
Solana → Credencial na wallet → Perfil público verificável por terceiros
```

O componente `StepFlow` mostra esse progresso em 5 passos no dashboard.

---

## 8. Variáveis de ambiente (`.env.example`)

```
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_SOLANA_CLUSTER="devnet"
NEXT_PUBLIC_SOLANA_RPC=""            # vazio = RPC público devnet
GITHUB_CLIENT_ID=""                  # vazio = OAuth desativado, usa link manual
GITHUB_CLIENT_SECRET=""
GITHUB_TOKEN=""                      # PAT opcional, sobe rate limit da API pública
VERITY_ISSUER_SECRET_KEY=""          # vazio = modo memo/mock
NEXT_PUBLIC_DEMO_MODE="auto"         # auto | on | off
```

---

## 9. Qualidade (não negociável)

- TypeScript strict, **zero `any`** em código de produção.
- `npm run build` tem que passar limpo. `npm run lint` sem erro.
- Nada de `console.log` esquecido. Erros tratados e mostrados na UI.
- Estados de loading, vazio e erro em toda tela que busca dados.
- Responsivo de 360px a desktop.
- Comentários só onde a intenção não é óbvia. Sem comentários narrando o óbvio.
