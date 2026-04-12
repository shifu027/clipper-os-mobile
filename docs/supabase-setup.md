# Supabase Cloud Sync Setup

This guide explains how to set up Supabase to enable multi-device sync in Clipper OS Mobile.

## Prerequisites

- A Supabase account (free tier is sufficient)
- A Supabase project

---

## Step 1 — Create a Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Enter a project name (e.g. `clipper-os`)
4. Set a strong database password
5. Choose a region closest to your users
6. Click **Create new project**

---

## Step 2 — Create the `app_state` Table

1. In the Supabase Dashboard, go to **SQL Editor**
2. Run the following SQL:

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

3. Click **Run**

---

## Step 3 — Enable Anonymous Sign-In

1. Go to **Authentication → Providers**
2. Find **Anonymous Sign-In**
3. Toggle it **Enabled**
4. Click **Save**

---

## Step 4 — Enable Realtime for the Table

1. Go to **Database → Replication**
2. Under **Supabase Realtime**, click on the `app_state` table to enable it
3. This allows real-time sync across devices

---

## Step 5 — Get Your Project Credentials

1. Go to **Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## Step 6 — Add Credentials to `.env`

Create a `.env` file in the project root (copy `.env.example`) and fill in the Supabase values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

## How It Works

- When the app starts, it signs in **anonymously** via Supabase Auth
- Each device gets a unique **User ID**
- Your app state is saved to the `app_state` table as a JSONB column
- Changes are synced in **real time** across all devices using Supabase Realtime
- If Supabase is not configured, the app works **100% offline** with `localStorage`

## Multi-Device Sync

Your **Sync ID** (User ID) is shown in **Settings → Cloud Sync**. To sync between devices:

1. Copy your Sync ID from your primary device
2. *(Future feature)* Paste it on another device to merge data

> **Note:** Currently each device gets its own anonymous ID. Cross-device sync works automatically only when using the same browser session or after linking devices (feature roadmap).

## Security Notes

- The `.env` file is **never committed** to git (it's in `.gitignore`)
- The `anon` key is safe to use in client-side code — Row Level Security (RLS) policies enforce data access
- Anonymous auth ensures only the owner of a user ID can read/write their data
