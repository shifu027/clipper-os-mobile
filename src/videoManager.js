import { escapeHtml, formatDate } from './utils.js';
import { PROVIDERS, getConnector } from './cloudConnectors.js';

export const VideoManagerUI = {
  renderVideoManager(state) {
    const videos = state.videoAssets || [];
    const activeFilter = state.videoFilter || 'todos';

    const filteredVideos = videos.filter(v => {
      if (activeFilter === 'todos') return v.status !== 'arquivado';
      return v.status === activeFilter;
    });

    // Stats counts
    const allActive = videos.filter(v => v.status !== 'arquivado');
    const novos     = allActive.filter(v => v.status === 'novo').length;
    const prontos   = allActive.filter(v => v.status === 'pronto').length;
    const publicados = allActive.filter(v => v.status === 'publicado').length;
    const agendados  = allActive.filter(v => state.routine.some(r => r.assetId === v.id)).length;

    const filters = [
      { id: 'todos',     label: 'Todos',      icon: 'fa-layer-group',  count: allActive.length },
      { id: 'novo',      label: 'Novos',       icon: 'fa-circle-dot',   count: novos },
      { id: 'pronto',    label: 'Prontos',     icon: 'fa-circle-check', count: prontos },
      { id: 'publicado', label: 'Publicados',  icon: 'fa-paper-plane',  count: publicados },
    ];

    const videosHTML = filteredVideos.length === 0
      ? this.renderEmptyState(activeFilter)
      : filteredVideos.map(v => this.renderVideoCard(v, state)).join('');

    return `
      <div class="vm-container">

        <!-- ── HEADER ───────────────────────────────────── -->
        <div class="vm-header">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div>
              <div class="vm-eyebrow">
                <span class="vm-accent-dot"></span>
                <span class="vm-eyebrow-text">Central de Mídia</span>
              </div>
              <h2 class="vm-title">Seus Vídeos</h2>
              <p class="vm-subtitle">${allActive.length} arquivo${allActive.length !== 1 ? 's' : ''} no vault · Sincronizado</p>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;padding-top:4px">
              <button data-action="open-cloud-modal" class="vm-btn-secondary">
                <i class="fa-solid fa-cloud-arrow-up" style="font-size:10px"></i>
                <span>Nuvem</span>
              </button>
              <button data-action="add-video-manual" class="vm-btn-primary">
                <i class="fa-solid fa-plus" style="font-size:10px"></i>
                <span>Importar</span>
              </button>
            </div>
          </div>

          <!-- Stats row -->
          <div class="vm-stats">
            <div class="vm-stat">
              <span class="vm-stat-num">${novos}</span>
              <span class="vm-stat-label">Novos</span>
            </div>
            <div class="vm-stat-divider"></div>
            <div class="vm-stat">
              <span class="vm-stat-num">${prontos}</span>
              <span class="vm-stat-label">Prontos</span>
            </div>
            <div class="vm-stat-divider"></div>
            <div class="vm-stat">
              <span class="vm-stat-num">${publicados}</span>
              <span class="vm-stat-label">Publicados</span>
            </div>
            <div class="vm-stat-divider"></div>
            <div class="vm-stat">
              <span class="vm-stat-num">${agendados}</span>
              <span class="vm-stat-label">Agendados</span>
            </div>
          </div>

          <!-- Filter pills -->
          <div class="vm-filters">
            ${filters.map(f => `
              <button data-action="filter-videos" data-filter="${f.id}"
                class="vm-filter-pill${activeFilter === f.id ? ' vm-filter-active' : ''}">
                <i class="fa-solid ${f.icon}" style="font-size:9px"></i>
                ${f.label}
                <span class="vm-filter-count">${f.count}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- ── GRID ──────────────────────────────────────── -->
        <div class="vm-grid">
          ${videosHTML}
        </div>

      </div>
    `;
  },

  renderVideoCard(video, state) {
    const isScheduled = state.routine.some(r => r.assetId === video.id);

    const statusConfig = {
      novo:      { dot: 'vm-dot-blue',   label: 'Novo' },
      pronto:    { dot: 'vm-dot-green',  label: 'Pronto' },
      agendado:  { dot: 'vm-dot-purple', label: 'Agendado' },
      publicado: { dot: 'vm-dot-slate',  label: 'Publicado' },
      reutilizar:{ dot: 'vm-dot-amber',  label: 'Reutilizar' },
      arquivado: { dot: 'vm-dot-slate',  label: 'Arquivado' },
    };

    const sc = statusConfig[video.status] || statusConfig.novo;

    // Dark fallback SVG thumbnail
    const thumbFallback = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225' viewBox='0 0 400 225'%3E%3Crect width='400' height='225' fill='%231a1a26'/%3E%3Crect x='170' y='90' width='60' height='45' rx='4' fill='none' stroke='%23312e81' stroke-width='2'/%3E%3Cpolygon points='188,103 188,124 208,113' fill='%234338ca'/%3E%3Ccircle cx='340' cy='185' r='40' fill='%230f0f1a'/%3E%3Ccircle cx='60' cy='40' r='25' fill='%230f0f1a'/%3E%3C/svg%3E`;

    const thumbSrc = video.thumbnailUrl || thumbFallback;

    return `
      <div class="vm-card" data-id="${video.id}" data-source="video">

        <!-- Thumbnail -->
        <div class="vm-thumb-wrap">
          <img src="${thumbSrc}" class="vm-thumb" alt="${escapeHtml(video.title)}"
               onerror="this.src='${thumbFallback}'" />

          <div class="vm-thumb-overlay"></div>

          <!-- Play on hover -->
          <button data-action="preview-video" data-id="${video.id}" class="vm-play-btn">
            <div class="vm-play-ring">
              <i class="fa-solid fa-play"></i>
            </div>
          </button>

          <!-- Status dot badge -->
          <div class="vm-status-badge">
            <span class="vm-status-dot ${sc.dot}"></span>
            <span class="vm-status-text">${sc.label}</span>
          </div>

          <!-- Duration -->
          <div class="vm-duration">${video.duration || '—:——'}</div>

          <!-- Scheduled badge (top-right, only if scheduled) -->
          ${isScheduled ? `
            <div class="vm-scheduled-badge">
              <i class="fa-solid fa-calendar-check" style="font-size:8px"></i>
              Agendado
            </div>
          ` : ''}
        </div>

        <!-- Metadata -->
        <div class="vm-card-meta">
          <h4 class="vm-card-title">${escapeHtml(video.title)}</h4>

          <div class="vm-card-row">
            <span class="vm-source-badge">
              <i class="fa-solid ${this.getProviderIcon(video.sourceProvider)}" style="font-size:8px"></i>
              ${video.sourceFolder || 'Local'}
            </span>
            <button data-action="video-options" data-id="${video.id}" class="vm-options-btn">
              <i class="fa-solid fa-ellipsis-vertical" style="font-size:10px"></i>
            </button>
          </div>

          <div class="vm-card-actions">
            <button data-action="attach-to-agenda" data-id="${video.id}" class="vm-action-primary">
              <i class="fa-solid fa-calendar-plus" style="font-size:9px"></i>
              Agendar
            </button>
            <button data-action="edit-video" data-id="${video.id}" class="vm-action-icon"
              title="Editar vídeo">
              <i class="fa-solid fa-pen-to-square" style="font-size:9px"></i>
            </button>
          </div>
        </div>

      </div>
    `;
  },

  renderEmptyState(activeFilter) {
    const isTodos = activeFilter === 'todos';
    return `
      <div class="vm-empty">
        <div class="vm-empty-icon">
          <i class="fa-solid fa-clapperboard"></i>
        </div>
        <p class="vm-empty-title">${isTodos ? 'Vault vazio' : 'Nenhum resultado'}</p>
        <p class="vm-empty-text">
          ${isTodos
            ? 'Conecte uma nuvem ou importe vídeos para começar a gerenciar seu conteúdo.'
            : 'Nenhum vídeo encontrado com este filtro. Tente outro ou importe novos arquivos.'}
        </p>
        ${isTodos ? `
          <button data-action="open-cloud-modal" class="vm-empty-cta">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size:11px"></i>
            Conectar Nuvem
          </button>
        ` : ''}
      </div>
    `;
  },

  renderCloudModal(state) {
    const connections = state.cloudConnections || [];

    const providersHTML = Object.values(PROVIDERS).map(p => {
      const conn = connections.find(c => c.provider === p);
      const isEnabled = conn && conn.enabled;

      return `
        <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-3 group hover:border-blue-300 transition-colors">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl">
                <i class="fa-solid ${this.getProviderIcon(p)} ${this.getProviderColor(p)}"></i>
              </div>
              <div>
                <div class="text-sm font-bold text-slate-800">${p}</div>
                <div class="text-[10px] text-slate-400 font-medium">${isEnabled ? 'Conectado' : 'Desconectado'}</div>
              </div>
            </div>
            ${isEnabled
              ? `<button data-action="disconnect-cloud" data-provider="${p}" class="text-[10px] font-bold text-red-500 hover:underline uppercase">Desconectar</button>`
              : `<button data-action="connect-cloud" data-provider="${p}" class="bg-blue-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md transition-all">CONECTAR</button>`
            }
          </div>

          ${isEnabled ? `
            <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 ml-1">Pasta de Entrada</label>
                <div class="relative">
                  <button data-action="select-folder" data-provider="${p}" data-type="input" class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-left flex justify-between items-center overflow-hidden">
                    <span class="truncate">${conn.inputFolderName || 'Selecionar...'}</span>
                    <i class="fa-solid fa-chevron-down text-[8px] text-slate-300"></i>
                  </button>
                </div>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 ml-1">Pasta de Postados</label>
                <div class="relative">
                  <button data-action="select-folder" data-provider="${p}" data-type="posted" class="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-left flex justify-between items-center overflow-hidden">
                    <span class="truncate">${conn.postedFolderName || 'Selecionar...'}</span>
                    <i class="fa-solid fa-chevron-down text-[8px] text-slate-300"></i>
                  </button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-6">
        <div>
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Escolha um Provedor</h4>
          ${providersHTML}
        </div>
        <p class="text-xs text-slate-400 mt-2 text-center">O Clipper OS sincronizará novos vídeos e os moverá após a postagem.</p>
      </div>
    `;
  },

  getProviderIcon(p) {
    if (p === PROVIDERS.GOOGLE_DRIVE) return 'fa-brands fa-google-drive';
    if (p === PROVIDERS.ONEDRIVE) return 'fa-cloud';
    if (p === PROVIDERS.ICLOUD) return 'fa-brands fa-apple';
    return 'fa-cloud';
  },

  getProviderColor(p) {
    if (p === PROVIDERS.GOOGLE_DRIVE) return 'text-green-500';
    if (p === PROVIDERS.ONEDRIVE) return 'text-blue-500';
    if (p === PROVIDERS.ICLOUD) return 'text-slate-900';
    return 'text-blue-500';
  }
};
