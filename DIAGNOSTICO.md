# CLIPPER OS MOBILE — DIAGNÓSTICO COMPLETO

> Gerado em: 2026-04-17 | Branch: backup/estado-2026-04-17

---

## RESUMO EXECUTIVO

**O que esse app É hoje**

Clipper OS é um studio de gerenciamento de conteúdo mobile-first para criadores de mídias sociais, construído como um app offline-first (localStorage) com sincronização opcional via Supabase. Implementa um fluxo completo de clipe-até-publicação: usuários gravam/importam conteúdo longo, extraem clipes curtos com metadados de timestamp, movem clips por um pipeline de 3 etapas (bruto → editando → aprovado), agendram posts em um grid de 7 dias, rastreiam histórico de publicações com avaliações de performance, mantêm uma biblioteca de assets com busca e filtro, e geram hooks/títulos/legendas via Gemini (proxy no backend). Todos os dados persistem localmente; Supabase adiciona sincronização multi-device, conectores OAuth para Google Drive e OneDrive, e gerenciamento seguro de tokens com criptografia em repouso. A stack é Vanilla JS + Vite + Tailwind CSS + Capacitor 8, deployável para Android/iOS e GitHub Pages.

**O que claramente falta para funcionar end-to-end**

Quatro peças críticas estão incompletas: (1) **fluxo de upload/import de vídeo** — o UI do videoManager renderiza, mas a integração do file-picker e upload para a nuvem não estão claramente conectados nos handlers de main.js; (2) **conector iCloud** — definido como provider mas OAuth + troca de token não estão implementados (apenas Google Drive e OneDrive funcionam); (3) **painel Admin** — exibe apenas dados mock hardcoded, sem conexão com dados reais; (4) **infraestrutura Supabase** — requer setup manual do projeto, execução das migrations e configuração dos secrets das Edge Functions para qualquer feature cloud funcionar. Adicionalmente, faltam testes E2E automatizados, tratamento de erros estruturado, cobertura de testes para fluxos de auth/cloud, e o main.js monolítico (3.911 linhas) precisa de refatoração.

---

## 1. STACK E ARQUITETURA

### Stack Real

| Camada          | Tecnologia                                              |
|-----------------|--------------------------------------------------------|
| Linguagem       | Vanilla JavaScript (ES6 modules, sem transpiler extra) |
| Framework       | Nenhum (sem React/Vue/Angular)                         |
| Build Tool      | Vite 8                                                 |
| CSS             | Tailwind CSS v3                                        |
| Ícones          | FontAwesome 6.4.0 (bundled localmente com SRI)         |
| Animações       | GSAP 3.15.0                                            |
| Background 3D   | Three.js 0.156.1 (sistema de partículas)               |
| Mobile          | Capacitor 8.3.0 (Android + iOS)                        |
| Storage         | localStorage (primário) + Supabase (sync cloud)        |
| Auth/Cloud      | Supabase (email/password + cloud sync)                 |
| Testes          | Vitest                                                 |

### Empacotamento para Mobile

**Arquivo:** `capacitor.config.json`

- App ID: `io.clipper.os`
- App Name: `Clipper OS`
- Web directory: `dist` (output do Vite)
- Android scheme: `https`
- Plugins nativos ativos:
  - `@capacitor/local-notifications@8.0.2`
  - `@ebarooni/capacitor-calendar@8.0.1`
  - SplashScreen (sem duração de show)
  - StatusBar (estilo dark, fundo claro)

### Organização do Código em src/

```
src/
├── main.js                  ← MONOLITO (3.911 linhas): entry, routing, todos os event handlers
├── state.js                 ← Gerenciamento de estado (load/save/migrate/merge localStorage + Supabase)
├── auth.js                  ← Supabase auth (signup, signin, signout, session, password reset)
├── supabase.js              ← SyncManager: cloud sync com realtime subscriptions + upsert
├── cloudConnectors.js       ← Abstração OAuth (Google Drive, OneDrive, iCloud stub)
├── videoManager.js          ← Renderização UI de assets de vídeo com filtros
├── calendar.js              ← Integração calendário (Capacitor nativo + fallback Google Calendar)
├── notifications.js         ← Notificações locais (plugin Capacitor com fallback web)
├── utils.js                 ← Helpers (escapeHtml, todayStr, csvEscape, platform links, tags)
├── styles.css               ← Diretivas Tailwind + estilos customizados (3.8 KB)
├── views/
│   ├── DashboardView.js     ← Progresso diário, rotina, stats rápidos
│   ├── ClipperView.js       ← Workflow de status dos clipes
│   ├── HistoryView.js       ← Posts passados, tracking de performance
│   ├── LibraryView.js       ← Assets finalizados, filtro por tag
│   ├── GeminiView.js        ← UI para AI (Gemini via proxy)
│   └── AdminView.js         ← Painel admin (dados mock, não real)
└── __tests__/
    ├── state.test.js        ← 11 testes: migração, merge, geração de ID
    └── utils.test.js        ← 9 testes: escaping HTML/CSV, formatação de data
```

