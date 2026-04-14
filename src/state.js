import { SyncManager } from './supabase.js';

export const STORAGE_KEY = 'clipperOS_StateV3'; // Upgraded version

export const DEFAULT_STATE = {
  currentView: 'dashboard',
  config: {
    channel: '',
    niche: '',
    frequency: '2',
    cloudLinks: {},
    team: 'Eu',
    notificationsEnabled: undefined,
    calendarAutoAdd: false
  },
  library: [],
  clips: [],
  routine: [],
  history: [],
  geminiTool: 'hooks',
  filterDate: new Date().toISOString().split('T')[0],
  // New Video Manager fields
  videoAssets: [],
  scheduledPosts: [],
  cloudConnections: [],
  activeNetworkFilter: 'Todas',
};

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function migrateState(state) {
  // Base initialization
  if (!state) state = { ...DEFAULT_STATE };

  // Ensure all arrays and objects exist
  state.config = { ...DEFAULT_STATE.config, ...state.config };
  state.config.cloudLinks = state.config.cloudLinks || {};

  const arrays = ['library', 'clips', 'routine', 'history', 'videoAssets', 'scheduledPosts', 'cloudConnections'];
  arrays.forEach(key => {
    if (!Array.isArray(state[key])) state[key] = [];
  });

  if (!state.filterDate) state.filterDate = new Date().toISOString().split('T')[0];
  if (!state.activeNetworkFilter) state.activeNetworkFilter = 'Todas';

  // Specific item migrations if needed
  state.library = state.library.map(migrateLibraryItem);

  // V2 to V3 Migration Logic: If routine has items with assetId but they aren't in scheduledPosts,
  // we might want to keep them compatible or migrate them.
  // For now, we'll keep routine as the "Source of Truth" for the agenda slots,
  // but Video Manager will use scheduledPosts for its specific logic if needed.
  // Actually, let's keep routine for the agenda slots but allow them to reference videoAssets.

  return state;
}

function migrateLibraryItem(item) {
  const tagMap = {
    'sales': 'vendas',
    'engagement': 'engajamento',
    'evergreen': 'atemporal',
    'reusable': 'reutilizável',
    'trending': 'tendência'
  };
  let tags = Array.isArray(item.tags) ? item.tags : [];
  tags = tags.map(t => tagMap[t.toLowerCase()] || t);

  return {
    id: item.id || generateId(),
    title: item.title || 'Sem Título',
    type: item.type || 'Vídeo Curto',
    tags: tags,
    link: item.link || '',
    team: item.team || '',
    notes: item.notes || '',
    platform: item.platform || '',
    createdAt: item.createdAt || Date.now(),
  };
}

export async function loadState() {
  // 1. Try cloud
  try {
    if (SyncManager.enabled) {
      const cloudState = await SyncManager.load();
      if (cloudState) {
        const migrated = migrateState(cloudState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn('[State] Cloud load failed', e);
  }

  // 2. Local fallback (Try V3 then V2 then V1)
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) raw = localStorage.getItem('clipperOS_StateV2');
  if (!raw) raw = localStorage.getItem('clipper_os_data');

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return migrateState(parsed);
    } catch (e) {
      console.error('[State] Failed to parse local state', e);
    }
  }

  return { ...DEFAULT_STATE };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (SyncManager.enabled) {
    SyncManager.save(state);
  }
}
