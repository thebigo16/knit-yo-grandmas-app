/* Stitch Counter: knitting & crochet project + row counter.
   Plain JS, no build step. All data lives in localStorage on the device. */
(() => {
'use strict';

/* ---------- storage ---------- */
const KEY = 'stitch-counter.v1';
const HISTORY_CAP = 300;
const defaultState = () => ({ projects: [], settings: { theme: 'auto', sound: false, haptic: true } });
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || defaultState(); } catch { state = defaultState(); }
state.settings = Object.assign(defaultState().settings, state.settings || {});
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save. Storage may be full.'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v, 10) || lo));
const proj = id => state.projects.find(p => p.id === id);
const unit = p => (p && p.craft === 'crochet' ? 'round' : 'row');
const Unit = p => unit(p)[0].toUpperCase() + unit(p).slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const COLORS = [
  ['#F4EBDD','Cream'],['#E8D3B0','Oatmeal'],['#C9A27A','Camel'],['#8B6A4E','Walnut'],['#5C4433','Chocolate'],['#2F2A27','Charcoal'],['#9A9590','Heather grey'],['#D9D4CF','Silver'],
  ['#F3C6C3','Blush'],['#E58F8A','Coral'],['#C4453E','Poppy'],['#8E2B2E','Burgundy'],['#F2C9A1','Peach'],['#E99A5B','Apricot'],['#C4530F','Burnt orange'],['#9A4A2A','Rust'],
  ['#F5E3A0','Butter'],['#E8C25A','Honey'],['#D6A645','Mustard'],['#A9822E','Ochre'],['#D7E5C8','Mint'],['#A9C59A','Sage'],['#7E9A7A','Moss'],['#3F5E43','Forest'],
  ['#C9E2E4','Sea glass'],['#7FB5BA','Aqua'],['#3E8A8F','Teal'],['#245457','Deep teal'],['#C7D6EE','Powder blue'],['#7FA2D1','Cornflower'],['#3F6A9A','Denim blue'],['#1E2B4A','Navy'],
  ['#DCCDE8','Lilac'],['#AE90CC','Lavender'],['#7A5A9E','Violet'],['#4A3166','Plum'],
];
const colorName = hex => (COLORS.find(c => c[0].toLowerCase() === String(hex).toLowerCase()) || [0, 'Custom color'])[1];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

/* part maths */
const rpr = part => Math.max(1, part.mode === 'custom' ? part.labels.length : part.rowsPerRepeat);
function rowLabel(part, i) {
  if (part.mode === 'custom') return (part.labels[i] || '').trim() || `Row ${i + 1}`;
  return ((i % 2 === 0 ? part.oddLabel : part.evenLabel) || '').trim() || (i % 2 === 0 ? 'Odd' : 'Even');
}
const posInRepeat = part => part.completedRows % rpr(part);
const repeatsDone = part => Math.floor(part.completedRows / rpr(part));
function totals(p) {
  const total = p.parts.reduce((a, x) => a + (x.targetRows || 0), 0);
  const done = p.parts.reduce((a, x) => a + (x.completedRows || 0), 0);
  const remaining = Math.max(0, total - done);
  const pct = total ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  return { total, done, remaining, pct };
}
const activePart = p => p.parts.find(x => x.id === p.activePartId) || null;
function ensureActive(p) {
  if (!activePart(p)) { const n = p.parts.find(x => !x.complete) || p.parts[0]; p.activePartId = n ? n.id : null; }
  return activePart(p);
}
function nextPart(p, cur) {
  const i = p.parts.indexOf(cur);
  return p.parts.slice(i + 1).find(x => !x.complete) || p.parts.slice(0, i).find(x => !x.complete) || null;
}
function newPart(p) {
  const crochet = p.craft === 'crochet';
  return { id: uid(), name: '', targetRows: 20, mode: 'oddeven', oddLabel: crochet ? 'Right side' : 'Knit', evenLabel: crochet ? 'Wrong side' : 'Purl',
    rowsPerRepeat: 2, labels: [], notes: '', completedRows: 0, complete: false, lengthMode: 'rows', targetRepeats: 10 };
}

/* ---------- icons ---------- */
const I = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8a21 21 0 0 0 .6 5M17 17H3s3-2 3-9a4.7 4.7 0 0 1 .3-1.7"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
};

/* ---------- feedback: haptic + sound ---------- */
const hapLabel = document.createElement('label');
hapLabel.className = 'hap'; hapLabel.setAttribute('aria-hidden', 'true');
hapLabel.innerHTML = '<input type="checkbox" switch tabindex="-1">';
document.body.appendChild(hapLabel);
function haptic() {
  if (!state.settings.haptic) return;
  if (navigator.vibrate) { navigator.vibrate(18); return; }
  hapLabel.click(); // iOS 18+: toggling a native switch gives a light haptic tap
}
let actx;
function tick(high) {
  if (!state.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(high ? 1320 : 880, t); o.frequency.exponentialRampToValueAtTime(high ? 990 : 660, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.14);
  } catch {}
}

/* ---------- screen wake lock ---------- */
let wakeLock = null, wantWake = false;
async function acquireWake() {
  wantWake = true;
  if (!('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; updateAwakeBadge(); });
  } catch { wakeLock = null; }
  updateAwakeBadge();
}
function releaseWake() { wantWake = false; if (wakeLock) wakeLock.release().catch(() => {}); wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wantWake) acquireWake(); });
function updateAwakeBadge() { const b = $('#awake'); if (b) b.hidden = !wakeLock; }