---

## 2. FEATURES IMPLEMENTADAS

### Views e o que Fazem Hoje

| View | O que faz hoje (código real) |
|------|------------------------------|
| **DashboardView.js** | Renderiza barra de progresso diário, contagem de posts/clipes pendentes/tamanho da biblioteca, slots da rotina de hoje com links para assets, card de stats (total de posts, viral count, high performance count). |
| **ClipperView.js** | Gerencia ciclo de vida dos clipes: exibe com cores de status (bruto/editando/aprovado), timestamps (minIn–minOut), campos de hook + CTA, botão de ciclo de status, botão delete, botão de agendamento para clipes aprovados. |
| **LibraryView.js** | Grid de assets com tags, ícone de tipo, botão delete, botão de agendamento, link externo opcional. Pills de filtro por tag: viral/vendas/engajamento/atemporal/tutorial/reutilizável/tendência. |
| **HistoryView.js** | Lista cronológica de conteúdo publicado com badge de plataforma, data, categoria, dropdown de performance (Pending/Low/Medium/High/Viral), botão de reutilização, status de movimentação cloud. Paginação (50 items por página). |
| **GeminiView.js** | Campo de tópico, 4 botões de ferramenta (Hooks/Títulos/Legendas/Scripts), botão gerar, placeholder de resultados. Integração backend funciona: chama edge function `gemini-proxy` e renderiza resposta em markdown com botão de copiar. |
| **AdminView.js** | **Mock apenas.** Exibe 1.284 usuários, 45.2k clips, 86 clientes ativos — todos hardcoded. Visível apenas se `VITE_ADMIN_EMAIL` corresponder ao usuário atual (validação client-side, não segura). |

### Features Cloud/Auth — Estado Real

#### Supabase Auth (auth.js)
- ✓ Cadastro email/senha com metadado full_name
- ✓ Login email/senha com rate limiting client-side (5 tentativas/min)
- ✓ Restauração de sessão no load da página
- ✓ Listener de estado de auth em tempo real (onAuthStateChange)
- ✓ Fluxo de reset de senha por email
- Limitação: sem OAuth/magic links no client (exigiria UI de auth customizada)

#### Supabase Cloud Sync (supabase.js)
- ✓ SyncManager inicializa a partir do AuthManager.client se usuário autenticado
- ✓ Save com debounce (500ms) → upsert na tabela `app_state`
- ✓ Load do cloud no primeiro acesso (fallback para localStorage se offline)
- ✓ Subscriptions realtime para eventos UPDATE na linha `app_state` do usuário
- ✓ Merge local + cloud por deep merge via ID (cloud wins em conflito)
- ✓ Funciona em modo offline quando variáveis Supabase não estão configuradas

#### Cloud Connectors (cloudConnectors.js)
- ✓ Google Drive: getOAuthUrl → listFiles (com thumbnails + durations) → moveFile
- ✓ OneDrive: getOAuthUrl → listFiles → moveFile
- ✗ iCloud: **Stub apenas** — OAuth URL gerada, mas token exchange não implementado
- ✓ CSRF: tokens de estado armazenados na tabela oauth_states, validados no exchange
- ✓ Criptografia de tokens: AES-256-GCM em repouso (fallback para plaintext se KEY não configurada)

#### Gemini AI (GeminiView.js + gemini-proxy)
- ✓ Chama edge function `gemini-proxy` via Supabase (não API direta)
- ✓ 4 templates de prompt: hooks, títulos, legendas, scripts (em português)
- ✓ Renderização de resposta com copiar para clipboard
- ✓ Desabilitado por padrão (`VITE_GEMINI_ENABLED=false`); requer env var para mostrar UI
- Risco: função proxy usa chave API armazenada em Supabase secrets; sem rate limiting adicional na função

