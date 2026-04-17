# Clipper OS Mobile — Claude Instructions

## Project Overview

Mobile content management app for social media creators and clipper workflows.
Stack: **Vite + Tailwind CSS v3 + Vanilla JS + Capacitor 8** (Android + iOS).
Backend: **Supabase** (auth, DB, Edge Functions), storage via localStorage (offline-first).

App ID: `io.clipper.os` | Web dir: `dist` | Version: 1.0.0

## Tech Stack

| Layer        | Technology                                  |
|--------------|---------------------------------------------|
| Frontend     | HTML, Tailwind CSS v3, Vanilla JS           |
| Build        | Vite 8                                      |
| Icons        | FontAwesome (locally bundled)               |
| Mobile       | Capacitor 8 (Android + iOS)                 |
| Storage      | localStorage (primary) + Supabase (cloud)   |
| Auth/Cloud   | Supabase (OAuth, Edge Functions)            |

## Development Commands

```bash
npm run dev              # dev server (Vite)
npm run build            # production build
npm run build:mobile     # build + cap sync
npm run test             # vitest run
npx cap open android     # open Android Studio
npx cap open ios         # open Xcode
```

## Key Source Files

- `src/main.js` — app entry, routing, view initialization
- `src/state.js` — global state management (localStorage)
- `src/auth.js` — authentication flow
- `src/supabase.js` — Supabase client + helpers
- `src/cloudConnectors.js` — cloud platform OAuth + posting
- `src/views/` — view components (dashboard, library, pipeline, etc.)
- `supabase/functions/cloud-auth/` — OAuth Edge Function
- `supabase/functions/cloud-proxy/` — posting proxy Edge Function

## AI Tools Available in This Project

### 1. Context7 — Current Library Documentation

**When to use:** Before writing code for any library (Vite, Capacitor, Supabase, Tailwind, GSAP, Three.js).

**Via MCP** (automatic — already connected as `claude.ai Context7`): Just ask for docs naturally.

**Via CLI** (fallback or explicit):
```bash
npx ctx7@latest library "Capacitor" "how to use local notifications"
npx ctx7@latest docs /capacitor/capacitor "local notifications setup"
```

**Trigger phrases:**
- "Use Context7 para buscar a documentação mais atual de X"
- "Antes de gerar esse código, consulte a API de X com Context7"

---

### 2. Obsidian MCP — Project Notes as External Memory

**MCP server:** `obsidian-project` (connected to this directory)

This vault is accessible as project memory. Use it to:
- Read and create `.md` notes with frontmatter and wikilinks
- Store decisions, architecture notes, and workflow docs

**Usage examples:**
- "Leia minhas notas da vault e resuma os pontos sobre autenticação"
- "Crie uma nota Obsidian com frontmatter sobre o fluxo de publicação"

---

### 3. Code Review Graph — Minimal-Context Code Review

**MCP server:** `code-review-graph` (configured in `.mcp.json`, graph built)

Reads only what's necessary — uses a knowledge graph of 274 nodes / 1413 edges built from this codebase.

**Skills available** (in `.claude/skills/`):
- `review-changes` — risk-scored review of staged/recent changes
- `explore-codebase` — minimal-token codebase exploration
- `refactor-safely` — impact-aware refactoring
- `debug-issue` — graph-guided debugging

**Usage examples:**
- "Build the code review graph for this project."
- "Use the graph to review this change reading the minimum number of files."
- "Give me the minimal context to understand the auth flow."

**Rebuild graph after major changes:**
```bash
py -m code_review_graph build
```

---

### 4. RTK — Compact Terminal Commands

**Status:** Requires Rust/Cargo installation (not yet available on this machine).

**Install when ready:**
```bash
# Windows: install Rust first from https://rustup.rs/
cargo install --git https://github.com/rtk-ai/rtk
rtk init -g
```

**Purpose:** Rewrites verbose terminal commands into compact versions, saving Claude context.

---

## MCP Servers Active for This Project

| Server              | Status       | Purpose                              |
|---------------------|--------------|--------------------------------------|
| claude.ai Context7  | ✓ Connected  | Library documentation (latest)       |
| obsidian-project    | ✓ Connected  | Project vault as external memory     |
| code-review-graph   | ✓ Configured | Knowledge graph for code review      |
| playwright          | ✓ Connected  | Browser automation / UI testing      |
| plugin:figma        | ✓ Connected  | Figma design inspection              |

## Coding Guidelines

- **No mock databases in tests** — integration tests hit real Supabase
- **Offline-first:** localStorage is the source of truth; Supabase is sync layer
- **No new files unless necessary** — prefer editing existing ones
- **Vanilla JS** — no React/Vue, keep it framework-free
- **Tailwind only** — no inline styles, no separate CSS unless PostCSS config
- **Security:** never log tokens, validate OAuth state (CSRF), sanitize event inputs
