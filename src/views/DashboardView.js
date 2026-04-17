import { escapeHtml, todayStr } from '../utils.js';

export function renderDashboard(state, findAsset) {
  const today = todayStr();
  const todaysRoutine = state.routine.filter(r => r.date === today).sort((a, b) => a.time.localeCompare(b.time));

  const postsDone  = state.history.filter(h => h.postedAt.startsWith(today)).length;
  const metaGoal   = parseInt(state.config.frequency) || 2;
  const totalGoal  = Math.max(todaysRoutine.length, metaGoal);
  const progress   = totalGoal === 0 ? 0 : Math.min(100, Math.round((postsDone / totalGoal) * 100));

  const pendingClips = state.clips.filter(c => !['approved', 'aprovado'].includes(c.status)).length;
  const libraryCount = state.library.length;

  const routineHTML = todaysRoutine.length === 0
    ? `<div class="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
         <i class="fa-solid fa-calendar-check text-3xl mb-3 text-slate-300"></i>
         <p class="text-sm">Nenhum post agendado para hoje.</p>
         <button data-action="goto-pipeline" class="mt-3 text-sm font-bold text-blue-600 hover:underline">Abrir Pipeline →</button>
       </div>`
    : todaysRoutine.map(slot => {
        const asset = findAsset(slot.assetId, slot.source);
        return `
        <div class="flex items-center gap-4 p-4 bg-white rounded-2xl border ${slot.isPosted ? 'border-green-200 bg-green-50/30' : 'border-slate-200'} mb-3 shadow-sm transition-all group">
          <div class="font-bold ${slot.isPosted ? 'text-green-600' : 'text-slate-800'} w-14 text-center">
            <div class="text-lg">${escapeHtml(slot.time)}</div>
            <div class="text-[9px] uppercase tracking-wide text-slate-400">${escapeHtml(slot.platform.split(' ')[0])}</div>
          </div>
          <div class="flex-1 border-l border-slate-100 pl-4">
            ${asset
              ? `<div class="text-sm font-bold ${slot.isPosted ? 'text-slate-500 line-through' : 'text-slate-800'}">${escapeHtml(asset.title)}</div>
                 <div class="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                   <span class="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500"><i class="fa-solid ${slot.source === 'library' ? 'fa-folder' : 'fa-scissors'}"></i> ${slot.source === 'library' ? 'Biblioteca' : 'Clipes'}</span>
                   ${asset.link ? `<i class="fa-solid fa-link text-blue-400"></i>` : ''}
                 </div>`
              : `<div class="text-xs text-slate-400 italic">Slot vazio — agende conteúdo da sua biblioteca.</div>`}
          </div>
          ${asset && !slot.isPosted ? `<button data-action="post-slot" data-id="${slot.id}" class="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 shadow-md transition-all active:scale-90 hover:scale-105 group-hover:rotate-12" title="Postar agora"><i class="fa-solid fa-paper-plane"></i></button>` : ''}
          ${slot.isPosted ? `<div class="w-10 h-10 text-green-500 flex items-center justify-center text-xl animate-bounce"><i class="fa-solid fa-circle-check"></i></div>` : ''}
        </div>`;
      }).join('');

  return `
    <div class="flex justify-between items-end mb-6">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-slate-800">Bem-vindo${state.config.channel ? ', ' + escapeHtml(state.config.channel) : ''}!</h2>
        <p class="text-slate-500 text-sm mt-1">Sua visão geral de operações de conteúdo hoje.</p>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-bullseye text-blue-500 mr-1"></i> Progresso Hoje</p>
        <div class="flex items-end gap-2"><h3 class="text-2xl font-bold text-slate-800">${progress}%</h3></div>
        <div class="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden"><div class="bg-blue-500 h-full rounded-full transition-all" style="width:${progress}%"></div></div>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-check-double text-green-500 mr-1"></i> Publicado</p>
        <h3 class="text-2xl font-bold text-slate-800">${postsDone} <span class="text-xs font-normal text-slate-400">/ ${totalGoal}</span></h3>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-amber-300" data-action="goto-clipper">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-scissors text-amber-500 mr-1"></i> Clipes Pendentes</p>
        <h3 class="text-2xl font-bold text-slate-800">${pendingClips}</h3>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:border-purple-300" data-action="goto-library">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"><i class="fa-solid fa-photo-film text-purple-500 mr-1"></i> Itens na Biblioteca</p>
        <h3 class="text-2xl font-bold text-slate-800">${libraryCount}</h3>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg text-slate-800">Agenda de Hoje</h3>
          <button data-action="goto-pipeline" class="text-sm text-blue-600 font-bold hover:underline">Ver Pipeline →</button>
        </div>
        <div class="bg-slate-50 p-2 md:p-4 rounded-3xl border border-slate-200">
          ${routineHTML}
        </div>
      </div>

      <div>
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-lg">
          <h3 class="font-bold mb-2 flex items-center gap-2"><i class="fa-solid fa-chart-line"></i> Estatísticas Rápidas</h3>
          <p class="text-xs text-slate-300 mb-4">Desempenho total de publicações.</p>
          <div class="space-y-3">
            <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
              <i class="fa-solid fa-check-circle text-green-400"></i>
              <div><div class="text-sm font-bold">${state.history.length}</div><div class="text-[10px] text-slate-400">Total Publicado</div></div>
            </div>
            <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
              <i class="fa-solid fa-fire text-orange-400"></i>
              <div><div class="text-sm font-bold">${state.history.filter(h => h.performance === 'Viral').length}</div><div class="text-[10px] text-slate-400">Posts Virais</div></div>
            </div>
            <div class="bg-white/10 border border-white/10 p-3 rounded-xl flex items-center gap-3">
              <i class="fa-solid fa-box-open text-blue-400"></i>
              <div><div class="text-sm font-bold">${state.library.length + state.clips.filter(c => c.status === 'approved').length}</div><div class="text-[10px] text-slate-400">Pronto para Publicar</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