### Implementado mas Quebrado ou Incompleto
1. **AdminView** — Dados todos hardcoded; sem queries reais ao banco
2. **iCloud Connector** — OAuth stub; listFiles/moveFile não implementados
3. **Video Manager** — UI de renderização existe; fluxo de upload/sync com cloud não claramente conectado
4. **Calendar Export** — Função de geração `.ics` existe mas conexão com ações de UI não confirmada
5. **Sync multi-device** — Sem mecanismo de resolução de conflito para edições offline simultâneas entre dispositivos

---

## 3. BACKEND E DADOS

### Edge Functions em supabase/functions/

#### cloud-auth/index.ts (258 linhas)
- `action: 'get_auth_url'` — Gera URL OAuth para Google Drive ou OneDrive; armazena state na tabela `oauth_states` para validação CSRF
- `action: 'exchange_token'` — Valida state, troca código por tokens, criptografa (AES-256-GCM), armazena em `cloud_tokens` com expiração

**Secrets necessários:**
```
CORS_ALLOWED_ORIGINS
TOKEN_ENCRYPTION_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
CLOUD_AUTH_REDIRECT_URI
```

#### cloud-proxy/index.ts (241 linhas)
- `action: 'list_files'` / `'list_folders'` — Busca arquivos/pastas Google Drive ou OneDrive; auto-refresh de tokens expirados
- `action: 'move_file'` — Move arquivo para nova pasta no provider
- Lógica de refresh: verifica expiração com buffer de 60s; re-criptografa antes de armazenar

#### gemini-proxy/index.ts (47 linhas, Deno)
- Recebe `{ prompt: string }`, chama Gemini 1.5 Flash API, retorna resposta raw
- CORS aberto (`Access-Control-Allow-Origin: *`) ⚠️ — risco de uso não autorizado
- Sem rate limiting próprio na função

### Migrations e Schema Resultante

#### 20240501000000_create_cloud_tokens.sql
```sql
cloud_tokens (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users,
  provider    text,              -- 'google' | 'onedrive'
  access_token  text,
  refresh_token text,
  expires_at  timestamptz,
  created_at  timestamptz,
  updated_at  timestamptz        -- auto-updated por trigger
)
-- UNIQUE (user_id, provider)
-- RLS: usuários gerenciam apenas seus próprios tokens
```

#### 20260414000000_create_app_state.sql
```sql
app_state (
  user_id    uuid PRIMARY KEY REFERENCES auth.users,
  state      jsonb,             -- blob completo do estado do app
  version    integer,
  updated_at timestamptz
)
-- RLS: auth.uid() = user_id
-- Índice em user_id para subscriptions realtime
```

#### 20260414000001_create_oauth_states.sql
```sql
oauth_states (
  id         uuid PRIMARY KEY,
  user_id    uuid REFERENCES auth.users,
  state      text UNIQUE,       -- token CSRF
  provider   text,
  expires_at timestamptz,       -- 10 minutos
  created_at timestamptz
)
-- RLS: usuários gerenciam seus próprios states
-- Índice em state para lookup rápido
```

### Valores Hardcoded que Deveriam ser Dinâmicos
- OAuth redirect URI: `io.clipper.os://oauth-callback` em cloudConnectors.js
- Admin email: via `VITE_ADMIN_EMAIL` (client-side — inseguro)
- Deep links de plataforma: hardcoded em utils.js (TikTok, Instagram Reels, YouTube, LinkedIn, Facebook, X)
- Modelo Gemini: hardcoded como `gemini-1.5-flash` em gemini-proxy
- ICS calendar PRODID: `-//Clipper OS//ClipperOS Mobile//EN`

---

## 4. QUALIDADE E TESTES

### Testes Existentes

#### src/__tests__/state.test.js (67 linhas, 11 casos)
- `generateId()` — unicidade de IDs
- `migrateState()` — fallback para defaults, inicialização de arrays, preservação de dados existentes
- `mergeStates()` — cloud wins em conflito, local-only preservado, resolução por ID

#### src/__tests__/utils.test.js (45 linhas, 9 casos)
- `escapeHtml()` — sanitização de entidades HTML
- `todayStr()` — formato de data
- `csvEscape()` — aspas e vírgulas em CSV

### CI Configuration (.github/workflows/)

| Workflow | Gatilho | O que faz |
|----------|---------|-----------|
| ci.yml | push/PR para main | Node 20, `npm test`, `npm run build` com secrets de Supabase |
| deploy-pages.yml | push para main | Deploy automático para GitHub Pages |
| build-android.yml | Manual | Build AAB para Play Store |
| build-ios.yml | Manual | Build IPA para App Store |
| release.yml | push com tag | Cria GitHub Release |