/* ---------- theme ---------- */
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').setAttribute('content', dark ? '#111A2E' : '#FAF3E6');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- overlays: toast + sheets ---------- */
const overlay = $('#overlay');
let toastTimer;
function toast(msg, actionLabel, action, opts = {}) {
  clearTimeout(toastTimer);
  const old = $('.toast', overlay); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (opts.top ? ' knit-toast' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  if (actionLabel) el.querySelector('button').onclick = () => action();
  overlay.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), opts.ms || 4000);
}
function closeSheet() { overlay.querySelectorAll('.scrim,.sheet').forEach(e => e.remove()); }
function sheet(html, { dismissable = true } = {}) {
  closeSheet();
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog');
  el.innerHTML = '<div class="grab"></div>' + html;
  if (dismissable) scrim.onclick = closeSheet;
  overlay.append(scrim, el);
  return el;
}
function confirmSheet(title, body, okLabel, onOk) {
  const el = sheet(`<h2>${esc(title)}</h2><p class="sub">${esc(body)}</p>
    <div class="stack"><button class="btn danger" data-ok>${esc(okLabel)}</button><button class="btn ghost" data-cancel>Cancel</button></div>`);
  el.querySelector('[data-ok]').onclick = () => { closeSheet(); onOk(); };
  el.querySelector('[data-cancel]').onclick = closeSheet;
}

/* ---------- router ---------- */
const view = $('#view');
let drafts = {}; // form drafts keyed by route
let showArchived = false;
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'new') return { name: 'projectForm' };
  if (h[0] === 'p' && proj(h[1])) {
    const p = proj(h[1]);
    if (h[2] === 'knit') return { name: 'knit', p };
    if (h[2] === 'settings') return { name: 'projectForm', p };
    if (h[2] === 'part') return { name: 'partForm', p, partId: h[3], fromNew: h[4] === 'first' };
    return { name: 'detail', p };
  }
  return { name: 'dashboard' };
}
function render() {
  const r = route();
  closeSheet();
  if (r.name !== 'knit') releaseWake();
  view.className = 'view';
  ({ dashboard: renderDashboard, projectForm: renderProjectForm, detail: renderDetail, partForm: renderPartForm, knit: renderKnit })[r.name](r);
  if (r.name !== 'knit') window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { render(); });

