-- Migrate: Create Cloud Tokens Table
-- Description: Stores OAuth tokens (Google Drive, OneDrive, etc.) securely for each user.
-- Author: Database Architect (Supabase/PostgreSQL)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.cloud_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at BIGINT, -- Using BIGINT for Unix Epoch (ms) consistency with JS Date.now()
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one token entry per provider per user
    UNIQUE(user_id, provider)
);

-- 2. Add comment for documentation
COMMENT ON TABLE public.cloud_tokens IS 'Stores OAuth credentials for cloud storage connectors.';

-- 3. Enable Row Level Security
ALTER TABLE public.cloud_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- NOTE: Edge Functions and Service Role actions bypass RLS by default.
-- These policies are for Client-side/App access via Supabase Client.

-- Allow users to view their own tokens (useful for checking connection status)
CREATE POLICY "Users can view their own cloud tokens"
ON public.cloud_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to insert their own tokens (initial connection)
CREATE POLICY "Users can insert their own cloud tokens"
ON public.cloud_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own tokens (refreshing or reconnecting)
CREATE POLICY "Users can update their own cloud tokens"
ON public.cloud_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own tokens (disconnecting)
CREATE POLICY "Users can delete their own cloud tokens"
ON public.cloud_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.cloud_tokens
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