### Lacunas de Cobertura
- **auth.js** — sem nenhum teste
- **cloudConnectors.js** — sem testes
- **main.js** — 3.911 linhas sem cobertura alguma
- **Sem testes de integração** — localStorage/Supabase não testados de ponta a ponta
- **Sem testes E2E** — nenhum fluxo de UI testado

---

## 5. DÍVIDA TÉCNICA

### TODOs / FIXMEs
- Nenhum comentário `TODO:` ou `FIXME:` explícito encontrado nos arquivos em src/
- notifications.js:13 tem um comentário de aviso sobre fix crítico já resolvido no código (não é um pending TODO)

### Arquivos Suspeitos / Abandonados
| Arquivo | Problema |
|---------|----------|
| AdminView.js | Dados todos hardcoded; parece uma tela de demo nunca conectada ao backend real |
| cloudConnectors.js (iCloud) | Objeto iCloud definido mas sem implementação funcional; vai falhar silenciosamente em runtime |
| videoManager.js | UI completa de renderização mas fluxo de import/upload não confirmado como funcional end-to-end |

### Código com Dívida Estrutural
1. **main.js monolito** — 3.911 linhas de event handlers, routing e lógica de UI. Deveria ser dividido em módulos por feature.
2. **Sem error boundary global** — erros não capturados em views podem quebrar silenciosamente
3. **Acessibilidade** — labels ARIA ausentes; indicadores de status apenas por cor (problemas para daltônicos)
4. **Admin client-side** — verificação de email admin via variável de ambiente Vite exposta ao cliente; trivial de bypass

### Dependências
- Todas as dependências principais estão atualizadas: Vite 8, Capacitor 8.3, Supabase 2.103, Three.js 0.156, GSAP 3.15
- FontAwesome 6.4.0 pode ser atualizado para 6.5+ mas não é crítico
- Nenhum pacote deprecated detectado

---

## 6. O QUE FALTA PARA RODAR LOCAL

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz com:

```env
# Supabase (opcional para modo offline, necessário para cloud sync/auth)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# Gemini AI (opcional, desabilitado por padrão)
VITE_GEMINI_ENABLED=false

# Admin (opcional, não seguro em produção)
VITE_ADMIN_EMAIL=admin@exemplo.com
```

**Para as Edge Functions (via `supabase secrets set`):**
```
TOKEN_ENCRYPTION_KEY=<base64 de 32 bytes: openssl rand -base64 32>
CORS_ALLOWED_ORIGINS=https://seu-app.com,http://localhost:5173
GOOGLE_CLIENT_ID=<Google OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth Secret>
MICROSOFT_CLIENT_ID=<Azure AD App Client ID>
MICROSOFT_CLIENT_SECRET=<Azure AD App Secret>
CLOUD_AUTH_REDIRECT_URI=io.clipper.os://oauth-callback
GEMINI_API_KEY=<sua-chave-gemini>
```

### Comandos

```bash
# Instalação
npm install

# Desenvolvimento web
npm run dev                 # http://localhost:5173

# Build e testes
npm run build
npm run test
npm run test:watch

# Mobile
npm run build:mobile        # build + cap sync
npx cap open android        # Android Studio
npx cap open ios            # Xcode
```

### Serviços Externos Necessários

| Serviço | Necessário para | Setup |
|---------|----------------|-------|
| Supabase | Auth, cloud sync, edge functions | Criar projeto, rodar migrations, configurar secrets |
| Google Cloud OAuth | Google Drive connector | Console GCP: OAuth consent + credentials + redirect URI |
| Microsoft Azure AD | OneDrive connector | Azure portal: registrar app + redirect URI |
| Google AI Studio | Gemini proxy | Criar API key, adicionar ao secret GEMINI_API_KEY |

### Setup Inicial Completo

```bash
# 1. Clone e instale dependências
git clone <repo>
cd clipper-os-mobile
npm install

# 2. Configure Supabase (opcional)
# Crie projeto em supabase.com
# Copie URL e anon key para .env

# 3. Execute migrations
supabase db push
# ou manualmente no SQL editor do Supabase

# 4. Configure secrets das Edge Functions
supabase secrets set GEMINI_API_KEY="..."
supabase secrets set GOOGLE_CLIENT_ID="..."
# (etc.)

# 5. Deploy das Edge Functions
supabase functions deploy cloud-auth
supabase functions deploy cloud-proxy
supabase functions deploy gemini-proxy

# 6. Inicie dev server
npm run dev
```

---

*Diagnóstico gerado por análise direta dos arquivos do repositório. Branch: `backup/estado-2026-04-17`.*
