/**
 * Aba "Cortes" — conversa com o Clipper Engine (engine/) rodando no computador.
 */
import { escapeHtml } from './utils.js';
import { saveState, generateId } from './state.js';

const ENGINE = 'http://127.0.0.1:8000';
const JOB_KEY = 'clipperEngine_job';
const STAGES = [
  ['ingestao', 'Lendo vídeo'], ['transcricao', 'Transcrevendo'], ['selecao', 'Escolhendo momentos'],
  ['cortes', 'Renderizando cortes'], ['compilado', 'Montando compilado'], ['pacote', 'Empacotando lotes'],
];

let app;
let online = null; // null = verificando
let job = null;
let uploading = false;

const api = (path, options) => fetch(ENGINE + path, options).then(async (r) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `Erro ${r.status}`);
  return r.json();
});

const refresh = () => { if (app.state.currentView === 'cortes') app.render(); };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

async function connect() {
  try {
    await api('/health');
    online = true;
    const last = localStorage.getItem(JOB_KEY);
    if (last && !job) watch(last);
  } catch {
    online = false;
  }
  refresh();
}

function watch(id) {
  localStorage.setItem(JOB_KEY, id);
  const events = new EventSource(`${ENGINE}/jobs/${id}/events`);
  events.onmessage = async (e) => {
    job = JSON.parse(e.data);
    if (!job || job.status === 'pronto' || job.status === 'erro') {
      events.close();
      if (job?.status === 'pronto') job = await api(`/jobs/${id}`);
    }
    refresh();
  };
  events.onerror = () => { events.close(); online = false; refresh(); };
}

async function start(source) {
  try {
    if (source instanceof File) {
      uploading = true;
      refresh();
      source = (await api(`/upload?name=${encodeURIComponent(source.name)}`, { method: 'PUT', body: source })).source;
    }
    job = await api('/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, per_day: parseInt(app.state.config.frequency) || 3 }),
    });
    watch(job.id);
  } catch (err) {
    app.showToast(err.message, 'error');
  }
  uploading = false;
  refresh();
}

function sendToVault() {
  const existing = new Set(app.state.videoAssets.map((v) => v.title));
  const fresh = job.manifesto.clips.filter((c) => !existing.has(c.title));
  app.state.videoAssets.push(...fresh.map((c) => ({
    id: generateId(),
    title: c.title,
    duration: mmss(c.end - c.start),
    status: 'pronto',
    sourceProvider: 'Clipper Engine',
    sourceFolder: `Lote ${c.lote} · nota ${c.score}`,
    createdAt: Date.now(),
  })));
  saveState(app.state);
  app.showToast(`${fresh.length} corte(s) enviados para a Central de Vídeos.`, 'success');
  app.changeView('videos');
}

function body() {
  if (online === null) return `<p class="ct-note">Procurando o motor…</p>`;
  if (!online) {
    return `<div class="ct-panel">
      <h3>Motor desligado</h3>
      <p class="ct-note">Os cortes são feitos no seu computador. Abra <code>scripts\\start-clipper.bat</code>
      (ou rode <code>uv run clipper servir</code> na pasta <code>engine</code>) e tente de novo.</p>
      <button data-cortes="retry" class="vm-btn-primary" style="margin-top:14px"><i class="fa-solid fa-rotate"></i> Tentar de novo</button>
    </div>`;
  }
  if (uploading) return `<div class="ct-panel"><h3>Enviando vídeo para o motor…</h3><div class="ct-bar ct-bar-pulse"><span style="width:100%"></span></div></div>`;
  if (job && ['fila', 'processando'].includes(job.status)) return progress();
  return form() + (job?.status === 'erro' ? `<p class="ct-error" role="alert">${escapeHtml(job.error)}</p>` : '') + (job?.manifesto ? results() : '');
}

function form() {
  return `<div class="ct-panel">
    <h3>Novo vídeo</h3>
    <p class="ct-note">Vídeo longo (até ~1h). Saem cortes verticais em lotes e um compilado horizontal de 8–12 min.</p>
    <div class="ct-row">
      <button data-cortes="pick" class="vm-btn-primary"><i class="fa-solid fa-upload"></i> Escolher arquivo</button>
      <input type="file" accept="video/*" id="ct-file" hidden>
      <label class="sr-only" for="ct-url">Link do vídeo</label>
      <input id="ct-url" class="ct-input" type="url" placeholder="ou cole um link do YouTube">
      <button data-cortes="url" class="vm-btn-secondary">Cortar link</button>
    </div>
  </div>`;
}

