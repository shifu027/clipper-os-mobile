import './styles.css';
import { NotificationManager } from './notifications.js';
import { AuthManager } from './auth.js';
import { SyncManager } from './supabase.js';
import { CalendarManager } from './calendar.js';

/**
 * Clipper OS — Content Management Studio
 * Mobile-first content operations app for creators, social media managers, and clipper workflows.
 */

// ─── Helpers ────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function csvEscape(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ─── Data Layer ─────────────────────────────────────────
const STORAGE_KEY = 'clipperOS_StateV2';

const DEFAULT_STATE = {
  currentView: 'dashboard',
  config: { channel: '', niche: '', frequency: '2', cloudLinks: {}, team: 'Me', notificationsEnabled: undefined, calendarAutoAdd: false },
  library: [],
  clips: [],
  routine: [],
  history: [],
  geminiTool: 'hooks',
  filterDate: todayStr(),
};

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'Facebook', 'X / Twitter'];
const TAGS = ['viral', 'sales', 'engagement', 'evergreen', 'tutorial', 'reusable', 'trending'];

async function loadState() {
  // 1. Try loading from Supabase (if configured)
  try {
    const cloudState = await SyncManager.load();
    if (cloudState) return migrateState({ ...DEFAULT_STATE, ...cloudState });
  } catch (e) {
    console.warn('[loadState] Cloud load failed, falling back to localStorage', e);
  }

  // 2. Fallback: localStorage (existing behaviour)
  return loadStateSync();
}

function loadStateSync() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return migrateState({ ...DEFAULT_STATE, ...parsed });
    } catch (e) {
      console.error('Failed to load state', e);
    }
  }
  // Try migrating from old v1 key
  const v1 = localStorage.getItem('clipper_os_data');
  if (v1) {
    try {
      const old = JSON.parse(v1);
      const migrated = { ...DEFAULT_STATE };
      if (Array.isArray(old.library)) migrated.library = old.library.map(migrateLibraryItem);
      if (Array.isArray(old.clips)) migrated.clips = old.clips.map(migrateClipItem);
      if (Array.isArray(old.routine)) migrated.routine = old.routine.map(migrateRoutineItem);
      if (Array.isArray(old.pipeline)) {
        old.pipeline.forEach(item => {
          migrated.library.push(migrateLibraryItem({ ...item, tags: ['imported'] }));
        });
      }
      localStorage.removeItem('clipper_os_data');
      return migrated;
    } catch (e) {
      console.error('Failed to migrate v1 data', e);
    }
  }
  return { ...DEFAULT_STATE };
}

function migrateState(state) {
  // Ensure all arrays exist
  if (!Array.isArray(state.library)) state.library = [];
  if (!Array.isArray(state.clips)) state.clips = [];
  if (!Array.isArray(state.routine)) state.routine = [];
  if (!Array.isArray(state.history)) state.history = [];
  if (!state.config) state.config = { ...DEFAULT_STATE.config };
  if (!state.config.cloudLinks) state.config.cloudLinks = {};
  if (!state.filterDate) state.filterDate = todayStr();

  // Normalize items
  state.library = state.library.map(migrateLibraryItem);
  state.clips = state.clips.map(migrateClipItem);
  state.routine = state.routine.map(migrateRoutineItem);
  state.history = state.history.map(migrateHistoryItem);
  return state;
}

function migrateLibraryItem(item) {
  return {
    id: item.id || generateId(),
    title: item.title || 'Untitled',
    type: item.type || 'Short Video',
    tags: Array.isArray(item.tags) ? item.tags : [],
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
    title: item.title || 'Untitled Clip',
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
    platform: item.platform || 'Pending',
    assetId: item.assetId || null,
    source: item.source || null,
    isPosted: item.isPosted || false,
  };
}

function migrateHistoryItem(item) {
  return {
    id: item.id || generateId(),
    assetId: item.assetId || '',
    title: item.title || 'Untitled',
    platform: item.platform || '',
    category: item.category || 'Clip',
    postedAt: item.postedAt || new Date().toISOString(),
    performance: item.performance || 'Pending',
    link: item.link || '',
  };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  SyncManager.save(state); // fire-and-forget cloud sync
}

