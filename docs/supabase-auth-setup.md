# Supabase Auth Setup — Clipper OS

Este guia explica como configurar a autenticação via Supabase para o Clipper OS Mobile.

---

## Pré-requisitos

- Uma conta no [Supabase](https://supabase.com) (plano gratuito é suficiente)
- Um projeto Supabase criado

---

## Passo 1 — Obter as credenciais da API

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings → API**
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## Passo 2 — Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (copie de `.env.example`):

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
```

> ⚠️ Nunca commite o arquivo `.env` — ele está no `.gitignore`.

Para builds via GitHub Actions, adicione esses valores como **Repository Secrets** em:
`Settings → Secrets and variables → Actions`

---

## Passo 3 — Habilitar autenticação por Email/Senha

1. No Dashboard, vá em **Authentication → Providers**
2. Certifique-se que **Email** está habilitado ✅
3. Clique em **Save**

---

## Passo 4 — (Opcional) Desativar confirmação de e-mail para testes

Durante o desenvolvimento, você pode desativar a confirmação de e-mail:

1. **Authentication → Settings**
2. Desative **"Enable email confirmations"**
3. Clique em **Save**

> ⚠️ Em produção, reative a confirmação de e-mail para segurança.

---

## Passo 5 — Criar a tabela `app_state`

No **SQL Editor** do Supabase, execute:

```sql
CREATE TABLE app_state (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own state"
  ON app_state
  FOR ALL
  USING (auth.uid() = user_id);
```

---

## Como ver usuários cadastrados

No Dashboard, acesse **Authentication → Users**.

Você verá:
- E-mail do usuário
- Data de criação da conta
- Último login
- Status (confirmado, pendente, etc.)

Isso permite controlar quem acessou o app — essencial para vender o acesso por link.

---

## Fluxo de autenticação no app

```
App abre
  └── Supabase configurado?
        ├── Não → Mostra erro "Configuração do servidor não encontrada"
        └── Sim → Sessão ativa?
                    ├── Sim → Abre o app diretamente
                    └── Não → Tela de Login/Cadastro
                                ├── Entrar → Login com email + senha
                                ├── Criar Conta → Cadastro com nome, email e senha
                                └── Esqueci minha senha → Envia e-mail de reset
```

---

## Segurança

- O arquivo `.env` **nunca** é commitado (está no `.gitignore`)
- A chave `anon` é segura para uso no client — as políticas de RLS protegem os dados
- Cada usuário autenticado só acessa seus próprios dados via RLS
- A sessão persiste automaticamente via localStorage (tokens JWT)
