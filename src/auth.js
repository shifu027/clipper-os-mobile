import { createClient } from '@supabase/supabase-js';

// Simple in-memory rate limiter for login attempts
const _loginAttempts = { count: 0, resetAt: 0 };
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60_000; // 1 minute

export const AuthManager = {
  client: null,
  user: null,

  init() {
    // Sanitize with .trim() to remove invisible line breaks (%0A) or spaces
    const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

    if (!url || !anonKey) {
      console.warn('[AuthManager] Supabase not configured.');
      return false;
    }
    this.client = createClient(url, anonKey);
    return true;
  },

  async getSession() {
    if (!this.client) return null;
    const { data: { session } } = await this.client.auth.getSession();
    if (session) this.user = session.user;
    return session;
  },

  async signUp(email, password, fullName) {
    if (!this.client) throw new Error('Supabase not configured');
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    this.user = data.user;
    return data;
  },

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase not configured');

    // Rate limit: max 5 attempts per minute (client-side guard)
    const now = Date.now();
    if (now > _loginAttempts.resetAt) {
      _loginAttempts.count = 0;
      _loginAttempts.resetAt = now + LOGIN_WINDOW_MS;
    }
    if (_loginAttempts.count >= LOGIN_MAX_ATTEMPTS) {
      const wait = Math.ceil((_loginAttempts.resetAt - now) / 1000);
      throw new Error(`Muitas tentativas de login. Aguarde ${wait}s antes de tentar novamente.`);
    }
    _loginAttempts.count++;

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    _loginAttempts.count = 0; // reset on success
    this.user = data.user;
    return data;
  },

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
  },

  onAuthStateChange(callback) {
    if (!this.client) return null;
    const { data: { subscription } } = this.client.auth.onAuthStateChange((event, session) => {
      this.user = session?.user ?? null;
      callback(event, session);
    });
    return subscription;
  },

  async resetPasswordForEmail(email) {
    if (!this.client) throw new Error('Supabase not configured');
    const { error } = await this.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  getUser() {
    return this.user;
  }
};
