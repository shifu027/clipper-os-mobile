/**
 * CloudConnectors — Abstraction layer for cloud storage providers.
 * Prepared for Google Drive, OneDrive, and iCloud.
 */

export const PROVIDERS = {
  GOOGLE_DRIVE: 'Google Drive',
  ONEDRIVE: 'OneDrive',
  ICLOUD: 'iCloud',
};

// Mock data for development
const MOCK_VIDEOS = [
  { id: 'm1', name: 'Entrevista Podcast Ep 12.mp4', size: '45MB', duration: '12:45', folder: 'Bruto', provider: PROVIDERS.GOOGLE_DRIVE, thumbnail: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=120&fit=crop' },
  { id: 'm2', name: 'Tutorial de Maquiagem.mov', size: '120MB', duration: '05:30', folder: 'Editado', provider: PROVIDERS.ONEDRIVE, thumbnail: 'https://images.unsplash.com/photo-1512496011212-32c70472c68b?w=200&h=120&fit=crop' },
  { id: 'm3', name: 'Vlog Diário - Paris.mp4', size: '890MB', duration: '22:15', folder: 'Assets', provider: PROVIDERS.GOOGLE_DRIVE, thumbnail: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=200&h=120&fit=crop' },
  { id: 'm4', name: 'Corte Viral - Negócios.mp4', size: '15MB', duration: '01:00', folder: 'Reutilizar', provider: PROVIDERS.ICLOUD, thumbnail: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=200&h=120&fit=crop' },
];

class CloudConnector {
  constructor(provider) {
    this.provider = provider;
  }

  async connect() {
    console.log(`[Cloud] Connecting to ${this.provider}...`);
    // Simulated auth flow
    return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  }

  async disconnect() {
    console.log(`[Cloud] Disconnecting from ${this.provider}...`);
    return true;
  }

  async listFiles(folderId) {
    console.log(`[Cloud] Listing files for ${this.provider} in folder ${folderId}...`);
    // Return mock videos filtered by provider for now
    return MOCK_VIDEOS.filter(v => v.provider === this.provider);
  }

  async getFolders() {
    return [
      { id: 'f1', name: 'Bruto' },
      { id: 'f2', name: 'Editado' },
      { id: 'f3', name: 'Assets' },
      { id: 'f4', name: 'Social' },
    ];
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
