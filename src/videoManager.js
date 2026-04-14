import { escapeHtml, formatDate } from './utils.js';
import { PROVIDERS, getConnector } from './cloudConnectors.js';

export const VideoManagerUI = {
  renderVideoManager(state) {
    const videos = state.videoAssets || [];
    const filter = state.activeNetworkFilter || 'Todas';

    const videosHTML = videos.length === 0
      ? `<div class="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
           <i class="fa-solid fa-clapperboard text-6xl mb-4 text-slate-200"></i>
           <p class="text-lg font-medium text-slate-500">Sua Central de Vídeos está vazia.</p>
           <p class="text-sm mt-1">Conecte uma nuvem ou importe vídeos manualmente.</p>
           <button data-action="open-cloud-modal" class="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:scale-105 transition-transform active:scale-95">Conectar Nuvem</button>
         </div>`
      : videos.map(v => this.renderVideoCard(v, state)).join('');

    return `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Central de Vídeos</h2>
          <p class="text-slate-500 text-sm mt-1">Gerencie seus arquivos brutos e editados em um só lugar.</p>
        </div>
        <div class="flex gap-2 w-full md:w-auto">
          <button data-action="open-cloud-modal" class="flex-1 md:flex-none bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-50 transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-cloud text-blue-500"></i> Conexões
          </button>
          <button data-action="add-video-manual" class="flex-1 md:flex-none bg-slate-900 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md hover:bg-slate-800 transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-plus"></i> Importar
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        ${videosHTML}
      </div>
    `;
  },

  renderVideoCard(video, state) {
    const statusColors = {
      novo: 'bg-blue-100 text-blue-700 border-blue-200',
      pronto: 'bg-green-100 text-green-700 border-green-200',
      agendado: 'bg-purple-100 text-purple-700 border-purple-200',
      publicado: 'bg-slate-100 text-slate-700 border-slate-200',
      reutilizar: 'bg-orange-100 text-orange-700 border-orange-200',
      arquivado: 'bg-slate-50 text-slate-400 border-slate-100'
    };

    const isScheduled = state.routine.some(r => r.assetId === video.id);

    return `
      <div class="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col h-full">
        <div class="relative aspect-video bg-slate-100 overflow-hidden">
          <img src="${video.thumbnailUrl || 'https://via.placeholder.com/400x225?text=No+Preview'}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
          <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg">
            ${video.duration || '00:00'}
          </div>
          ${isScheduled ? `
            <div class="absolute top-2 left-2 bg-purple-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shadow-lg">
              <i class="fa-solid fa-calendar-check mr-1"></i> Agendado
            </div>
          ` : ''}
          <button data-action="preview-video" data-id="${video.id}" class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white text-xl border border-white/30 shadow-2xl scale-75 group-hover:scale-100 transition-transform">
              <i class="fa-solid fa-play ml-1"></i>
            </div>
          </button>
        </div>

        <div class="p-5 flex-1 flex flex-col">
          <div class="flex justify-between items-start mb-2 gap-2">
            <h4 class="font-bold text-slate-800 text-sm leading-tight line-clamp-2 flex-1">${escapeHtml(video.title)}</h4>
            <div class="dropdown relative">
              <button data-action="video-options" data-id="${video.id}" class="text-slate-300 hover:text-slate-600 w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center transition-colors">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
             <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusColors[video.status] || statusColors.novo}">
               ${video.status}
             </span>
             <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-50 text-slate-500 border border-slate-100">
               <i class="fa-solid ${video.sourceProvider === PROVIDERS.GOOGLE_DRIVE ? 'fa-brands fa-google-drive text-green-500' : 'fa-cloud'} mr-1"></i> ${video.sourceFolder}
             </span>
          </div>

          <div class="mt-auto pt-4 border-t border-slate-50 flex gap-2">
            <button data-action="attach-to-agenda" data-id="${video.id}" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2.5 rounded-xl shadow-md active:scale-95 transition-all">
              <i class="fa-solid fa-calendar-plus mr-1"></i> Agendar
            </button>
            <button data-action="edit-video" data-id="${video.id}" class="w-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderCloudModal(state) {
    const connections = state.cloudConnections || [];

    const providersHTML = Object.values(PROVIDERS).map(p => {
      const conn = connections.find(c => c.provider === p);
      return `
        <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-between mb-3 group hover:border-blue-300 transition-colors">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl">
              <i class="fa-solid ${this.getProviderIcon(p)} ${this.getProviderColor(p)}"></i>
            </div>
            <div>
              <div class="text-sm font-bold text-slate-800">${p}</div>
              <div class="text-[10px] text-slate-400 font-medium">${conn ? `Conectado como ${conn.accountLabel}` : 'Desconectado'}</div>
            </div>
          </div>
          ${conn
            ? `<button data-action="disconnect-cloud" data-provider="${p}" class="text-[10px] font-bold text-red-500 hover:underline uppercase">Desconectar</button>`
            : `<button data-action="connect-cloud" data-provider="${p}" class="bg-blue-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md transition-all">CONECTAR</button>`
          }
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-6">
        <div>
          <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Escolha um Provedor</h4>
          ${providersHTML}
        </div>

        ${connections.length > 0 ? `
          <div class="pt-6 border-t border-slate-200">
            <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Pasta de Sincronização</label>
            <select id="cloud-folder-select" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecione uma pasta...</option>
              <option value="f1">Bruto (Drafts)</option>
              <option value="f2" selected>Finalizados (Ready)</option>
              <option value="f3">Recursos (Assets)</option>
            </select>
            <p class="text-[10px] text-slate-400 mt-2 text-center">O Clipper OS sincronizará novos vídeos desta pasta automaticamente.</p>
          </div>
        ` : ''}
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
