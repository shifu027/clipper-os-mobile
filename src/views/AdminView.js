export function renderAdmin(isAdmin) {
  if (!isAdmin) return '<div class="p-8 text-center text-red-500 font-bold">Acesso Negado</div>';

  return `
    <div class="flex justify-between items-center mb-8">
      <div>
        <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Painel Administrativo</h2>
        <p class="text-slate-500 text-sm mt-1">Monitore usuários, clientes e a saúde do ecossistema.</p>
      </div>
      <div class="bg-blue-600 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20">MODO BOSS</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
        <i class="fa-solid fa-users text-blue-500/10 text-6xl absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform"></i>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total de Usuários</p>
        <h3 class="text-3xl font-bold text-slate-800">1.284</h3>
        <p class="text-[10px] text-green-600 font-bold mt-2"><i class="fa-solid fa-caret-up"></i> +12% este mês</p>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
        <i class="fa-solid fa-clapperboard text-purple-500/10 text-6xl absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform"></i>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Clipes Processados</p>
        <h3 class="text-3xl font-bold text-slate-800">45.2k</h3>
        <p class="text-[10px] text-blue-600 font-bold mt-2"><i class="fa-solid fa-bolt"></i> Eficiência: 98.2%</p>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
        <i class="fa-solid fa-briefcase text-orange-500/10 text-6xl absolute -right-4 -bottom-4 group-hover:scale-110 transition-transform"></i>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Clientes Ativos</p>
        <h3 class="text-3xl font-bold text-slate-800">86</h3>
        <p class="text-[10px] text-slate-400 font-bold mt-2">Plano Enterprise: 12</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-bold text-slate-800">Registros Recentes</h3>
          <button class="text-blue-600 text-xs font-bold hover:underline">Ver Todos</button>
        </div>
        <div class="divide-y divide-slate-50">
          ${[
            { name: 'João Silva',    email: 'joao@exemplo.com',  date: '2 min atrás',   status: 'Ativo' },
            { name: 'Alice Smith',   email: 'alice@agency.co',   date: '15 min atrás',  status: 'Pendente' },
            { name: 'Roberto Lee',   email: 'robert@tech.io',    date: '1 hora atrás',  status: 'Ativo' },
            { name: 'Sara Wilson',   email: 'sara@clipper.com',  date: '3 horas atrás', status: 'Ativo' },
          ].map(user => `
            <div class="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">${user.name[0]}</div>
              <div class="flex-1">
                <div class="text-sm font-bold text-slate-800">${user.name}</div>
                <div class="text-[10px] text-slate-400">${user.email}</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-bold text-slate-500 mb-1">${user.date}</div>
                <span class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${user.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${user.status}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-slate-100">
          <h3 class="font-bold text-slate-800">Visão Geral de Conteúdo (Global)</h3>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            ${[
              { label: 'Engajamento TikTok',   pct: 84, color: 'bg-slate-900' },
              { label: 'Crescimento Instagram', pct: 62, color: 'bg-blue-500'  },
              { label: 'Retenção YouTube',      pct: 45, color: 'bg-red-500'   },
            ].map(bar => `
              <div>
                <div class="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-2">
                  <span>${bar.label}</span><span>${bar.pct}%</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div class="${bar.color} h-full rounded-full" style="width:${bar.pct}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-8 pt-6 border-t border-slate-100 text-center">
            <button class="bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-slate-900/20 transition-all flex items-center justify-center gap-2 mx-auto">
              <i class="fa-solid fa-file-export"></i> Baixar Relatório de Auditoria Global
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
