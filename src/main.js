import './styles.css';

/**
 * Clipper OS - Main Application
 * Content management app for social media workflow.
 */
const ClipperApp = {
  data: {
    library: [],
    clips: [],
    pipeline: [],
    routine: [],
  },

  init() {
    this.loadData();
    this.render();
  },

  loadData() {
    const saved = localStorage.getItem('clipper_os_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.data = {
          library: parsed.library || [],
          clips: parsed.clips || [],
          pipeline: parsed.pipeline || [],
          routine: parsed.routine || [],
        };
      } catch (e) {
        console.error('Error loading data', e);
      }
    }
  },

  saveData() {
    localStorage.setItem('clipper_os_data', JSON.stringify(this.data));
  },

  navigate(view) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');

    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.remove('active');
      n.classList.add('text-gray-500');
    });
    const navBtn = document.querySelector('[data-view="' + view + '"]');
    if (navBtn) {
      navBtn.classList.add('active');
      navBtn.classList.remove('text-gray-500');
    }

    const titles = {
      dashboard: 'Dashboard',
      library: 'Biblioteca',
      clips: 'Clips',
      routine: 'Rotina Diária',
      gemini: 'Gemini AI',
    };
    const subtitle = document.getElementById('header-subtitle');
    if (subtitle) subtitle.textContent = titles[view] || '';

    this.render();
  },

  render() {
    this.renderDashboard();
    this.renderLibrary();
    this.renderClips();
    this.renderRoutine();
  },

  renderDashboard() {
    const setTextById = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    setTextById('stat-library', this.data.library.length);
    setTextById('stat-clips', this.data.clips.length);
    setTextById('stat-pipeline', this.data.pipeline.length);
    setTextById('stat-routine', this.data.routine.length);

    const activity = document.getElementById('recent-activity');
    if (!activity) return;

    const allItems = [
      ...this.data.library.map((i) => ({ ...i, _type: 'library' })),
      ...this.data.clips.map((i) => ({ ...i, _type: 'clip' })),
    ]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);

    if (allItems.length === 0) {
      activity.textContent = 'Nenhuma atividade recente.';
    } else {
      activity.innerHTML = allItems
        .map(
          (i) =>
            '<div class="py-1 border-b last:border-0"><span class="font-medium">' +
            this.escapeHtml(i.title || 'Sem título') +
            '</span> <span class="text-xs text-gray-400">(' +
            i._type +
            ')</span></div>'
        )
        .join('');
    }
  },

  renderLibrary() {
    const list = document.getElementById('library-list');
    const empty = document.getElementById('library-empty');
    if (!list || !empty) return;

    if (this.data.library.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.innerHTML = this.data.library
      .map(
        (item, idx) =>
          '<div class="bg-white rounded-xl shadow p-4">' +
          '<div class="flex justify-between items-start">' +
          '<div class="flex-1">' +
          '<h4 class="font-semibold text-sm">' +
          this.escapeHtml(item.title) +
          '</h4>' +
          (item.platform
            ? '<span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">' +
              this.escapeHtml(item.platform) +
              '</span>'
            : '') +
          (item.link
            ? '<a href="' +
              this.escapeHtml(item.link) +
              '" target="_blank" rel="noopener noreferrer" class="block text-xs text-blue-500 mt-1 truncate">' +
              this.escapeHtml(item.link) +
              '</a>'
            : '') +
          (item.notes
            ? '<p class="text-xs text-gray-500 mt-1">' + this.escapeHtml(item.notes) + '</p>'
            : '') +
          '</div>' +
          '<div class="flex gap-1">' +
          '<button data-action="send-library" data-index="' +
          idx +
          '" class="text-blue-500 text-xs px-2 py-1"><i class="fas fa-paper-plane"></i></button>' +
          '<button data-action="delete-library" data-index="' +
          idx +
          '" class="text-red-500 text-xs px-2 py-1"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>' +
          '</div>'
      )
      .join('');
  },

  renderClips() {
    const list = document.getElementById('clips-list');
    const empty = document.getElementById('clips-empty');
    if (!list || !empty) return;

    if (this.data.clips.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.innerHTML = this.data.clips
      .map(
        (item, idx) =>
          '<div class="bg-white rounded-xl shadow p-4">' +
          '<div class="flex justify-between items-start">' +
          '<div class="flex-1">' +
          '<h4 class="font-semibold text-sm">' +
          this.escapeHtml(item.title) +
          '</h4>' +
          (item.platform
            ? '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">' +
              this.escapeHtml(item.platform) +
              '</span>'
            : '') +
          (item.content
            ? '<p class="text-xs text-gray-600 mt-1">' +
              this.escapeHtml(item.content).substring(0, 100) +
              '</p>'
            : '') +
          '</div>' +
          '<div class="flex gap-1">' +
          '<button data-action="send-clips" data-index="' +
          idx +
          '" class="text-blue-500 text-xs px-2 py-1"><i class="fas fa-paper-plane"></i></button>' +
          '<button data-action="delete-clips" data-index="' +
          idx +
          '" class="text-red-500 text-xs px-2 py-1"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>' +
          '</div>'
      )
      .join('');
  },

  renderRoutine() {
    const container = document.getElementById('routine-slots');
    const empty = document.getElementById('routine-empty');
    if (!container || !empty) return;

    if (this.data.routine.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    container.innerHTML = this.data.routine
      .map(
        (slot, idx) =>
          '<div class="bg-white rounded-xl shadow p-4">' +
          '<div class="flex justify-between items-center">' +
          '<div>' +
          '<p class="font-semibold text-sm">Slot ' +
          (idx + 1) +
          '</p>' +
          '<p class="text-xs text-gray-500">' +
          this.escapeHtml(slot.time || 'Sem horário') +
          ' — ' +
          this.escapeHtml(slot.platform || 'Sem plataforma') +
          '</p>' +
          (slot.content
            ? '<p class="text-xs text-gray-600 mt-1">' + this.escapeHtml(slot.content) + '</p>'
            : '') +
          '</div>' +
          '<button data-action="remove-routine" data-index="' +
          idx +
          '" class="text-red-500 text-xs px-2 py-1"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>'
      )
      .join('');
  },

  showAddLibraryModal() {
    const modal = document.getElementById('modal-add-library');
    if (modal) modal.classList.remove('hidden');
  },

  showAddClipModal() {
    const modal = document.getElementById('modal-add-clip');
    if (modal) modal.classList.remove('hidden');
  },

  closeModals() {
    document.querySelectorAll('[id^="modal-"]').forEach((m) => m.classList.add('hidden'));
  },

  saveLibraryItem() {
    const title = document.getElementById('lib-title')?.value.trim();
    const link = document.getElementById('lib-link')?.value.trim();
    const platform = document.getElementById('lib-platform')?.value || '';
    const notes = document.getElementById('lib-notes')?.value.trim();

    if (!title) {
      alert('Título é obrigatório.');
      return;
    }
    if (link && !this.isValidUrl(link)) {
      alert('Link inválido. Insira uma URL válida (ex: https://exemplo.com).');
      return;
    }

    this.data.library.push({ title, link, platform, notes, createdAt: Date.now() });
    this.saveData();
    this.closeModals();

    // Clear form
    const fields = ['lib-title', 'lib-link', 'lib-platform', 'lib-notes'];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.render();
  },

  saveClip() {
    const title = document.getElementById('clip-title')?.value.trim();
    const content = document.getElementById('clip-content')?.value.trim();
    const platform = document.getElementById('clip-platform')?.value || '';

    if (!title) {
      alert('Título é obrigatório.');
      return;
    }

    this.data.clips.push({ title, content, platform, createdAt: Date.now() });
    this.saveData();
    this.closeModals();

    // Clear form
    const fields = ['clip-title', 'clip-content', 'clip-platform'];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.render();
  },

  sendToPipeline(index, source) {
    const item = this.data[source]?.[index];
    if (!item) return;
    this.data.pipeline.push({ ...item, sentAt: Date.now(), source });
    this.saveData();
    this.render();
    alert('Enviado para o pipeline!');
  },

  deleteItem(index, source) {
    if (!confirm('Remover este item?')) return;
    this.data[source].splice(index, 1);
    this.saveData();
    this.render();
  },

  addRoutineSlot() {
    // Show the routine modal instead of using prompts
    const modal = document.getElementById('modal-add-routine');
    if (modal) modal.classList.remove('hidden');
  },

  saveRoutineSlot() {
    const time = document.getElementById('routine-time')?.value.trim();
    const platform = document.getElementById('routine-platform')?.value || '';
    const content = document.getElementById('routine-content')?.value.trim();

    if (!time) {
      alert('Horário é obrigatório.');
      return;
    }

    this.data.routine.push({
      time,
      platform,
      content: content || '',
    });
    this.saveData();
    this.closeModals();

    // Clear form
    const fields = ['routine-time', 'routine-platform', 'routine-content'];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    this.render();
  },

  removeRoutineSlot(index) {
    if (!confirm('Remover este slot?')) return;
    this.data.routine.splice(index, 1);
    this.saveData();
    this.render();
  },

  generateWithGemini() {
    const promptEl = document.getElementById('gemini-prompt');
    const promptText = promptEl?.value.trim();
    if (!promptText) {
      alert('Digite um prompt.');
      return;
    }

    const resultEl = document.getElementById('gemini-result');
    const outputEl = document.getElementById('gemini-output');
    if (!resultEl || !outputEl) return;

    // Check if Gemini is enabled via environment variable
    const geminiEnabled = typeof __GEMINI_ENABLED__ !== 'undefined' ? __GEMINI_ENABLED__ : false;
    const apiKey = typeof __GEMINI_API_KEY__ !== 'undefined' ? __GEMINI_API_KEY__ : '';

    if (!geminiEnabled || !apiKey) {
      resultEl.classList.remove('hidden');
      outputEl.textContent =
        'Gemini AI não está disponível neste build. Configure as variáveis de ambiente para habilitar esta funcionalidade.';
      return;
    }

    outputEl.textContent = 'Gerando...';
    resultEl.classList.remove('hidden');

    fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' +
        apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      }
    )
      .then((r) => r.json())
      .then((data) => {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
        outputEl.textContent = text;
      })
      .catch((err) => {
        outputEl.textContent = 'Erro: ' + err.message;
      });
  },

  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  },
};

// Make ClipperApp available globally for inline event handlers
window.ClipperApp = ClipperApp;

// Event delegation for dynamic buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const index = parseInt(btn.getAttribute('data-index'), 10);

  switch (action) {
    case 'send-library':
      ClipperApp.sendToPipeline(index, 'library');
      break;
    case 'send-clips':
      ClipperApp.sendToPipeline(index, 'clips');
      break;
    case 'delete-library':
      ClipperApp.deleteItem(index, 'library');
      break;
    case 'delete-clips':
      ClipperApp.deleteItem(index, 'clips');
      break;
    case 'remove-routine':
      ClipperApp.removeRoutineSlot(index);
      break;
  }
});

document.addEventListener('DOMContentLoaded', () => ClipperApp.init());