// ─── App Controller ─────────────────────────────────────
const App = {
  state: loadStateSync(),
  syncStatus: 'offline', // 'offline' | 'syncing' | 'synced'

  views: [
    { id: 'dashboard', icon: 'fa-house', name: 'Dashboard' },
    { id: 'pipeline', icon: 'fa-calendar-days', name: 'Pipeline' },
    { id: 'library', icon: 'fa-photo-film', name: 'Library' },
    { id: 'clipper', icon: 'fa-scissors', name: 'Clips' },
    { id: 'history', icon: 'fa-chart-pie', name: 'History' },
    { id: 'gemini', icon: 'fa-wand-magic-sparkles', name: 'AI Studio' },
  ],

  async init() {
    // ── Auth gate ───────────────────────────────────────
    const authConfigured = AuthManager.init();

    if (!authConfigured) {
      // Show error on auth screen when Supabase is not configured
      const authScreen = document.getElementById('auth-screen');
      const errEl = document.getElementById('auth-error');
      if (errEl) {
        errEl.textContent = 'Configuração do servidor não encontrada. Contate o administrador.';
        errEl.classList.remove('hidden');
      }
      // Keep auth screen visible — app cannot function without auth
      return;
    }

    // Wire up auth forms before checking session
    setupAuthForms();

    const session = await AuthManager.getSession();
    if (!session) {
      // No active session — show auth screen, hide app
      return;
    }

    // Active session — proceed to app
    hideAuthScreen();
    await this.initApp();
  },

  async initApp() {
    // Show logged-in user email in sidebar
    const user = AuthManager.getUser();
    const userInfoEl = document.getElementById('sidebar-user-info');
    if (userInfoEl && user?.email) {
      userInfoEl.textContent = user.email;
      userInfoEl.classList.remove('hidden');
    }

    // Initialise Supabase sync (no-op when env vars are absent)
    const syncEnabled = await SyncManager.init();

    if (syncEnabled) {
      // Load from cloud and override localStorage state
      const cloudState = await SyncManager.load();
      if (cloudState) {
        this.state = migrateState({ ...DEFAULT_STATE, ...cloudState });
        saveState(this.state);
      }
      this.syncStatus = 'synced';

      // Subscribe to real-time updates from other devices
      SyncManager.subscribe((newState) => {
        this.state = migrateState({ ...this.state, ...newState });
        saveState(this.state);
        this.renderNav();
        this.render();
        this.showToast('Data synced from another device!', 'info');
      });
    }

    if (!this.state.config.channel) {
      this.state.currentView = 'setup';
    }

    // Request notification permission if not yet decided
    if (this.state.config.notificationsEnabled === undefined) {
      const granted = await NotificationManager.requestPermission();
      this.state.config.notificationsEnabled = granted;
      saveState(this.state);
    }

    this.bindGlobalEvents();
    this.renderNav();
    this.render();
  },

  bindGlobalEvents() {
    document.getElementById('btn-backup')?.addEventListener('click', () => this.exportDataCSV());
    document.getElementById('btn-settings')?.addEventListener('click', () => this.editConfig());
    document.getElementById('btn-settings-mobile')?.addEventListener('click', () => this.editConfig());
    document.getElementById('modal-backdrop')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
      await AuthManager.signOut();
      SyncManager.reset();
      showAuthScreen();
    });
  },

  // ─── Navigation ─────────────────────────────────────
  changeView(viewId) {
    this.state.currentView = viewId;
    saveState(this.state);
    this.renderNav();
    this.render();
  },

  renderNav() {
    const createBtn = (v, mobile) => {
      const active = this.state.currentView === v.id;
      if (mobile) {
        return `<button data-nav="${v.id}" class="flex flex-col justify-center items-center py-2 transition-colors nav-item ${active ? 'text-blue-600 font-semibold' : 'text-slate-400'}">
          <i class="fa-solid ${v.icon} text-xl mb-1"></i>
          <span class="text-[10px]">${v.name}</span>
        </button>`;
      }
      return `<button data-nav="${v.id}" class="w-full flex items-center gap-3 px-6 py-3.5 mb-1 transition-colors nav-item ${active ? 'bg-blue-50 text-blue-600 font-semibold border-r-3 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}">
        <i class="fa-solid ${v.icon} text-lg w-5 text-center"></i>
        <span class="text-sm font-medium">${v.name}</span>
      </button>`;
    };

    const desktopNav = document.getElementById('desktop-nav');
    const mobileNav = document.getElementById('mobile-nav');
    if (desktopNav) desktopNav.innerHTML = this.views.map(v => createBtn(v, false)).join('');
    if (mobileNav) mobileNav.innerHTML = this.views.slice(0, 5).map(v => createBtn(v, true)).join('');

    // Bind nav clicks
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => this.changeView(btn.dataset.nav));
    });
  },

  // ─── Render Router ──────────────────────────────────
  render() {
    const content = document.getElementById('app-content');
    if (!content) return;
    content.scrollTop = 0;

    if (this.state.currentView === 'setup') {
      content.innerHTML = this.getSetupHTML();
      this.bindSetupEvents();
      return;
    }

    const renderers = {
      dashboard: () => this.getDashboardHTML(),
      pipeline: () => this.getPipelineHTML(),
      library: () => this.getLibraryHTML(),
      clipper: () => this.getClipperHTML(),
      history: () => this.getHistoryHTML(),
      gemini: () => this.getGeminiHTML(),
    };

    const renderer = renderers[this.state.currentView];
    content.innerHTML = `<div class="fade-in max-w-6xl mx-auto w-full">${renderer ? renderer() : ''}</div>`;
    this.bindViewEvents();
  },

  // ─── Dashboard ──────────────────────────────────────
  getDashboardHTML() {
    const today = todayStr();
    const todaysRoutine = this.state.routine.filter(r => r.date === today).sort((a, b) => a.time.localeCompare(b.time));

    const postsDone = this.state.history.filter(h => h.postedAt.startsWith(today)).length;
    const totalGoal = todaysRoutine.length || parseInt(this.state.config.frequency) || 2;
    const progress = totalGoal === 0 ? 0 : Math.min(100, Math.round((postsDone / totalGoal) * 100));
    const pendingClips = this.state.clips.filter(c => c.status !== 'approved' && c.status !== 'aprovado').length;
    const libraryCount = this.state.library.length;

    const routineHTML = todaysRoutine.length === 0
      ? `<div class="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
           <i class="fa-solid fa-calendar-check text-3xl mb-3 text-slate-300"></i>
           <p class="text-sm">No posts scheduled for today.</p>
           <button data-action="goto-pipeline" class="mt-3 text-sm font-bold text-blue-600 hover:underline">Open Pipeline →</button>
         </div>`
      : todaysRoutine.map(slot => {
          const asset = this.findAsset(slot.assetId, slot.source);
          return `
          <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border ${slot.isPosted ? 'border-green-200 bg-green-50/30' : 'border-slate-200'} mb-3 shadow-sm transition-all">
            <div class="font-bold ${slot.isPosted ? 'text-green-600' : 'text-slate-800'} w-14 text-center">
              <div class="text-lg">${escapeHtml(slot.time)}</div>
              <div class="text-[9px] uppercase tracking-wide text-slate-400">${escapeHtml(slot.platform.split(' ')[0])}</div>
            </div>
            <div class="flex-1 border-l border-slate-100 pl-4">
              ${asset
                ? `<div class="text-sm font-bold ${slot.isPosted ? 'text-slate-500 line-through' : 'text-slate-800'}">${escapeHtml(asset.title)}</div>
                   <div class="text-[10px] text-slate-400 mt-1">
                     <span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid ${slot.source === 'library' ? 'fa-folder' : 'fa-scissors'}"></i> ${slot.source === 'library' ? 'Library' : 'Clips'}</span>
                   </div>`
                : `<div class="text-xs text-slate-400 italic">Empty slot — schedule content from your library.</div>`}
            </div>
            ${asset && !slot.isPosted ? `<button data-action="post-slot" data-id="${slot.id}" class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 shadow-md transition-transform active:scale-95"><i class="fa-solid fa-paper-plane"></i></button>` : ''}
            ${slot.isPosted ? `<div class="w-10 h-10 text-green-500 flex items-center justify-center text-xl"><i class="fa-solid fa-circle-check"></i></div>` : ''}
          </div>`;
        }).join('');

    return `
      <div class="flex justify-between items-end mb-6">
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-slate-800">Welcome${this.state.config.channel ? ', ' + escapeHtml(this.state.config.channel) : ''}!</h2>
          <p class="text-slate-500 text-sm mt-1">Your content operations overview for today.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-bullseye text-blue-500 mr-1"></i> Today's Progress</p>
          <div class="flex items-end gap-2"><h3 class="text-2xl font-bold text-slate-800">${progress}%</h3></div>
          <div class="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden"><div class="bg-blue-500 h-full rounded-full transition-all" style="width:${progress}%"></div></div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-check-double text-green-500 mr-1"></i> Published</p>
          <h3 class="text-2xl font-bold text-slate-800">${postsDone} <span class="text-xs font-normal text-slate-400">/ ${totalGoal}</span></h3>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-amber-300" data-action="goto-clipper">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-scissors text-amber-500 mr-1"></i> Pending Clips</p>
          <h3 class="text-2xl font-bold text-slate-800">${pendingClips}</h3>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-300" data-action="goto-library">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-photo-film text-purple-500 mr-1"></i> Library Items</p>
          <h3 class="text-2xl font-bold text-slate-800">${libraryCount}</h3>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg text-slate-800">Today's Schedule</h3>
            <button data-action="goto-pipeline" class="text-sm text-blue-600 font-bold hover:underline">View Pipeline →</button>
          </div>
          <div class="bg-slate-50 p-2 md:p-4 rounded-3xl border border-slate-200">
            ${routineHTML}
          </div>
        </div>

        <div>
          <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg">
            <h3 class="font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-chart-line"></i> Quick Stats</h3>
            <p class="text-xs text-slate-300 mb-4">Lifetime publishing performance.</p>
            <div class="space-y-3">
              <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
                <i class="fa-solid fa-check-circle text-green-400"></i>
                <div><div class="text-sm font-bold">${this.state.history.length}</div><div class="text-[10px] text-slate-400">Total Published</div></div>
              </div>
              <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
                <i class="fa-solid fa-fire text-orange-400"></i>
                <div><div class="text-sm font-bold">${this.state.history.filter(h => h.performance === 'Viral').length}</div><div class="text-[10px] text-slate-400">Viral Posts</div></div>
              </div>
              <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
                <i class="fa-solid fa-box-open text-blue-400"></i>
                <div><div class="text-sm font-bold">${this.state.library.length + this.state.clips.filter(c => c.status === 'approved').length}</div><div class="text-[10px] text-slate-400">Ready to Publish</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },

  // ─── Library ────────────────────────────────────────
  getLibraryHTML() {
    const lib = this.state.library;
    const libHTML = lib.length === 0
      ? `<div class="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
           <i class="fa-solid fa-folder-open text-5xl mb-4 text-slate-300"></i>
           <p class="text-sm">Your content library is empty.</p>
           <p class="text-xs mt-1 text-slate-400">Add finished assets ready for scheduling.</p>
         </div>`
      : lib.map(item => `
          <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
            <div>
              <div class="flex justify-between items-start mb-3">
                <div class="flex gap-1 flex-wrap">
                  ${(item.tags || []).map(t => `<span class="tag-pill tag-${TAGS.includes(t) ? t : 'default'}">${escapeHtml(t)}</span>`).join('')}
                </div>
                <button data-action="delete-lib" data-id="${item.id}" class="text-slate-300 hover:text-red-500 transition-colors"><i class="fa-solid fa-trash"></i></button>
              </div>
              <h4 class="font-bold text-slate-800 text-base leading-tight mb-2">${escapeHtml(item.title)}</h4>
              <p class="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                <i class="fa-solid ${(item.type || '').includes('Video') || (item.type || '').includes('Vídeo') ? 'fa-video' : 'fa-image'} text-slate-400"></i> ${escapeHtml(item.type)}
              </p>
            </div>
            <div class="flex gap-2 border-t border-slate-100 pt-4">
              <button data-action="schedule-asset" data-id="${item.id}" data-source="library" class="flex-1 bg-slate-900 text-white text-xs py-2.5 rounded-xl font-bold hover:bg-slate-800 shadow-md active:scale-95 transition-transform"><i class="fa-solid fa-calendar-plus mr-1"></i> Schedule</button>
              ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="bg-slate-100 text-slate-600 text-xs px-4 py-2.5 rounded-xl hover:bg-slate-200 font-medium transition-colors inline-flex items-center"><i class="fa-solid fa-cloud-arrow-down"></i></a>` : ''}
            </div>
          </div>
        `).join('');

    return `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Content Library</h2>
          <p class="text-sm text-slate-500 mt-1">Finished content ready for scheduling and publishing.</p>
        </div>
        <button data-action="add-library" class="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> New Content</button>
      </div>

      <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-4 mb-2">
        <button class="tag-pill bg-slate-800 text-white whitespace-nowrap">All</button>
        ${TAGS.map(t => `<button class="tag-pill tag-${t} whitespace-nowrap bg-white hover:bg-slate-50">#${t}</button>`).join('')}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        ${libHTML}
      </div>`;
  },

  // ─── Clipper (Clips Manager) ────────────────────────
  getClipperHTML() {
    const clips = this.state.clips;
    const statusStyles = {
      raw: { color: 'slate', icon: 'fa-box', label: 'Raw' },
      bruto: { color: 'slate', icon: 'fa-box', label: 'Raw' },
      editing: { color: 'amber', icon: 'fa-scissors', label: 'Editing' },
      editando: { color: 'amber', icon: 'fa-scissors', label: 'Editing' },
      approved: { color: 'green', icon: 'fa-check-double', label: 'Approved' },
      aprovado: { color: 'green', icon: 'fa-check-double', label: 'Approved' },
    };

    const clipsHTML = clips.length === 0
      ? `<div class="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl w-full bg-white">
           <i class="fa-solid fa-film text-5xl mb-4 text-slate-300"></i>
           <p class="text-sm">No clips in the queue.</p>
           <p class="text-xs mt-1 text-slate-400">Start by clipping segments from your long-form content.</p>
         </div>`
      : clips.map(c => {
          const st = statusStyles[c.status] || statusStyles.raw;
          return `
          <div class="bg-white border-l-4 border-${st.color}-500 rounded-r-2xl rounded-l-md p-5 shadow-sm mb-4 hover:shadow-md transition">
            <div class="flex justify-between items-start mb-3">
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-${st.color}-50 text-${st.color}-600 uppercase flex items-center gap-1 border border-${st.color}-100"><i class="fa-solid ${st.icon}"></i> ${st.label}</span>
                <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md"><i class="fa-regular fa-clock text-slate-400"></i> ${escapeHtml(c.minIn)} – ${escapeHtml(c.minOut)}</span>
              </div>
              <div class="flex gap-1">
                <button data-action="cycle-clip" data-id="${c.id}" class="text-slate-400 hover:text-blue-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-arrows-rotate"></i></button>
                <button data-action="delete-clip" data-id="${c.id}" class="text-slate-400 hover:text-red-500 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>

            <h4 class="font-bold text-slate-800 text-lg mb-2 leading-tight">${escapeHtml(c.title)}</h4>

            ${c.hook ? `<div class="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 space-y-2">
              <p class="text-xs text-slate-600"><strong class="text-slate-800">Hook (0-3s):</strong> ${escapeHtml(c.hook)}</p>
              ${c.cta ? `<p class="text-xs text-slate-600"><strong class="text-slate-800">CTA:</strong> ${escapeHtml(c.cta)}</p>` : ''}
            </div>` : ''}

            <div class="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i class="fa-solid fa-bullhorn mr-1"></i> ${escapeHtml(c.platform || 'Multi-platform')}</span>
              ${c.status === 'approved' || c.status === 'aprovado'
                ? `<button data-action="schedule-asset" data-id="${c.id}" data-source="clip" class="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-transform"><i class="fa-solid fa-calendar-plus mr-1"></i> Schedule</button>`
                : `<button data-action="cycle-clip" data-id="${c.id}" class="text-xs font-semibold text-${st.color}-600 underline">Advance Stage →</button>`}
            </div>
          </div>`;
        }).join('');

    return `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Clip Manager</h2>
          <p class="text-sm text-slate-500 mt-1">Track clips from raw footage to approved and ready to publish.</p>
        </div>
        <button data-action="add-clip" class="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition flex items-center justify-center gap-2"><i class="fa-solid fa-scissors"></i> New Clip</button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-2">${clipsHTML}</div>
        <div>
          <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 sticky top-4">
            <h3 class="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2"><i class="fa-solid fa-list-check text-blue-500 mr-2"></i> Workflow Guide</h3>
            <ol class="text-sm text-slate-600 space-y-3 pl-2">
              <li class="flex gap-2"><span class="font-bold text-slate-400">1.</span> Log clip timestamps from podcasts, lives, or long videos.</li>
              <li class="flex gap-2"><span class="font-bold text-slate-400">2.</span> Write a strong hook for the first 3 seconds.</li>
              <li class="flex gap-2"><span class="font-bold text-slate-400">3.</span> Move to <span class="bg-amber-100 text-amber-700 px-1 rounded text-[10px] font-bold">Editing</span> when in progress.</li>
              <li class="flex gap-2"><span class="font-bold text-slate-400">4.</span> Mark as <span class="bg-green-100 text-green-700 px-1 rounded text-[10px] font-bold">Approved</span> and schedule for publishing.</li>
            </ol>
          </div>
        </div>
      </div>`;
  },

  // ─── Pipeline / Calendar ────────────────────────────
  getPipelineHTML() {
    const today = new Date();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
      });
    }

    const selectedDate = this.state.filterDate;
    const calendarHTML = days.map(d => `
      <button data-action="set-date" data-date="${d.dateStr}" class="flex-1 flex flex-col items-center p-3 rounded-2xl transition-all border ${selectedDate === d.dateStr ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
        <span class="text-[10px] uppercase font-bold opacity-80 mb-1">${d.dayName}</span>
        <span class="text-xl font-bold leading-none">${d.dayNum}</span>
      </button>
    `).join('');

    const slots = this.state.routine.filter(r => r.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));

    const slotsHTML = slots.length === 0
      ? `<div class="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
           <i class="fa-solid fa-calendar-xmark text-3xl mb-3 text-slate-300"></i>
           <p class="text-sm">No items scheduled for this day.</p>
           <button data-action="add-slot" data-date="${selectedDate}" class="mt-3 text-sm font-bold text-blue-500 hover:underline">+ Add Time Slot</button>
         </div>`
      : slots.map(slot => {
          const asset = this.findAsset(slot.assetId, slot.source);
          return `
          <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-3 flex gap-4 items-center">
            <div class="font-bold text-slate-700 w-12 text-center text-lg">${escapeHtml(slot.time)}</div>
            <div class="flex-1 border-l border-slate-100 pl-4 py-1">
              ${asset
                ? `<div class="flex justify-between items-start">
                     <div class="flex-1 min-w-0">
                       <span class="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded mb-1 inline-block">${escapeHtml(slot.platform)}</span>
                       <h4 class="text-sm font-bold text-slate-800 truncate" title="${escapeHtml(asset.title)}">${escapeHtml(asset.title)}</h4>
                     </div>
                     <div class="flex items-center gap-1 ml-2 shrink-0">
                       <button data-action="add-to-calendar" data-id="${slot.id}" class="text-slate-300 hover:text-blue-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors" title="Add to Calendar"><i class="fa-solid fa-calendar-plus text-xs"></i></button>
                       <button data-action="unschedule" data-id="${slot.id}" class="text-slate-300 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors" title="Unschedule"><i class="fa-solid fa-xmark"></i></button>
                     </div>
                   </div>`
                : `<div class="flex justify-between items-center">
                     <div class="text-xs text-slate-400 italic">Available slot (${escapeHtml(slot.platform)})</div>
                     <button data-action="delete-slot" data-id="${slot.id}" class="text-slate-300 hover:text-red-500 p-1"><i class="fa-solid fa-trash"></i></button>
                   </div>`}
            </div>
          </div>`;
        }).join('') + `<button data-action="add-slot" data-date="${selectedDate}" class="w-full border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 rounded-2xl p-3 text-center text-sm font-bold transition-colors">+ New Time Slot</button>`;

    // Ready assets not yet scheduled or posted
    const scheduledIds = new Set(this.state.routine.map(r => r.assetId).filter(Boolean));
    const postedIds = new Set(this.state.history.map(h => h.assetId).filter(Boolean));
    const readyAssets = [
      ...this.state.library,
      ...this.state.clips.filter(c => c.status === 'approved' || c.status === 'aprovado'),
    ].filter(a => !scheduledIds.has(a.id) && !postedIds.has(a.id));

    const readyHTML = readyAssets.length === 0
      ? `<div class="text-xs text-slate-400 text-center py-6">No unscheduled content. Approve clips or add to the library first.</div>`
      : readyAssets.map(item => `
          <div class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-2 hover:border-blue-300 transition-colors">
            <div class="text-[9px] font-bold text-slate-400 uppercase mb-1">${escapeHtml(item.type || 'Approved Clip')}</div>
            <h4 class="text-sm font-bold text-slate-800 mb-3 leading-tight line-clamp-2">${escapeHtml(item.title)}</h4>
            <button data-action="schedule-asset" data-id="${item.id}" data-source="${item.type ? 'library' : 'clip'}" class="w-full bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-200 text-xs py-2 rounded-lg font-bold transition-colors"><i class="fa-solid fa-calendar-plus mr-1"></i> Schedule</button>
          </div>
        `).join('');

    return `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Content Pipeline</h2>
          <p class="text-sm text-slate-500 mt-1">Schedule and manage your publishing calendar.</p>
        </div>
        <button data-action="export-calendar" class="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-bold px-3 py-2 rounded-xl transition-colors">
          <i class="fa-solid fa-calendar-arrow-up"></i> <span class="hidden sm:inline">Export to Calendar</span>
        </button>
      </div>

      <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-6 snap-x">
        ${calendarHTML}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <h3 class="font-bold text-slate-700 mb-4">Schedule for ${formatDate(selectedDate)}</h3>
          <div class="bg-slate-50 p-4 rounded-3xl border border-slate-200">
            ${slotsHTML}
          </div>
        </div>

        <div>
          <div class="bg-slate-100 rounded-3xl p-4 border border-slate-200 h-full max-h-[600px] flex flex-col">
            <h3 class="font-bold text-slate-700 mb-4 flex items-center gap-2"><i class="fa-solid fa-box-open text-blue-500"></i> Ready Content</h3>
            <div class="overflow-y-auto flex-1 pr-2 hide-scrollbar">
              ${readyHTML}
            </div>
          </div>
        </div>
      </div>`;
  },

  // ─── History / Analytics ────────────────────────────
  getHistoryHTML() {
    const hist = [...this.state.history].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
    const stats = {
      total: hist.length,
      viral: hist.filter(h => h.performance === 'Viral').length,
      high: hist.filter(h => h.performance === 'High' || h.performance === 'Alto').length,
    };

    const platformCounts = {};
    hist.forEach(h => {
      const p = (h.platform || 'Other').split(' ')[0];
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });
    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];

    const listHTML = hist.length === 0
      ? `<div class="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
           <i class="fa-solid fa-chart-line text-5xl mb-4 text-slate-300"></i>
           <p class="text-sm">No published content yet.</p>
           <p class="text-xs mt-1 text-slate-400">Publish content from your pipeline to build your history.</p>
         </div>`
      : hist.map(h => `
          <div class="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3 hover:shadow-md transition">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"><i class="fa-solid fa-bullhorn"></i> ${escapeHtml(h.platform || 'General')}</span>
                <span class="text-[10px] font-medium text-slate-400"><i class="fa-regular fa-calendar-check mr-1"></i> ${formatDate(h.postedAt)}</span>
                <span class="text-[10px] font-medium text-slate-400"><i class="fa-solid fa-folder-tree mr-1"></i> ${escapeHtml(h.category)}</span>
              </div>
              <h4 class="font-bold text-slate-800 text-sm md:text-base leading-tight">${escapeHtml(h.title)}</h4>
            </div>
            <div class="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 border-t md:border-0 border-slate-100 pt-3 md:pt-0">
              <div class="flex flex-col flex-1 md:flex-none">
                <label class="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Performance</label>
                <select data-action="set-perf" data-id="${h.id}" class="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-32 ${h.performance === 'Viral' ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-slate-600'}">
                  <option value="Pending" ${h.performance === 'Pending' || h.performance === 'Pendente' ? 'selected' : ''}>⏳ Evaluate</option>
                  <option value="Low" ${h.performance === 'Low' || h.performance === 'Baixo' ? 'selected' : ''}>Low</option>
                  <option value="Medium" ${h.performance === 'Medium' || h.performance === 'Médio' ? 'selected' : ''}>Medium</option>
                  <option value="High" ${h.performance === 'High' || h.performance === 'Alto' ? 'selected' : ''}>High</option>
                  <option value="Viral" ${h.performance === 'Viral' ? 'selected' : ''}>🔥 Viral</option>
                </select>
              </div>
              <button data-action="reuse-content" data-id="${h.id}" class="bg-blue-50 text-blue-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-100 transition whitespace-nowrap self-end border border-blue-100 shadow-sm active:scale-95"><i class="fa-solid fa-recycle mr-1"></i> Reuse</button>
            </div>
          </div>
        `).join('');

    return `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 class="text-2xl font-bold text-slate-800">Publishing History</h2>
          <p class="text-sm text-slate-500 mt-1">Track performance and recycle your best content.</p>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm text-center">
          <div class="text-3xl font-bold text-slate-800">${stats.total}</div>
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Posts</div>
        </div>
        <div class="bg-orange-50 p-5 rounded-3xl border border-orange-200 shadow-sm text-center">
          <div class="text-3xl font-bold text-orange-600">${stats.viral}</div>
          <div class="text-[10px] font-bold text-orange-500 uppercase tracking-wider mt-1">Viral 🔥</div>
        </div>
        <div class="bg-green-50 p-5 rounded-3xl border border-green-200 shadow-sm text-center">
          <div class="text-3xl font-bold text-green-600">${stats.high}</div>
          <div class="text-[10px] font-bold text-green-500 uppercase tracking-wider mt-1">High Perf</div>
        </div>
        <div class="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg text-center">
          <div class="text-3xl font-bold text-white">${topPlatform ? topPlatform[1] : 0}</div>
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">${topPlatform ? topPlatform[0] : 'Top Platform'}</div>
        </div>
      </div>

      <div class="space-y-1">${listHTML}</div>`;
  },

  // ─── Gemini AI (Disabled/Placeholder) ───────────────
  getGeminiHTML() {
    const geminiEnabled = typeof __GEMINI_ENABLED__ !== 'undefined' ? __GEMINI_ENABLED__ : false;

    if (!geminiEnabled) {
      return `
        <div class="bg-gradient-to-br from-purple-800 via-purple-600 to-pink-500 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-8">
          <i class="fa-solid fa-wand-magic-sparkles absolute -right-4 -bottom-4 text-[150px] opacity-10 transform -rotate-12"></i>
          <h2 class="text-3xl md:text-4xl font-bold mb-3 relative z-10 tracking-tight">AI Studio</h2>
          <p class="text-purple-100 text-sm md:text-base max-w-lg relative z-10 leading-relaxed">AI-powered content generation for hooks, titles, captions, and scripts.</p>
        </div>

        <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 text-center">
          <div class="max-w-md mx-auto py-8">
            <div class="w-20 h-20 mx-auto bg-purple-50 rounded-full flex items-center justify-center mb-6">
              <i class="fa-solid fa-lock text-3xl text-purple-400"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">AI Features Coming Soon</h3>
            <p class="text-sm text-slate-500 mb-6 leading-relaxed">
              AI-powered content generation requires a secure backend proxy to protect API credentials. This feature is intentionally disabled in the current release to ensure your security.
            </p>
            <div class="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-left">
              <h4 class="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">What you'll be able to do:</h4>
              <ul class="text-sm text-purple-600 space-y-2">
                <li class="flex items-center gap-2"><i class="fa-solid fa-check text-purple-400"></i> Generate attention-grabbing hooks</li>
                <li class="flex items-center gap-2"><i class="fa-solid fa-check text-purple-400"></i> Create viral titles and captions</li>
                <li class="flex items-center gap-2"><i class="fa-solid fa-check text-purple-400"></i> Write full video scripts</li>
                <li class="flex items-center gap-2"><i class="fa-solid fa-check text-purple-400"></i> Discover trending content angles</li>
              </ul>
            </div>
            <p class="text-xs text-slate-400 mt-4">See the project README for instructions on enabling AI features with a backend proxy.</p>
          </div>
        </div>`;
    }

    // Enabled state (dev mode only with backend proxy)
    const tools = [
      { id: 'hooks', label: '🎣 Hooks' },
      { id: 'titles', label: '📝 Titles' },
      { id: 'captions', label: '🏷️ Captions' },
      { id: 'scripts', label: '🎬 Scripts' },
    ];

    return `
      <div class="bg-gradient-to-br from-purple-800 via-purple-600 to-pink-500 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-8">
        <i class="fa-solid fa-wand-magic-sparkles absolute -right-4 -bottom-4 text-[150px] opacity-10 transform -rotate-12"></i>
        <h2 class="text-3xl md:text-4xl font-bold mb-3 relative z-10 tracking-tight">AI Studio</h2>
        <p class="text-purple-100 text-sm md:text-base max-w-lg relative z-10 leading-relaxed">Generate high-retention scripts, magnetic titles, and discover viral angles instantly.</p>
      </div>

      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
        <div class="space-y-6">
          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Topic / Subject</label>
            <input type="text" id="gemini-topic" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none placeholder:text-slate-400 transition-all" placeholder="E.g.: 3 ways to invest with little money...">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">What to generate?</label>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              ${tools.map(t => `<button data-action="set-tool" data-tool="${t.id}" class="tool-btn py-3.5 rounded-xl text-sm font-bold border transition-all ${this.state.geminiTool === t.id ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${t.label}</button>`).join('')}
            </div>
          </div>

          <button data-action="generate-ai" class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.98] transition-all mt-2">
            <i class="fa-solid fa-bolt text-yellow-400 mr-2"></i> Generate Content
          </button>
        </div>

        <div id="gemini-results" class="mt-8 pt-8 border-t border-slate-100">
          <div class="text-center py-12 px-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <i class="fa-solid fa-robot text-4xl mb-4 text-slate-300"></i>
            <p>Results will appear here after generation.</p>
          </div>
        </div>
      </div>`;
  },

  // ─── Setup / Settings ──────────────────────────────
  getSetupHTML() {
    const c = this.state.config;
    return `
      <div class="max-w-lg mx-auto fade-in mt-6 md:mt-12 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-slate-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl mb-5 shadow-lg"><i class="fa-solid fa-layer-group"></i></div>
          <h1 class="text-2xl font-bold text-slate-800">Clipper OS</h1>
          <p class="text-sm text-slate-500 mt-2">Set up your content workspace.</p>
        </div>
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 md:col-span-1">
              <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Project Name</label>
              <input type="text" id="cfg-channel" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition" value="${escapeHtml(c.channel)}" placeholder="E.g.: My Brand">
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Niche</label>
              <input type="text" id="cfg-niche" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition" value="${escapeHtml(c.niche)}" placeholder="E.g.: Finance">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Daily Target (Posts/Day)</label>
            <select id="cfg-freq" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none">
              <option value="1" ${c.frequency === '1' ? 'selected' : ''}>1 Post per day</option>
              <option value="2" ${c.frequency === '2' ? 'selected' : ''}>2 Posts per day</option>
              <option value="3" ${c.frequency === '3' ? 'selected' : ''}>3 Posts per day</option>
              <option value="5" ${c.frequency === '5' ? 'selected' : ''}>5 Posts per day (Aggressive)</option>
            </select>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-cloud text-blue-500 mr-1"></i> Cloud Folders (Optional)</h3>
            <div class="grid grid-cols-2 gap-3">
              ${['Raw', 'Edited', 'Assets', 'Management'].map(p => `
              <div><label class="block text-[10px] font-bold text-slate-400 mb-1">${p}</label><input type="url" id="cfg-link-${p}" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" placeholder="Paste link..." value="${escapeHtml(c.cloudLinks[p] || '')}"></div>
              `).join('')}
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-bell text-amber-500 mr-1"></i> Notifications</h3>
            <div class="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div>
                <div class="text-sm font-semibold text-slate-700">Enable posting reminders</div>
                <div class="text-xs text-slate-400 mt-0.5">Get reminded 15 minutes before each scheduled post</div>
              </div>
              <button id="btn-toggle-notifications" data-action="toggle-notifications"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-calendar-days text-green-500 mr-1"></i> Calendar</h3>
            <div class="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div>
                <div class="text-sm font-semibold text-slate-700">Auto-add to calendar when scheduling</div>
                <div class="text-xs text-slate-400 mt-0.5">Each new scheduled slot is automatically added to your calendar</div>
              </div>
              <button id="btn-toggle-calendar" data-action="toggle-calendar"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.calendarAutoAdd ? 'bg-blue-600' : 'bg-slate-300'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.calendarAutoAdd ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-cloud-arrow-up text-purple-500 mr-1"></i> Cloud Sync</h3>
            ${SyncManager.enabled
              ? `<div class="space-y-3">
                   <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                     <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Your Sync ID</div>
                     <div class="flex items-center gap-2">
                       <code class="text-xs text-slate-700 flex-1 truncate bg-white border border-slate-200 rounded-lg px-3 py-2">${escapeHtml(SyncManager.userId || '')}</code>
                       <button data-action="copy-sync-id" class="text-xs bg-blue-600 text-white font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">Copy ID</button>
                     </div>
                   </div>
                   <p class="text-xs text-slate-400 text-center">Your data is automatically synced when Supabase is configured</p>
                 </div>`
              : `<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                   <p class="text-sm text-amber-700 font-medium">Configure Supabase in <code class="bg-amber-100 px-1 rounded">.env</code> to enable sync</p>
                   <p class="text-xs text-amber-500 mt-1">See <code class="bg-amber-100 px-1 rounded">docs/supabase-setup.md</code> for instructions</p>
                 </div>`
            }
          </div>

          <button id="btn-save-setup" class="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-6 shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all">Save & Enter</button>
          ${c.channel ? `<button id="btn-reset" class="w-full text-slate-400 text-xs font-semibold py-2 mt-2 hover:text-red-500 transition-colors">Reset all data</button>` : ''}
        </div>
      </div>`;
  },

  // ─── Event Binding ──────────────────────────────────
  bindSetupEvents() {
    document.getElementById('btn-save-setup')?.addEventListener('click', () => this.saveSetup());
    document.getElementById('btn-reset')?.addEventListener('click', () => this.resetData());
  },

  bindViewEvents() {
    const content = document.getElementById('app-content');
    if (!content) return;

    content.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      switch (action) {
        case 'goto-pipeline': this.changeView('pipeline'); break;
        case 'goto-clipper': this.changeView('clipper'); break;
        case 'goto-library': this.changeView('library'); break;
        case 'add-library': this.openAddLibraryModal(); break;
        case 'add-clip': this.openAddClipModal(); break;
        case 'delete-lib': this.deleteLibraryItem(id); break;
        case 'delete-clip': this.deleteClip(id); break;
        case 'cycle-clip': this.cycleClipStatus(id); break;
        case 'schedule-asset': this.openScheduleModal(btn.dataset.id, btn.dataset.source); break;
        case 'set-date': this.setFilterDate(btn.dataset.date); break;
        case 'add-slot': this.addEmptySlot(btn.dataset.date); break;
        case 'delete-slot': this.deleteSlot(id); break;
        case 'unschedule': this.unscheduleAsset(id); break;
        case 'post-slot': this.postScheduledAsset(id); break;
        case 'reuse-content': this.reuseContent(id); break;
        case 'set-tool': this.setGeminiTool(btn.dataset.tool); break;
        case 'generate-ai': this.generateWithAI(); break;
        case 'add-to-calendar': this.openCalendarModal(id); break;
        case 'export-calendar': this.exportCalendar(); break;
        case 'toggle-notifications': this.toggleNotifications(); break;
        case 'toggle-calendar': this.toggleCalendarAutoAdd(); break;
        case 'copy-sync-id': this.copySyncId(); break;
      }
    });

    // Performance select change
    content.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-action="set-perf"]');
      if (sel) this.updatePerformance(sel.dataset.id, sel.value);
    });
  },

  // ─── Business Logic ─────────────────────────────────
  findAsset(assetId, source) {
    if (!assetId) return null;
    if (source === 'library') return this.state.library.find(a => a.id === assetId);
    return this.state.clips.find(c => c.id === assetId);
  },

  editConfig() {
    this.state.currentView = 'setup';
    this.renderNav();
    this.render();
  },

  saveSetup() {
    const channel = document.getElementById('cfg-channel')?.value.trim();
    if (!channel) return this.showToast('Project name is required.', 'error');

    this.state.config.channel = channel;
    this.state.config.niche = document.getElementById('cfg-niche')?.value || '';
    this.state.config.frequency = document.getElementById('cfg-freq')?.value || '2';

    ['Raw', 'Edited', 'Assets', 'Management'].forEach(p => {
      this.state.config.cloudLinks[p] = document.getElementById(`cfg-link-${p}`)?.value || '';
    });

    this.ensureTodaySlots();
    this.changeView('dashboard');
    this.showToast('Settings saved!', 'success');
  },

  resetData() {
    if (confirm('WARNING: This will delete ALL data (history, library, clips, settings). Continue?')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('clipper_os_data');
      location.reload();
    }
  },

  ensureTodaySlots() {
    const freq = parseInt(this.state.config.frequency) || 2;
    const times = freq === 1 ? ['18:00'] : freq === 2 ? ['11:30', '18:30'] : freq === 3 ? ['11:00', '14:30', '19:00'] : ['10:00', '13:00', '17:00', '20:00'];
    const today = todayStr();

    if (!this.state.routine.some(r => r.date === today)) {
      times.forEach(t => {
        this.state.routine.push({
          id: generateId(), date: today, time: t, platform: 'Auto', assetId: null, source: null, isPosted: false,
        });
      });
      saveState(this.state);
    }
  },

  // ─── Library Actions ────────────────────────────────
  openAddLibraryModal() {
    const body = `
      <div class="space-y-4">
        <div><label class="block text-xs font-bold text-slate-400 mb-1">Title</label>
        <input type="text" id="lib-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Format</label>
          <select id="lib-type" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"><option>Short Video</option><option>Long Video</option><option>Carousel / Image</option></select></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Team Member</label>
          <input type="text" id="lib-team" value="${escapeHtml(this.state.config.team)}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>
        </div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Tags (comma-separated)</label>
        <input type="text" id="lib-tags" placeholder="e.g.: viral, sales, tutorial" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Cloud Link (Optional)</label>
        <input type="url" id="lib-link" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>
      </div>`;
    const footer = `<button id="btn-save-lib" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md">Save to Library</button>`;
    this.openModal('New Content', body, footer);
    document.getElementById('btn-save-lib')?.addEventListener('click', () => this.saveLibraryItem());
  },

  saveLibraryItem() {
    const title = document.getElementById('lib-title')?.value.trim();
    if (!title) return this.showToast('Title is required.', 'error');

    const tagsRaw = document.getElementById('lib-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

    this.state.library.unshift({
      id: generateId(),
      title,
      type: document.getElementById('lib-type')?.value || 'Short Video',
      tags,
      link: document.getElementById('lib-link')?.value || '',
      team: document.getElementById('lib-team')?.value || '',
      createdAt: Date.now(),
    });
    saveState(this.state);
    this.closeModal();
    this.render();
    this.showToast('Content saved to library!', 'success');
  },

  deleteLibraryItem(id) {
    if (!confirm('Delete this item permanently?')) return;
    this.state.library = this.state.library.filter(i => i.id !== id);
    this.state.routine.forEach(r => { if (r.assetId === id) { r.assetId = null; r.source = null; } });
    saveState(this.state);
    this.render();
  },

  // ─── Clip Actions ───────────────────────────────────
  openAddClipModal() {
    const platOptions = PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('');
    const body = `
      <div class="space-y-4">
        <div><label class="block text-xs font-bold text-slate-400 mb-1">Clip Title</label>
        <input type="text" id="clip-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Start Time</label>
          <input type="text" id="clip-in" placeholder="00:00" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none text-center"></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">End Time</label>
          <input type="text" id="clip-out" placeholder="00:00" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none text-center"></div>
        </div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Hook (First 3 seconds)</label>
        <textarea id="clip-hook" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-16 resize-none"></textarea></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Target Platform</label>
          <select id="clip-plat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none">${platOptions}</select></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">CTA</label>
          <input type="text" id="clip-cta" placeholder="Follow for more..." class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none"></div>
        </div>
      </div>`;
    const footer = `<button id="btn-save-clip" class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md">Save Clip</button>`;
    this.openModal('New Clip', body, footer);
    document.getElementById('btn-save-clip')?.addEventListener('click', () => this.saveClip());
  },

  saveClip() {
    const title = document.getElementById('clip-title')?.value.trim();
    if (!title) return this.showToast('Title is required.', 'error');

    this.state.clips.unshift({
      id: generateId(),
      title,
      minIn: document.getElementById('clip-in')?.value || '00:00',
      minOut: document.getElementById('clip-out')?.value || '00:00',
      hook: document.getElementById('clip-hook')?.value || '',
      platform: document.getElementById('clip-plat')?.value || '',
      cta: document.getElementById('clip-cta')?.value || '',
      status: 'raw',
      createdAt: Date.now(),
    });
    saveState(this.state);
    this.closeModal();
    this.render();
    this.showToast('Clip added to queue!', 'success');
  },

  cycleClipStatus(id) {
    const clip = this.state.clips.find(c => c.id === id);
    if (!clip) return;
    const cycle = { raw: 'editing', bruto: 'editing', editing: 'approved', editando: 'approved', approved: 'raw', aprovado: 'raw' };
    clip.status = cycle[clip.status] || 'raw';
    saveState(this.state);
    this.render();
    const labels = { raw: 'Raw', editing: 'Editing', approved: 'Approved' };
    this.showToast(`Moved to: ${labels[clip.status] || clip.status}`, 'info');
  },

  deleteClip(id) {
    if (!confirm('Delete this clip?')) return;
    this.state.clips = this.state.clips.filter(c => c.id !== id);
    this.state.routine.forEach(r => { if (r.assetId === id) { r.assetId = null; r.source = null; } });
    saveState(this.state);
    this.render();
  },

  // ─── Pipeline / Scheduling Actions ──────────────────
  setFilterDate(dateStr) {
    this.state.filterDate = dateStr;
    this.render();
  },

  openScheduleModal(assetId, source) {
    const platOptions = PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('');
    const defaultDate = this.state.filterDate || todayStr();

    const body = `
      <div class="space-y-4">
        <input type="hidden" id="sched-asset" value="${assetId}">
        <input type="hidden" id="sched-source" value="${source}">

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Publish Date</label>
        <input type="date" id="sched-date" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${defaultDate}"></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Time</label>
          <input type="time" id="sched-time" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value="12:00"></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Platform</label>
          <select id="sched-plat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm outline-none">${platOptions}</select></div>
        </div>
      </div>`;
    const footer = `<button id="btn-save-schedule" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md">Confirm Schedule</button>`;
    this.openModal('Schedule Content', body, footer);
    document.getElementById('btn-save-schedule')?.addEventListener('click', () => this.saveSchedule());
  },

  saveSchedule() {
    const assetId = document.getElementById('sched-asset')?.value;
    const source = document.getElementById('sched-source')?.value;
    const date = document.getElementById('sched-date')?.value;
    const time = document.getElementById('sched-time')?.value;
    const platform = document.getElementById('sched-plat')?.value;

    if (!date || !time) return this.showToast('Date and time are required.', 'error');

    const slot = { id: generateId(), date, time, platform, assetId, source, isPosted: false };
    this.state.routine.push(slot);

    this.state.filterDate = date;
    saveState(this.state);
    this.closeModal();
    this.changeView('pipeline');
    this.showToast('Content scheduled!', 'success');

    // Schedule local notification if enabled
    if (this.state.config.notificationsEnabled && assetId) {
      const asset = this.findAsset(assetId, source);
      if (asset) NotificationManager.scheduleForSlot(slot, asset.title);
    }

    // Auto-add to calendar if enabled
    if (this.state.config.calendarAutoAdd && assetId) {
      const asset = this.findAsset(assetId, source);
      if (asset) CalendarManager.addEvent(slot, asset.title);
    }
  },

  addEmptySlot(date) {
    this.state.routine.push({
      id: generateId(), date, time: '12:00', platform: 'Pending', assetId: null, source: null, isPosted: false,
    });
    saveState(this.state);
    this.render();
  },

  deleteSlot(id) {
    NotificationManager.cancelForSlot(id);
    this.state.routine = this.state.routine.filter(r => r.id !== id);
    saveState(this.state);
    this.render();
  },

  unscheduleAsset(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (slot) {
      NotificationManager.cancelForSlot(slotId);
      slot.assetId = null;
      slot.source = null;
      saveState(this.state);
      this.render();
    }
  },

  // ─── Posting / History Actions ──────────────────────
  postScheduledAsset(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (!slot || !slot.assetId) return;

    const asset = this.findAsset(slot.assetId, slot.source);
    if (!asset) return;

    this.state.history.unshift({
      id: generateId(),
      assetId: asset.id,
      title: asset.title,
      platform: slot.platform,
      category: asset.type || 'Clip',
      postedAt: new Date().toISOString(),
      performance: 'Pending',
      link: asset.link || '',
    });

    slot.isPosted = true;
    NotificationManager.cancelForSlot(slotId);
    saveState(this.state);
    this.render();
    this.showToast('Marked as published! Logged in History.', 'success');
  },

  updatePerformance(historyId, val) {
    const h = this.state.history.find(x => x.id === historyId);
    if (h) {
      h.performance = val;
      saveState(this.state);
    }
  },

  reuseContent(historyId) {
    const h = this.state.history.find(x => x.id === historyId);
    if (!h) return;

    this.state.library.unshift({
      id: generateId(),
      title: `[REPOST] ${h.title}`,
      type: h.category,
      tags: ['reusable'],
      link: h.link || '',
      team: this.state.config.team,
      createdAt: Date.now(),
    });

    saveState(this.state);
    this.showToast('Content copied to Library for reuse.', 'success');
  },

  // ─── Calendar / Notification Actions ────────────────
  openCalendarModal(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (!slot) return;
    const asset = this.findAsset(slot.assetId, slot.source);
    const title = asset ? asset.title : 'Scheduled Post';

    const body = `
      <div class="space-y-3 py-2">
        <p class="text-sm text-slate-600">Add <strong>${escapeHtml(title)}</strong> on <strong>${escapeHtml(slot.date)}</strong> at <strong>${escapeHtml(slot.time)}</strong> to your calendar.</p>
        <button data-action="cal-native" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-solid fa-mobile-screen text-blue-500 text-base w-5 text-center"></i> Add to Device Calendar
        </button>
        <button data-action="cal-google" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-brands fa-google text-red-500 text-base w-5 text-center"></i> Add to Google Calendar
        </button>
        <button data-action="cal-ics" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-solid fa-file-arrow-down text-green-500 text-base w-5 text-center"></i> Download .ics file
        </button>
      </div>`;

    this.openModal('Add to Calendar', body, '');

    // Bind calendar modal buttons
    const modalBody = document.getElementById('modal-body');
    if (!modalBody) return;
    modalBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'cal-native') {
        CalendarManager.addEvent(slot, title).then(r => {
          this.closeModal();
          this.showToast(r.method === 'native' ? 'Added to device calendar!' : 'Opened Google Calendar', 'success');
        });
      } else if (action === 'cal-google') {
        CalendarManager.openGoogleCalendar(slot, title);
        this.closeModal();
      } else if (action === 'cal-ics') {
        CalendarManager.downloadICS([slot], [...this.state.library, ...this.state.clips]);
        this.closeModal();
        this.showToast('Calendar file downloaded!', 'success');
      }
    }, { once: true });
  },

  exportCalendar() {
    const allAssets = [...this.state.library, ...this.state.clips];
    const upcomingSlots = this.state.routine.filter(r => !r.isPosted && r.assetId);
    if (upcomingSlots.length === 0) {
      this.showToast('No scheduled posts to export.', 'warning');
      return;
    }
    CalendarManager.downloadICS(upcomingSlots, allAssets);
    this.showToast('Calendar exported!', 'success');
  },

  async toggleNotifications() {
    if (!this.state.config.notificationsEnabled) {
      const granted = await NotificationManager.requestPermission();
      this.state.config.notificationsEnabled = granted;
      if (!granted) {
        this.showToast('Notification permission denied.', 'warning');
      } else {
        this.showToast('Reminders enabled!', 'success');
      }
    } else {
      this.state.config.notificationsEnabled = false;
      await NotificationManager.cancelAll();
      this.showToast('Reminders disabled.', 'info');
    }
    saveState(this.state);
    this.render();
  },

  toggleCalendarAutoAdd() {
    this.state.config.calendarAutoAdd = !this.state.config.calendarAutoAdd;
    saveState(this.state);
    this.showToast(this.state.config.calendarAutoAdd ? 'Auto calendar enabled!' : 'Auto calendar disabled.', 'info');
    this.render();
  },

  copySyncId() {
    const id = SyncManager.userId || '';
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      this.showToast('Sync ID copied to clipboard!', 'success');
    }).catch(() => {
      this.showToast('Could not copy ID.', 'error');
    });
  },

  // ─── Gemini / AI ────────────────────────────────────
  setGeminiTool(tool) {
    this.state.geminiTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const isActive = btn.dataset.tool === tool;
      btn.className = `tool-btn py-3.5 rounded-xl text-sm font-bold border transition-all ${isActive ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`;
    });
  },

  async generateWithAI() {
    const resultsDiv = document.getElementById('gemini-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = `
      <div class="text-center py-6 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
        <i class="fa-solid fa-circle-info text-blue-400 text-2xl mb-3"></i>
        <p class="text-sm font-medium">AI generation requires a backend proxy.</p>
        <p class="text-xs text-slate-400 mt-2">Configure the <code class="bg-slate-200 px-1 rounded">/api/gemini/generate</code> endpoint to enable this feature.</p>
      </div>`;
  },

  // ─── Export ─────────────────────────────────────────
  exportDataCSV() {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Title,Platform,Category,Posted Date,Performance,Link\n';
    this.state.history.forEach(row => {
      csvContent += [row.id, row.title, row.platform, row.category, row.postedAt, row.performance, row.link].map(csvEscape).join(',') + '\n';
    });
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `ClipperOS_History_${todayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Export completed!', 'success');
  },

  // ─── Modal ──────────────────────────────────────────
  openModal(title, bodyHTML, footerHTML) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-footer').innerHTML = footerHTML;

    const modal = document.getElementById('global-modal');
    const content = document.getElementById('global-modal-content');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      content.classList.remove('translate-y-full');
      content.classList.add('translate-y-0');
    }, 10);
  },

  closeModal() {
    const modal = document.getElementById('global-modal');
    const content = document.getElementById('global-modal-content');
    content.classList.remove('translate-y-0');
    content.classList.add('translate-y-full');
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);
  },

  // ─── Toast Notifications ────────────────────────────
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const styles = {
      success: 'bg-green-800 text-green-50',
      error: 'bg-red-800 text-red-50',
      warning: 'bg-amber-800 text-amber-50',
      info: 'bg-slate-800 text-slate-50',
    };
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-triangle-exclamation',
      warning: 'fa-exclamation',
      info: 'fa-info-circle',
    };
    toast.className = `${styles[type]} px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-sm font-medium toast-enter pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]} text-lg opacity-90"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
};

// ─── Auth Helpers ─────────────────────────────────────
function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.remove('hidden');
}

function hideAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function setAuthSuccess(msg) {
  const el = document.getElementById('auth-success');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

window.switchAuthTab = function(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const forgotForm = document.getElementById('forgot-form');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');

  setAuthError('');
  setAuthSuccess('');

  // Hide all forms first
  loginForm?.classList.add('hidden');
  signupForm?.classList.add('hidden');
  forgotForm?.classList.add('hidden');

  // Reset tab styles
  const activeClasses = ['bg-white', 'text-slate-900', 'shadow-sm'];
  const inactiveClasses = ['text-slate-500'];
  tabLogin?.classList.remove(...activeClasses, ...inactiveClasses);
  tabSignup?.classList.remove(...activeClasses, ...inactiveClasses);

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    tabLogin?.classList.add(...activeClasses);
    tabSignup?.classList.add(...inactiveClasses);
  } else {
    signupForm?.classList.remove('hidden');
    tabSignup?.classList.add(...activeClasses);
    tabLogin?.classList.add(...inactiveClasses);
  }
};

function setupAuthForms() {
  // Auth tab event listeners (replaces inline onclick attributes)
  document.getElementById('tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-signup')?.addEventListener('click', () => switchAuthTab('signup'));

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('login-btn');
    const spinner = document.getElementById('login-spinner');

    btn?.setAttribute('disabled', 'true');
    spinner?.classList.remove('hidden');

    try {
      await AuthManager.signIn(email, password);
      hideAuthScreen();
      await App.initApp();
    } catch (err) {
      setAuthError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      btn?.removeAttribute('disabled');
      spinner?.classList.add('hidden');
    }
  });

  // Signup form
  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const name = document.getElementById('signup-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const password = document.getElementById('signup-password')?.value;
    const confirm = document.getElementById('signup-password-confirm')?.value;
    const btn = document.getElementById('signup-btn');
    const spinner = document.getElementById('signup-spinner');

    if (password !== confirm) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    btn?.setAttribute('disabled', 'true');
    spinner?.classList.remove('hidden');

    try {
      const data = await AuthManager.signUp(email, password, name);
      // If email confirmation is required, user will be null
      if (data.user && data.user.email_confirmed_at == null && data.session === null) {
        setAuthSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      } else {
        hideAuthScreen();
        await App.initApp();
      }
    } catch (err) {
      setAuthError(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      btn?.removeAttribute('disabled');
      spinner?.classList.add('hidden');
    }
  });

  // Forgot password form
  document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const email = document.getElementById('forgot-email')?.value.trim();
    const btn = document.getElementById('forgot-btn');
    const spinner = document.getElementById('forgot-spinner');

    btn?.setAttribute('disabled', 'true');
    spinner?.classList.remove('hidden');

    try {
      await AuthManager.resetPasswordForEmail(email);
      setAuthSuccess('Link de redefinição enviado! Verifique seu e-mail.');
    } catch (err) {
      setAuthError(err.message || 'Erro ao enviar e-mail. Tente novamente.');
    } finally {
      btn?.removeAttribute('disabled');
      spinner?.classList.add('hidden');
    }
  });

  // Forgot password button
  document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
    setAuthError('');
    setAuthSuccess('');
    document.getElementById('login-form')?.classList.add('hidden');
    document.getElementById('forgot-form')?.classList.remove('hidden');
    document.getElementById('tab-login')?.classList.remove('bg-white', 'text-slate-900', 'shadow-sm');
    document.getElementById('tab-login')?.classList.add('text-slate-500');
  });

  // Back to login button
  document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
    setAuthError('');
    setAuthSuccess('');
    document.getElementById('forgot-form')?.classList.add('hidden');
    document.getElementById('login-form')?.classList.remove('hidden');
    document.getElementById('tab-login')?.classList.add('bg-white', 'text-slate-900', 'shadow-sm');
    document.getElementById('tab-login')?.classList.remove('text-slate-500');
  });
}

// ─── Initialize ───────────────────────────────────────
window.ClipperApp = App;
document.addEventListener('DOMContentLoaded', () => App.init());
