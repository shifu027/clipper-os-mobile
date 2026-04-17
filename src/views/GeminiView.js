export function renderGemini(state) {
  const tools = [
    { id: 'hooks',    label: '🎣 Hooks' },
    { id: 'titles',   label: '📝 Títulos' },
    { id: 'captions', label: '🏷️ Legendas' },
    { id: 'scripts',  label: '🎬 Roteiros' },
  ];

  return `
    <div class="bg-gradient-to-br from-purple-800 via-purple-600 to-pink-500 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-8">
      <i class="fa-solid fa-wand-magic-sparkles absolute -right-4 -bottom-4 text-[150px] opacity-10 transform -rotate-12"></i>
      <h2 class="text-3xl md:text-4xl font-bold mb-3 relative z-10 tracking-tight">AI Studio</h2>
      <p class="text-purple-100 text-sm md:text-base max-w-lg relative z-10 leading-relaxed">Gere roteiros de alta retenção, títulos magnéticos e descubra ângulos virais instantaneamente.</p>
    </div>

    <div class="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
      <div class="space-y-6">
        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Tópico / Assunto</label>
          <input type="text" id="gemini-topic" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none placeholder:text-slate-400 transition-all" placeholder="Ex: 3 formas de investir com pouco dinheiro...">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">O que gerar?</label>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${tools.map(t => `<button data-action="set-tool" data-tool="${t.id}" class="tool-btn py-3.5 rounded-xl text-sm font-bold border transition-all ${state.geminiTool === t.id ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${t.label}</button>`).join('')}
          </div>
        </div>

        <button id="btn-generate-ai" data-action="generate-ai" class="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.98] transition-all mt-2 flex items-center justify-center gap-2">
          <i class="fa-solid fa-bolt text-yellow-400"></i>
          <span id="ai-btn-text">Gerar Conteúdo</span>
          <i id="ai-spinner" class="fa-solid fa-spinner fa-spin hidden"></i>
        </button>
      </div>

      <div id="gemini-results" class="mt-8 pt-8 border-t border-slate-100">
        <div class="text-center py-12 px-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <i class="fa-solid fa-robot text-4xl mb-4 text-slate-300"></i>
          <p>Os resultados aparecerão aqui após a geração.</p>
        </div>
      </div>
    </div>`;
}
