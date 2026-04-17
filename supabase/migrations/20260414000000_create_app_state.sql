-- Migration: Create app_state table for cloud state synchronization
-- Required by SyncManager (src/supabase.js)

CREATE TABLE IF NOT EXISTS public.app_state (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}',
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own state"
  ON public.app_state
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for realtime filter (user_id=eq.<id>)
CREATE INDEX IF NOT EXISTS app_state_user_id_idx ON public.app_state (user_id);
