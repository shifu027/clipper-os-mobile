import { escapeHtml, formatDate } from '../utils.js';

const PAGE_SIZE = 50;

export function renderHistoryItem(h) {
  return `
    <div class="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3 hover:shadow-md transition">
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"><i class="fa-solid fa-bullhorn"></i> ${escapeHtml(h.platform || 'Geral')}</span>
          <span class="text-[10px] font-medium text-slate-400"><i class="fa-regular fa-calendar-check mr-1"></i> ${formatDate(h.postedAt)}</span>
          <span class="text-[10px] font-medium text-slate-400"><i class="fa-solid fa-folder-tree mr-1"></i> ${escapeHtml(h.category)}</span>
          ${h.cloudMove ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded ${h.cloudMove === 'Sucesso' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'} border ml-1"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Nuvem: ${h.cloudMove}</span>` : ''}
        </div>
        <h4 class="font-bold text-slate-800 text-sm md:text-base leading-tight">${escapeHtml(h.title)}</h4>
      </div>
      <div class="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0 border-t md:border-0 border-slate-100 pt-3 md:pt-0">
        <div class="flex flex-col flex-1 md:flex-none">
          <label class="text-[9px] font-bold text-slate-400 uppercase mb-1 ml-1">Performance</label>
          <select data-action="set-perf" data-id="${h.id}" class="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-32 ${h.performance === 'Viral' ? 'text-orange-600 bg-orange-50 border-orange-200' : 'text-slate-600'}">
            <option value="Pending"  ${h.performance === 'Pending'  || h.performance === 'Pendente' ? 'selected' : ''}>⏳ Avaliar</option>
            <option value="Low"      ${h.performance === 'Low'      || h.performance === 'Baixo'    ? 'selected' : ''}>Baixo</option>
            <option value="Medium"   ${h.performance === 'Medium'   || h.performance === 'Médio'    ? 'selected' : ''}>Médio</option>
            <option value="High"     ${h.performance === 'High'     || h.performance === 'Alto'     ? 'selected' : ''}>Alto</option>
            <option value="Viral"    ${h.performance === 'Viral'                                    ? 'selected' : ''}>🔥 Viral</option>
          </select>
        </div>
        <button data-action="reuse-content" data-id="${h.id}" class="bg-blue-50 text-blue-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-blue-100 transition whitespace-nowrap self-end border border-blue-100 shadow-sm active:scale-95"><i class="fa-solid fa-recycle mr-1"></i> Reutilizar</button>
      </div>
    </div>`;
}

export function renderHistory(state, limit = PAGE_SIZE) {
  const hist = [...state.history].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  const stats = {
    total: hist.length,
    viral: hist.filter(h => h.performance === 'Viral').length,
    high:  hist.filter(h => h.performance === 'High' || h.performance === 'Alto').length,
  };

  const platformCounts = {};
  hist.forEach(h => {
    const p = (h.platform || 'Other').split(' ')[0];
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });
  const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0];

  const visible  = hist.slice(0, limit);
  const hasMore  = hist.length > limit;
  const remaining = hist.length - limit;

  const listHTML = visible.length === 0
    ? `<div class="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
         <i class="fa-solid fa-chart-line text-5xl mb-4 text-slate-300"></i>
         <p class="text-sm">Nenhum conteúdo publicado ainda.</p>
         <p class="text-xs mt-1 text-slate-400">Publique conteúdo do seu pipeline para construir seu histórico.</p>
       </div>`
    : visible.map(h => renderHistoryItem(h)).join('');

  return `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Histórico de Publicação</h2>
        <p class="text-sm text-slate-500 mt-1">Acompanhe o desempenho e recicle seu melhor conteúdo.</p>
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
        <div class="text-[10px] font-bold text-green-500 uppercase tracking-wider mt-1">Alta Perf</div>
      </div>
      <div class="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg text-center">
        <div class="text-3xl font-bold text-white">${topPlatform ? topPlatform[1] : 0}</div>
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">${topPlatform ? topPlatform[0] : 'Top Plataforma'}</div>
      </div>
    </div>

    <div id="history-items-list" class="space-y-1">
      ${listHTML}
    </div>

    ${hasMore ? `
    <div class="text-center mt-6">
      <button data-action="load-more-history" data-offset="${limit}"
        class="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
        <i class="fa-solid fa-chevron-down mr-2"></i> Carregar mais (${remaining} restantes)
      </button>
    </div>` : ''}`;
}
