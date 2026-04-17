import { escapeHtml } from '../utils.js';

export function renderClipper(state) {
  const clips = state.clips;
  const statusStyles = {
    raw:      { color: 'slate',  icon: 'fa-box',        label: 'Bruto' },
    bruto:    { color: 'slate',  icon: 'fa-box',        label: 'Bruto' },
    editing:  { color: 'amber',  icon: 'fa-scissors',   label: 'Editando' },
    editando: { color: 'amber',  icon: 'fa-scissors',   label: 'Editando' },
    approved: { color: 'green',  icon: 'fa-check-double', label: 'Aprovado' },
    aprovado: { color: 'green',  icon: 'fa-check-double', label: 'Aprovado' },
  };

  const clipsHTML = clips.length === 0
    ? `<div class="py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl w-full bg-white">
         <i class="fa-solid fa-film text-5xl mb-4 text-slate-300"></i>
         <p class="text-sm">Nenhum clipe na fila.</p>
         <p class="text-xs mt-1 text-slate-400">Comece recortando segmentos do seu conteúdo longo.</p>
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
            <p class="text-xs text-slate-600"><strong class="text-slate-800">Gancho (0-3s):</strong> ${escapeHtml(c.hook)}</p>
            ${c.cta ? `<p class="text-xs text-slate-600"><strong class="text-slate-800">CTA:</strong> ${escapeHtml(c.cta)}</p>` : ''}
          </div>` : ''}

          <div class="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i class="fa-solid fa-bullhorn mr-1"></i> ${escapeHtml(c.platform || 'Multi-plataforma')}</span>
            ${c.status === 'approved' || c.status === 'aprovado'
              ? `<button data-action="schedule-asset" data-id="${c.id}" data-source="clip" class="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-transform"><i class="fa-solid fa-calendar-plus mr-1"></i> Agendar</button>`
              : `<button data-action="cycle-clip" data-id="${c.id}" class="text-xs font-semibold text-${st.color}-600 underline">Avançar Estágio →</button>`}
          </div>
        </div>`;
      }).join('');

  return `
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Gerenciador de Clipes</h2>
        <p class="text-sm text-slate-500 mt-1">Acompanhe clipes desde o material bruto até o aprovado e pronto para publicar.</p>
      </div>
      <button data-action="add-clip" class="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 transition flex items-center justify-center gap-2"><i class="fa-solid fa-scissors"></i> Novo Clipe</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-2">${clipsHTML}</div>
      <div>
        <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 sticky top-4">
          <h3 class="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2"><i class="fa-solid fa-list-check text-blue-500 mr-2"></i> Guia de Workflow</h3>
          <ol class="text-sm text-slate-600 space-y-3 pl-2">
            <li class="flex gap-2"><span class="font-bold text-slate-400">1.</span> Registre tempos de clipes de podcasts, lives ou vídeos longos.</li>
            <li class="flex gap-2"><span class="font-bold text-slate-400">2.</span> Escreva um gancho forte para os primeiros 3 segundos.</li>
            <li class="flex gap-2"><span class="font-bold text-slate-400">3.</span> Mova para <span class="bg-amber-100 text-amber-700 px-1 rounded text-[10px] font-bold">Editando</span> quando estiver em progresso.</li>
            <li class="flex gap-2"><span class="font-bold text-slate-400">4.</span> Marque como <span class="bg-green-100 text-green-700 px-1 rounded text-[10px] font-bold">Aprovado</span> e agende para publicação.</li>
          </ol>
        </div>
      </div>
    </div>`;
}
