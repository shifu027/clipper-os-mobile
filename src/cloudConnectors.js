/**
 * CloudConnectors — Abstraction layer for cloud storage providers.
 * Real implementation using Supabase Edge Functions as Proxy for security.
 */

import { SyncManager } from './supabase.js';

export const PROVIDERS = {
  GOOGLE_DRIVE: 'Google Drive',
  ONEDRIVE: 'OneDrive',
  ICLOUD: 'iCloud',
};

class CloudConnector {
  constructor(provider) {
    this.provider = provider;
  }

  async connect() {
    console.log(`[Cloud] Connecting to ${this.provider} via proxy...`);

    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    try {
      // Generate a random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(`oauth_state_${this.provider}`, state);

      // Detect native platform to use deep link redirect URI
      let redirectUri;
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          redirectUri = 'io.clipper.os://oauth-callback';
        }
      } catch { /* running in web — no redirect_uri needed */ }

      // 1. Get OAuth URL from Edge Function
      const body = { action: 'get_auth_url', provider: this.provider, state };
      if (redirectUri) body.redirect_uri = redirectUri;

      const { data, error } = await SyncManager.client.functions.invoke('cloud-auth', { body });

      if (error) throw error;
      if (data && data.url) {
        window.open(data.url, '_blank');
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[Cloud] Connection error:`, err);
      throw err;
    }
  }

  async listFiles(folderId) {
    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
      body: { action: 'list_files', provider: this.provider, folderId }
    });

    if (error) {
      const isNotConnected = error.status === 404 || (error.message && error.message.includes('not connected'));
      console.error(`[Cloud] listFiles error (${this.provider}):`, error);
      throw isNotConnected
        ? new Error(`${this.provider} não está conectado. Reconecte sua conta nas configurações.`)
        : error;
    }

    return (data.files || []).map(f => ({
      id: f.id,
      title: f.name || f.title,
      thumbnailUrl: f.thumbnail || f.thumbnailUrl || 'https://via.placeholder.com/400x225?text=Video',
      duration: f.duration || '00:00',
      sourceFolder: f.folderName || 'Cloud',
      sourceProvider: this.provider,
      link: f.link,
      metadata: f.metadata || {}
    }));
  }

  async getFolders() {
    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
      body: { action: 'list_folders', provider: this.provider }
    });

    if (error) {
      console.error(`[Cloud] getFolders error (${this.provider}):`, error);
      throw error;
    }

    return data.folders || [];
  }

  async moveFile(fileId, toFolderId) {
    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    try {
      const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
        body: { action: 'move_file', provider: this.provider, fileId, newFolderId: toFolderId }
      });
      if (error) throw error;
      return data.success || false;
    } catch (err) {
      console.error(`[Cloud] moveFile error:`, err);
      return false;
    }
  }

  // Helper to exchange code for token after OAuth callback
  async exchangeToken(code, state) {
    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    // CSRF Validation
    const savedState = localStorage.getItem(`oauth_state_${this.provider}`);
    localStorage.removeItem(`oauth_state_${this.provider}`);
    if (!state || state !== savedState) {
       console.error(`[OAuth] State mismatch! Expected: ${savedState}, Received: ${state}`);
       throw new Error('Segurança: Falha na validação do estado (CSRF)');
    }

    const { data, error } = await SyncManager.client.functions.invoke('cloud-auth', {
      body: { action: 'exchange_token', provider: this.provider, code, state }
    });

    if (error) throw error;
    return data?.success || false;
  }
}

export const GoogleDriveConnector = new CloudConnector(PROVIDERS.GOOGLE_DRIVE);
export const OneDriveConnector = new CloudConnector(PROVIDERS.ONEDRIVE);
export const iCloudConnector = new CloudConnector(PROVIDERS.ICLOUD);

export const getConnector = (provider) => {
  switch (provider) {
    case PROVIDERS.GOOGLE_DRIVE: return GoogleDriveConnector;
    case PROVIDERS.ONEDRIVE: return OneDriveConnector;
    case PROVIDERS.ICLOUD: return iCloudConnector;
    default: return null;
  }
};
