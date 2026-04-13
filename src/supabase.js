/**
 * SyncManager — Supabase cloud sync
 * Runs in offline-only mode when Supabase env vars are not configured.
 *
 * Requires a `app_state` table in Supabase with the following schema:
 *   CREATE TABLE app_state (
 *     user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *     state    JSONB NOT NULL DEFAULT '{}',
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users manage own state" ON app_state
 *     FOR ALL USING (auth.uid() = user_id);
 */

import { AuthManager } from './auth.js';

export const SyncManager = {
  client: null,
  userId: null,
  channel: null,
  enabled: false,

  async init() {
    if (!AuthManager.client || !AuthManager.user) {
      console.log('[SyncManager] No authenticated user. Running offline.');
      return false;
    }

    try {
      this.client = AuthManager.client;
      this.userId = AuthManager.user.id;
      this.enabled = true;
      return true;
    } catch (e) {
      console.warn('[SyncManager] init failed:', e);
      return false;
    }
  },

  async save(state) {
    if (!this.enabled || !this.userId) return;
    try {
      const { error } = await this.client
        .from('app_state')
        .upsert(
          { user_id: this.userId, state, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) console.warn('[SyncManager] save error:', error.message);
    } catch (e) {
      console.warn('[SyncManager] save error:', e);
    }
  },

  async load() {
    if (!this.enabled || !this.userId) return null;
    try {
      const { data, error } = await this.client
        .from('app_state')
        .select('state')
        .eq('user_id', this.userId)
        .maybeSingle();

      if (error) {
        console.warn('[SyncManager] load error:', error.message);
        return null;
      }
      return data?.state ?? null;
    } catch (e) {
      console.warn('[SyncManager] load error:', e);
      return null;
    }
  },

  subscribe(onUpdate) {
    if (!this.enabled || !this.userId) return;

    this.channel = this.client
      .channel('app_state_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_state',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          const newState = payload.new?.state;
          if (newState) onUpdate(newState);
        },
      )
      .subscribe();
  },

  disconnect() {
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  },

  reset() {
    this.disconnect();
    this.client = null;
    this.userId = null;
    this.enabled = false;
  },
};
