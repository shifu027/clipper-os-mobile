import { SyncManager } from './supabase.js';
import { todayStr } from './utils.js';

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
  cloudConnections: [
    { provider: 'Google Drive', enabled: false, inputFolderId: '', postedFolderId: '', inputFolderName: 'Selecionar...', postedFolderName: 'Selecionar...' },
    { provider: 'OneDrive', enabled: false, inputFolderId: '', postedFolderId: '', inputFolderName: 'Selecionar...', postedFolderName: 'Selecionar...' }
  ],
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
  state.clips = state.clips.map(migrateClipItem);
  state.routine = state.routine.map(migrateRoutineItem);
  state.history = state.history.map(migrateHistoryItem);
  state.videoAssets = state.videoAssets.map(migrateVideoAsset);

  // V2 to V3 Migration Logic

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

function migrateClipItem(item) {
  return {
    id: item.id || generateId(),
    title: item.title || 'Clipe Sem Título',
    minIn: item.minIn || '00:00',
    minOut: item.minOut || '00:00',
    hook: item.hook || item.gancho || '',
    cta: item.cta || '',
    platform: item.platform || '',
    status: item.status || 'raw',
    content: item.content || '',
    createdAt: item.createdAt || Date.now(),
  };
}

function migrateRoutineItem(item) {
  return {
    id: item.id || generateId(),
    date: item.date || todayStr(),
    time: item.time || '12:00',
    platform: item.platform || 'Pendente',
    assetId: item.assetId || null,
    source: item.source || null,
    isPosted: item.isPosted || false,
  };
}

function migrateHistoryItem(item) {
  return {
    id: item.id || generateId(),
    assetId: item.assetId || '',
    title: item.title || 'Sem Título',
    platform: item.platform || '',
    category: item.category || 'Clipe',
    postedAt: item.postedAt || new Date().toISOString(),
    performance: item.performance || 'Pendente',
    link: item.link || '',
  };
}

function migrateVideoAsset(item) {
  return {
    id: item.id || generateId(),
    title: item.title || item.name || 'Sem Título',
    thumbnailUrl: item.thumbnailUrl || '',
    duration: item.duration || '00:00',
    status: item.status || 'novo',
    sourceProvider: item.sourceProvider || 'Manual',
    sourceFolder: item.sourceFolder || 'Upload',
    createdAt: item.createdAt || Date.now(),
  };
}

export async function loadState() {
  const user = SyncManager.userId;
  const userKey = user ? `${STORAGE_KEY}_${user}` : STORAGE_KEY;

  // 1. Try cloud
  try {
    if (SyncManager.enabled) {
      const cloudState = await SyncManager.load();
      if (cloudState) {
        const migrated = migrateState(cloudState);
        localStorage.setItem(userKey, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn('[State] Cloud load failed', e);
  }

  // 2. Local fallback
  let raw = localStorage.getItem(userKey);
  // Fallback to generic key if user-specific not found (for first login migration)
  if (!raw && user) raw = localStorage.getItem(STORAGE_KEY);
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

// Deep merge: arrays merged by id (cloud wins for existing, local-only items kept).
// Prevents cloud sync from silently overwriting unsaved local changes.
export function mergeStates(local, cloud) {
  const byId = (localArr, cloudArr) => {
    const cloudMap = new Map((cloudArr || []).map(i => [i.id, i]));
    const merged = [...(cloudArr || [])];
    (localArr || []).forEach(i => { if (!cloudMap.has(i.id)) merged.push(i); });
    return merged;
  };
  return {
    ...local,
    ...cloud,
    config: { ...local.config, ...cloud.config },
    library:          byId(local.library,          cloud.library),
    clips:            byId(local.clips,            cloud.clips),
    routine:          byId(local.routine,          cloud.routine),
    history:          byId(local.history,          cloud.history),
    videoAssets:      byId(local.videoAssets,      cloud.videoAssets),
    scheduledPosts:   byId(local.scheduledPosts,   cloud.scheduledPosts),
    cloudConnections: cloud.cloudConnections || local.cloudConnections,
  };
}

export function saveState(state) {
  const user = SyncManager.userId;
  const userKey = user ? `${STORAGE_KEY}_${user}` : STORAGE_KEY;

  localStorage.setItem(userKey, JSON.stringify(state));
  if (SyncManager.enabled) {
    SyncManager.save(state).catch(e => {
      console.error('[State] Cloud save failed — local state is safe:', e);
    });
  }
}