function progress() {
  const at = STAGES.findIndex(([id]) => id === job.stage);
  const steps = STAGES.map(([, label], i) => {
    const state = i < at ? 'done' : i === at ? 'now' : '';
    const pct = i < at ? 100 : i === at ? Math.round(job.pct * 100) : 0;
    return `<li class="ct-step ${state}">
      <span class="ct-step-label">${i + 1}. ${label}</span><span class="ct-step-pct">${state ? pct + '%' : ''}</span>
      <div class="ct-bar"><span style="width:${pct}%"></span></div>
    </li>`;
  }).join('');
  return `<div class="ct-panel" aria-live="polite">
    <h3>${job.status === 'fila' ? 'Na fila…' : `Etapa ${Math.max(at, 0) + 1} de ${STAGES.length}`}</h3>
    <p class="ct-note">Pode deixar aberto: se fechar, o motor continua e retoma de onde parou.</p>
    <ol class="ct-steps">${steps}</ol>
  </div>`;
}

function results() {
  const { clips, compilado } = job.manifesto;
  const base = `${ENGINE}/saida/${encodeURIComponent(job.folder)}/`;
  const cards = clips.map((c) => `<article class="vm-card ct-card">
    <video src="${base}${c.file}#t=0.5" controls preload="metadata" playsinline></video>
    <div class="ct-card-body">
      <div class="ct-card-top"><span class="ct-score" title="Nota de viralidade">${c.score}</span><span class="ct-lote">Lote ${c.lote} · ${mmss(c.end - c.start)}</span></div>
      <p class="ct-card-title">${escapeHtml(c.title)}</p>
      <p class="ct-note">${c.platforms.join(' · ')}</p>
    </div>
  </article>`).join('');
  const comp = compilado ? `<div class="ct-panel">
    <h3>Compilado — ${mmss(compilado.segundos)} ${compilado.na_regra_8_12_min ? '' : '<span class="ct-warn">(fora de 8–12 min: vídeo curto demais)</span>'}</h3>
    <video class="ct-wide" src="${base}${compilado.file}#t=0.5" controls preload="metadata"></video>
  </div>` : '';
  return `<div class="ct-results-head">
      <div><h3>${clips.length} cortes prontos</h3><p class="ct-note">Pasta: <code>${escapeHtml(job.folder)}</code> (shorts / reels / tiktok / compilados + lotes.csv)</p></div>
      <button data-cortes="send" class="vm-btn-primary"><i class="fa-solid fa-paper-plane"></i> Enviar para a Central</button>
    </div>
    <div class="vm-grid ct-grid">${cards}</div>${comp}`;
}

export const CortesUI = {
  init(appRef) {
    app = appRef;
    document.addEventListener('click', (e) => {
      const action = e.target.closest('[data-cortes]')?.dataset.cortes;
      if (action === 'pick') document.getElementById('ct-file').click();
      if (action === 'retry') { online = null; refresh(); connect(); }
      if (action === 'send') sendToVault();
      if (action === 'url') {
        const url = document.getElementById('ct-url').value.trim();
        if (/^https?:\/\//.test(url)) start(url); else app.showToast('Cole um link válido.', 'error');
      }
    });
    document.addEventListener('change', (e) => {
      if (e.target.id === 'ct-file' && e.target.files[0]) start(e.target.files[0]);
    });
  },

  render() {
    if (online === null) connect();
    return `<div class="vm-container">
      <div class="vm-header">
        <div class="vm-eyebrow"><span class="vm-accent-dot"></span><span class="vm-eyebrow-text">Clipper Engine</span></div>
        <h2 class="vm-title">Cortes</h2>
        <p class="vm-subtitle">Vídeo longo → Shorts, Reels, TikTok e compilado</p>
      </div>
      <div class="ct-body">${body()}</div>
    </div>`;
  },
};
