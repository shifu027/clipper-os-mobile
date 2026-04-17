import { escapeHtml, TAGS } from '../utils.js';

export function renderLibrary(state) {
  const lib = state.library;
  const libHTML = lib.length === 0
    ? `<div class="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
         <i class="fa-solid fa-folder-open text-5xl mb-4 text-slate-300"></i>
         <p class="text-sm">Sua biblioteca de conteúdo está vazia.</p>
         <p class="text-xs mt-1 text-slate-400">Adicione ativos finalizados prontos para agendamento.</p>
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
            <button data-action="schedule-asset" data-id="${item.id}" data-source="library" class="flex-1 bg-slate-900 text-white text-xs py-2.5 rounded-xl font-bold hover:bg-slate-800 shadow-md active:scale-95 transition-transform"><i class="fa-solid fa-calendar-plus mr-1"></i> Agendar</button>
            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="bg-slate-100 text-slate-600 text-xs px-4 py-2.5 rounded-xl hover:bg-slate-200 font-medium transition-colors inline-flex items-center"><i class="fa-solid fa-cloud-arrow-down"></i></a>` : ''}
          </div>
        </div>
      `).join('');

  return `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Biblioteca de Conteúdo</h2>
        <p class="text-sm text-slate-500 mt-1">Conteúdo finalizado pronto para agendamento e publicação.</p>
      </div>
      <button data-action="add-library" class="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2"><i class="fa-solid fa-plus"></i> Novo Conteúdo</button>
    </div>

    <div class="flex gap-2 overflow-x-auto hide-scrollbar pb-4 mb-2">
      <button class="tag-pill bg-slate-800 text-white whitespace-nowrap">Todos</button>
      ${TAGS.map(t => `<button class="tag-pill tag-${t} whitespace-nowrap bg-white hover:bg-slate-50">#${t}</button>`).join('')}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      ${libHTML}
    </div>`;
}
