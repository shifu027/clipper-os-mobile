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
        body: { action: 'get_auth_url', provider: this.provider }
      });

      if (error) throw error;
      if (!data.url) throw new Error('Failed to get auth URL');

      // 2. Open URL for user (Capacitor Browser would be used here in production)
      window.open(data.url, '_blank');

      // For mobile development, we expect the redirect to a deep-link
      // which will then notify the app. Here we simulate polling or completion.
      return true;
    } catch (err) {
      console.error(`[Cloud] Connection error:`, err);
      throw err;
    }
  }

  async listFiles(folderId) {
    console.log(`[Cloud] Listing files for ${this.provider} in folder ${folderId}...`);

    if (!SyncManager.client) return [];

    try {
      const { data, error } = await SyncManager.client.functions.invoke('cloud-proxy', {
        body: { action: 'list_files', provider: this.provider, folderId }
      });

      if (error) throw error;

      // Normalize response from proxy
      return (data.files || []).map(f => ({
        id: f.id,
        title: f.name,
        thumbnailUrl: f.thumbnail,
        duration: f.duration || '00:00',
        folder: f.folderName || 'Root',
        provider: this.provider,
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
      return [];
    }
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