/* ---------- dashboard ---------- */
function renderDashboard() {
  const list = state.projects.filter(p => !!p.archived === showArchived)
    .sort((a, b) => (b.lastKnitAt || b.createdAt) - (a.lastKnitAt || a.createdAt));
  const archivedCount = state.projects.filter(p => p.archived).length;
  const activeCount = state.projects.filter(p => !p.archived).length;
  view.innerHTML = `
    <div class="pad dash-head">
      <h1>${showArchived ? 'Archived' : 'My Projects'}</h1>
      <div class="r">
        <button class="iconbtn" data-a="settings" aria-label="Settings">${I.gear}</button>
        ${showArchived ? '' : `<button class="iconbtn accent" data-a="new" aria-label="New project">${I.plus}</button>`}
      </div>
    </div>
    <div class="pad muted" style="font-size:15px;margin-bottom:16px">${showArchived ? `${plural(archivedCount, 'project')} put away` : activeCount ? `${activeCount} on the needles` : ''}</div>
    <div class="pad proj-list">
      ${list.length ? list.map((p, i) => projectCard(p, i === 0 && !showArchived)).join('') :
        showArchived ? '<div class="empty">Nothing archived.</div>' :
        `<div class="empty"><div class="big">🧶</div><div style="font-size:18px;font-weight:650;color:var(--ink)">No projects yet</div>
         <p style="margin:8px 0 20px">Start one, break it into parts, then just tap to count rows.</p>
         <button class="btn" data-a="new">${I.plus.replace('<svg', '<svg width="20" height="20"')} New project</button></div>`}
      ${archivedCount || showArchived ? `<button class="muted" style="font-size:15px;font-weight:500;margin:4px 0 20px" data-a="toggle-archived">${showArchived ? '‹ Back to projects' : `Archived (${archivedCount}) ›`}</button>` : ''}
    </div>`;
  view.onclick = e => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    const id = a.dataset.id;
    if (a.dataset.a === 'new') { delete drafts.new; go('#/new'); }
    else if (a.dataset.a === 'settings') settingsSheet();
    else if (a.dataset.a === 'toggle-archived') { showArchived = !showArchived; render(); }
    else if (a.dataset.a === 'open') go(`#/p/${id}`);
    else if (a.dataset.a === 'knit') { e.stopPropagation(); startKnitting(proj(id)); }
    else if (a.dataset.a === 'more') { e.stopPropagation(); projectMenu(proj(id)); }
  };
}
function projectCard(p, primary) {
  const t = totals(p), ap = activePart(p), u = unit(p);
  const allDone = p.parts.length && p.parts.every(x => x.complete);
  return `<div class="card proj" style="--c:${esc(p.color)}" data-a="open" data-id="${p.id}">
    <div class="top"><div><div class="name">${esc(p.name)}</div>
      <div class="meta">${[p.size, p.craft === 'crochet' ? 'Crochet' : 'Knitting'].filter(Boolean).map(esc).join(' · ')}${allDone ? ' · <b>Finished 🎉</b>' : ap ? ` · On <b>${esc(ap.name)}</b>` : ''}</div></div>
      <button class="more" data-a="more" data-id="${p.id}" aria-label="More options">···</button></div>
    <div class="prog-row"><div class="bar"><i style="width:${t.pct}%"></i></div><b>${t.pct}%</b></div>
    <div class="split"><span>${plural(t.done, u)} done</span><span>${t.remaining} to go</span></div>
    ${primary && p.parts.length && !allDone ? `<button class="btn small" style="margin-top:14px" data-a="knit" data-id="${p.id}">${I.play} Keep ${p.craft === 'crochet' ? 'crocheting' : 'knitting'}</button>` : ''}
  </div>`;
}
function projectMenu(p) {
  const el = sheet(`<h2 style="margin-bottom:8px">${esc(p.name)}</h2><div class="menu">
    <button data-m="open">Open</button>
    <button data-m="edit">Edit project settings</button>
    <button data-m="archive">${p.archived ? 'Unarchive' : 'Archive'}</button>
    <button data-m="delete" class="danger">Delete project</button></div>`);
  el.onclick = e => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    if (m === 'open') go(`#/p/${p.id}`);
    if (m === 'edit') { delete drafts['edit' + p.id]; go(`#/p/${p.id}/settings`); }
    if (m === 'archive') { p.archived = !p.archived; save(); closeSheet(); render(); toast(p.archived ? 'Project archived' : 'Project restored'); }
    if (m === 'delete') confirmSheet('Delete project?', `“${p.name}” and all its counts will be gone for good.`, 'Delete', () => {
      state.projects = state.projects.filter(x => x !== p); save(); render(); toast('Project deleted');
    });
  };
}
function settingsSheet() {
  const s = state.settings;
  const el = sheet(`<h2>Settings</h2>
    <div class="label">Appearance</div>
    <div class="seg">${['auto', 'light', 'dark'].map(t => `<button data-theme="${t}" class="${s.theme === t ? 'on' : ''}">${t === 'auto' ? 'Match phone' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
    <div class="label">When I complete a row</div>
    <div class="seg"><button data-hap="1" class="${s.haptic ? 'on' : ''}">Haptic on</button><button data-hap="0" class="${!s.haptic ? 'on' : ''}">Haptic off</button></div>
    <div class="seg" style="margin-top:8px"><button data-snd="1" class="${s.sound ? 'on' : ''}">Sound on</button><button data-snd="0" class="${!s.sound ? 'on' : ''}">Sound off</button></div>
    <div class="label">Backup</div>
    <p class="muted" style="font-size:14px;margin:0 4px 10px">Projects are saved on this phone only. Save a backup file now and then, or to move to a new phone.</p>
    <div class="stack" style="margin-top:0"><button class="btn ghost" data-a="export">Save backup file</button>
    <button class="btn ghost" data-a="import">Restore from backup…</button></div>
    <input type="file" accept="application/json,.json" hidden id="importFile">`);
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.theme) { s.theme = b.dataset.theme; applyTheme(); }
    if (b.dataset.hap) { s.haptic = b.dataset.hap === '1'; if (s.haptic) haptic(); }
    if (b.dataset.snd) { s.sound = b.dataset.snd === '1'; tick(); }
    if (b.dataset.a === 'export') return exportBackup();
    if (b.dataset.a === 'import') return $('#importFile', el).click();
    save(); settingsSheet();
  };
  $('#importFile', el).onchange = async ev => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!Array.isArray(data.projects)) throw 0;
      confirmSheet('Restore backup?', `This replaces what's on this phone with ${plural(data.projects.length, 'project')} from the backup.`, 'Restore', () => {
        state = { projects: data.projects, settings: Object.assign(defaultState().settings, data.settings || {}) };
        save(); applyTheme(); render(); toast('Backup restored');
      });
    } catch { toast("That file isn't a Stitch Counter backup"); }
  };
}
async function exportBackup() {
  const name = `stitch-counter-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Stitch Counter backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- project form ---------- */
function renderProjectForm({ p }) {
  const key = p ? 'edit' + p.id : 'new';
  const d = drafts[key] ||= p
    ? { name: p.name, craft: p.craft, size: p.size, needles: [...p.needles], color: p.color }
    : { name: '', craft: 'knit', size: '', needles: [], color: '#3F6A9A' };
  const crochet = d.craft === 'crochet';
  const customSize = d.size && !SIZES.includes(d.size);
  view.innerHTML = `
    <div class="nav"><button data-a="cancel">Cancel</button><span class="title">${p ? 'Edit Project' : 'New Project'}</span>
      <button class="strong" data-a="save" ${d.name.trim() ? '' : 'disabled'}>Save</button></div>
    <div class="pad" style="padding-bottom:30px">
      <div class="label" style="margin-top:4px">Project name</div>
      <input class="field" id="f-name" placeholder="e.g. Blue Cable Cardigan" value="${esc(d.name)}" autocomplete="off" enterkeyhint="done">
      <div class="label">Craft</div>
      <div class="seg"><button data-craft="knit" class="${!crochet ? 'on' : ''}">🧶 Knitting</button><button data-craft="crochet" class="${crochet ? 'on' : ''}">🪝 Crochet</button></div>
      <div class="label">Size made</div>
      <div class="chips">${SIZES.map(s => `<button class="chip ${d.size === s ? 'on' : ''}" data-size="${s}">${s}</button>`).join('')}
        <button class="chip ${customSize || d.customOpen ? 'on' : ''}" data-size="custom">${customSize ? esc(d.size) : 'Custom…'}</button></div>
      ${customSize || d.customOpen ? `<input class="field" id="f-size" style="margin-top:10px" placeholder='e.g. 38" bust, Baby 6–12 mo' value="${customSize ? esc(d.size) : ''}">` : ''}
      <div class="label">${crochet ? 'Hook size(s)' : 'Needle size(s)'}</div>
      <div class="chips">${d.needles.map((n, i) => `<span class="chip card-bg">${esc(n)} <button class="faint" data-rmneedle="${i}" aria-label="Remove">✕</button></span>`).join('')}</div>
      <div class="add-row"><input class="field" id="f-needle" placeholder="${crochet ? 'e.g. H-8 · 5 mm' : 'e.g. US 6 · 4 mm'}" list="needle-list" enterkeyhint="done">
        <button class="btn" data-a="addneedle">Add</button></div>
      <datalist id="needle-list">${(crochet ? ['B-1 · 2.25 mm', 'C-2 · 2.75 mm', 'D-3 · 3.25 mm', 'E-4 · 3.5 mm', 'F-5 · 3.75 mm', 'G-6 · 4 mm', 'H-8 · 5 mm', 'I-9 · 5.5 mm', 'J-10 · 6 mm', 'K-10½ · 6.5 mm', 'L-11 · 8 mm', 'N-15 · 10 mm']
        : ['US 0 · 2 mm', 'US 1 · 2.25 mm', 'US 2 · 2.75 mm', 'US 3 · 3.25 mm', 'US 4 · 3.5 mm', 'US 5 · 3.75 mm', 'US 6 · 4 mm', 'US 7 · 4.5 mm', 'US 8 · 5 mm', 'US 9 · 5.5 mm', 'US 10 · 6 mm', 'US 10½ · 6.5 mm', 'US 11 · 8 mm', 'US 13 · 9 mm', 'US 15 · 10 mm']).map(n => `<option value="${n}">`).join('')}</datalist>
      <div class="label">Project color</div>
      <div class="card" style="padding:14px">
        <div class="swatches">${COLORS.map(([c, n]) => `<button class="swatch ${c === d.color ? 'on' : ''}" style="background:${c}" data-color="${c}" aria-label="${n}"></button>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:15px">
          <span style="display:flex;gap:8px;align-items:center"><span class="yarn" style="background:${esc(d.color)};width:18px;height:18px"></span>${colorName(d.color)}</span>
          <label class="link" style="position:relative">Custom color…<input type="color" id="f-color" value="${esc(d.color)}" style="position:absolute;inset:0;opacity:0"></label>
        </div>
      </div>
      <button class="btn" style="margin-top:22px" data-a="save" ${d.name.trim() ? '' : 'disabled'}>${p ? 'Save changes' : 'Next: Add parts →'}</button>
    </div>`;
  const syncSave = () => view.querySelectorAll('[data-a=save]').forEach(b => b.disabled = !d.name.trim());
  $('#f-name').oninput = e => { d.name = e.target.value; syncSave(); };
  if ($('#f-size')) $('#f-size').oninput = e => { d.size = e.target.value; };
  $('#f-color').oninput = e => { d.color = e.target.value; };
  $('#f-color').onchange = () => renderProjectForm({ p });
  const addNeedle = () => { const v = $('#f-needle').value.trim(); if (v) { d.needles.push(v); renderProjectForm({ p }); } };
  $('#f-needle').onkeydown = e => { if (e.key === 'Enter') addNeedle(); };
  view.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.craft) { d.craft = b.dataset.craft; }
    else if (b.dataset.size) {
      if (b.dataset.size === 'custom') { d.customOpen = true; if (SIZES.includes(d.size)) d.size = ''; }
      else { d.size = d.size === b.dataset.size ? '' : b.dataset.size; d.customOpen = false; }
    }
    else if (b.dataset.rmneedle) d.needles.splice(+b.dataset.rmneedle, 1);
    else if (b.dataset.color) d.color = b.dataset.color;
    else if (b.dataset.a === 'addneedle') return addNeedle();
    else if (b.dataset.a === 'cancel') { delete drafts[key]; return go(p ? `#/p/${p.id}` : '#/'); }
    else if (b.dataset.a === 'save') {
      if (!d.name.trim()) return;
      const pending = $('#f-needle').value.trim(); if (pending) d.needles.push(pending);
      const fields = { name: d.name.trim(), craft: d.craft, size: (d.size || '').trim(), needles: d.needles, color: d.color };
      delete drafts[key];
      if (p) { Object.assign(p, fields); save(); return go(`#/p/${p.id}`); }
      const np = Object.assign({ id: uid(), parts: [], history: [], activePartId: null, archived: false, createdAt: Date.now() }, fields);
      state.projects.push(np); save();
      return go(`#/p/${np.id}/part/new/first`);
    } else return;
    renderProjectForm({ p });
    if (b.dataset.size === 'custom') $('#f-size')?.focus();
  };
}

