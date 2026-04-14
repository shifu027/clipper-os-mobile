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
      // 1. Get OAuth URL from Edge Function
      const { data, error } = await SyncManager.client.functions.invoke('cloud-auth', {
        body: {
          action: 'get_auth_url',
          provider: this.provider,
          // If you have a specific mobile redirect URI, pass it here
          // redirect_uri: 'com.clipperos.app://oauth-callback'
        }
      });

      if (error) throw error;
      if (data && data.url) {
        // For mobile apps (Capacitor), use Browser plugin or deep links
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
    if (!SyncManager.client) return [];

    try {
      const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
        body: { action: 'list_files', provider: this.provider, folderId }
      });

      if (error) {
         if (error.status === 404 || (error.message && error.message.includes('not connected'))) {
           console.warn(`[Cloud] ${this.provider} not connected or token missing.`);
         }
         throw error;
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
    } catch (err) {
      console.error(`[Cloud] listFiles error:`, err);
      return [];
    }
  }

  async getFolders() {
    if (!SyncManager.client) return [];

    try {
      const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
        body: { action: 'list_folders', provider: this.provider }
      });
      if (error) throw error;
      return data.folders || [];
    } catch (err) {
      console.error(`[Cloud] getFolders error:`, err);
      return [];
    }
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
  async exchangeToken(code) {
    if (!SyncManager.client) throw new Error('Supabase client not initialized');

    const { data, error } = await SyncManager.client.functions.invoke('cloud-auth', {
      body: { action: 'exchange_token', provider: this.provider, code }
    });

    if (error) throw error;
    return data.success;
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
