import './styles.css';
import * as THREE from 'three';
import { NotificationManager } from './notifications.js';
import { AuthManager } from './auth.js';
import { SyncManager } from './supabase.js';
import { CalendarManager } from './calendar.js';
import { loadState, saveState, migrateState, mergeStates, STORAGE_KEY, generateId } from './state.js';
import { renderDashboard } from './views/DashboardView.js';
import { renderLibrary }   from './views/LibraryView.js';
import { renderClipper }   from './views/ClipperView.js';
import { renderHistory, renderHistoryItem } from './views/HistoryView.js';
import { renderAdmin }     from './views/AdminView.js';
import { renderGemini }    from './views/GeminiView.js';
import { VideoManagerUI } from './videoManager.js';
import { PROVIDERS, getConnector } from './cloudConnectors.js';
import { escapeHtml, formatDate, todayStr, csvEscape, PLATFORMS, TAGS, getSocialDeepLink } from './utils.js';

/**
 * Clipper OS — Content Management Studio
 * Mobile-first content operations app for creators, social media managers, and clipper workflows.
 */

// ─── Three.js Background Logic ──────────────────────────
function initBackground() {
  const canvas = document.getElementById('three-bg');
  if (!canvas) return;

  const isMobile = /Android|iPhone/i.test(navigator.userAgent);
  const MAX_PARTICLES = isMobile ? 40 : 100;
  const MAX_DISTANCE = 150;

  let scene, camera, renderer, particles, lines;
  let positions, velocities, particleData = [];
  let mouse = new THREE.Vector2(-1000, -1000);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 4000);
  camera.position.z = 1000;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const group = new THREE.Group();
  scene.add(group);

  const segments = MAX_PARTICLES * MAX_PARTICLES;
  positions = new Float32Array(MAX_PARTICLES * 3);
  const linePositions = new Float32Array(segments * 3);
  const lineColors = new Float32Array(segments * 3);

  const pMaterial = new THREE.PointsMaterial({
    color: 0x4cc9f0,
    size: 3,
    blending: THREE.AdditiveBlending,
    transparent: true,
    sizeAttenuation: true
  });

  const particlesGeom = new THREE.BufferGeometry();
  particlesGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  particles = new THREE.Points(particlesGeom, pMaterial);
  group.add(particles);

  const linesGeom = new THREE.BufferGeometry();
  linesGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
  linesGeom.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

  const lMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.3
  });

  lines = new THREE.LineSegments(linesGeom, lMaterial);
  group.add(lines);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    const x = Math.random() * 800 - 400;
    const y = Math.random() * 800 - 400;
    const z = Math.random() * 800 - 400;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    particleData.push({
      velocity: new THREE.Vector3(-0.5 + Math.random(), -0.5 + Math.random(), -0.5 + Math.random()),
      numConnections: 0
    });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);

  function render() {
    let vertexIndex = 0;
    let colorIndex = 0;
    let lineCount = 0;

    const lp = lines.geometry.attributes.position.array;
    const lc = lines.geometry.attributes.color.array;

    // GPU & CPU Throttle: Only process/render if the tab is visible
    if (!document.hidden) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const i3 = i * 3;
        positions[i3] += particleData[i].velocity.x;
        positions[i3 + 1] += particleData[i].velocity.y;
        positions[i3 + 2] += particleData[i].velocity.z;

        if (positions[i3] < -400 || positions[i3] > 400) particleData[i].velocity.x *= -1;
        if (positions[i3+1] < -400 || positions[i3+1] > 400) particleData[i].velocity.y *= -1;
        if (positions[i3+2] < -400 || positions[i3+2] > 400) particleData[i].velocity.z *= -1;

        for (let j = i + 1; j < MAX_PARTICLES; j++) {
          const j3 = j * 3;
          const dx = positions[i3] - positions[j3];
          const dy = positions[i3 + 1] - positions[j3 + 1];
          const dz = positions[i3 + 2] - positions[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < MAX_DISTANCE) {
            const alpha = 1.0 - dist / MAX_DISTANCE;
            lp[vertexIndex++] = positions[i3];
            lp[vertexIndex++] = positions[i3 + 1];
            lp[vertexIndex++] = positions[i3 + 2];
            lp[vertexIndex++] = positions[j3];
            lp[vertexIndex++] = positions[j3 + 1];
            lp[vertexIndex++] = positions[j3 + 2];
            lc[colorIndex++] = alpha * 0.2;
            lc[colorIndex++] = alpha * 0.5;
            lc[colorIndex++] = alpha * 0.8;
            lc[colorIndex++] = alpha * 0.2;
            lc[colorIndex++] = alpha * 0.5;
            lc[colorIndex++] = alpha * 0.8;
            lineCount++;
          }
        }
      }

      camera.position.x += (mouse.x * 50 - camera.position.x) * 0.02;
      camera.position.y += (mouse.y * 50 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      lines.geometry.setDrawRange(0, lineCount * 2);
      lines.geometry.attributes.position.needsUpdate = true;
      lines.geometry.attributes.color.needsUpdate = true;
      particles.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }

    animationFrameId = requestAnimationFrame(render);
  }

  let animationFrameId;
  const handleVisibilityChange = () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      render();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  render();

  return function destroyBackground() {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    renderer.dispose();
  };
}

// ─── App Controller ─────────────────────────────────────