/* ---------- project detail ---------- */
function ring(pct) {
  const C = 2 * Math.PI * 36;
  return `<svg width="86" height="86" viewBox="0 0 86 86" aria-hidden="true"><circle cx="43" cy="43" r="36" fill="none" stroke="var(--sunk)" stroke-width="10"/>
    <circle cx="43" cy="43" r="36" fill="none" stroke="var(--accent)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" transform="rotate(-90 43 43)"/>
    <text x="43" y="49" text-anchor="middle" font-size="19" font-weight="700" fill="var(--ink)">${pct}%</text></svg>`;
}
function renderDetail({ p }) {
  const t = totals(p), u = unit(p), ap = ensureActive(p);
  const allDone = p.parts.length && p.parts.every(x => x.complete);
  view.innerHTML = `
    <div class="nav"><button data-a="back">‹ Projects</button><span></span><button data-a="edit">Edit</button></div>
    <div class="pad" style="padding-bottom:110px">
      <div style="display:flex;align-items:center;gap:10px"><span class="yarn" style="background:${esc(p.color)};width:18px;height:18px"></span><h1 style="font-size:28px">${esc(p.name)}</h1></div>
      <div class="muted" style="font-size:15px;margin-top:4px">${[p.size && `Size ${p.size}`, p.craft === 'crochet' ? 'Crochet' : 'Knitting', p.needles.join(', ')].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="card ring-card">${ring(t.pct)}
        <div><div style="font-size:24px;font-weight:700">${t.done} <span class="muted" style="font-size:17px;font-weight:500">/ ${t.total} ${u}s</span></div>
        <div class="muted" style="font-size:15px;margin-top:4px">${allDone ? 'Finished! 🎉' : `${plural(t.remaining, u)} remaining`}</div></div></div>
      <div class="label" style="display:flex;justify-content:space-between"><span>Parts</span>${p.parts.length > 1 ? '<span style="text-transform:none;letter-spacing:0;color:var(--faint);font-weight:500">Drag ≡ to reorder</span>' : ''}</div>
      ${p.parts.length ? `<div class="parts card" style="padding:0" id="parts">${p.parts.map(x => partRow(p, x, ap)).join('')}</div>`
        : `<div class="card empty" style="padding:30px 20px">Break the project into parts, like Ribbing, Body and Sleeves, in the order you'll make them.</div>`}
      <button class="link" style="display:block;margin:16px auto" data-a="addpart">+ Add part</button>
    </div>
    ${p.parts.length && !allDone ? `<div class="sticky-bottom" style="position:fixed;left:50%;transform:translateX(-50%);width:100%;max-width:520px">
      <button class="btn" data-a="knit">${I.play} ${p.history.length || t.done ? 'Keep' : 'Start'} ${p.craft === 'crochet' ? 'crocheting' : 'knitting'} · ${esc(ap.name)}</button></div>` : ''}`;
  view.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'back') go('#/');
    if (a === 'edit') { delete drafts['edit' + p.id]; go(`#/p/${p.id}/settings`); }
    if (a === 'addpart') go(`#/p/${p.id}/part/new`);
    if (a === 'knit') startKnitting(p);
    if (a === 'editpart') go(`#/p/${p.id}/part/${b.dataset.id}`);
    if (a === 'knitpart') { e.stopPropagation(); p.activePartId = b.dataset.id; save(); startKnitting(p); }
  };
  if ($('#parts')) enableDrag($('#parts'), p);
}
function partRow(p, x, ap) {
  const active = ap && x.id === ap.id && !x.complete, u = unit(p);
  const dot = x.complete ? '<span class="dot done">✓</span>' : active ? '<span class="dot cur">→</span>' : '<span class="dot todo"></span>';
  const reps = repeatsDone(x);
  return `<div class="part ${active ? 'active' : ''}" data-id="${x.id}">
    ${dot}
    <div class="info" data-a="editpart" data-id="${x.id}">
      <div class="pn">${esc(x.name)}${active ? `<span class="badge">${p.craft === 'crochet' ? 'ON THE HOOK' : 'KNITTING NOW'}</span>` : ''}</div>
      <div class="ps">${x.completedRows} / ${x.targetRows} ${u}s${x.complete ? ' · done' : reps ? ` · ${plural(reps, 'repeat')}` : ''}</div>
      ${active ? `<div class="bar" style="margin-top:8px;height:6px;background:rgba(0,0,0,.07)"><i style="width:${Math.min(100, x.targetRows ? x.completedRows / x.targetRows * 100 : 0)}%"></i></div>` : ''}
    </div>
    ${!active && !x.complete ? `<button class="go" data-a="knitpart" data-id="${x.id}">Switch</button>` : ''}
    ${p.parts.length > 1 ? '<span class="handle" aria-label="Drag to reorder">≡</span>' : ''}
  </div>`;
}
function enableDrag(list, p) {
  list.addEventListener('pointerdown', e => {
    const h = e.target.closest('.handle'); if (!h) return;
    e.preventDefault();
    const row = h.closest('.part'), rows = [...list.children], startY = e.clientY;
    const rects = rows.map(r => r.getBoundingClientRect());
    const from = rows.indexOf(row); let to = from;
    row.classList.add('dragging'); h.setPointerCapture(e.pointerId);
    const move = ev => {
      const dy = ev.clientY - startY; row.style.transform = `translateY(${dy}px)`;
      const mid = rects[from].top + rects[from].height / 2 + dy;
      to = rects.filter(r => r.top + r.height / 2 < mid).length - (rects[from].top + rects[from].height / 2 < mid ? 1 : 0);
      to = Math.max(0, Math.min(rows.length - 1, to));
      rows.forEach((r, i) => {
        if (r === row) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -rects[from].height;
        if (from > to && i < from && i >= to) shift = rects[from].height;
        r.style.transition = 'transform .15s'; r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      if (to !== from) { const [m] = p.parts.splice(from, 1); p.parts.splice(to, 0, m); save(); haptic(); }
      render();
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });
}

/* ---------- part form ---------- */
const rowsCalc = (t, n, u) => t % n === 0 ? `That's ${plural(t / n, 'repeat')} of ${n} ${u}s` : `About ${(t / n).toFixed(1).replace(/\.0$/, '')} repeats of ${n} ${u}s`;
function renderPartForm({ p, partId, fromNew }) {
  const existing = partId !== 'new' ? p.parts.find(x => x.id === partId) : null;
  if (partId !== 'new' && !existing) return go(`#/p/${p.id}`);
  const key = 'part' + p.id + partId;
  const d = drafts[key] ||= existing ? JSON.parse(JSON.stringify(existing)) : newPart(p);
  const u = unit(p), U = Unit(p);
  const custom = d.mode === 'custom';
  const n = custom ? d.labels.length : d.rowsPerRepeat;
  const byReps = d.lengthMode === 'repeats';
  if (byReps) d.targetRows = clampInt((+d.targetRepeats || 1) * n, 1, 9999);
  view.innerHTML = `
    <div class="nav"><button data-a="back">${fromNew ? 'Skip' : '‹ Back'}</button><span class="title">${existing ? 'Edit Part' : 'New Part'}</span>
      <button class="strong" data-a="done" ${d.name.trim() ? '' : 'disabled'}>Done</button></div>
    <div class="pad" style="padding-bottom:40px">
      ${fromNew ? `<p class="muted" style="margin:0 4px 6px;font-size:15px">Add the first part of <b style="color:var(--ink)">${esc(p.name)}</b>. You can add more after.</p>` : ''}
      <div class="label" style="margin-top:4px">Part name</div><input class="field" id="f-pname" placeholder="e.g. Body" value="${esc(d.name)}" autocomplete="off">
      <div class="label">${U} pattern</div>
      <div class="seg"><button data-mode="oddeven" class="${!custom ? 'on' : ''}">Odd / Even</button><button data-mode="custom" class="${custom ? 'on' : ''}">${U} by ${u}</button></div>
      <div class="card" style="margin-top:10px;padding:8px 0">
        <div class="rpr"><span style="font-weight:600">${U}s per repeat</span>
          <span class="mini"><button data-a="r-" aria-label="Fewer">−</button><b>${n}</b><button data-a="r+" aria-label="More">+</button></span></div>
        ${custom ? d.labels.map((l, i) => `<div class="rr"><span class="n">${i + 1}</span><input data-label="${i}" value="${esc(l)}" placeholder="${U} ${i + 1} instruction"></div>`).join('')
          : `<div class="rr"><span class="n">Odd</span><input id="f-odd" value="${esc(d.oddLabel)}" placeholder="e.g. Knit"></div>
             <div class="rr"><span class="n">Even</span><input id="f-even" value="${esc(d.evenLabel)}" placeholder="e.g. Purl"></div>`}
        <div class="faint" style="font-size:13px;padding:8px 16px 6px">After ${u} ${n}, the repeat starts again at ${u} 1.</div>
      </div>
      <div class="label">Part length</div>
      <div class="seg"><button data-len="rows" class="${!byReps ? 'on' : ''}">Total ${u}s</button><button data-len="repeats" class="${byReps ? 'on' : ''}">Number of repeats</button></div>
      <div class="card lenbox">
        ${byReps
          ? `<div class="lenrow"><span>Repeats</span>
               <div class="stepper"><button data-a="p-" aria-label="Fewer">−</button><input id="f-reps" inputmode="numeric" pattern="[0-9]*" value="${d.targetRepeats}"><button data-a="p+" aria-label="More">+</button></div></div>
             <div class="calc" id="f-calc">${d.targetRepeats || 0} × ${n} ${u}s = <b>${d.targetRows} ${u}s</b></div>`
          : `<div class="lenrow"><span>Target ${u}s</span>
               <div class="stepper"><button data-a="t-" aria-label="Fewer">−</button><input id="f-target" inputmode="numeric" pattern="[0-9]*" value="${d.targetRows}"><button data-a="t+" aria-label="More">+</button></div></div>
             <div class="calc" id="f-calc">${rowsCalc(+d.targetRows || 0, n, u)}</div>`}
      </div>
      <div class="label">Notes for this part</div>
      <textarea class="field" id="f-notes" rows="4" placeholder="Needle changes, decreases, reminders…">${esc(d.notes)}</textarea>
      ${existing ? `<div class="label">Progress</div>
        <div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px">
          <span>${U}s done</span>
          <div class="stepper" style="box-shadow:none;background:var(--sunk);width:136px;height:44px"><button data-a="c-">−</button><input id="f-done" inputmode="numeric" pattern="[0-9]*" value="${d.completedRows}"><button data-a="c+">+</button></div>
        </div>` : ''}
      ${existing ? `<div class="foot-actions"><button data-a="complete" style="color:var(--done)">${d.complete ? '↺ Mark not complete' : '✓ Mark part complete'}</button>
        <button data-a="delete" style="color:var(--danger)">Delete part</button></div>` : ''}
    </div>`;
  const syncDone = () => view.querySelectorAll('[data-a=done]').forEach(b => b.disabled = !d.name.trim());
  $('#f-pname').oninput = e => { d.name = e.target.value; syncDone(); };
  if ($('#f-target')) {
    $('#f-target').oninput = e => { d.targetRows = e.target.value === '' ? '' : clampInt(e.target.value, 1, 9999); $('#f-calc').textContent = rowsCalc(+d.targetRows || 0, n, u); };
    $('#f-target').onblur = () => { d.targetRows = clampInt(d.targetRows, 1, 9999); $('#f-target').value = d.targetRows; $('#f-calc').textContent = rowsCalc(d.targetRows, n, u); };
  }
  if ($('#f-reps')) {
    const maxReps = Math.floor(9999 / n);
    $('#f-reps').oninput = e => {
      d.targetRepeats = e.target.value === '' ? '' : clampInt(e.target.value, 1, maxReps);
      d.targetRows = clampInt((+d.targetRepeats || 1) * n, 1, 9999);
      $('#f-calc').innerHTML = `${d.targetRepeats || 0} × ${n} ${u}s = <b>${d.targetRows} ${u}s</b>`;
    };
    $('#f-reps').onblur = () => { d.targetRepeats = clampInt(d.targetRepeats, 1, maxReps); $('#f-reps').value = d.targetRepeats; };
  }
  if ($('#f-done')) { $('#f-done').oninput = e => { d.completedRows = clampInt(e.target.value, 0, 99999); }; $('#f-done').onblur = () => { $('#f-done').value = d.completedRows; }; }
  if ($('#f-odd')) { $('#f-odd').oninput = e => d.oddLabel = e.target.value; $('#f-even').oninput = e => d.evenLabel = e.target.value; }
  view.querySelectorAll('[data-label]').forEach(inp => inp.oninput = e => { d.labels[+inp.dataset.label] = e.target.value; });
  $('#f-notes').oninput = e => { d.notes = e.target.value; };
  view.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a;
    if (b.dataset.mode && b.dataset.mode !== d.mode) {
      if (b.dataset.mode === 'custom') d.labels = Array.from({ length: Math.max(1, d.rowsPerRepeat) }, (_, i) => d.labels[i] ?? (i % 2 === 0 ? d.oddLabel : d.evenLabel));
      else d.rowsPerRepeat = d.labels.length;
      d.mode = b.dataset.mode;
    }
    else if (b.dataset.len && b.dataset.len !== (d.lengthMode || 'rows')) {
      if (b.dataset.len === 'repeats') d.targetRepeats = Math.max(1, Math.round((+d.targetRows || n) / n));
      d.lengthMode = b.dataset.len;
    }
    else if (a === 'p-' || a === 'p+') d.targetRepeats = clampInt((+d.targetRepeats || 0) + (a === 'p+' ? 1 : -1), 1, Math.floor(9999 / n));
    else if (a === 't-' || a === 't+') d.targetRows = clampInt((+d.targetRows || 0) + (a === 't+' ? 1 : -1), 1, 9999);
    else if (a === 'c-' || a === 'c+') d.completedRows = clampInt(d.completedRows + (a === 'c+' ? 1 : -1), 0, 99999);
    else if (a === 'r-' || a === 'r+') {
      const nn = clampInt(n + (a === 'r+' ? 1 : -1), 1, 200);
      if (custom) { while (d.labels.length < nn) d.labels.push(''); d.labels.length = nn; } else d.rowsPerRepeat = nn;
    }
    else if (a === 'complete') { d.complete = !d.complete; }
    else if (a === 'back') { delete drafts[key]; return go(`#/p/${p.id}`); }
    else if (a === 'delete') return confirmSheet('Delete part?', `“${existing.name}” and its ${d.completedRows} counted ${u}s will be removed.`, 'Delete', () => {
      p.parts = p.parts.filter(x => x !== existing); p.history = p.history.filter(h => h.partId !== existing.id);
      if (p.activePartId === existing.id) { p.activePartId = null; ensureActive(p); }
      delete drafts[key]; save(); go(`#/p/${p.id}`); toast('Part deleted');
    });
    else if (a === 'done') {
      if (!d.name.trim()) return;
      d.name = d.name.trim();
      if (d.mode === 'custom') d.rowsPerRepeat = d.labels.length;
      if (d.lengthMode === 'repeats') { d.targetRepeats = clampInt(d.targetRepeats, 1, Math.floor(9999 / rpr(d))); d.targetRows = clampInt(d.targetRepeats * rpr(d), 1, 9999); }
      d.targetRows = clampInt(d.targetRows, 1, 9999);
      if (existing) {
        if (existing.completedRows !== d.completedRows) p.history = p.history.filter(h => h.partId !== existing.id); // manual edit: drop stale undo steps
        Object.assign(existing, d);
        if (existing.complete && p.activePartId === existing.id) { const nx = nextPart(p, existing); if (nx) p.activePartId = nx.id; }
      } else { p.parts.push(d); if (!activePart(p) || activePart(p).complete) p.activePartId = d.id; }
      delete drafts[key]; save(); return go(`#/p/${p.id}`);
    } else return;
    const y = window.scrollY; renderPartForm({ p, partId, fromNew }); window.scrollTo(0, y);
  };
}

/* ---------- knitting mode ---------- */
let undoStreak = 0, undoStreakTimer;
function startKnitting(p) {
  ensureActive(p);
  if (activePart(p)?.complete) { const nx = nextPart(p, activePart(p)); if (nx) p.activePartId = nx.id; }
  save(); go(`#/p/${p.id}/knit`);
}
function snapshot(p, part) { return { partId: part.id, completedRows: part.completedRows, complete: part.complete, activePartId: p.activePartId }; }
function pushHistory(p, snap) { p.history.push(snap); if (p.history.length > HISTORY_CAP) p.history.splice(0, p.history.length - HISTORY_CAP); }

function renderKnit({ p }) {
  const part = ensureActive(p);
  if (!part) return go(`#/p/${p.id}`);
  view.className = 'view knit';
  const u = unit(p), U = Unit(p), t = totals(p);
  const n = rpr(part), i = posInRepeat(part);
  const dots = n <= 24 ? `<div class="dots ${n > 12 ? 'many' : ''}" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>` : '';
  const next = n > 1 ? rowLabel(part, (i + 1) % n) : '';
  const over = part.completedRows >= part.targetRows;
  view.innerHTML = `
    <div class="k-top">
      <button class="proj-name" data-a="back"><span class="chev">‹</span><span class="yarn" style="background:${esc(p.color)}"></span><span class="t">${esc(p.name)}</span></button>
      <span class="awake" id="awake" hidden>☀︎ Screen stays on</span>
    </div>
    <div class="k-main">
      <div class="rowof" aria-live="polite">${U.toUpperCase()} ${i + 1} <small>of ${n}</small></div>
      <div class="instr">${esc(rowLabel(part, i))}</div>
      <button class="partpill" data-a="parts">${esc(part.name)} · ${over ? `${part.completedRows} of ${part.targetRows} ${u}s ✓` : `${u} ${part.completedRows + 1} of ${part.targetRows}`}</button>
      ${dots}
      ${next ? `<div class="next">Next: ${esc(next)}</div>` : ''}
    </div>
    <button class="complete" data-a="complete"><b>COMPLETE ${U.toUpperCase()}</b><span>tap anywhere here</span></button>
    <div class="stats">
      <div><b>${t.done}</b><span>${u}s done</span></div>
      <div><b>${repeatsDone(part)}</b><span>${repeatsDone(part) === 1 ? 'repeat' : 'repeats'}</span></div>
      <div><b>${t.remaining}</b><span>remaining</span></div>
    </div>
    <div class="k-prog"><div class="bar"><i style="width:${t.pct}%"></i></div><b>${t.pct}%</b></div>
    <div class="k-bottom">
      <button class="undo" data-a="undo" ${p.history.length ? '' : 'disabled'}>${I.undo} Undo last ${u}</button>
      <span class="spacer"></span>
      <button class="iconbtn ${state.settings.sound ? '' : 'off'}" data-a="sound" aria-label="Sound ${state.settings.sound ? 'on' : 'off'}">${state.settings.sound ? I.bell : I.bellOff}</button>
      <button class="iconbtn" data-a="notes" aria-label="Notes">${I.note}${part.notes.trim() ? '<span style="position:absolute;margin:-22px -22px 0 0;width:9px;height:9px;border-radius:50%;background:var(--accent)"></span>' : ''}</button>
    </div>`;
  acquireWake(); updateAwakeBadge();
  view.onclick = e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'complete') completeRow(p);
    if (a === 'undo') undo(p);
    if (a === 'back' || a === 'parts') go(`#/p/${p.id}`);
    if (a === 'sound') { state.settings.sound = !state.settings.sound; save(); tick(); renderKnit({ p }); toast(state.settings.sound ? 'Sound on' : 'Sound off', null, null, { top: true, ms: 1500 }); }
    if (a === 'notes') notesSheet(p, part);
  };
}
function completeRow(p) {
  const part = activePart(p); if (!part) return;
  pushHistory(p, snapshot(p, part));
  part.completedRows++;
  p.lastKnitAt = Date.now();
  save();
  const repeatDone = part.completedRows % rpr(part) === 0;
  haptic(); tick(repeatDone);
  undoStreak = 0;
  const old = $('.toast', overlay); if (old) old.remove();
  renderKnit({ p });
  $('.rowof').classList.add('bump'); view.classList.add('flash');
  if (part.completedRows === part.targetRows) setTimeout(() => endOfPartSheet(p, part), 250);
}
function undo(p) {
  const h = p.history.pop(); if (!h) return;
  const part = p.parts.find(x => x.id === h.partId);
  if (part) { part.completedRows = h.completedRows; part.complete = h.complete; }
  p.activePartId = h.activePartId;
  save(); haptic(); closeSheet();
  clearTimeout(undoStreakTimer); undoStreak++; undoStreakTimer = setTimeout(() => undoStreak = 0, 4000);
  if (route().name !== 'knit') go(`#/p/${p.id}/knit`); else renderKnit({ p });
  const ap = activePart(p), u = unit(p);
  if (!ap) return;
  const msg = `Undid ${plural(undoStreak, u)} · back to ${u} ${posInRepeat(ap) + 1}`;
  toast(undoStreak === 1 ? `Back to ${ap.name}, ${u} ${posInRepeat(ap) + 1}` : msg, p.history.length ? 'Undo more' : null, () => undo(p));
}
function endOfPartSheet(p, part) {
  const nx = nextPart(p, part), u = unit(p);
  const finished = !nx;
  const el = sheet(`<div style="text-align:center"><div class="bigcheck">${finished ? '🎉' : '✓'}</div>
      <h2>${finished ? `${esc(p.name)} is finished!` : `${esc(part.name)} is done!`}</h2>
      <p class="sub">${part.completedRows} of ${part.targetRows} ${u}s · ${plural(repeatsDone(part), 'repeat')}</p></div>
    ${finished ? '' : `<div class="upnext"><span class="dot todo"></span><div><div class="k">Up next</div><div class="v">${esc(nx.name)} · ${nx.targetRows} ${u}s</div></div></div>`}
    <div class="stack">
      ${finished ? `<button class="btn" data-s="finish">Back to projects</button>` : `<button class="btn" data-s="next">Start ${esc(nx.name)}</button>
      <button class="btn ghost" data-s="choose">Choose a different part</button>`}
    </div>
    <div class="sheet-links"><button class="muted" data-s="keep">Keep going on ${esc(part.name)}</button><button class="link" data-s="undo">↶ Undo last ${u}</button></div>`, { dismissable: false });
  el.onclick = e => {
    const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return;
    if (s === 'keep') return closeSheet();
    if (s === 'undo') return undo(p);
    pushHistory(p, snapshot(p, part));
    part.complete = true;
    if (s === 'next') { p.activePartId = nx.id; save(); haptic(); closeSheet(); renderKnit({ p }); toast(`Now on ${nx.name}`, null, null, { top: true, ms: 2000 }); }
    if (s === 'choose') { save(); go(`#/p/${p.id}`); }
    if (s === 'finish') { save(); go('#/'); }
  };
}
function notesSheet(p, part) {
  const el = sheet(`<h2>${esc(part.name)} notes</h2>
    <textarea class="notes-area" id="notes" placeholder="Needle changes, decreases, reminders…">${esc(part.notes)}</textarea>
    <div class="stack"><button class="btn" data-a="close">Done</button></div>`);
  const ta = $('#notes', el);
  ta.oninput = () => { part.notes = ta.value; save(); };
  el.querySelector('[data-a=close]').onclick = () => { closeSheet(); renderKnit({ p }); };
}

/* ---------- boot ---------- */
state.projects.forEach(p => { p.history ||= []; p.parts ||= []; p.needles ||= []; });
applyTheme();
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__stitch = { get state() { return state; }, totals, rpr, posInRepeat, repeatsDone, rowLabel }; // for tests
})();