const App = {
  state: null, // Will be loaded in init
  syncStatus: 'offline', // 'offline' | 'syncing' | 'synced'
  isAdmin: false,
  _authSubscription: null,
  _initializingApp: false,

  views: [
    { id: 'dashboard', icon: 'fa-house', name: 'Início' },
    { id: 'videos', icon: 'fa-clapperboard', name: 'Vídeos' },
    { id: 'pipeline', icon: 'fa-calendar-days', name: 'Pipeline' },
    { id: 'library', icon: 'fa-photo-film', name: 'Biblioteca' },
    { id: 'clipper', icon: 'fa-scissors', name: 'Clipes' },
    { id: 'history', icon: 'fa-chart-pie', name: 'Histórico' },
    { id: 'gemini', icon: 'fa-wand-magic-sparkles', name: 'AI Studio' },
  ],

  async init() {
    this.state = await loadState();
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

    // ── Global Auth Listener ────────────────────────────
    if (this._authSubscription) {
      this._authSubscription.unsubscribe();
    }
    this._authSubscription = AuthManager.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`);

      if (event === 'SIGNED_OUT') {
        SyncManager.reset();
        showAuthScreen();
        // Force a UI reset or reload to clear sensitive data
        location.reload();
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          hideAuthScreen();
          // Avoid re-initializing if already in the app
          const appContent = document.getElementById('app-content');
          if (appContent && !appContent.innerHTML.trim()) {
            await this.initApp();
          }
        }
      }
    });

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
    if (this._initializingApp) {
      console.warn('[App] initApp() already in progress, skipping duplicate call.');
      return;
    }
    this._initializingApp = true;
    console.log('[App] Initializing content...');

    // ── OAuth Callback Handling ─────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const provider = urlParams.get('provider');

    if (code && provider) {
      try {
        const connector = getConnector(provider);
        if (connector) {
          const success = await connector.exchangeToken(code, state);
          if (success) {
            // Only clean the URL after a confirmed successful exchange
            window.history.replaceState({}, document.title, window.location.pathname);
            this.showToast(`${provider} conectado com sucesso!`, 'success');
          }
        }
      } catch (err) {
        console.error('[OAuth] Exchange failed:', err);
        // Do NOT clean the URL on failure — user can reload to retry
        this.showToast(`Erro ao conectar ${provider}: ${err.message}. Recarregue a página para tentar novamente.`, 'error');
      }
    }

    const user = AuthManager.getUser();
    if (user) {
      const userInfoEl = document.getElementById('sidebar-user-info');
      if (userInfoEl) {
        userInfoEl.textContent = user.email;
        userInfoEl.classList.remove('hidden');
      }
    }

    // Boss Detection
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
    this.isAdmin = adminEmail && user?.email === adminEmail;

    // Add Admin View to the list if user is admin
    if (this.isAdmin && !this.views.find(v => v.id === 'admin')) {
      this.views.push({ id: 'admin', icon: 'fa-user-shield', name: 'Painel Admin' });
    }

    // Force setup view if no channel is configured
    if (!this.state.config.channel) {
      this.state.currentView = 'setup';
    } else {
      const validViews = this.views.map(v => v.id).concat(['setup']);
      if (!validViews.includes(this.state.currentView)) {
        this.state.currentView = 'dashboard';
      }
    }

    // Initialise Supabase sync
    const syncEnabled = await SyncManager.init();
    if (syncEnabled) {
      const cloudState = await SyncManager.load();
      if (cloudState) {
        this.state = migrateState(mergeStates(this.state, cloudState));
      }
      SyncManager.subscribe((newState) => {
        this.state = migrateState(mergeStates(this.state, newState));

        // State Management Concurrency Guard
        const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        const isModalOpen = !document.getElementById('global-modal')?.classList.contains('hidden');

        if (isEditing || isModalOpen) {
          console.log('[App] State updated from cloud, but skipping render to preserve user focus/modal.');
          return;
        }

        this.renderNav();
        this.render();
      });
    }

    this.bindGlobalEvents();
    this.renderNav();
    this.render();

    // Final safety: if for some reason content is empty, force dashboard
    setTimeout(() => {
      const content = document.getElementById('app-content');
      if (content && !content.innerHTML.trim()) {
        console.warn('[App] Content empty, re-rendering...');
        this.changeView('dashboard');
      }
    }, 100);

    this._initializingApp = false;
  },

  bindGlobalEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    const safeBind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn.bind(this);
    };

    safeBind('btn-backup', this.exportDataCSV);
    safeBind('btn-settings', this.editConfig);
    safeBind('btn-settings-mobile', this.editConfig);
    safeBind('modal-backdrop', this.closeModal);
    safeBind('modal-close-btn', this.closeModal);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await AuthManager.signOut();
        SyncManager.reset();
        location.reload(); // Hard reload for clean state
      };
    }

    // Navigation Event Delegation
    const handleNav = (e) => {
      const btn = e.target.closest('[data-nav]');
      if (btn) {
        e.preventDefault();
        this.changeView(btn.dataset.nav);
      }
    };
    document.getElementById('desktop-nav')?.addEventListener('click', handleNav);
    document.getElementById('mobile-nav')?.addEventListener('click', handleNav);

    // ─── Content Event Delegation ───────────────────────
    const content = document.getElementById('app-content');
    if (content) {
      // Click Delegation
      content.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        this.handleAction(action, id, btn);
      });

      // Change Delegation
      content.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-action="set-perf"]');
        if (sel) this.updatePerformance(sel.dataset.id, sel.value);
      });

      // Drag-and-Drop Delegation (mouse)
      content.addEventListener('dragstart', (e) => {
        const el = e.target.closest('.draggable-item');
        if (el) {
          const item = { id: el.dataset.id, source: el.dataset.source };
          e.dataTransfer.setData('application/json', JSON.stringify(item));
          el.classList.add('opacity-50', 'scale-95');
        }
      });

      content.addEventListener('dragend', (e) => {
        const el = e.target.closest('.draggable-item');
        if (el) el.classList.remove('opacity-50', 'scale-95');
      });

      content.addEventListener('dragover', (e) => {
        const zone = e.target.closest('[data-action="attach-content"]');
        if (zone) {
          e.preventDefault();
          const container = zone.closest('.bg-white') || zone;
          container.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/50');
        }
      });

      content.addEventListener('dragleave', (e) => {
        const zone = e.target.closest('[data-action="attach-content"]');
        if (zone) {
          const container = zone.closest('.bg-white') || zone;
          container.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50');
        }
      });

      content.addEventListener('drop', (e) => {
        const zone = e.target.closest('[data-action="attach-content"]');
        if (zone) {
          e.preventDefault();
          const container = zone.closest('.bg-white') || zone;
          container.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50');
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const slotId = zone.dataset.id;
            if (data.id && slotId) this.attachToSlot(slotId, data.id, data.source);
          } catch (err) {
            console.error('[DnD] Drop failed:', err);
          }
        }
      });

      // Drag-and-Drop Delegation (touch — iOS/Android)
      let _touchDragItem = null;
      let _touchDragEl = null;

      const _clearDropHighlights = () => {
        content.querySelectorAll('[data-action="attach-content"]').forEach(z => {
          (z.closest('.bg-white') || z).classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/50');
        });
      };

      content.addEventListener('touchstart', (e) => {
        const el = e.target.closest('.draggable-item');
        if (!el) return;
        _touchDragEl = el;
        _touchDragItem = { id: el.dataset.id, source: el.dataset.source };
        el.classList.add('opacity-50', 'scale-95');
      }, { passive: true });

      content.addEventListener('touchmove', (e) => {
        if (!_touchDragItem) return;
        e.preventDefault();
        const touch = e.touches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const zone = elUnder?.closest('[data-action="attach-content"]');
        _clearDropHighlights();
        if (zone) {
          (zone.closest('.bg-white') || zone).classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/50');
        }
      }, { passive: false });

      content.addEventListener('touchend', (e) => {
        if (!_touchDragItem) return;
        const touch = e.changedTouches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const zone = elUnder?.closest('[data-action="attach-content"]');
        if (_touchDragEl) _touchDragEl.classList.remove('opacity-50', 'scale-95');
        _clearDropHighlights();
        if (zone) {
          const slotId = zone.dataset.id;
          if (_touchDragItem.id && slotId) this.attachToSlot(slotId, _touchDragItem.id, _touchDragItem.source);
        }
        _touchDragItem = null;
        _touchDragEl = null;
      });
    }
  },

  handleAction(action, id, btn) {
    switch (action) {
      case 'goto-pipeline': this.changeView('pipeline'); break;
      case 'goto-clipper': this.changeView('clipper'); break;
      case 'goto-library': this.changeView('library'); break;
      case 'add-library': this.openAddLibraryModal(); break;
      case 'add-clip': this.openAddClipModal(); break;
      case 'delete-lib': this.deleteLibraryItem(id); break;
      case 'delete-clip': this.deleteClip(id); break;
      case 'cycle-clip': this.cycleClipStatus(id); break;
      case 'schedule-asset': this.openScheduleModal(id, btn.dataset.source); break;
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
      case 'filter-network': this.setNetworkFilter(btn.dataset.network); break;
      case 'attach-content': this.openAttachModal(id); break;
      case 'open-cloud-modal': this.openCloudModal(); break;
      case 'connect-cloud': this.connectCloud(btn.dataset.provider); break;
      case 'disconnect-cloud': this.disconnectCloud(btn.dataset.provider); break;
      case 'preview-video': this.previewVideo(id); break;
      case 'edit-video': this.editVideo(id); break;
      case 'attach-to-agenda': this.openScheduleModal(id, 'videoAsset'); break;
      case 'add-video-manual': this.addVideoManual(); break;
      case 'save-setup': this.saveSetup(); break;
      case 'reset-data': this.resetData(); break;
      case 'filter-videos':
        this.state.videoFilter = btn.dataset.filter;
        saveState(this.state);
        this.render();
        break;
      case 'select-folder': this.selectCloudFolder(btn.dataset.provider, btn.dataset.type); break;
      case 'video-options': this.showVideoOptions(id); break;
      case 'load-more-history': {
        const offset = parseInt(btn.dataset.offset);
        const PAGE = 50;
        const hist = [...this.state.history].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
        const list = document.getElementById('history-items-list');
        if (list) {
          hist.slice(offset, offset + PAGE).forEach(h => list.insertAdjacentHTML('beforeend', renderHistoryItem(h)));
          const remaining = hist.length - (offset + PAGE);
          if (remaining > 0) { btn.dataset.offset = offset + PAGE; btn.innerHTML = `<i class="fa-solid fa-chevron-down mr-2"></i> Carregar mais (${remaining} restantes)`; }
          else btn.parentElement?.remove();
        }
        break;
      }
    }
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
        return `<button data-nav="${v.id}" class="flex flex-col justify-center items-center py-2 transition-all nav-item ${active ? 'text-blue-600 font-semibold' : 'text-slate-400'}">
          <i class="fa-solid ${v.icon} text-xl mb-1"></i>
          <span class="text-[10px]">${v.name}</span>
        </button>`;
      }
      return `<button data-nav="${v.id}" class="w-full flex items-center gap-3 px-6 py-3.5 mb-1 transition-all nav-item ${active ? 'bg-blue-50 text-blue-600 font-semibold border-r-4 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}">
        <i class="fa-solid ${v.icon} text-lg w-5 text-center"></i>
        <span class="text-sm font-medium">${v.name}</span>
      </button>`;
    };

    const desktopNav = document.getElementById('desktop-nav');
    const mobileNav = document.getElementById('mobile-nav');
    if (desktopNav) desktopNav.innerHTML = this.views.map(v => createBtn(v, false)).join('');

    if (mobileNav) {
      const findView = (id) => this.views.find(v => v.id === id);
      // Incluindo 'videos' na navegação mobile principal
      let mobileViewIds = ['dashboard', 'videos', 'pipeline', 'library', 'gemini'];

      if (this.isAdmin) {
        mobileViewIds = ['dashboard', 'videos', 'pipeline', 'gemini', 'admin'];
      }

      let mobileViews = mobileViewIds.map(id => findView(id)).filter(Boolean);

      // Fallback if views weren't found for some reason
      if (mobileViews.length === 0) {
        mobileViews = this.views.slice(0, 5);
      }

      mobileNav.innerHTML = mobileViews.map(v => createBtn(v, true)).join('');
    }
  },

  // ─── Render Router ──────────────────────────────────
  render() {
    const content = document.getElementById('app-content');
    if (!content) return;

    try {
      content.scrollTop = 0;
      if (this.state.currentView !== 'history') this._historyLimit = 50;

      if (this.state.currentView === 'setup') {
        content.innerHTML = this.getSetupHTML();
        this.bindSetupEvents();
        return;
      }

      const renderers = {
        dashboard: () => this.getDashboardHTML(),
        videos: () => VideoManagerUI.renderVideoManager(this.state),
        pipeline: () => this.getPipelineHTML(),
        library: () => this.getLibraryHTML(),
        clipper: () => this.getClipperHTML(),
        history: () => this.getHistoryHTML(),
        gemini: () => this.getGeminiHTML(),
        admin: () => this.getAdminHTML(),
      };

      const renderer = renderers[this.state.currentView];
      content.innerHTML = `<div class="fade-in max-w-6xl mx-auto w-full">${renderer ? renderer() : ''}</div>`;
      this.bindViewEvents();
    } catch (e) {
      console.error('[App] Render failed:', e);
      content.innerHTML = `<div class="p-8 text-center text-red-500"><i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i><p class="font-bold">Erro ao carregar a tela.</p><p class="text-sm text-slate-500 mt-1">Recarregue a página para continuar.</p></div>`;
    }
  },

  // ─── Dashboard ──────────────────────────────────────
  getDashboardHTML() {
    return renderDashboard(this.state, this.findAsset.bind(this));
  },


  // ─── Library ────────────────────────────────────
  getLibraryHTML() {
    return renderLibrary(this.state);
  },

  // ─── Clipper (Clips Manager) ────────────────────
  getClipperHTML() {
    return renderClipper(this.state);
  },

  // ─── Pipeline / Calendar ────────────────────────────
  getPipelineHTML() {
    const today = new Date();
    const days = [];
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: weekdays[d.getDay()],
        dayNum: d.getDate(),
      });
    }

    const selectedDate = this.state.filterDate;
    const activeFilter = this.state.activeNetworkFilter || 'Todas';

    const calendarHTML = days.map(d => `
      <button data-action="set-date" data-date="${d.dateStr}" class="flex-1 flex flex-col items-center p-3 rounded-2xl transition-all border ${selectedDate === d.dateStr ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
        <span class="text-[10px] uppercase font-bold opacity-80 mb-1">${d.dayName}</span>
        <span class="text-xl font-bold leading-none">${d.dayNum}</span>
      </button>
    `).join('');

    const filterPlatforms = ['Todas', ...PLATFORMS];
    const filtersHTML = filterPlatforms.map(p => `
      <button data-action="filter-network" data-network="${p}" class="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${activeFilter === p ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}">
        ${p}
      </button>
    `).join('');

    let slots = this.state.routine.filter(r => r.date === selectedDate);
    if (activeFilter !== 'Todas') {
      slots = slots.filter(r => r.platform.includes(activeFilter) || r.platform === 'Auto' || r.platform === 'Pendente');
    }
    slots.sort((a, b) => a.time.localeCompare(b.time));

    const slotsHTML = slots.length === 0
      ? `<div class="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
           <i class="fa-solid fa-calendar-xmark text-4xl mb-4 text-slate-200"></i>
           <p class="text-sm font-medium">Nenhum slot para esta combinação.</p>
           <button data-action="add-slot" data-date="${selectedDate}" class="mt-4 text-sm font-bold text-blue-600 hover:underline">+ Adicionar Horário Operacional</button>
         </div>`
      : slots.map(slot => {
          const asset = this.findAsset(slot.assetId, slot.source);
          const isAuto = slot.platform === 'Auto' || slot.platform === 'Pendente';

          return `
          <div class="bg-white p-5 rounded-3xl shadow-sm border ${asset ? 'border-blue-100 bg-blue-50/10' : 'border-slate-200'} mb-4 flex gap-5 items-center group transition-all hover:shadow-md">
            <div class="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-white transition-colors">
              <span class="text-lg font-black text-slate-800">${escapeHtml(slot.time)}</span>
              <span class="text-[8px] font-black uppercase tracking-tighter text-slate-400">OPERACIONAL</span>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1.5">
                <span class="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                  ${escapeHtml(slot.platform === 'Auto' ? 'Smart Slot' : slot.platform)}
                </span>
                ${slot.isPosted ? '<span class="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg"><i class="fa-solid fa-check mr-1"></i> PUBLICADO</span>' : ''}
              </div>

              ${asset
                ? `<div class="flex justify-between items-center gap-3">
                     <div class="flex-1 min-w-0">
                       <h4 class="text-sm font-bold text-slate-800 truncate" title="${escapeHtml(asset.title)}">${escapeHtml(asset.title)}</h4>
                       <div class="flex items-center gap-2 mt-1">
                          <span class="text-[10px] text-slate-400"><i class="fa-solid ${slot.source === 'videoAsset' ? 'fa-clapperboard' : 'fa-folder'} mr-1"></i> ${slot.source === 'videoAsset' ? 'Central de Vídeos' : 'Biblioteca'}</span>
                       </div>
                     </div>
                     <div class="flex items-center gap-1 shrink-0">
                       <button data-action="unschedule" data-id="${slot.id}" class="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all" title="Desvincular">
                         <i class="fa-solid fa-link-slash text-xs"></i>
                       </button>
                     </div>
                   </div>`
                : `<div class="flex justify-between items-center">
                     <div class="text-xs text-slate-400 font-medium">Livre para conteúdo</div>
                     <div class="flex gap-2">
                       <button data-action="attach-content" data-id="${slot.id}" class="bg-blue-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-blue-700 shadow-sm transition-all active:scale-95">
                         <i class="fa-solid fa-paperclip mr-1"></i> ANEXAR
                       </button>
                       <button data-action="delete-slot" data-id="${slot.id}" class="text-slate-300 hover:text-red-500 p-1 transition-colors"><i class="fa-solid fa-trash-can text-xs"></i></button>
                     </div>
                   </div>`}
            </div>
          </div>`;
        }).join('') + `<button data-action="add-slot" data-date="${selectedDate}" class="w-full border-2 border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 rounded-3xl p-4 text-center text-sm font-bold transition-all">+ Novo Horário Operacional</button>`;

    // Available content for the side panel
    const scheduledAssetIds = new Set(this.state.routine.map(r => r.assetId).filter(Boolean));
    const readyContent = [
      ...this.state.videoAssets.filter(v => v.status === 'pronto' || v.status === 'reutilizar'),
      ...this.state.library,
      ...this.state.clips.filter(c => c.status === 'approved' || c.status === 'aprovado'),
    ];

    const readyHTML = readyContent.length === 0
      ? `<div class="text-xs text-slate-400 text-center py-10 px-4 bg-white/50 rounded-2xl border border-dashed border-slate-200">
          <i class="fa-solid fa-inbox text-2xl mb-2 opacity-20"></i>
          <p>Nenhum conteúdo pronto disponível para agendamento.</p>
        </div>`
      : readyContent.map(item => {
          const isVideo = !!item.thumbnailUrl;
          const source = item.type ? 'library' : (isVideo ? 'videoAsset' : 'clip');
          const isScheduled = scheduledAssetIds.has(item.id);

          return `
          <div class="bg-white p-3 rounded-2xl shadow-sm border ${isScheduled ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'} mb-3 hover:border-blue-400 transition-all group cursor-move draggable-item" draggable="true" data-id="${item.id}" data-source="${source}">
            <div class="flex gap-3 pointer-events-none">
              ${isVideo ? `<img src="${item.thumbnailUrl}" class="w-12 h-12 rounded-lg object-cover bg-slate-100" />` : `<div class="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><i class="fa-solid fa-file-lines"></i></div>`}
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                  <div class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">${escapeHtml(item.type || (isVideo ? 'Vídeo' : 'Clipe'))}</div>
                  ${isScheduled ? `<span class="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tighter"><i class="fa-solid fa-calendar-check mr-1"></i> Agendado</span>` : ''}
                </div>
                <h4 class="text-xs font-bold text-slate-800 leading-tight line-clamp-2">${escapeHtml(item.title)}</h4>
              </div>
            </div>
            <button data-action="schedule-asset" data-id="${item.id}" data-source="${source}" class="w-full mt-3 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-slate-500 border border-slate-100 group-hover:border-blue-600 text-[10px] font-black py-2 rounded-xl transition-all uppercase tracking-widest">
              Agendar ${isScheduled ? 'Novamente' : ''}
            </button>
          </div>
        `;}).join('');

    return `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Agenda Operacional</h2>
          <p class="text-sm text-slate-500 mt-1">Gerencie os slots de publicação e o fluxo de distribuição.</p>
        </div>
        <div class="flex gap-2">
          <button data-action="export-calendar" class="bg-white text-slate-700 border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
            <i class="fa-solid fa-file-export text-blue-500"></i> Exportar
          </button>
        </div>
      </div>

      <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-4 mb-4 snap-x">
        ${calendarHTML}
      </div>

      <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-6 mb-2">
        ${filtersHTML}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2">
          <div class="flex items-center justify-between mb-4">
             <h3 class="font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-clock-rotate-left text-blue-500"></i> Slots para ${formatDate(selectedDate)}</h3>
             <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${slots.length} HORÁRIOS</span>
          </div>
          <div class="bg-slate-50/50 p-2 md:p-6 rounded-[2rem] border border-slate-200/60">
            ${slotsHTML}
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden">
            <i class="fa-solid fa-rocket absolute -right-4 -bottom-4 text-7xl opacity-10 -rotate-12"></i>
            <h3 class="font-bold text-lg mb-1 flex items-center gap-2">Ready to Post</h3>
            <p class="text-[10px] text-slate-400 uppercase tracking-widest mb-6">Conteúdo finalizado</p>
            <div class="overflow-y-auto max-h-[500px] pr-1 hide-scrollbar">
              ${readyHTML}
            </div>
          </div>
        </div>
      </div>`;
  },

  // ─── History / Analytics ────────────────────────
  getHistoryHTML() {
    return renderHistory(this.state, this._historyLimit || 50);
  },

  // ─── Admin Hub ──────────────────────────────────
  getAdminHTML() {
    return renderAdmin(this.isAdmin);
  },

  // ─── Gemini AI (Supabase Proxy Integration) ───────
  getGeminiHTML() {
    return renderGemini(this.state);
  },

  // ─── Setup / Settings ──────────────────────────────
  getSetupHTML() {
    const c = this.state.config;
    const isCustomFreq = !['1', '2', '3', '5'].includes(c.frequency);

    return `
      <div class="max-w-lg mx-auto fade-in mt-6 md:mt-12 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-slate-900 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl mb-5 shadow-lg"><i class="fa-solid fa-layer-group"></i></div>
          <h1 class="text-2xl font-bold text-slate-800">Clipper OS</h1>
          <p class="text-sm text-slate-500 mt-2">Configure seu espaço de trabalho.</p>
        </div>
        <div class="space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 md:col-span-1">
              <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Nome do Projeto</label>
              <input type="text" id="cfg-channel" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition" value="${escapeHtml(c.channel)}" placeholder="Ex: Minha Marca">
            </div>
            <div class="col-span-2 md:col-span-1">
              <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Nicho</label>
              <input type="text" id="cfg-niche" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition" value="${escapeHtml(c.niche)}" placeholder="Ex: Finanças">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Meta Diária (Posts/Dia)</label>
            <div class="flex gap-2">
              <select id="cfg-freq" class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" onchange="document.getElementById('custom-freq-wrapper').classList.toggle('hidden', this.value !== 'custom')">
                <option value="1" ${c.frequency === '1' ? 'selected' : ''}>1 Post por dia</option>
                <option value="2" ${c.frequency === '2' ? 'selected' : ''}>2 Posts por dia</option>
                <option value="3" ${c.frequency === '3' ? 'selected' : ''}>3 Posts por dia</option>
                <option value="5" ${c.frequency === '5' ? 'selected' : ''}>5 Posts por dia (Agressivo)</option>
                <option value="custom" ${isCustomFreq ? 'selected' : ''}>Personalizado</option>
              </select>
              <div id="custom-freq-wrapper" class="${isCustomFreq ? '' : 'hidden'} w-24">
                <input type="number" id="cfg-freq-custom" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none" value="${isCustomFreq ? c.frequency : '4'}" min="1" max="24">
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-cloud text-blue-500 mr-1"></i> Pastas na Nuvem (Opcional)</h3>
            <div class="grid grid-cols-2 gap-3">
              ${[
                { id: 'Raw', label: 'Bruto' },
                { id: 'Edited', label: 'Editado' },
                { id: 'Assets', label: 'Recursos' },
                { id: 'Management', label: 'Gestão' }
              ].map(p => `
              <div><label class="block text-[10px] font-bold text-slate-400 mb-1">${p.label}</label><input type="url" id="cfg-link-${p.id}" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" placeholder="Link..." value="${escapeHtml(c.cloudLinks[p.id] || '')}"></div>
              `).join('')}
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-bell text-amber-500 mr-1"></i> Notificações</h3>
            <div class="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div>
                <div class="text-sm font-semibold text-slate-700">Lembretes de postagem</div>
                <div class="text-xs text-slate-400 mt-0.5">Lembrete 15 minutos antes de cada post agendado</div>
              </div>
              <button id="btn-toggle-notifications" data-action="toggle-notifications"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.notificationsEnabled ? 'bg-blue-600' : 'bg-slate-300'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-calendar-days text-green-500 mr-1"></i> Calendário</h3>
            <div class="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
              <div>
                <div class="text-sm font-semibold text-slate-700">Auto-adicionar ao calendário</div>
                <div class="text-xs text-slate-400 mt-0.5">Adiciona automaticamente eventos ao agendar</div>
              </div>
              <button id="btn-toggle-calendar" data-action="toggle-calendar"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${c.calendarAutoAdd ? 'bg-blue-600' : 'bg-slate-300'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${c.calendarAutoAdd ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          </div>

          <div class="border-t border-slate-100 pt-5 mt-5">
            <h3 class="text-sm font-bold text-slate-800 mb-3"><i class="fa-solid fa-cloud-arrow-up text-purple-500 mr-1"></i> Sincronização em Nuvem</h3>
            ${SyncManager.enabled
              ? `<div class="space-y-3">
                   <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                     <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Seu ID de Sincronização</div>
                     <div class="flex items-center gap-2">
                       <code class="text-xs text-slate-700 flex-1 truncate bg-white border border-slate-200 rounded-lg px-3 py-2">${escapeHtml(SyncManager.userId || '')}</code>
                       <button data-action="copy-sync-id" class="text-xs bg-blue-600 text-white font-bold px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">Copiar ID</button>
                     </div>
                   </div>
                   <p class="text-xs text-slate-400 text-center">Seus dados são sincronizados automaticamente quando o Supabase está configurado</p>
                 </div>`
              : `<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                   <p class="text-sm text-amber-700 font-medium">Configure o Supabase no arquivo <code class="bg-amber-100 px-1 rounded">.env</code> para habilitar</p>
                   <p class="text-xs text-amber-50 mt-1">Veja <code class="bg-amber-100 px-1 rounded">docs/supabase-setup.md</code> para instruções</p>
                 </div>`
            }
          </div>

          <button id="btn-save-setup" data-action="save-setup" class="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-6 shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all">Salvar e Entrar</button>
          ${c.channel ? `<button id="btn-reset" data-action="reset-data" class="w-full text-slate-400 text-xs font-semibold py-2 mt-2 hover:text-red-500 transition-colors">Resetar todos os dados</button>` : ''}
        </div>
      </div>`;
  },

  // ─── Event Binding ──────────────────────────────────
  bindSetupEvents() {
    document.getElementById('btn-save-setup')?.addEventListener('click', () => this.saveSetup());
    document.getElementById('btn-reset')?.addEventListener('click', () => this.resetData());
  },

  bindViewEvents() {
    // Note: Most event bindings are now handled via global delegation in bindGlobalEvents()
    // to avoid listener accumulation. Only view-specific initialization that doesn't
    // support delegation should be added here.
  },

  // ─── Business Logic ─────────────────────────────────
  findAsset(assetId, source) {
    if (!assetId) return null;
    if (source === 'library') return this.state.library.find(a => a.id === assetId);
    if (source === 'videoAsset') return this.state.videoAssets.find(v => v.id === assetId);
    return this.state.clips.find(c => c.id === assetId);
  },

  setNetworkFilter(network) {
    this.state.activeNetworkFilter = network;
    saveState(this.state);
    this.render();
  },

  openAttachModal(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (!slot) return;

    const scheduledAssetIds = new Set(this.state.routine.map(r => r.assetId).filter(Boolean));
    const readyContent = [
      ...this.state.videoAssets.filter(v => v.status === 'pronto' || v.status === 'reutilizar'),
      ...this.state.library,
      ...this.state.clips.filter(c => c.status === 'approved' || c.status === 'aprovado'),
    ].filter(a => !scheduledAssetIds.has(a.id));

    const body = `
      <div class="space-y-4">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione o conteúdo para o slot das ${slot.time}</p>
        <div class="max-h-64 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
          ${readyContent.length === 0
            ? '<p class="text-center py-4 text-slate-400 text-sm">Nenhum conteúdo disponível.</p>'
            : readyContent.map(item => `
              <button data-action="confirm-attach" data-slot-id="${slotId}" data-asset-id="${item.id}" data-source="${item.type ? 'library' : (item.thumbnailUrl ? 'videoAsset' : 'clip')}"
                class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-3 group">
                ${item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" class="w-10 h-10 rounded-lg object-cover" />` : `<div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><i class="fa-solid fa-file-lines"></i></div>`}
                <div class="flex-1 min-w-0">
                  <div class="text-[8px] font-black text-slate-400 uppercase">${escapeHtml(item.type || (item.thumbnailUrl ? 'Vídeo' : 'Clipe'))}</div>
                  <div class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.title)}</div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-blue-500 text-[10px]"></i>
              </button>
            `).join('')}
        </div>
      </div>
    `;

    this.openModal('Anexar Conteúdo', body, '');

    // Bind the inner buttons manually for this modal
    document.getElementById('modal-body').querySelectorAll('[data-action="confirm-attach"]').forEach(btn => {
      btn.onclick = () => {
        const { slotId, assetId, source } = btn.dataset;
        this.attachToSlot(slotId, assetId, source);
        this.closeModal();
      };
    });
  },

  attachToSlot(slotId, assetId, source) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (slot) {
      slot.assetId = assetId;
      slot.source = source;
      saveState(this.state);
      this.render();
      this.showToast('Conteúdo anexado ao slot!', 'success');
    }
  },

  editConfig() {
    this.state.currentView = 'setup';
    this.renderNav();
    this.render();
  },

  saveSetup() {
    const channel = document.getElementById('cfg-channel')?.value.trim();
    if (!channel) return this.showToast('O nome do projeto é obrigatório.', 'error');

    this.state.config.channel = channel;
    this.state.config.niche = document.getElementById('cfg-niche')?.value || '';

    const freqSelect = document.getElementById('cfg-freq');
    if (freqSelect?.value === 'custom') {
      this.state.config.frequency = document.getElementById('cfg-freq-custom')?.value || '1';
    } else {
      this.state.config.frequency = freqSelect?.value || '2';
    }

    ['Raw', 'Edited', 'Assets', 'Management'].forEach(p => {
      this.state.config.cloudLinks[p] = document.getElementById(`cfg-link-${p}`)?.value || '';
    });

    this.ensureTodaySlots();
    this.changeView('dashboard');
    this.showToast('Configurações salvas!', 'success');
  },

  // ─── Video Manager Logic ─────────────────────────────
  openCloudModal() {
    const body = VideoManagerUI.renderCloudModal(this.state);
    this.openModal('Conexões em Nuvem', body, '');
  },

  async connectCloud(provider) {
    try {
      const connector = getConnector(provider);
      if (!connector) return;

      this.showToast(`Conectando ao ${provider}...`, 'info');
      const success = await connector.connect();

      if (success) {
        if (!this.state.cloudConnections) this.state.cloudConnections = [];
        const existing = this.state.cloudConnections.find(c => c.provider === provider);

        if (!existing) {
          this.state.cloudConnections.push({
            provider,
            accountLabel: 'Usuário Clipper',
            connectedAt: Date.now(),
            enabled: true,
            inputFolderId: null,
            postedFolderId: null
          });
        } else {
          existing.enabled = true;
          existing.connectedAt = Date.now();
        }

        saveState(this.state);
        this.render();
        this.openCloudModal(); // Refresh modal
        this.showToast(`${provider} conectado! Configure as pastas.`, 'success');
      }
    } catch (err) {
      this.showToast(`Erro ao conectar: ${err.message}`, 'error');
    }
  },

  disconnectCloud(provider) {
    const conn = this.state.cloudConnections.find(c => c.provider === provider);
    if (conn) {
      conn.enabled = false;
      // We keep folder IDs to make re-connection easier, but disable the flow
    }
    saveState(this.state);
    this.render();
    this.openCloudModal();
    this.showToast(`${provider} desconectado.`, 'info');
  },

  previewVideo(id) {
    const video = this.state.videoAssets.find(v => v.id === id);
    if (!video) return;

    const body = `
      <div class="aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center relative group">
        <img src="${video.thumbnailUrl}" class="w-full h-full object-contain opacity-50" />
        <div class="absolute inset-0 flex items-center justify-center">
           <i class="fa-solid fa-play text-6xl text-white/80"></i>
        </div>
        <div class="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-4 rounded-xl text-white">
          <div class="text-xs font-black uppercase tracking-widest text-blue-400 mb-1">Visualização</div>
          <div class="font-bold truncate">${escapeHtml(video.title)}</div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
           <div class="text-[9px] font-black text-slate-400 uppercase">Duração</div>
           <div class="font-bold text-slate-800">${video.duration}</div>
        </div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
           <div class="text-[9px] font-black text-slate-400 uppercase">Origem</div>
           <div class="font-bold text-slate-800">${video.sourceProvider}</div>
        </div>
      </div>
    `;

    this.openModal('Preview', body, `<button class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md" onclick="ClipperApp.closeModal()">Fechar</button>`);
  },

  editVideo(id) {
    const video = this.state.videoAssets.find(v => v.id === id);
    if (!video) return;

    const body = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Nome do Arquivo</label>
          <input type="text" id="edit-video-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value="${escapeHtml(video.title)}">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Status do Fluxo</label>
          <select id="edit-video-status" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none">
            ${['novo', 'pronto', 'agendado', 'publicado', 'reutilizar', 'arquivado'].map(s => `<option value="${s}" ${video.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
    `;

    this.openModal('Editar Vídeo', body, `<button id="btn-update-video" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md">Salvar Alterações</button>`);

    document.getElementById('btn-update-video')?.addEventListener('click', () => {
      video.title = document.getElementById('edit-video-title').value;
      video.status = document.getElementById('edit-video-status').value;
      saveState(this.state);
      this.closeModal();
      this.render();
      this.showToast('Vídeo atualizado!', 'success');
    });
  },

  async selectCloudFolder(provider, type) {
    const connector = getConnector(provider);
    if (!connector) return;

    this.showToast(`Buscando pastas no ${provider}...`, 'info');
    try {
      const folders = await connector.getFolders();

      const body = `
        <div class="space-y-4">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Selecione a pasta de ${type === 'input' ? 'Entrada (Brutos)' : 'Postados (Arquivamento)'}</p>
          <div class="max-h-64 overflow-y-auto space-y-2 pr-1 hide-scrollbar">
            ${folders.length === 0
              ? '<p class="text-center py-8 text-slate-400 text-sm italic">Nenhuma pasta encontrada.</p>'
              : folders.map(f => `
                <button data-action="confirm-folder" data-id="${f.id}" data-name="${f.name}"
                  class="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-between group bg-white shadow-sm">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                       <i class="fa-solid fa-folder"></i>
                    </div>
                    <span class="text-sm font-bold text-slate-700">${escapeHtml(f.name)}</span>
                  </div>
                  <i class="fa-solid fa-chevron-right text-slate-300 group-hover:text-blue-500 text-[10px]"></i>
                </button>
              `).join('')}
          </div>
        </div>
      `;

      this.openModal('Configurar Pasta', body, '');

      document.getElementById('modal-body').querySelectorAll('[data-action="confirm-folder"]').forEach(btn => {
        btn.onclick = async () => {
          const { id, name } = btn.dataset;
          const conn = this.state.cloudConnections.find(c => c.provider === provider);
          if (conn) {
            if (type === 'input') {
              conn.inputFolderId = id;
              conn.inputFolderName = name;

              // Trigger initial sync for the selected folder
              this.showToast(`Sincronizando ${name}...`, 'info');
              try {
                const files = await connector.listFiles(id);
                files.forEach(f => {
                  if (!this.state.videoAssets.some(v => v.id === f.id)) {
                    this.state.videoAssets.push({
                      id: f.id,
                      title: f.name || f.title,
                      thumbnailUrl: f.thumbnail || f.thumbnailUrl,
                      duration: f.duration || '00:00',
                      status: 'novo',
                      sourceProvider: provider,
                      sourceFolder: name,
                      createdAt: Date.now()
                    });
                  }
                });
              } catch (syncErr) {
                console.error('[Cloud] Initial sync failed:', syncErr);
                this.showToast(syncErr.message || 'Erro ao sincronizar arquivos da pasta.', 'error');
              }
            } else {
              conn.postedFolderId = id;
              conn.postedFolderName = name;
            }
            saveState(this.state);
            this.openCloudModal();
            this.showToast('Configuração salva!', 'success');
            this.render(); // Update Video Manager view if visible
          }
        };
      });
    } catch (err) {
      this.showToast('Erro ao listar pastas.', 'error');
    }
  },

  showVideoOptions(id) {
    const video = this.state.videoAssets.find(v => v.id === id);
    if (!video) return;

    const body = `
      <div class="grid grid-cols-1 gap-2">
        <button data-action="preview-video" data-id="${id}" class="w-full text-left p-4 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors">
          <i class="fa-solid fa-play text-blue-500 w-5"></i>
          <span class="text-sm font-bold text-slate-700">Visualizar</span>
        </button>
        <button data-action="edit-video" data-id="${id}" class="w-full text-left p-4 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors">
          <i class="fa-solid fa-pen text-amber-500 w-5"></i>
          <span class="text-sm font-bold text-slate-700">Editar Detalhes</span>
        </button>
        <button data-action="attach-to-agenda" data-id="${id}" class="w-full text-left p-4 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors">
          <i class="fa-solid fa-calendar-plus text-purple-500 w-5"></i>
          <span class="text-sm font-bold text-slate-700">Agendar Postagem</span>
        </button>
        <button data-action="mark-ready" data-id="${id}" class="w-full text-left p-4 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors">
          <i class="fa-solid fa-check-circle text-green-500 w-5"></i>
          <span class="text-sm font-bold text-slate-700">Marcar como Pronto</span>
        </button>
        <div class="border-t border-slate-100 my-1"></div>
        <button data-action="delete-video" data-id="${id}" class="w-full text-left p-4 rounded-xl hover:bg-red-50 flex items-center gap-3 transition-colors text-red-500">
          <i class="fa-solid fa-trash w-5"></i>
          <span class="text-sm font-bold">Excluir do App</span>
        </button>
      </div>
    `;

    this.openModal('Opções do Vídeo', body, '');

    // Bind modal actions
    const modalBody = document.getElementById('modal-body');
    modalBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this.closeModal();
      const action = btn.dataset.action;
      if (action === 'preview-video') this.previewVideo(id);
      if (action === 'edit-video') this.editVideo(id);
      if (action === 'attach-to-agenda') this.openScheduleModal(id, 'videoAsset');
      if (action === 'mark-ready') {
        video.status = 'pronto';
        saveState(this.state);
        this.render();
        this.showToast('Vídeo marcado como pronto!', 'success');
      }
      if (action === 'delete-video') {
        this.confirmAction('Remover vídeo da lista? (Não apagará na nuvem)', () => {
          this.state.videoAssets = this.state.videoAssets.filter(v => v.id !== id);
          saveState(this.state);
          this.render();
        }, 'Remover Vídeo');
      }
    }, { once: true });
  },

  addVideoManual() {
    const body = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Nome do Vídeo</label>
          <input type="text" id="new-video-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="Ex: Meu Vídeo Incrível">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Duração (mm:ss)</label>
            <input type="text" id="new-video-dur" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="00:30">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Status</label>
            <select id="new-video-status" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none">
              <option value="novo">Novo</option>
              <option value="pronto">Pronto</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">URL da Thumbnail (Opcional)</label>
          <input type="url" id="new-video-thumb" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" placeholder="https://...">
        </div>
      </div>
    `;

    this.openModal('Importar Vídeo', body, `<button id="btn-save-new-video" class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md">Importar</button>`);

    document.getElementById('btn-save-new-video')?.addEventListener('click', () => {
      const title = document.getElementById('new-video-title').value;
      if (!title) return this.showToast('Nome é obrigatório', 'error');

      this.state.videoAssets.push({
        id: generateId(),
        title,
        duration: document.getElementById('new-video-dur').value || '00:00',
        status: document.getElementById('new-video-status').value,
        thumbnailUrl: document.getElementById('new-video-thumb').value || 'https://via.placeholder.com/400x225?text=Video',
        sourceProvider: 'Manual',
        sourceFolder: 'Upload',
        createdAt: Date.now()
      });

      saveState(this.state);
      this.closeModal();
      this.render();
      this.showToast('Vídeo importado manualmente!', 'success');
    });
  },

  async resetData() {
    this.confirmAction('AVISO: Isso apagará TODOS os dados locais e fará logout. Deseja continuar?', async () => {
      try { await AuthManager.signOut(); SyncManager.reset(); } catch (e) { console.error('Logout error during reset:', e); }
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('clipper_os_data');
      sessionStorage.clear();
      location.reload();
    }, 'Limpeza Profunda');
  },

  ensureTodaySlots() {
    const freq = parseInt(this.state.config.frequency) || 2;
    let times = [];

    if (freq === 1) times = ['18:00'];
    else if (freq === 2) times = ['11:30', '18:30'];
    else if (freq === 3) times = ['11:00', '14:30', '19:00'];
    else {
      // Distribuição genérica entre 09:00 e 21:00
      for (let i = 0; i < freq; i++) {
        const totalMinutes = 540 + Math.floor((720 / (freq - 1 || 1)) * i);
        const h = Math.floor(totalMinutes / 60);
        const m = Math.floor((totalMinutes % 60) / 5) * 5; // Round to 5 mins
        times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }

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
        <div><label class="block text-xs font-bold text-slate-400 mb-1">Título</label>
        <input type="text" id="lib-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Formato</label>
          <select id="lib-type" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"><option>Vídeo Curto</option><option>Vídeo Longo</option><option>Carrossel / Imagem</option></select></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Equipe</label>
          <input type="text" id="lib-team" value="${escapeHtml(this.state.config.team)}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>
        </div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Tags (separadas por vírgula)</label>
        <input type="text" id="lib-tags" placeholder="ex: viral, vendas, tutorial" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Link na Nuvem (Opcional)</label>
        <input type="url" id="lib-link" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none"></div>
      </div>`;
    const footer = `<button id="btn-save-lib" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md">Salvar na Biblioteca</button>`;
    this.openModal('Novo Conteúdo', body, footer);
    document.getElementById('btn-save-lib')?.addEventListener('click', () => this.saveLibraryItem());
  },

  saveLibraryItem() {
    const title = document.getElementById('lib-title')?.value.trim();
    if (!title) return this.showToast('O título é obrigatório.', 'error');

    const tagsRaw = document.getElementById('lib-tags')?.value || '';
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(t => t);

    this.state.library.unshift({
      id: generateId(),
      title,
      type: document.getElementById('lib-type')?.value || 'Vídeo Curto',
      tags,
      link: document.getElementById('lib-link')?.value || '',
      team: document.getElementById('lib-team')?.value || '',
      createdAt: Date.now(),
    });
    saveState(this.state);
    this.closeModal();
    this.render();
    this.showToast('Conteúdo salvo na biblioteca!', 'success');
  },

  deleteLibraryItem(id) {
    this.confirmAction('Excluir este item permanentemente?', () => {
      this.state.library = this.state.library.filter(i => i.id !== id);
      this.state.routine.forEach(r => { if (r.assetId === id) { r.assetId = null; r.source = null; } });
      saveState(this.state);
      this.render();
    }, 'Excluir Item');
  },

  // ─── Clip Actions ───────────────────────────────────
  openAddClipModal() {
    const platOptions = PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('');
    const body = `
      <div class="space-y-4">
        <div><label class="block text-xs font-bold text-slate-400 mb-1">Título do Clipe</label>
        <input type="text" id="clip-title" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500"></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Início</label>
          <input type="text" id="clip-in" placeholder="00:00" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none text-center"></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Fim</label>
          <input type="text" id="clip-out" placeholder="00:00" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none text-center"></div>
        </div>

        <div><label class="block text-xs font-bold text-slate-400 mb-1">Gancho (Primeiros 3 segundos)</label>
        <textarea id="clip-hook" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none h-16 resize-none"></textarea></div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-xs font-bold text-slate-400 mb-1">Plataforma Alvo</label>
          <select id="clip-plat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none">${platOptions}</select></div>
          <div><label class="block text-xs font-bold text-slate-400 mb-1">CTA</label>
          <input type="text" id="clip-cta" placeholder="Siga para mais..." class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs outline-none"></div>
        </div>
      </div>`;
    const footer = `<button id="btn-save-clip" class="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-md">Salvar Clipe</button>`;
    this.openModal('Novo Clipe', body, footer);
    document.getElementById('btn-save-clip')?.addEventListener('click', () => this.saveClip());
  },

  saveClip() {
    const title = document.getElementById('clip-title')?.value.trim();
    if (!title) return this.showToast('O título é obrigatório.', 'error');

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
    this.showToast('Clipe adicionado à fila!', 'success');
  },

  cycleClipStatus(id) {
    const clip = this.state.clips.find(c => c.id === id);
    if (!clip) return;
    const cycle = { raw: 'editing', bruto: 'editing', editing: 'approved', editando: 'approved', approved: 'raw', aprovado: 'raw' };
    clip.status = cycle[clip.status] || 'raw';
    saveState(this.state);
    this.render();
    const labels = { raw: 'Bruto', editing: 'Editando', approved: 'Aprovado' };
    this.showToast(`Movido para: ${labels[clip.status] || clip.status}`, 'info');
  },

  deleteClip(id) {
    this.confirmAction('Excluir este clipe?', () => {
      this.state.clips = this.state.clips.filter(c => c.id !== id);
      this.state.routine.forEach(r => { if (r.assetId === id) { r.assetId = null; r.source = null; } });
      saveState(this.state);
      this.render();
    }, 'Excluir Clipe');
  },

  // ─── Pipeline / Scheduling Actions ──────────────────
  setFilterDate(dateStr) {
    this.state.filterDate = dateStr;
    this.render();
  },

  openScheduleModal(assetId, source) {
    const platOptions = PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('');
    const multiPlatOptions = PLATFORMS.map(p => `
      <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
        <input type="checkbox" name="sched-plats" value="${p}" class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
        <span class="text-xs font-bold text-slate-700">${p}</span>
      </label>
    `).join('');

    const defaultDate = this.state.filterDate || todayStr();
    const asset = this.findAsset(assetId, source);

    const body = `
      <div class="space-y-5">
        <input type="hidden" id="sched-asset" value="${assetId}">
        <input type="hidden" id="sched-source" value="${source}">

        <div class="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          ${asset?.thumbnailUrl ? `<img src="${asset.thumbnailUrl}" class="w-12 h-12 rounded-lg object-cover" />` : `<div class="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-blue-500 shadow-sm"><i class="fa-solid fa-file-video"></i></div>`}
          <div class="flex-1 min-w-0">
             <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Agendando Conteúdo</div>
             <div class="text-sm font-bold text-slate-800 truncate">${escapeHtml(asset?.title || asset?.name || 'Item')}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Data</label>
            <input type="date" id="sched-date" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" value="${defaultDate}">
          </div>
          <div>
            <label class="block text-[10px] font-black text-slate-400 mb-1.5 uppercase tracking-widest">Horário</label>
            <input type="time" id="sched-time" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none" value="12:00">
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Redes Sociais (Multi-post)</label>
          <div class="grid grid-cols-2 gap-2">
            ${multiPlatOptions}
          </div>
        </div>
      </div>`;

    const footer = `<button id="btn-save-schedule" class="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all uppercase tracking-widest">Confirmar Agendamento</button>`;
    this.openModal('Agendar Conteúdo', body, footer);
    document.getElementById('btn-save-schedule')?.addEventListener('click', () => this.saveSchedule());
  },

  saveSchedule() {
    const assetId = document.getElementById('sched-asset')?.value;
    const source = document.getElementById('sched-source')?.value;
    const date = document.getElementById('sched-date')?.value;
    const time = document.getElementById('sched-time')?.value;

    const selectedPlats = Array.from(document.querySelectorAll('input[name="sched-plats"]:checked')).map(cb => cb.value);

    if (!date || !time) return this.showToast('Data e hora são obrigatórios.', 'error');
    if (selectedPlats.length === 0) return this.showToast('Selecione pelo menos uma plataforma.', 'warning');
    if (date < todayStr()) return this.showToast('Não é possível agendar em uma data passada.', 'error');

    selectedPlats.forEach(platform => {
      const slot = {
        id: generateId(),
        date,
        time,
        platform,
        assetId,
        source,
        isPosted: false
      };
      this.state.routine.push(slot);

      // Schedule local notification if enabled
      if (this.state.config.notificationsEnabled && assetId) {
        const asset = this.findAsset(assetId, source);
        if (asset) NotificationManager.scheduleForSlot(slot, asset.title || asset.name);
      }

      // Auto-add to calendar if enabled
      if (this.state.config.calendarAutoAdd && assetId) {
        const asset = this.findAsset(assetId, source);
        if (asset) CalendarManager.addEvent(slot, asset.title || asset.name);
      }
    });

    this.state.filterDate = date;
    saveState(this.state);
    this.closeModal();
    this.changeView('pipeline');
    this.showToast(`${selectedPlats.length} agendamentos criados!`, 'success');
  },

  addEmptySlot(date) {
    this.state.routine.push({
      id: generateId(), date, time: '12:00', platform: 'Pendente', assetId: null, source: null, isPosted: false,
    });
    saveState(this.state);
    this.render();
  },

  deleteSlot(id) {
    const slot = this.state.routine.find(r => r.id === id);
    if (slot && slot.assetId) {
      const confirmMsg = 'Este slot tem conteúdo agendado. Deseja mesmo excluir o slot e desvincular o conteúdo?';
      this.confirmAction(confirmMsg, () => {
        NotificationManager.cancelForSlot(id);
        this.state.routine = this.state.routine.filter(r => r.id !== id);
        saveState(this.state);
        this.render();
      }, 'Excluir Slot');
      return;
    }

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
  async postScheduledAsset(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (!slot || !slot.assetId) return;

    const asset = this.findAsset(slot.assetId, slot.source);
    if (!asset) return;

    // 1. Get Social Link
    const socialUrl = asset.link || getSocialDeepLink(slot.platform);

    // 2. Prepare Modal Content
    const body = `
      <div class="space-y-6">
        <div class="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
           ${asset.thumbnailUrl ? `<img src="${asset.thumbnailUrl}" class="w-16 h-16 rounded-xl object-cover shadow-sm" />` : `<div class="w-16 h-16 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100"><i class="fa-solid fa-file-video text-2xl"></i></div>`}
           <div class="flex-1 min-w-0">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${escapeHtml(slot.platform)}</div>
              <div class="font-bold text-slate-800 truncate">${escapeHtml(asset.title)}</div>
           </div>
        </div>

        <div class="grid grid-cols-1 gap-3">
          <a href="${socialUrl}" target="_blank" class="flex items-center justify-center gap-3 bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-black transition-all active:scale-95">
            <i class="fa-solid fa-external-link-alt"></i> Abrir ${slot.platform}
          </a>

          <button id="btn-copy-caption" class="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group">
            <div class="flex items-center gap-3">
              <i class="fa-solid fa-quote-left text-blue-500"></i>
              <span class="text-sm font-bold text-slate-700">Copiar Legenda</span>
            </div>
            <i class="fa-solid fa-copy text-slate-300 group-hover:text-blue-500"></i>
          </button>
        </div>

        <div class="pt-4 border-t border-slate-100">
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mb-4">Após publicar na rede social:</p>
          <button id="btn-confirm-post" class="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-green-600/20 active:scale-95 transition-all uppercase tracking-widest">
            <i class="fa-solid fa-check-circle mr-2"></i> Confirmar como Postado
          </button>
        </div>
      </div>
    `;

    this.openModal('Postagem Rápida', body, '');

    // Bind local modal events
    document.getElementById('btn-copy-caption')?.addEventListener('click', () => {
      const caption = `${asset.title}\n\n#clipperos #contentcreator #${slot.platform.replace(' ', '').toLowerCase()}`;
      navigator.clipboard.writeText(caption);
      this.showToast('Legenda copiada!', 'success');
    });

    document.getElementById('btn-confirm-post')?.addEventListener('click', async () => {
      this.closeModal();
      this.showToast('Finalizando...', 'info');

      // Cloud Move Logic
      let moveStatus = 'Não aplicável';
      if (asset.sourceProvider && asset.id) {
        const conn = this.state.cloudConnections.find(c => c.provider === asset.sourceProvider);
        if (conn && conn.enabled && conn.postedFolderId) {
          const connector = getConnector(asset.sourceProvider);
          if (connector) {
            try {
              const success = await connector.moveFile(asset.id, conn.postedFolderId);
              moveStatus = success ? 'Sucesso' : 'Falha';
              if (success) {
                asset.status = 'publicado';
                asset.sourceFolder = conn.postedFolderName || 'Postados';
                this.showToast('Arquivo movido na nuvem!', 'success');
              } else {
                this.showToast('Falha ao mover arquivo na nuvem.', 'warning');
              }
            } catch (e) {
              moveStatus = `Erro: ${e.message}`;
            }
          }
        }
      }

      // Abort if cloud move failed — don't mark as posted
      if (moveStatus === 'Falha' || moveStatus.startsWith('Erro:')) {
        this.showToast('Publicação não confirmada: falha ao mover arquivo na nuvem.', 'error');
        return;
      }

      // Record in History (only on success or when cloud move was not applicable)
      this.state.history.unshift({
        id: generateId(),
        assetId: asset.id,
        title: asset.title,
        platform: slot.platform,
        category: asset.type || 'Vídeo',
        postedAt: new Date().toISOString(),
        performance: 'Pendente',
        link: '',
        cloudMove: moveStatus
      });

      slot.isPosted = true;
      NotificationManager.cancelForSlot(slotId);

      saveState(this.state);
      this.render();
      this.showToast('Publicado com sucesso! 🚀', 'success');
    });
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
      tags: ['reutilizável'],
      link: h.link || '',
      team: this.state.config.team,
      createdAt: Date.now(),
    });

    saveState(this.state);
    this.showToast('Conteúdo copiado para a biblioteca para reuso.', 'success');
  },

  // ─── Calendar / Notification Actions ────────────────
  openCalendarModal(slotId) {
    const slot = this.state.routine.find(r => r.id === slotId);
    if (!slot) return;
    const asset = this.findAsset(slot.assetId, slot.source);
    const title = asset ? (asset.title || asset.name) : 'Post Agendado';

    const body = `
      <div class="space-y-3 py-2">
        <p class="text-sm text-slate-600">Adicionar <strong>${escapeHtml(title)}</strong> em <strong>${escapeHtml(slot.date)}</strong> às <strong>${escapeHtml(slot.time)}</strong> ao seu calendário.</p>
        <button data-action="cal-native" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-solid fa-mobile-screen text-blue-500 text-base w-5 text-center"></i> Adicionar ao Calendário do Dispositivo
        </button>
        <button data-action="cal-google" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-brands fa-google text-red-500 text-base w-5 text-center"></i> Adicionar ao Google Calendar
        </button>
        <button data-action="cal-ics" data-id="${slotId}" class="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition-colors">
          <i class="fa-solid fa-file-arrow-down text-green-500 text-base w-5 text-center"></i> Baixar arquivo .ics
        </button>
      </div>`;

    this.openModal('Adicionar ao Calendário', body, '');

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
          this.showToast(r.method === 'native' ? 'Adicionado ao calendário!' : 'Google Calendar aberto', 'success');
        });
      } else if (action === 'cal-google') {
        CalendarManager.openGoogleCalendar(slot, title);
        this.closeModal();
      } else if (action === 'cal-ics') {
        CalendarManager.downloadICS([slot], [...this.state.library, ...this.state.clips, ...this.state.videoAssets]);
        this.closeModal();
        this.showToast('Arquivo de calendário baixado!', 'success');
      }
    }, { once: true });
  },

  exportCalendar() {
    const allAssets = [...this.state.library, ...this.state.clips, ...this.state.videoAssets];
    const upcomingSlots = this.state.routine.filter(r => !r.isPosted && r.assetId);
    if (upcomingSlots.length === 0) {
      this.showToast('Nenhum post agendado para exportar.', 'warning');
      return;
    }
    CalendarManager.downloadICS(upcomingSlots, allAssets);
    this.showToast('Calendário exportado!', 'success');
  },

  async toggleNotifications() {
    if (!this.state.config.notificationsEnabled) {
      const granted = await NotificationManager.requestPermission();
      this.state.config.notificationsEnabled = granted;
      if (!granted) {
        this.showToast('Permissão de notificação negada.', 'warning');
      } else {
        this.showToast('Lembretes ativados!', 'success');
      }
    } else {
      this.state.config.notificationsEnabled = false;
      await NotificationManager.cancelAll();
      this.showToast('Lembretes desativados.', 'info');
    }
    saveState(this.state);
    this.render();
  },

  toggleCalendarAutoAdd() {
    this.state.config.calendarAutoAdd = !this.state.config.calendarAutoAdd;
    saveState(this.state);
    this.showToast(this.state.config.calendarAutoAdd ? 'Auto-calendário ativado!' : 'Auto-calendário desativado.', 'info');
    this.render();
  },

  copySyncId() {
    const id = SyncManager.userId || '';
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      this.showToast('ID de sincronização copiado!', 'success');
    }).catch(() => {
      this.showToast('Não foi possível copiar o ID.', 'error');
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
    const topic = document.getElementById('gemini-topic')?.value.trim();
    if (!topic) return this.showToast('Por favor, insira um tópico.', 'warning');

    const resultsDiv = document.getElementById('gemini-results');
    const btn = document.getElementById('btn-generate-ai');
    const spinner = document.getElementById('ai-spinner');
    const btnText = document.getElementById('ai-btn-text');

    if (!SyncManager.client) {
      return this.showToast('Supabase não configurado. AI requer um proxy.', 'error');
    }

    // Prepare prompt
    const tool = this.state.geminiTool || 'hooks';
    const prompts = {
      hooks: `Gere 3 ganchos virais para um vídeo curto sobre: ${topic}. Foque em retenção e curiosidade.`,
      titles: `Gere 5 títulos chamativos para um vídeo sobre: ${topic}.`,
      captions: `Escreva uma legenda engajadora com hashtags para: ${topic}.`,
      scripts: `Escreva um roteiro de 60 segundos sobre: ${topic}. Estrutura: Gancho, Valor, CTA.`,
    };

    try {
      // Loading state
      btn.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Gerando...';
      resultsDiv.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-purple-500 animate-pulse">
        <i class="fa-solid fa-brain text-4xl mb-4"></i>
        <p class="text-sm font-bold uppercase tracking-widest">A IA está pensando...</p>
      </div>`;

      // Call Supabase Edge Function Proxy
      const { data, error } = await SyncManager.client.functions.invoke('gemini-proxy', {
        body: { prompt: prompts[tool] || prompts.hooks }
      });

      if (error) throw error;

      // Parse Gemini response
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta da IA.";

      resultsDiv.innerHTML = `
        <div class="bg-purple-50 border border-purple-100 rounded-2xl p-6 fade-in">
          <div class="flex justify-between items-center mb-4 pb-4 border-b border-purple-100">
            <h4 class="text-xs font-bold text-purple-700 uppercase tracking-widest"><i class="fa-solid fa-sparkles mr-1"></i> Resultados da IA</h4>
            <button id="btn-copy-ai" class="text-[10px] font-bold bg-white text-purple-600 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors uppercase">Copiar Resultados</button>
          </div>
          <div class="prose prose-sm text-slate-700 whitespace-pre-wrap leading-relaxed">${escapeHtml(aiText)}</div>
        </div>`;

      document.getElementById('btn-copy-ai')?.addEventListener('click', () => {
        navigator.clipboard.writeText(aiText);
        this.showToast('Resultados copiados!', 'success');
      });

    } catch (err) {
      console.error('[Gemini] Error:', err);

      let friendlyMessage = 'Erro ao gerar conteúdo. Tente novamente mais tarde.';
      const errorStr = (err.message || '').toLowerCase();

      if (errorStr.includes('429') || errorStr.includes('rate limit') || errorStr.includes('402') || errorStr.includes('billing') || errorStr.includes('quota')) {
        friendlyMessage = 'Limite de requisições atingido ou sem créditos na API de IA. Tente novamente mais tarde.';
      }

      this.showToast(friendlyMessage, 'error');
      resultsDiv.innerHTML = `
        <div class="text-center py-6 text-red-500 bg-red-50 rounded-2xl border border-red-200">
          <i class="fa-solid fa-circle-exclamation text-2xl mb-2"></i>
          <p class="text-sm font-bold">Falha na Geração</p>
          <p class="text-xs mt-1 px-4">${escapeHtml(friendlyMessage)}</p>
        </div>`;
    } finally {
      btn.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Gerar Conteúdo';
    }
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
    this.showToast('Exportação concluída!', 'success');
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
    clearTimeout(this._modalOpenTimer);
    this._modalOpenTimer = setTimeout(() => {
      content.classList.remove('translate-y-full');
      content.classList.add('translate-y-0');
    }, 10);
  },

  closeModal() {
    clearTimeout(this._modalOpenTimer);
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
const AUTH_REDIRECT_DELAY_MS = 3000;

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
  const successScreen = document.getElementById('signup-success-screen');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const tabsContainer = document.querySelector('.flex.bg-slate-100.rounded-xl.p-1.mb-6');

  setAuthError('');
  setAuthSuccess('');

  // Hide all forms first
  loginForm?.classList.add('hidden');
  signupForm?.classList.add('hidden');
  forgotForm?.classList.add('hidden');
  successScreen?.classList.add('hidden');

  // Ensure tabs are visible unless it's the success screen
  if (tab === 'success') {
    tabsContainer?.classList.add('hidden');
  } else {
    tabsContainer?.classList.remove('hidden');
  }

  // Reset tab styles
  const activeClasses = ['bg-white', 'text-slate-900', 'shadow-sm'];
  const inactiveClasses = ['text-slate-500'];
  tabLogin?.classList.remove(...activeClasses, ...inactiveClasses);
  tabSignup?.classList.remove(...activeClasses, ...inactiveClasses);

  if (tab === 'login') {
    loginForm?.classList.remove('hidden');
    tabLogin?.classList.add(...activeClasses);
    tabSignup?.classList.add(...inactiveClasses);
  } else if (tab === 'signup') {
    signupForm?.classList.remove('hidden');
    tabSignup?.classList.add(...activeClasses);
    tabLogin?.classList.add(...inactiveClasses);
  } else if (tab === 'success') {
    successScreen?.classList.remove('hidden');
  }
};

function setupAuthForms() {
  // Auth tab event listeners (replaces inline onclick attributes)
  document.getElementById('tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-signup')?.addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('goto-login-btn')?.addEventListener('click', () => switchAuthTab('login'));

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('login-btn');
    const spinner = document.getElementById('login-spinner');

    if (!email || !isValidEmail(email)) {
      setAuthError('Por favor, insira um e-mail válido.');
      return;
    }
    if (!password) {
      setAuthError('Por favor, insira sua senha.');
      return;
    }

    btn?.setAttribute('disabled', 'true');
    btn?.classList.add('opacity-50', 'cursor-not-allowed');
    spinner?.classList.remove('hidden');

    try {
      await AuthManager.signIn(email, password);
      hideAuthScreen();
      // Ensure state is fresh and UI is cleared before re-init
      App.state = await loadState();
      await App.initApp();
      App.showToast('Bem-vindo de volta!', 'success');
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setAuthError('E-mail ou senha incorretos.');
      } else {
        setAuthError(msg || 'Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      btn?.removeAttribute('disabled');
      btn?.classList.remove('opacity-50', 'cursor-not-allowed');
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

    if (!name) {
      setAuthError('Por favor, insira seu nome.');
      return;
    }
    if (!email || !isValidEmail(email)) {
      setAuthError('Por favor, insira um e-mail válido.');
      return;
    }
    if (!password) {
      setAuthError('Por favor, insira uma senha.');
      return;
    }
    if (password !== confirm) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    btn?.setAttribute('disabled', 'true');
    btn?.classList.add('opacity-50', 'cursor-not-allowed');
    spinner?.classList.remove('hidden');

    try {
      const data = await AuthManager.signUp(email, password, name);
      // If email confirmation is required, user will be null
      if (data.user && data.user.email_confirmed_at == null && data.session === null) {
        switchAuthTab('success');
        document.getElementById('signup-form')?.reset();
      } else {
        hideAuthScreen();
        await App.initApp();
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('User already registered')) {
        setAuthError('Este e-mail já está cadastrado.');
      } else if (msg.includes('Password should be at least 6 characters')) {
        setAuthError('A senha deve ter no mínimo 6 caracteres.');
      } else {
        setAuthError(msg || 'Erro ao criar conta. Tente novamente.');
      }
    } finally {
      btn?.removeAttribute('disabled');
      btn?.classList.remove('opacity-50', 'cursor-not-allowed');
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

    if (!email || !isValidEmail(email)) {
      setAuthError('Por favor, insira um e-mail válido.');
      return;
    }

    btn?.setAttribute('disabled', 'true');
    btn?.classList.add('opacity-50', 'cursor-not-allowed');
    spinner?.classList.remove('hidden');

    try {
      await AuthManager.resetPasswordForEmail(email);
      setAuthSuccess('Link de redefinição enviado! Verifique seu e-mail.');
    } catch (err) {
      setAuthError(err.message || 'Erro ao enviar e-mail. Tente novamente.');
    } finally {
      btn?.removeAttribute('disabled');
      btn?.classList.remove('opacity-50', 'cursor-not-allowed');
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
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window._destroyBackground = initBackground();
});
