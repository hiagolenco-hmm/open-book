'use strict';

/* =====================================================
   Notas — app offline estilo Notion (v2)
   ===================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripHtml = (h) => { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent.replace(/ /g, ' '); };
const imgSrc = (b) => b.src || (S.images && S.images[b.img]) || '';
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let S = null;            // estado
let hist = [], hi = -1;  // histórico de navegação
let dragBlockId = null, dragPageId = null;
const svgi = (inner, sw) => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${sw || 1.5}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const CHEV = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 1.8 6.7 5 3.5 8.2"/></svg>';
const ICO = {
  back: svgi('<path d="M10 3 5 8l5 5"/>', 1.7),
  fwd: svgi('<path d="M6 3l5 5-5 5"/>', 1.7),
  side: svgi('<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M6 3v10"/>'),
  menu: svgi('<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>'),
  close: svgi('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>', 1.4),
  plus: svgi('<path d="M8 3v10M3 8h10"/>', 1.5),
  alL: svgi('<rect x="2" y="2.5" width="6" height="5" rx="1"/><path d="M2 11h12M2 14h8"/>'),
  alC: svgi('<rect x="5" y="2.5" width="6" height="5" rx="1"/><path d="M2 11h12M4 14h8"/>'),
  alR: svgi('<rect x="8" y="2.5" width="6" height="5" rx="1"/><path d="M2 11h12M6 14h8"/>'),
  wrL: svgi('<rect x="2" y="2.5" width="5" height="6" rx="1"/><path d="M9.5 3.5H14M9.5 6.5H14M2 11.5h12M2 14h9"/>'),
  wrR: svgi('<rect x="9" y="2.5" width="5" height="6" rx="1"/><path d="M2 3.5h4.5M2 6.5h4.5M2 11.5h12M5 14h9"/>'),
  trash: svgi('<path d="M3 4.5h10M6.2 4.5V2.8h3.6v1.7M4.4 4.5l.6 8.7h6l.6-8.7"/>')
};
let mOpen = false;       // gaveta do menu lateral (celular)
const isMobile = () => document.documentElement.classList.contains('mobile');
function updateMobileClass() {
  const m = document.documentElement.classList.contains('android') || window.matchMedia('(max-width: 760px)').matches;
  const was = isMobile();
  document.documentElement.classList.toggle('mobile', m);
  if (was !== m && S) renderAll();
}
updateMobileClass();
window.addEventListener('resize', updateMobileClass);

const COVERS = [
  'linear-gradient(135deg,#f6d365,#fda085)', 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  'linear-gradient(135deg,#84fab0,#8fd3f4)', 'linear-gradient(135deg,#d4a5f5,#fbc2eb)',
  'linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#43cea2,#185a9d)', 'linear-gradient(135deg,#434343,#000000)'
];

/* ---------- Estado e persistência ---------- */
const mkBlock = (type = 'text', html = '') => ({ id: uid(), type, html, checked: false, indent: 0 });

function welcomeState() {
  const id = uid(), sub = uid();
  const pages = {};
  pages[id] = {
    id, title: 'Bem-vindo', icon: '👋', parent: null, children: [sub], expanded: true, updated: Date.now(),
    blocks: [
      mkBlock('h2', 'Suas notas, 100% offline'),
      mkBlock('text', 'Tudo fica salvo no seu computador, sem conta, sem internet e sem atualizações forçadas.'),
      mkBlock('h3', 'Dicas rápidas'),
      mkBlock('bullet', 'Digite <b>/</b> para escolher o tipo de bloco (texto, títulos, tarefas, toggle, imagem, página…)'),
      mkBlock('bullet', 'Atalhos de markdown: <b>#</b>, <b>##</b>, <b>-</b>, <b>1.</b>, <b>[]</b>, <b>&gt;</b> (toggle), <b>"</b> (citação), <b>---</b> e <b>```</b> + espaço'),
      mkBlock('bullet', 'Selecione um texto para formatar: negrito, itálico, código, cores…'),
      mkBlock('bullet', 'Passe o mouse sobre um bloco: <b>+</b> adiciona e <b>⋮⋮</b> abre opções ou arrasta'),
      mkBlock('bullet', 'Botão <b>⋯</b> no topo: duplicar, mover, exportar, excluir, fonte e largura da página'),
      mkBlock('bullet', 'Páginas excluídas vão para a <b>Lixeira</b> e podem ser restauradas'),
      mkBlock('bullet', '<b>Ctrl+P</b> busca · <b>Ctrl+N</b> nova página · <b>Ctrl+Z / Ctrl+Y</b> desfaz e refaz · <b>Ctrl+\\</b> recolhe o menu'),
      mkBlock('todo', 'Criar minha primeira página'),
      Object.assign(mkBlock('page'), { pageId: sub }),
      mkBlock('text', '')
    ]
  };
  pages[sub] = { id: sub, title: 'Uma subpágina', icon: '📄', parent: id, children: [], expanded: false, updated: Date.now(), blocks: [mkBlock('text', 'Páginas podem ficar dentro de outras páginas, em qualquer nível.')] };
  return { pages, root: [id], current: id, theme: 'light', sidebar: true, sbw: 260, images: {} };
}

/* salvamento + histórico de desfazer */
let saveTimer = null, snapTimer = null, metaT = null;
let undoStack = [], redoStack = [], lastSnap = '';
const SNAP_SKIP = new Set(['current', 'theme', 'sidebar', 'sbw', 'expanded', 'images', 'tabs', 'tab', 'versions', 'userDict', 'spellOff', 'emojis', 'coverLib']);
const snapStr = () => JSON.stringify(S, (k, v) => (SNAP_SKIP.has(k) ? undefined : v));

function save(touch = true) {
  if (touch && S && S.pages[S.current]) { S.pages[S.current].updated = Date.now(); clearTimeout(metaT); metaT = setTimeout(renderMeta, 400); }
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 350);
  clearTimeout(snapTimer); snapTimer = setTimeout(snapshot, 500);
}
let lastImgSig = null;
function flush() {
  clearTimeout(saveTimer); if (!S) return;
  const sig = Object.keys(S.images || {}).join(',');
  const imgs = sig !== lastImgSig ? S.images : null;
  lastImgSig = sig;
  window.api.save(Object.assign({}, S, { images: undefined }), imgs);
}
window.addEventListener('beforeunload', () => { snapshot(); captureVersion(S.current, true); flush(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

function snapshot() {
  clearTimeout(snapTimer);
  if (!S) return;
  const j = snapStr();
  if (j === lastSnap) return;
  if (lastSnap) { undoStack.push(lastSnap); if (undoStack.length > 100) undoStack.shift(); redoStack = []; }
  lastSnap = j;
}
function applySnap(str) {
  const meta = { current: S.current, theme: S.theme, sidebar: S.sidebar, sbw: S.sbw, images: S.images, tabs: S.tabs, tab: S.tab, versions: S.versions, userDict: S.userDict, spellOff: S.spellOff, emojis: S.emojis, coverLib: S.coverLib };
  const exp = {}; Object.values(S.pages).forEach((p) => { exp[p.id] = p.expanded; });
  const next = JSON.parse(str);
  Object.values(next.pages).forEach((p) => { p.expanded = exp[p.id] || false; });
  Object.assign(next, meta);
  S = next; lastSnap = str;
  if (!S.pages[S.current] || inTrash(S.pages[S.current])) S.current = S.root[0] || Object.keys(S.pages)[0];
  hist = hist.filter((x) => S.pages[x]); hi = Math.min(hi, hist.length - 1);
  renderAll(); flush();
}
function undo() { snapshot(); if (!undoStack.length) return; redoStack.push(lastSnap); applySnap(undoStack.pop()); toast('Desfeito'); }
function redo() { snapshot(); if (!redoStack.length) return; undoStack.push(lastSnap); applySnap(redoStack.pop()); toast('Refeito'); }

/* ---------- Helpers de árvore ---------- */
const P = (id) => S.pages[id];
const siblings = (p) => (p.parent ? P(p.parent).children : S.root);
function isDescendant(id, ancestorId) {
  let cur = P(id);
  while (cur) { if (cur.id === ancestorId) return true; cur = cur.parent ? P(cur.parent) : null; }
  return false;
}
function collect(id, out = []) { out.push(id); P(id).children.forEach((c) => collect(c, out)); return out; }
function inTrash(p) { let c = p; while (c) { if (c.trashed) return true; c = c.parent ? P(c.parent) : null; } return false; }
function addLinkBlock(parentId, pageId, afterIdx) {
  const par = P(parentId);
  const link = Object.assign(mkBlock('page'), { pageId });
  if (typeof afterIdx === 'number') { par.blocks.splice(afterIdx + 1, 0, link); return; }
  const last = par.blocks[par.blocks.length - 1];
  if (last && last.type === 'text' && !stripHtml(last.html)) par.blocks.splice(par.blocks.length - 1, 0, link);
  else par.blocks.push(link);
}
function removeLinkBlocks(parentId, pageId) {
  if (!parentId || !S.pages[parentId]) return;
  const par = P(parentId);
  par.blocks = par.blocks.filter((b) => !(b.type === 'page' && b.pageId === pageId));
  if (!par.blocks.length) par.blocks.push(mkBlock());
}

function createPage(parentId, opts = {}) {
  snapshot();
  const id = uid();
  S.pages[id] = { id, title: opts.title || '', icon: opts.icon || '', parent: parentId || null, children: [], expanded: false, updated: Date.now(), blocks: [mkBlock('text', '')] };
  if (parentId) {
    const par = P(parentId);
    par.children.push(id);
    par.expanded = true;
    if (opts.addLink !== false) addLinkBlock(parentId, id);
  } else S.root.push(id);
  save(false);
  return id;
}

/* lixeira */
function trashPage(id) {
  const p = P(id);
  if (!p || p.trashed) return;
  snapshot();
  const parent = p.parent;
  const arr = siblings(p);
  const idx = arr.indexOf(id);
  if (idx >= 0) arr.splice(idx, 1);
  p.trashed = Date.now(); p.trashParent = parent; p.trashIdx = idx;
  removeLinkBlocks(parent, id);
  hist = hist.filter((x) => S.pages[x] && !inTrash(S.pages[x])); hi = Math.min(hi, hist.length - 1);
  if (inTrash(P(S.current))) {
    let next = parent && S.pages[parent] && !inTrash(P(parent)) ? parent : S.root[0];
    if (!next) next = createPage(null);
    S.current = next;
    let a = P(next).parent; while (a) { P(a).expanded = true; a = P(a).parent; }
    if (hist[hist.length - 1] !== next) { hist.push(next); hi = hist.length - 1; }
  }
  save(false);
  renderAll();
  toast(`"${p.title || 'Sem título'}" foi para a lixeira`, 'Desfazer', () => { restorePage(id); });
}
function restorePage(id) {
  const p = P(id);
  if (!p || !p.trashed) return;
  snapshot();
  const parent = p.trashParent;
  delete p.trashed; delete p.trashParent;
  const idx = p.trashIdx; delete p.trashIdx;
  if (parent && S.pages[parent] && !inTrash(P(parent))) {
    p.parent = parent;
    const arr = P(parent).children;
    arr.splice(Math.min(typeof idx === 'number' && idx >= 0 ? idx : arr.length, arr.length), 0, id);
    P(parent).expanded = true;
    addLinkBlock(parent, id);
  } else { p.parent = null; S.root.push(id); }
  save(false);
  renderAll();
  renderTrash();
}
function purgePage(id) {
  const ids = collect(id);
  ids.forEach((x) => { delete S.pages[x]; if (S.versions) delete S.versions[x]; });
  hist = hist.filter((x) => S.pages[x]); hi = Math.min(hi, hist.length - 1);
  save(false);
}
function trashedTop() { return Object.values(S.pages).filter((p) => p.trashed).sort((a, b) => b.trashed - a.trashed); }

function duplicatePage(id, newParent, isTop = true) {
  if (isTop) snapshot();
  const src = P(id);
  const nid = uid();
  const map = {};
  const copy = JSON.parse(JSON.stringify(src));
  delete copy.trashed; delete copy.trashParent; delete copy.trashIdx;
  Object.assign(copy, { id: nid, parent: newParent, children: [], fav: false, updated: Date.now(), title: isTop ? (src.title || 'Sem título') + ' (cópia)' : src.title });
  S.pages[nid] = copy;
  copy.blocks = copy.blocks.map((b) => ({ ...b, id: uid() }));
  if (newParent) P(newParent).children.push(nid);
  else S.root.splice(S.root.indexOf(id) + 1, 0, nid);
  src.children.forEach((c) => { map[c] = duplicatePage(c, nid, false); });
  copy.blocks.forEach((b) => { if (b.type === 'page' && map[b.pageId]) b.pageId = map[b.pageId]; });
  if (isTop && newParent) {
    if (newParent === src.parent) { // logo após o original
      const arr = P(newParent).children;
      arr.splice(arr.indexOf(nid), 1);
      arr.splice(arr.indexOf(id) + 1, 0, nid);
    }
    addLinkBlock(newParent, nid);
  }
  return nid;
}

/* Mantém a ordem das subpáginas igual na barra lateral e dentro da página */
function syncBlocksFromChildren(pid) {
  const par = S.pages[pid]; if (!par) return;
  const slots = [], blks = [];
  par.blocks.forEach((b, i) => { if (b.type === 'page' && par.children.includes(b.pageId)) { slots.push(i); blks.push(b); } });
  const sorted = blks.slice().sort((a, b) => par.children.indexOf(a.pageId) - par.children.indexOf(b.pageId));
  slots.forEach((i, k) => { par.blocks[i] = sorted[k]; });
}
function syncChildrenFromBlocks(pid) {
  const par = S.pages[pid]; if (!par) return;
  const order = [];
  par.blocks.forEach((b) => { if (b.type === 'page' && par.children.includes(b.pageId) && !order.includes(b.pageId)) order.push(b.pageId); });
  if (order.length < 2) return;
  const rest = par.children.filter((c) => !order.includes(c));
  par.children = order.concat(rest);
}
function movePage(id, targetId, where) {
  snapshot();
  const p = P(id);
  if (where !== 'root') {
    if (id === targetId || isDescendant(targetId, id)) return;
  }
  const oldParent = p.parent;
  const from = siblings(p);
  from.splice(from.indexOf(id), 1);
  if (where === 'root') {
    p.parent = null; S.root.push(id);
  } else if (where === 'inside') {
    const t = P(targetId);
    p.parent = targetId; t.children.push(id); t.expanded = true;
  } else {
    const t = P(targetId);
    p.parent = t.parent;
    const to = siblings(t);
    to.splice(to.indexOf(targetId) + (where === 'after' ? 1 : 0), 0, id);
  }
  if (oldParent !== p.parent) {
    removeLinkBlocks(oldParent, id);
    if (p.parent) addLinkBlock(p.parent, id);
  }
  if (p.parent) syncBlocksFromChildren(p.parent);
  save(false);
  renderAll();
}

/* ---------- Navegação ---------- */
function go(id, push = true, focusTitle = false) {
  if (!S.pages[id]) return;
  if (S.current !== id) captureVersion(S.current);
  S.current = id;
  let a = P(id).parent;
  while (a) { P(a).expanded = true; a = P(a).parent; }
  if (push) { hist = hist.slice(0, hi + 1); if (hist[hist.length - 1] !== id) hist.push(id); hi = hist.length - 1; }
  if (isMobile()) mOpen = false;
  renderAll();
  $('#scroll').scrollTop = 0;
  if (focusTitle) { const t = $('.title'); if (t) t.focus(); }
  save(false);
}
let tabs = [], curTab = 0;
function syncTab() { if (tabs[curTab]) { tabs[curTab].hist = hist; tabs[curTab].hi = hi; } }
function loadTab(n) { curTab = n; hist = tabs[n].hist; hi = tabs[n].hi; S.current = hist[hi]; renderAll(); $('#scroll').scrollTop = 0; save(false); }
function switchTab(n) { if (n === curTab || !tabs[n]) return; syncTab(); loadTab(n); }
function openInNewTab(id) { syncTab(); tabs.splice(curTab + 1, 0, { hist: [id], hi: 0 }); loadTab(curTab + 1); }
function newTab() { openInNewTab(S.current); openSearch(); }
function closeTab(n) {
  if (tabs.length <= 1) return;
  syncTab(); tabs.splice(n, 1);
  if (n < curTab) { curTab--; syncTab(); renderTabs(); return; }
  loadTab(Math.min(n === curTab ? n : curTab, tabs.length - 1));
}
function renderTabs() {
  if (!S || !tabs.length) return;
  syncTab();
  tabs.forEach((t, i) => {
    if (i === curTab) return;
    t.hist = t.hist.filter((x) => S.pages[x] && !inTrash(S.pages[x]));
    if (!t.hist.length) t.hist = [S.root[0] || S.current];
    t.hi = Math.max(0, Math.min(t.hi, t.hist.length - 1));
  });
  S.tabs = tabs.map((t) => ({ hist: t.hist, hi: t.hi })); S.tab = curTab;
  const bar = $('#tabs'); bar.innerHTML = '';
  tabs.forEach((t, i) => {
    const p = S.pages[t.hist[t.hi]];
    const el = document.createElement('div');
    el.className = 'tab' + (i === curTab ? ' active' : '');
    el.title = p ? (p.title || 'Sem título') : '';
    el.innerHTML = `<span class="ti">${iconHtml(p && p.icon)}</span><span class="tt">${esc(p && p.title ? p.title : 'Sem título')}</span>` + (tabs.length > 1 ? `<span class="tx" title="Fechar aba">${ICO.close}</span>` : '');
    el.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('click', (e) => { if (e.target.closest('.tx')) closeTab(i); else switchTab(i); });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeTab(i); } });
    bar.appendChild(el);
  });
  const add = document.createElement('button');
  add.className = 'tabadd'; add.title = 'Nova aba (Ctrl+T)'; add.innerHTML = ICO.plus;
  add.addEventListener('click', newTab);
  bar.appendChild(add);
}
function back() { if (hi > 0) { hi--; go(hist[hi], false); } }
function fwd() { if (hi < hist.length - 1) { hi++; go(hist[hi], false); } }

/* ---------- Render geral ---------- */
function applySidebar() {
  const sb = $('#sidebar');
  if (isMobile()) {
    sb.style.width = sb.style.minWidth = sb.style.marginLeft = '';
    sb.classList.toggle('m-open', mOpen);
    $('#sbBackdrop').classList.toggle('show', mOpen);
    $('#btnExpand').style.display = 'flex'; $('#btnExpand').innerHTML = ICO.menu;
    return;
  }
  sb.classList.remove('m-open'); $('#sbBackdrop').classList.remove('show');
  $('#btnExpand').innerHTML = ICO.side;
  const w = S.sbw || 260;
  sb.style.width = sb.style.minWidth = w + 'px';
  sb.style.marginLeft = S.sidebar ? '0' : -w + 'px';
  $('#btnExpand').style.display = S.sidebar ? 'none' : 'flex';
}
function renderAll() {
  document.documentElement.dataset.theme = S.theme;
  if (window.Android && window.Android.setDark) window.Android.setDark(isDarkTheme());
  applySidebar();
  renderSidebar();
  renderBreadcrumb();
  renderPage();
  renderMeta();
  renderTabs();
  if ($('#findbar').classList.contains('show') && find.page !== S.current) { find.page = S.current; setTimeout(() => findScan($('#findInput').value), 0); }
  $('#btnBack').style.opacity = hi > 0 ? 1 : .35;
  $('#btnFwd').style.opacity = hi < hist.length - 1 ? 1 : .35;
}
function renderMeta() {
  const p = P(S.current);
  if (!p) return;
  const d = new Date(p.updated || Date.now());
  const words = p.blocks.reduce((a, b) => a + (blockText(b).trim().match(/\S+/g) || []).length, 0) + ((p.title || '').trim().match(/\S+/g) || []).length;
  $('#editedAt').textContent = words + (words === 1 ? ' palavra · ' : ' palavras · ') + 'Editado ' + d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const f = $('#btnFav'); f.textContent = p.fav ? '★' : '☆'; f.classList.toggle('on', !!p.fav); f.title = p.fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
}

/* ---------- Sidebar ---------- */
function renderSidebar() {
  const sc = $('#treeScroll');
  const scroll = sc.scrollTop;
  const tree = $('#tree');
  tree.innerHTML = '';
  S.root.forEach((id) => tree.appendChild(treeNode(id, 0, false)));
  if (!S.root.length) tree.innerHTML = '<div class="empty-hint" style="padding-left:12px">Nenhuma página</div>';
  const favs = Object.values(S.pages).filter((p) => p.fav && !inTrash(p));
  $('#favSection').style.display = favs.length ? 'block' : 'none';
  const ft = $('#favTree');
  ft.innerHTML = '';
  favs.forEach((p) => ft.appendChild(treeNode(p.id, 0, true)));
  sc.scrollTop = scroll;
}

function treeNode(id, depth, flat) {
  const p = P(id);
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'row' + (S.current === id ? ' active' : '');
  row.style.paddingLeft = 4 + depth * 14 + 'px';
  row.dataset.id = id;
  const hasKids = p.children.length > 0;
  row.innerHTML =
    `<span class="arrow ${flat || !hasKids ? 'empty' : ''} ${p.expanded && hasKids ? 'open' : ''}">${CHEV}</span>` +
    `<span class="picon">${iconHtml(p.icon)}</span>` +
    `<span class="ptitle ${p.title ? '' : 'untitled'}">${esc(p.title || 'Sem título')}</span>` +
    `<span class="acts"><button data-a="menu" title="Mais opções">⋯</button>${flat ? '' : '<button data-a="add" title="Adicionar subpágina">+</button>'}</span>`;
  row.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (!flat && e.target.closest('.arrow')) { p.expanded = !p.expanded; save(false); renderSidebar(); return; }
    if (a && a.dataset.a === 'add') { e.stopPropagation(); const nid = createPage(id); go(nid, true, true); return; }
    if (a && a.dataset.a === 'menu') { e.stopPropagation(); const r = a.getBoundingClientRect(); openMenu(r.left, r.bottom + 4, pageItems(id)); return; }
    if (e.ctrlKey || e.metaKey) { openInNewTab(id); return; }
    go(id);
  });
  row.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); openInNewTab(id); } });
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); openMenu(e.clientX, e.clientY, pageItems(id)); });

  if (!flat) {
    row.draggable = true;
    row.addEventListener('dragstart', (e) => { dragPageId = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
    row.addEventListener('dragend', () => { dragPageId = null; hideDrop(); });
    row.addEventListener('dragover', (e) => {
      if (!dragPageId || dragPageId === id || isDescendant(id, dragPageId)) return;
      e.preventDefault(); e.stopPropagation();
      const z = dropZone(row, e);
      row.classList.toggle('drop-inside', z === 'inside');
      if (z === 'inside') hideDrop(); else showDrop(row, z);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-inside'));
    row.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      row.classList.remove('drop-inside'); hideDrop();
      if (!dragPageId || dragPageId === id || isDescendant(id, dragPageId)) return;
      const pid = dragPageId; dragPageId = null;
      movePage(pid, id, dropZone(row, e));
    });
  }

  wrap.appendChild(row);
  if (!flat && p.expanded) {
    if (hasKids) p.children.forEach((c) => { if (S.pages[c]) wrap.appendChild(treeNode(c, depth + 1, false)); });
    else { const h = document.createElement('div'); h.className = 'empty-hint'; h.style.paddingLeft = 4 + (depth + 1) * 14 + 22 + 'px'; h.textContent = 'Nenhuma página dentro'; wrap.appendChild(h); }
  }
  return wrap;
}
function dropZone(row, e) {
  const r = row.getBoundingClientRect();
  const y = e.clientY - r.top;
  if (y < r.height * 0.28) return 'before';
  if (y > r.height * 0.72) return 'after';
  return 'inside';
}
function showDrop(row, zone) {
  const r = row.getBoundingClientRect();
  const d = $('#dropline');
  d.style.display = 'block';
  d.style.left = r.left + 'px'; d.style.width = r.width + 'px';
  d.style.top = (zone === 'before' ? r.top - 1 : r.bottom - 2) + 'px';
}
function hideDrop() { $('#dropline').style.display = 'none'; }

// soltar na área vazia da árvore move a página para a raiz
$('#tree').addEventListener('dragover', (e) => { if (dragPageId && e.target.id === 'tree') { e.preventDefault(); } });
$('#tree').addEventListener('drop', (e) => {
  if (dragPageId && e.target.id === 'tree') { e.preventDefault(); const pid = dragPageId; dragPageId = null; hideDrop(); movePage(pid, null, 'root'); }
});

/* ações de página (sidebar, topo e blocos) */
function setFont(p, k) { p.font = k; save(); applyPageClasses(); }
function applyPageClasses() {
  const p = P(S.current);
  const pg = $('#page');
  pg.className = (p.font ? 'font-' + p.font + ' ' : '') + (p.small ? 'small ' : '') + (p.full ? 'full' : '');
}
function pageItems(id) {
  const p = P(id);
  const cur = id === S.current;
  const ck = (on, l) => (on ? '✓ ' : '  ') + l;
  const items = [];
  if (cur) {
    items.push({ header: 'Estilo da página' });
    [['', 'Padrão'], ['serif', 'Serif'], ['mono', 'Mono']].forEach(([k, l]) => items.push({ label: ck((p.font || '') === k, l), fn: () => setFont(p, k) }));
    items.push({ label: ck(p.small, 'Texto pequeno'), fn: () => { p.small = !p.small; save(); applyPageClasses(); } });
    items.push({ label: ck(p.full, 'Largura total'), fn: () => { p.full = !p.full; save(); applyPageClasses(); } });
    items.push('-');
  }
  items.push({ label: 'Abrir em nova aba', fn: () => openInNewTab(id) });
  items.push({ label: p.fav ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos', fn: () => { p.fav = !p.fav; save(false); renderSidebar(); renderMeta(); } });
  items.push({ label: '＋ Adicionar subpágina', fn: () => { const n = createPage(id); go(n, true, true); } });
  items.push({ label: '✏️ Renomear', fn: () => go(id, id !== S.current, true) });
  items.push({ label: '⧉ Duplicar', fn: () => { const n = duplicatePage(id, p.parent); save(false); renderAll(); toast('Página duplicada'); } });
  items.push({ label: '↗ Mover para…', fn: () => openPicker('Mover para…', id, (target) => { target ? movePage(id, target, 'inside') : movePage(id, null, 'root'); toast('Página movida'); }) });
  items.push({ label: '🕘 Histórico de versões…', fn: () => versionsDialog(id) });
  items.push({ label: '⬇ Exportar…', fn: () => exportDialog(id) });
  items.push('-');
  items.push({ label: '🗑 Excluir', danger: true, fn: () => trashPage(id) });
  return items;
}

function renderBreadcrumb() {
  renderTabs();
  const bc = $('#breadcrumb');
  bc.innerHTML = '';
  const chain = [];
  let c = P(S.current);
  while (c) { chain.unshift(c); c = c.parent ? P(c.parent) : null; }
  chain.forEach((p, i) => {
    if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '/'; bc.appendChild(s); }
    const el = document.createElement('span');
    el.className = 'crumb' + (i === chain.length - 1 ? ' last' : '');
    el.textContent = iconText(p.icon) + (p.title || 'Sem título');
    el.onclick = () => go(p.id);
    bc.appendChild(el);
  });
}

/* ---------- Página ---------- */
function renderPage() {
  const p = P(S.current);
  applyPageClasses();
  // capa
  const cw = $('#coverWrap');
  cw.innerHTML = '';
  const coverImg = typeof p.cover === 'string' && p.cover.slice(0, 4) === 'img:' && S.images[p.cover.slice(4)];
  const hasCover = coverImg || (typeof p.cover === 'number' && COVERS[p.cover]);
  $('#scroll').classList.toggle('has-cover', !!hasCover);
  if (hasCover) {
    const cv = document.createElement('div');
    cv.className = 'cover'; if (coverImg) { cv.style.backgroundImage = `url(${coverImg})`; cv.style.backgroundSize = 'cover'; cv.style.backgroundPosition = 'center'; } else cv.style.background = COVERS[p.cover];
    cv.innerHTML = '<div class="cbtns"><button data-c="change">Alterar capa</button><button data-c="remove">Remover</button></div>';
    cv.querySelector('[data-c=change]').onclick = (e) => openCoverPicker(e.currentTarget, p);
    cv.querySelector('[data-c=remove]').onclick = () => { delete p.cover; save(); renderPage(); };
    cw.appendChild(cv);
  }
  const head = $('#pageHead');
  head.innerHTML = '';
  if (p.icon) {
    const ic = document.createElement('div');
    ic.className = 'page-icon'; ic.innerHTML = iconHtml(p.icon);
    ic.onclick = () => openEmoji(ic, p);
    head.appendChild(ic);
  }
  const acts = document.createElement('div');
  acts.className = 'head-actions';
  if (!p.icon) { const b = document.createElement('button'); b.textContent = '😀 Adicionar ícone'; b.onclick = () => openEmoji(b, p); acts.appendChild(b); }
  if (!hasCover) { const b = document.createElement('button'); b.textContent = '🖼 Adicionar capa'; b.onclick = () => { p.cover = Math.floor(Math.random() * COVERS.length); save(); renderPage(); }; acts.appendChild(b); }
  head.appendChild(acts);

  const t = document.createElement('div');
  t.className = 'title';
  t.contentEditable = 'plaintext-only';
  t.dataset.ph = 'Sem título';
  t.spellcheck = false;
  t.textContent = p.title;
  t.addEventListener('input', () => {
    p.title = t.textContent.replace(/\n/g, ' ');
    if (!p.title.trim() && t.innerHTML === '<br>') t.innerHTML = '';
    renderSidebar(); renderBreadcrumb(); save();
  });
  t.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusBlock(p.blocks[0].id, 'start'); }
  });
  t.addEventListener('beforeinput', (e) => { if (e.inputType === 'insertParagraph') { e.preventDefault(); focusBlock(p.blocks[0].id, 'start'); } });
  t.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\n/g, ' ')); });
  head.appendChild(t);
  if (!p.blocks.length) p.blocks.push(mkBlock());
  renderBlocks();
  renderBacklinks();
  if (!p.title && !p.blocks.some((b) => stripHtml(b.html) || b.type === 'page' || b.type === 'image' || b.type === 'video' || b.type === 'embed' || b.type === 'table')) setTimeout(() => t.focus(), 0);
}

function renderBlocks(focusId, pos) {
  if (msMode) { msMode = false; document.documentElement.classList.remove('ms'); }
  const p = P(S.current);
  const box = $('#blocks');
  box.innerHTML = '';
  let num = 0, hideBelow = null;
  const only = p.blocks.length === 1;
  p.blocks.forEach((b, i) => {
    const ind = b.indent || 0;
    if (hideBelow !== null) { if (ind > hideBelow) return; hideBelow = null; }
    if (b.type === 'numbered') num = (i > 0 && p.blocks[i - 1].type === 'numbered' && (p.blocks[i - 1].indent || 0) === ind) ? num + 1 : 1;
    box.appendChild(blockEl(b, i, num, only));
    if (b.type === 'toggle' && !b.open) hideBelow = ind;
  });
  if (focusId) focusBlock(focusId, pos);
}

const PLACEHOLDERS = { text: "Digite '/' para ver os comandos", h1: 'Título 1', h2: 'Título 2', h3: 'Título 3', bullet: 'Item da lista', numbered: 'Item da lista', todo: 'Tarefa', toggle: 'Alternar', quote: 'Citação', callout: 'Escreva algo…', code: 'Código' };

function blockEl(b, i, num, only) {
  const d = document.createElement('div');
  d.className = `block t-${b.type}${b.type === 'todo' && b.checked ? ' done' : ''}${only ? ' only' : ''}`;
  d.dataset.id = b.id;
  d.style.marginLeft = (b.indent || 0) * 26 + 'px';

  const ctl = document.createElement('div');
  ctl.className = 'bctl';
  const plus = document.createElement('span'); plus.textContent = '+'; plus.title = 'Adicionar bloco abaixo';
  plus.onclick = () => openInsertMenu(b);
  const drag = document.createElement('span'); drag.className = 'drag'; drag.textContent = '⋮⋮'; drag.title = 'Arraste para mover · clique para opções'; drag.draggable = true;
  drag.onclick = (e) => blockMenu(b, e.clientX, e.clientY);
  drag.addEventListener('dragstart', (e) => { dragBlockId = b.id; e.dataTransfer.setDragImage(d, 0, 0); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'b'); setTimeout(() => d.classList.add('dragging'), 0); });
  drag.addEventListener('dragend', () => { dragBlockId = null; d.classList.remove('dragging'); hideDrop(); });
  ctl.append(plus, drag);
  d.appendChild(ctl);

  d.addEventListener('dragover', (e) => {
    if (!dragBlockId || dragBlockId === b.id) return;
    e.preventDefault();
    const r = d.getBoundingClientRect();
    showDrop(d, e.clientY - r.top < r.height / 2 ? 'before' : 'after');
  });
  d.addEventListener('drop', (e) => {
    if (!dragBlockId || dragBlockId === b.id) return;
    e.preventDefault();
    const r = d.getBoundingClientRect();
    const after = e.clientY - r.top >= r.height / 2;
    const pg = P(S.current);
    const from = pg.blocks.findIndex((x) => x.id === dragBlockId);
    const [mv] = pg.blocks.splice(from, 1);
    const to = pg.blocks.findIndex((x) => x.id === b.id) + (after ? 1 : 0);
    pg.blocks.splice(to, 0, mv);
    syncChildrenFromBlocks(S.current);
    hideDrop(); dragBlockId = null; save(); renderBlocks(); renderSidebar();
  });

  if (b.type === 'divider') {
    const r = document.createElement('div'); r.className = 'rule'; r.tabIndex = 0; r.innerHTML = '<hr>';
    r.addEventListener('keydown', (e) => nonEditableKey(e, b));
    d.appendChild(r);
    return d;
  }
  if (b.type === 'video') {
    if (b.wrap && (b.vid || b.file)) { d.classList.add('fl-' + b.wrap); d.style.width = (b.w || 40) + '%'; }
    d.appendChild(videoEl(b)); return d;
  }
  if (b.type === 'embed') { d.appendChild(embedEl(b)); return d; }
  if (b.type === 'table') { d.appendChild(tableEl(b)); return d; }
  if (b.type === 'image') {
    if (b.wrap) { d.classList.add('fl-' + b.wrap); d.style.width = (b.w || 40) + '%'; }
    d.appendChild(imageEl(b));
    return d;
  }
  if (b.type === 'page') {
    const target = S.pages[b.pageId];
    const l = document.createElement('div'); l.className = 'plink'; l.tabIndex = 0;
    l.innerHTML = target && !inTrash(target)
      ? `<span class="pi">${iconHtml(target.icon)}</span><span class="ptxt">${esc(target.title || 'Sem título')}</span><span class="pdel" title="Mover para a lixeira">🗑</span>`
      : `<span class="pi">📄</span><span class="ptxt missing">Página não encontrada</span>`;
    const ok = target && !inTrash(target);
    l.addEventListener('click', (e) => {
      if (!ok) return;
      if (e.target.classList.contains('pdel')) { e.stopPropagation(); trashPage(b.pageId); return; }
      go(b.pageId);
    });
    l.addEventListener('keydown', (e) => { if (e.key === 'Enter' && ok) { e.preventDefault(); go(b.pageId); } else nonEditableKey(e, b); });
    d.appendChild(l);
    return d;
  }

  // marcador
  const mark = document.createElement('div'); mark.className = 'mark';
  if (b.type === 'numbered') mark.textContent = num + '.';
  if (b.type === 'callout') mark.textContent = '💡';
  if (b.type === 'todo') {
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!b.checked;
    cb.onchange = () => { b.checked = cb.checked; d.classList.toggle('done', b.checked); save(); };
    mark.appendChild(cb);
  }
  if (b.type === 'toggle') {
    const ar = document.createElement('div'); ar.className = 'tarrow' + (b.open ? ' open' : ''); ar.innerHTML = CHEV;
    ar.onclick = () => { b.open = !b.open; renderBlocks(); save(); };
    mark.appendChild(ar);
  }
  if (['bullet', 'numbered', 'todo', 'callout', 'toggle'].includes(b.type)) d.appendChild(mark);

  const c = document.createElement('div');
  c.className = 'content';
  c.contentEditable = b.type === 'code' ? 'plaintext-only' : 'true';
  c.spellcheck = false;
  c.dataset.ph = PLACEHOLDERS[b.type] || '';
  c.innerHTML = b.html || '';
  refreshMentions(c);
  c.addEventListener('click', mentionClick);
  c.addEventListener('input', () => onInput(b, c));
  c.addEventListener('keydown', (e) => onKey(e, b, c));
  c.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertParagraph') {
      if (slash.open) { e.preventDefault(); applySlash(slash.items[slash.idx]); return; }
      doEnter(b, c, e);
    } else if (e.inputType === 'deleteContentBackward') doBackspace(b, c, e);
  });
  c.addEventListener('paste', (e) => onPaste(e, b, c));
  d.appendChild(c);
  return d;
}


/* ---------- Tabelas ---------- */
const blockText = (b) => b.type === 'table' ? (b.rows || []).map((r) => r.map(stripHtml).join('  ')).join('  ') : stripHtml(b.html);
function tableEl(b) {
  if (!b.rows || !b.rows.length) b.rows = [['']];
  const nr = b.rows.length, nc = Math.max(1, ...b.rows.map((r) => r.length));
  b.rows.forEach((r) => { while (r.length < nc) r.push(''); });
  const w = document.createElement('div'); w.className = 'twrap';
  const sc = document.createElement('div'); sc.className = 'tscroll';
  const t = document.createElement('table'); t.className = 'tbl' + (b.hdr ? ' hdr' : '');
  t.style.minWidth = nc * 110 + 'px';
  b.rows.forEach((row, ri) => {
    const tr = document.createElement('tr');
    row.forEach((html, ci) => {
      const td = document.createElement('td');
      const c = document.createElement('div'); c.className = 'content tcell'; c.contentEditable = 'true'; c.spellcheck = false;
      c.innerHTML = html || '';
      refreshMentions(c);
      c.addEventListener('click', mentionClick);
      c.addEventListener('input', () => {
        if (c.innerHTML === '<br>' || (c.textContent === '' && !c.querySelector('*'))) c.innerHTML = '';
        b.rows[ri][ci] = c.innerHTML; save();
      });
      c.addEventListener('keydown', (e) => tableKey(e, b, ri, ci, c));
      c.addEventListener('paste', (e) => tablePaste(e, b, ri, ci));
      c.addEventListener('contextmenu', (e) => { e.preventDefault(); tableMenu(b, ri, ci, e.clientX, e.clientY); });
      td.appendChild(c); tr.appendChild(td);
    });
    t.appendChild(tr);
  });
  sc.appendChild(t); w.appendChild(sc);
  const ac = document.createElement('button'); ac.className = 'tadd tadd-c'; ac.title = 'Adicionar coluna'; ac.innerHTML = ICO.plus;
  ac.addEventListener('mousedown', (e) => { e.preventDefault(); tableOp(b, 'addCol', nr ? 0 : 0, nc - 1); });
  const ar = document.createElement('button'); ar.className = 'tadd tadd-r'; ar.title = 'Adicionar linha'; ar.innerHTML = ICO.plus;
  ar.addEventListener('mousedown', (e) => { e.preventDefault(); tableOp(b, 'addRow', nr - 1, 0); });
  const mn = document.createElement('button'); mn.className = 'tmenu'; mn.title = 'Opções da tabela'; mn.textContent = '⋯';
  mn.addEventListener('mousedown', (e) => { e.preventDefault(); const r = mn.getBoundingClientRect(); tableMenu(b, 0, 0, r.left, r.bottom + 4); });
  w.appendChild(ac); w.appendChild(ar); w.appendChild(mn);
  return w;
}
function focusCell(b, r, c, pos) {
  const el = $(`.block[data-id="${b.id}"] tr:nth-child(${r + 1}) td:nth-child(${c + 1}) .content`);
  if (!el) return;
  el.focus();
  if (pos === 'start') setCaret(el, 0); else setCaret(el, el.textContent.length);
}
function tableOp(b, op, r, c) {
  snapshot();
  const nc = b.rows[0].length;
  if (op === 'addRow') { b.rows.splice(r + 1, 0, new Array(nc).fill('')); r++; }
  else if (op === 'addRowAbove') { b.rows.splice(r, 0, new Array(nc).fill('')); op = 'addRow'; }
  else if (op === 'addCol') { b.rows.forEach((x) => x.splice(c + 1, 0, '')); c++; }
  else if (op === 'addColLeft') { b.rows.forEach((x) => x.splice(c, 0, '')); op = 'addCol'; }
  else if (op === 'delRow') { if (b.rows.length <= 1) { const f = removeBlock(b); renderBlocks(f.id, 'start'); return; } b.rows.splice(r, 1); r = Math.min(r, b.rows.length - 1); }
  else if (op === 'delCol') { if (nc <= 1) { const f = removeBlock(b); renderBlocks(f.id, 'start'); return; } b.rows.forEach((x) => x.splice(c, 1)); c = Math.min(c, nc - 2); }
  else if (op === 'hdr') b.hdr = !b.hdr;
  renderBlocks(); save();
  focusCell(b, Math.max(0, Math.min(r, b.rows.length - 1)), Math.max(0, Math.min(c, b.rows[0].length - 1)), 'start');
}
function tableMenu(b, r, c, x, y) {
  openMenu(x, y, [
    { label: 'Inserir linha acima', fn: () => tableOp(b, 'addRowAbove', r, c) },
    { label: 'Inserir linha abaixo', fn: () => tableOp(b, 'addRow', r, c) },
    { label: 'Inserir coluna à esquerda', fn: () => tableOp(b, 'addColLeft', r, c) },
    { label: 'Inserir coluna à direita', fn: () => tableOp(b, 'addCol', r, c) },
    '-',
    { label: (b.hdr ? '✓ ' : '  ') + 'Primeira linha como cabeçalho', fn: () => tableOp(b, 'hdr', r, c) },
    '-',
    { label: 'Excluir linha', fn: () => tableOp(b, 'delRow', r, c) },
    { label: 'Excluir coluna', fn: () => tableOp(b, 'delCol', r, c) },
    { label: '🗑 Excluir tabela', danger: true, fn: () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); } }
  ]);
}
function tableKey(e, b, r, c, el) {
  const nr = b.rows.length, nc = b.rows[0].length;
  const pg = P(S.current), i = blockIndex(b.id);
  if (e.key === 'Tab') {
    e.preventDefault();
    let nr2 = r, nc2 = c + (e.shiftKey ? -1 : 1);
    if (nc2 >= nc) { nc2 = 0; nr2++; } else if (nc2 < 0) { nc2 = nc - 1; nr2--; }
    if (nr2 < 0) return;
    if (nr2 >= nr) { tableOp(b, 'addRow', nr - 1, 0); focusCell(b, nr, 0, 'start'); return; }
    focusCell(b, nr2, nc2, 'start');
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (r + 1 >= nr) { tableOp(b, 'addRow', r, c); focusCell(b, r + 1, c, 'start'); } else focusCell(b, r + 1, c, 'start');
  } else if (e.key === 'ArrowDown' && !e.shiftKey && edgeLine(el, 'bottom')) {
    e.preventDefault();
    if (r + 1 < nr) focusCell(b, r + 1, c, 'start');
    else { const j = visIdx(i, 1); if (j >= 0) focusBlock(pg.blocks[j].id, 'start'); }
  } else if (e.key === 'ArrowUp' && !e.shiftKey && edgeLine(el, 'top')) {
    e.preventDefault();
    if (r > 0) focusCell(b, r - 1, c, 'end');
    else { const j = visIdx(i, -1); if (j >= 0) focusBlock(pg.blocks[j].id, 'end'); }
  } else if (e.key === 'Escape') { el.blur(); }
}
function tablePaste(e, b, r, c) {
  e.preventDefault();
  const text = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
  if (!text) return;
  if (text.indexOf('\t') < 0 && text.indexOf('\n') < 0) { document.execCommand('insertText', false, text); return; }
  snapshot();
  const lines = text.replace(/\n$/, '').split('\n');
  lines.forEach((ln, li) => {
    const rr = r + li;
    while (b.rows.length <= rr) b.rows.push(new Array(b.rows[0].length).fill(''));
    ln.split('\t').forEach((v, vi) => {
      const cc = c + vi;
      if (cc >= b.rows[0].length) b.rows.forEach((x) => x.push(''));
      b.rows[rr][cc] = esc(v);
    });
  });
  renderBlocks(); save();
}

/* ---------- Vídeo do YouTube ---------- */
function ytParse(u) {
  u = String(u || '').trim();
  const m = u.match(/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/i);
  if (!m) return null;
  let t = 0;
  const a = u.match(/[?&#](?:t|start)=(\d+)s?(?:&|#|$)/);
  if (a) t = +a[1];
  else { const h = u.match(/[?&#]t=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); if (h && (h[1] || h[2] || h[3])) t = (+h[1] || 0) * 3600 + (+h[2] || 0) * 60 + (+h[3] || 0); }
  return { id: m[1], start: t };
}
const ytWatch = (b) => 'https://www.youtube.com/watch?v=' + b.vid + (b.start ? '&t=' + b.start + 's' : '');
let VIDEO_BASE = '';
const videoUrl = (n) => VIDEO_BASE + encodeURIComponent(n);
const VIDEO_EXT = /\.(mp4|m4v|webm|ogv|ogg|mov|mkv)$/i;
const isVideoFile = (f) => (f.type && f.type.startsWith('video/')) || VIDEO_EXT.test(f.name || '');
function pickVideoFile(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,.mkv,.mov'; inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); }; inp.click();
}
/* Copia o arquivo para "User data/videos" e coloca no bloco b (ou cria bloco novo depois de afterId) */
async function importVideo(f, b, afterId) {
  const web = !f.path && window.api.videoImportFile;
  const src = f.path;
  if (!src && !web) { toast('Não foi possível ler o caminho do arquivo'); return; }
  toast('Importando vídeo para a pasta de dados…');
  const r = web ? await window.api.videoImportFile(f) : await window.api.videoImport(src);
  if (!r || r.error) { toast((r && r.error) || 'Falha ao importar'); return; }
  snapshot();
  const pg = P(S.current);
  if (!b) {
    b = mkBlock('video'); const i = afterId ? blockIndex(afterId) : pg.blocks.length - 1;
    const prev = pg.blocks[i];
    if (prev && prev.type === 'text' && !stripHtml(prev.html).trim()) pg.blocks.splice(i, 1, b); else pg.blocks.splice(i + 1, 0, b);
  }
  b.type = 'video'; b.html = ''; delete b.vid; b.file = r.name; b.w = b.w || 100;
  if (!pg.blocks.some((x, k) => k > blockIndex(b.id) && x.type === 'text')) pg.blocks.push(mkBlock());
  renderBlocks(b.id); save(); toast('Vídeo importado');
}
function videoEl(b) {
  const w = document.createElement('div');
  w.className = 'vwrap' + (b.wrap ? ' wr-' + b.wrap : b.align === 'center' ? ' al-c' : b.align === 'right' ? ' al-r' : ''); w.tabIndex = 0;
  if (!b.vid && !b.file) {
    w.classList.add('vempty');
    w.innerHTML = '<span class="vic">▶</span><input class="vurl" placeholder="Cole o link do YouTube e tecle Enter" spellcheck="false"><button class="vok">Inserir</button><button class="vfile" title="Importar um arquivo de vídeo do computador">📁 Arquivo…</button><button class="vno" title="Cancelar">✕</button>';
    const inp = $('.vurl', w);
    const ok = () => {
      const y = ytParse(inp.value);
      if (!y) { toast('Não parece um link do YouTube'); return; }
      snapshot(); b.vid = y.id; b.start = y.start; renderBlocks(b.id); save();
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') { e.preventDefault(); $('.vno', w).click(); } });
    inp.addEventListener('paste', () => setTimeout(() => { if (ytParse(inp.value)) ok(); }, 0));
    $('.vok', w).onclick = ok;
    $('.vfile', w).onclick = () => pickVideoFile((f) => importVideo(f, b));
    $('.vno', w).onclick = () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); };
    return w;
  }
  const box = document.createElement('div');
  box.className = 'vbox' + (b.file ? ' vlocal' : ''); if (b.w && !b.wrap) box.style.width = b.w + '%';
  const card = document.createElement('div'); card.className = 'vcard';
  card.innerHTML = '<img alt="" src="https://i.ytimg.com/vi/' + b.vid + '/hqdefault.jpg"><div class="vplay"><svg width="64" height="46" viewBox="0 0 64 46"><rect width="64" height="46" rx="12" fill="#f00"/><path d="M26 13l18 10-18 10z" fill="#fff"/></svg></div><div class="vhint">Clique para reproduzir (precisa de internet)</div>';
  $('img', card).addEventListener('error', (e) => e.target.remove());
  const play = () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.vid + '?autoplay=1&rel=0&playsinline=1' + (b.start ? '&start=' + b.start : '');
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.title = 'Vídeo do YouTube';
    card.replaceWith(f);
  };
  card.addEventListener('click', play);
  card.addEventListener('pointerdown', (e) => startMove(e, b, w));
  if (b.file) {
    const v = document.createElement('video'); v.controls = true; v.preload = 'metadata'; v.src = videoUrl(b.file);
    v.addEventListener('error', () => { const m = document.createElement('div'); m.className = 'verr'; m.textContent = 'Não foi possível reproduzir este vídeo (formato ou arquivo ausente em User data/videos).'; v.replaceWith(m); });
    box.appendChild(v);
  } else box.appendChild(card);
  ['l', 'r'].forEach((side) => { const h = document.createElement('div'); h.className = 'rh ' + side; h.title = 'Arraste para redimensionar'; h.addEventListener('pointerdown', (e) => startResize(e, b, w, box, side)); box.appendChild(h); });
  const tb = document.createElement('div'); tb.className = 'imgtb';
  const btn = (label, title, fn) => { const x = document.createElement('span'); x.innerHTML = label; x.title = title; x.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); tb.appendChild(x); };
  const mv = document.createElement('span'); mv.title = 'Arraste para mover o vídeo'; mv.style.cursor = 'grab'; mv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>';
  mv.addEventListener('pointerdown', (e) => { e.stopPropagation(); startMove(e, b, w); }); tb.appendChild(mv);
  const sep = () => { const x = document.createElement('i'); tb.appendChild(x); };
  sep();
  [25, 50, 75, 100].forEach((n) => btn(n + '%', 'Largura ' + n + '%', () => { b.w = n; renderBlocks(b.id); save(); }));
  sep();
  btn(ICO.alL, 'Alinhar à esquerda', () => { setImgPos(b, 'l'); renderBlocks(b.id); save(); });
  btn(ICO.alC, 'Centralizar', () => { setImgPos(b, 'c'); renderBlocks(b.id); save(); });
  btn(ICO.alR, 'Alinhar à direita', () => { setImgPos(b, 'r'); renderBlocks(b.id); save(); });
  sep();
  btn(ICO.wrL, 'Vídeo à esquerda, texto ao lado', () => { setImgPos(b, 'wl'); renderBlocks(b.id); save(); });
  btn(ICO.wrR, 'Vídeo à direita, texto ao lado', () => { setImgPos(b, 'wr'); renderBlocks(b.id); save(); });
  sep();
  if (b.file) {
    btn('Mostrar na pasta', 'Mostrar o arquivo na pasta User data', () => api.videoReveal(b.file));
    btn('Trocar vídeo', 'Escolher outro vídeo', () => { snapshot(); delete b.file; renderBlocks(b.id); save(); });
  } else {
    btn('Abrir no navegador', 'Abrir no navegador padrão', () => { if (window.api.openExternal) window.api.openExternal(ytWatch(b)); });
    btn('Trocar link', 'Trocar o link do vídeo', () => { snapshot(); delete b.vid; renderBlocks(b.id); save(); const i = $(`.block[data-id="${b.id}"] .vurl`); if (i) i.focus(); });
  }
  btn(ICO.trash, 'Excluir vídeo', () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); });
  box.appendChild(tb);
  tbAuto(box, tb, w);
  w.appendChild(box);
  w.addEventListener('keydown', (e) => { if (e.target === w) nonEditableKey(e, b); });
  return w;
}

/* ---------- Imagens: exibir, redimensionar, mover, texto ao lado ---------- */
function setImgPos(b, m) {
  delete b.align; delete b.wrap;
  if (m === 'c') b.align = 'center';
  else if (m === 'r') b.align = 'right';
  else if (m === 'wl' || m === 'wr') { b.wrap = m === 'wl' ? 'l' : 'r'; if (!b.w || b.w > 70) b.w = 40; }
}
function imageEl(b) {
  const w = document.createElement('div');
  w.className = 'imgwrap' + (b.wrap ? ' wr-' + b.wrap : b.align === 'center' ? ' al-c' : b.align === 'right' ? ' al-r' : '');
  w.tabIndex = 0;
  const box = document.createElement('div');
  box.className = 'imgbox' + (b.w ? ' fixed' : '');
  if (b.w && !b.wrap) box.style.width = b.w + '%';
  const im = document.createElement('img'); im.src = imgSrc(b); im.draggable = false;
  im.title = 'Arraste para mover a imagem';
  im.addEventListener('pointerdown', (e) => startMove(e, b, w));
  box.appendChild(im);
  ['l', 'r'].forEach((side) => {
    const h = document.createElement('div'); h.className = 'rh ' + side; h.title = 'Arraste para redimensionar';
    h.addEventListener('pointerdown', (e) => startResize(e, b, w, box, side));
    box.appendChild(h);
  });
  const tb = document.createElement('div'); tb.className = 'imgtb';
  const btn = (label, title, fn) => { const x = document.createElement('span'); x.innerHTML = label; x.title = title; x.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); tb.appendChild(x); };
  const sep = () => { const x = document.createElement('i'); tb.appendChild(x); };
  [25, 50, 75, 100].forEach((n) => btn(n + '%', 'Largura ' + n + '%', () => { b.w = n; renderBlocks(b.id); save(); }));
  btn('Original', 'Tamanho original', () => { delete b.w; if (b.wrap) setImgPos(b, 'l'); renderBlocks(b.id); save(); });
  sep();
  btn(ICO.alL, 'Alinhar à esquerda', () => { setImgPos(b, 'l'); renderBlocks(b.id); save(); });
  btn(ICO.alC, 'Centralizar', () => { setImgPos(b, 'c'); renderBlocks(b.id); save(); });
  btn(ICO.alR, 'Alinhar à direita', () => { setImgPos(b, 'r'); renderBlocks(b.id); save(); });
  sep();
  btn(ICO.wrL, 'Imagem à esquerda, texto ao lado', () => { setImgPos(b, 'wl'); renderBlocks(b.id); save(); });
  btn(ICO.wrR, 'Imagem à direita, texto ao lado', () => { setImgPos(b, 'wr'); renderBlocks(b.id); save(); });
  sep();
  btn(ICO.trash, 'Excluir imagem', () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); });
  box.appendChild(tb);
  w.appendChild(box);
  w.addEventListener('keydown', (e) => nonEditableKey(e, b));
  return w;
}
function startMove(e, b, wrap) {
  if (e.button !== 0) return;
  const d = wrap.closest('.block');
  const sx = e.clientX, sy = e.clientY;
  let on = false;
  const mv = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!on) {
      if (Math.hypot(dx, dy) < 8) return;
      on = true; document.body.style.cursor = 'grabbing'; document.body.classList.add('dragging'); d.classList.add('moving');
    }
    d.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const up = (ev) => {
    document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    document.body.style.cursor = ''; document.body.classList.remove('dragging');
    if (!on) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    d.style.transform = ''; d.classList.remove('moving');
    snapshot();
    const pg = P(S.current);
    const pr = $('#blocks').getBoundingClientRect();
    const rel = (ev.clientX - pr.left) / pr.width;
    if (Math.abs(ev.clientX - sx) > 30) {
      if (rel < 0.34) { if (b.wrap !== 'l') setImgPos(b, 'wl'); }
      else if (rel > 0.66) { if (b.wrap !== 'r') setImgPos(b, 'wr'); }
      else setImgPos(b, 'c');
    }
    const tb = el && el.closest ? el.closest('.block') : null;
    if (tb && tb !== d && tb.parentElement && tb.parentElement.id === 'blocks' && Math.abs(ev.clientY - sy) > 12) {
      const r = tb.getBoundingClientRect();
      const after = ev.clientY - r.top >= r.height / 2;
      const from = pg.blocks.findIndex((x) => x.id === b.id);
      pg.blocks.splice(from, 1);
      const to = pg.blocks.findIndex((x) => x.id === tb.dataset.id) + (after ? 1 : 0);
      pg.blocks.splice(to, 0, b);
      syncChildrenFromBlocks(S.current);
    }
    renderBlocks(b.id); save(); renderSidebar();
  };
  document.addEventListener('pointermove', mv);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
function startResize(e, b, wrap, box, side) {
  e.preventDefault(); e.stopPropagation();
  snapshot();
  const fl = !!b.wrap;
  const host = wrap.closest('.block');
  const startX = e.clientX;
  const startW = box.getBoundingClientRect().width;
  const maxW = fl ? $('#blocks').getBoundingClientRect().width : (wrap.getBoundingClientRect().width || startW);
  const factor = !fl && b.align === 'center' ? 2 : 1;
  const sign = side === 'r' ? 1 : -1;
  wrap.focus();
  document.body.style.cursor = 'ew-resize'; document.body.classList.add('dragging');
  const mv = (ev) => {
    const nw = Math.max(48, Math.min(maxW, startW + (ev.clientX - startX) * sign * factor));
    if (fl) host.style.width = nw + 'px';
    else { box.classList.add('fixed'); box.style.width = nw + 'px'; }
  };
  const up = () => {
    document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    document.body.style.cursor = ''; document.body.classList.remove('dragging');
    const cur = fl ? host.getBoundingClientRect().width : box.getBoundingClientRect().width;
    const pct = Math.max(5, Math.min(100, Math.round(cur / maxW * 100)));
    b.w = pct;
    if (fl) host.style.width = pct + '%'; else box.style.width = pct + '%';
    save();
  };
  document.addEventListener('pointermove', mv);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

/* ---------- Edição de blocos ---------- */
const blockById = (id) => P(S.current).blocks.find((b) => b.id === id);
const blockIndex = (id) => P(S.current).blocks.findIndex((b) => b.id === id);
function insertAfter(id, nb) { const bl = P(S.current).blocks; bl.splice(blockIndex(id) + 1, 0, nb); }
function cleanHtml(h) { const d = document.createElement('div'); d.innerHTML = h; return d.textContent === '' && !d.querySelector('img') ? '' : h; }
const stripEico = (h) => h.replace(/<img[^>]*class="eico"[^>]*>/g, (t) => t.replace(/\s+src="[^"]*"/, ''));
function hydrateEmojis(el) { el.querySelectorAll('img.eico').forEach((im) => { const k = im.dataset.k, src = S.images && S.images[k]; if (src) { if (im.getAttribute('src') !== src) im.src = src; } else im.style.display = 'none'; im.draggable = false; }); }
const isVisible = (id) => !!$(`.block[data-id="${id}"]`);
function visIdx(i, dir) { const bl = P(S.current).blocks; for (let j = i + dir; j >= 0 && j < bl.length; j += dir) if (isVisible(bl[j].id)) return j; return -1; }
function reveal(b) {
  const bl = P(S.current).blocks;
  let th = b.indent || 0;
  for (let j = blockIndex(b.id) - 1; j >= 0 && th > 0; j--) {
    const ind = bl[j].indent || 0;
    if (ind < th) { if (bl[j].type === 'toggle') bl[j].open = true; th = ind; }
  }
}

function getCaret(el) {
  const sel = getSelection();
  if (!sel.rangeCount || !el.contains(sel.anchorNode)) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  const pre = document.createRange();
  pre.selectNodeContents(el); pre.setEnd(r.endContainer, r.endOffset);
  return pre.toString().length;
}
function setCaret(el, n) {
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = n, node;
  while ((node = walker.nextNode())) {
    if (left <= node.length) { range.setStart(node, left); range.collapse(true); applyRange(range); return; }
    left -= node.length;
  }
  range.selectNodeContents(el); range.collapse(false); applyRange(range);
}
function applyRange(r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

function focusBlock(id, pos = 'end') {
  const d = $(`.block[data-id="${id}"]`);
  if (!d) return;
  const c = $('.content', d);
  if (!c) { const f = $('.vurl, .rule, .plink, .imgwrap, .vwrap', d); if (f) f.focus(); return; }
  c.focus();
  if (pos === 'start') setCaret(c, 0);
  else if (pos === 'end') setCaret(c, c.textContent.length);
  else setCaret(c, pos);
  c.scrollIntoView({ block: 'nearest' });
}

const MD = [
  [/^#\s$/, 'h1'], [/^##\s$/, 'h2'], [/^###\s$/, 'h3'],
  [/^[-*]\s$/, 'bullet'], [/^1[.)]\s$/, 'numbered'], [/^\[\s?\]\s$/, 'todo'],
  [/^>\s$/, 'toggle'], [/^["”“]\s$/, 'quote'], [/^```$/, 'code']
];

function onInput(b, c) {
  if (c.innerHTML === '<br>' || (c.textContent === '' && !c.querySelector('*'))) c.innerHTML = '';
  if (b.type === 'code') b.html = esc(c.textContent); else b.html = stripEico(c.innerHTML);
  const txt = c.textContent.replace(/ /g, ' ');
  if (b.type === 'text') {
    for (const [re, type] of MD) {
      if (re.test(txt)) { b.type = type; b.html = ''; if (type === 'toggle') b.open = true; renderBlocks(b.id, 'start'); save(); closeSlash(); return; }
    }
    if (txt === '---') { b.type = 'divider'; b.html = ''; const nb = mkBlock(); insertAfter(b.id, nb); renderBlocks(nb.id, 'start'); save(); return; }
  }
  if (!updateMention(b, c)) updateSlash(b, c, txt);
  save();
}

/* imagens */
function loadImage(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let w = img.width, h = img.height;
      if (w > max) { h = Math.round(h * max / w); w = max; }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      const keepAlpha = /png|gif|webp/.test(file.type);
      if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h);
      cb(cv.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = () => toast('Não foi possível abrir essa imagem');
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function setImage(b, src) {
  const pg = P(S.current);
  const key = uid();
  if (!S.images) S.images = {};
  S.images[key] = src;
  b.type = 'image'; b.img = key; delete b.src; b.html = '';
  if (blockIndex(b.id) === pg.blocks.length - 1) pg.blocks.push(mkBlock());
  renderBlocks(); save();
}
let pendingImg = null;
$('#fileInput').addEventListener('change', (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/')); e.target.value = '';
  if (!files.length || !pendingImg) return;
  const b = blockById(pendingImg); pendingImg = null;
  if (!b) return;
  loadImage(files[0], (src) => { setImage(b, src); if (files.length > 1) addImageFiles(files.slice(1), b.id); });
});
const loadImageP = (file) => new Promise((res) => loadImage(file, res));
async function addImageFiles(files, afterId) {
  let after = afterId ? blockById(afterId) : null;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const src = await loadImageP(f);
    const pg = P(S.current);
    const nb = mkBlock();
    if (after) insertAfter(after.id, nb);
    else {
      const last = pg.blocks[pg.blocks.length - 1];
      if (last && last.type === 'text' && !stripHtml(last.html)) pg.blocks.splice(pg.blocks.length - 1, 0, nb); else pg.blocks.push(nb);
    }
    setImage(nb, src);
    after = nb;
  }
}
const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  const vids = [...e.dataTransfer.files].filter(isVideoFile);
  if (vids.length && e.target.closest && e.target.closest('#scroll')) { const bk = e.target.closest('.block'); vids.reduce((p, f) => p.then(() => importVideo(f, null, bk ? bk.dataset.id : null)), Promise.resolve()); return; }
  const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length || !e.target.closest || !e.target.closest('#scroll')) { if (!files.length) toast('Só é possível soltar imagens ou vídeos aqui'); return; }
  const blk = e.target.closest('.block');
  addImageFiles(files, blk ? blk.dataset.id : null);
});

function onPaste(e, b, c) {
  e.preventDefault();
  const text = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '');
  if (!text) {
    const it = [...(e.clipboardData.items || [])].find((x) => x.type.startsWith('image/'));
    if (it) {
      const f = it.getAsFile();
      loadImage(f, (src) => {
        let target = b;
        if (stripHtml(b.html) || b.type !== 'text') { target = mkBlock(); insertAfter(b.id, target); }
        setImage(target, src);
      });
    }
    return;
  }
  if (b.type !== 'code' && /^https?:\/\/\S+$/i.test(text.trim())) { pasteUrl(text.trim(), b, c); return; }
  const lines = text.split('\n');
  if (lines.length === 1 || b.type === 'code') { document.execCommand('insertText', false, text); return; }
  document.execCommand('insertText', false, lines[0]);
  let prev = b;
  const rest = lines.slice(1);
  const tail = splitAtCaret(c, b);
  let last = null;
  rest.forEach((ln) => {
    let type = 'text', html = esc(ln);
    const m = ln.match(/^(#{1,3})\s+(.*)/);
    if (m) { type = 'h' + m[1].length; html = esc(m[2]); }
    else if (/^[-*]\s+/.test(ln)) { type = 'bullet'; html = esc(ln.replace(/^[-*]\s+/, '')); }
    else if (/^\d+[.)]\s+/.test(ln)) { type = 'numbered'; html = esc(ln.replace(/^\d+[.)]\s+/, '')); }
    else if (/^>\s+/.test(ln)) { type = 'quote'; html = esc(ln.replace(/^>\s+/, '')); }
    const nb = mkBlock(type, html);
    nb.indent = b.indent || 0;
    insertAfter(prev.id, nb); prev = nb; last = nb;
  });
  last.html += tail;
  renderBlocks(last.id, 'end');
  save();
}

/* Divide o conteúdo no cursor: mantém o início no bloco e devolve o HTML do final */
function splitAtCaret(c, b) {
  const sel = getSelection();
  if (!sel.rangeCount) return '';
  const r = sel.getRangeAt(0);
  if (!r.collapsed) r.deleteContents();
  const tail = document.createRange();
  tail.setStart(r.endContainer, r.endOffset);
  tail.setEnd(c, c.childNodes.length);
  const frag = tail.extractContents();
  const tmp = document.createElement('div'); tmp.appendChild(frag);
  b.html = b.type === 'code' ? esc(c.textContent) : cleanHtml(stripEico(c.innerHTML));
  return cleanHtml(tmp.innerHTML);
}

function onKey(e, b, c) {
  const pg = P(S.current);
  const i = blockIndex(b.id);

  if (slash.open) {
    if (e.key === 'ArrowDown') { e.preventDefault(); slash.idx = (slash.idx + 1) % slash.items.length; drawSlash(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); slash.idx = (slash.idx - 1 + slash.items.length) % slash.items.length; drawSlash(); return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlash(slash.items[slash.idx]); return; }
    if (e.key === 'Escape') { e.preventDefault(); closeSlash(); if (stripHtml(b.html).trim() === '/') { b.html = ''; c.innerHTML = ''; save(); } return; }
  }

  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const j = e.key === 'ArrowUp' ? visIdx(i, -1) : visIdx(i, 1);
    if (j < 0) return;
    const caret = getCaret(c);
    [pg.blocks[i], pg.blocks[j]] = [pg.blocks[j], pg.blocks[i]];
    renderBlocks(b.id, caret); save();
    return;
  }

  if (e.key === 'Tab') {
    e.preventDefault();
    if (b.type === 'code') { document.execCommand('insertText', false, '  '); return; }
    const caret = getCaret(c);
    b.indent = Math.max(0, Math.min(5, (b.indent || 0) + (e.shiftKey ? -1 : 1)));
    reveal(b);
    renderBlocks(b.id, caret); save();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) { doEnter(b, c, e); return; }
  if (e.key === 'Backspace') { doBackspace(b, c, e); return; }

  if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey && edgeLine(c, 'top')) {
    const j = visIdx(i, -1);
    if (j >= 0) { e.preventDefault(); focusBlock(pg.blocks[j].id, 'end'); }
    return;
  }
  if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey && edgeLine(c, 'bottom')) {
    const j = visIdx(i, 1);
    if (j >= 0) { e.preventDefault(); focusBlock(pg.blocks[j].id, 'start'); }
  }
}

function doEnter(b, c, e) {
  if (b.type === 'code') {
    const txt = c.textContent;
    if (getCaret(c) === txt.length && txt.endsWith('\n')) {
      e.preventDefault();
      b.html = esc(txt.replace(/\n$/, ''));
      const nb = mkBlock(); insertAfter(b.id, nb); renderBlocks(nb.id, 'start'); save();
    }
    return;
  }
  e.preventDefault();
  const empty = !c.textContent;
  if (empty && ['bullet', 'numbered', 'todo', 'toggle', 'quote', 'callout', 'h1', 'h2', 'h3'].includes(b.type)) {
    if ((b.indent || 0) > 0 && ['bullet', 'numbered', 'todo'].includes(b.type)) b.indent--;
    else b.type = 'text';
    renderBlocks(b.id, 'start'); save(); return;
  }
  const tail = splitAtCaret(c, b);
  const keep = ['bullet', 'numbered', 'todo'].includes(b.type) ? b.type : 'text';
  const nb = mkBlock(keep, tail);
  nb.indent = b.indent || 0;
  if (b.type === 'toggle' && b.open) nb.indent = (b.indent || 0) + 1;
  insertAfter(b.id, nb);
  renderBlocks(nb.id, 'start'); save();
}
function doBackspace(b, c, e) {
  const pg = P(S.current);
  const i = blockIndex(b.id);
  const sel = getSelection();
  if (!(sel.isCollapsed && getCaret(c) === 0)) return;
  if (b.indent) { e.preventDefault(); b.indent--; renderBlocks(b.id, 0); save(); return; }
  if (b.type !== 'text') { e.preventDefault(); b.type = 'text'; renderBlocks(b.id, 0); save(); return; }
  const pv = visIdx(i, -1);
  if (pv < 0) return;
  e.preventDefault();
  const prev = pg.blocks[pv];
  if (prev.type === 'divider') { pg.blocks.splice(pv, 1); renderBlocks(b.id, 0); save(); return; }
  if (prev.type === 'page' || prev.type === 'image' || prev.type === 'video' || prev.type === 'embed' || prev.type === 'table') {
    if (!c.textContent) { pg.blocks.splice(i, 1); renderBlocks(prev.id); save(); } else focusBlock(prev.id);
    return;
  }
  const plen = stripHtml(prev.html).length;
  prev.html = (prev.html || '') + (b.html || '');
  pg.blocks.splice(i, 1);
  renderBlocks(prev.id, plen); save();
}
function moveBlock(b, dir) {
  const pg = P(S.current);
  const i = blockIndex(b.id);
  const j = visIdx(i, dir);
  if (j < 0) return;
  snapshot();
  const c = $(`.block[data-id="${b.id}"] .content`);
  const caret = c ? getCaret(c) : 'end';
  [pg.blocks[i], pg.blocks[j]] = [pg.blocks[j], pg.blocks[i]];
  syncChildrenFromBlocks(S.current);
  renderBlocks(b.id, caret); save(); renderSidebar();
}
function indentBlock(b, d) {
  snapshot();
  const c = $(`.block[data-id="${b.id}"] .content`);
  const caret = c ? getCaret(c) : 'end';
  b.indent = Math.max(0, Math.min(5, (b.indent || 0) + d));
  reveal(b);
  renderBlocks(b.id, caret); save();
}
function openInsertMenu(b) {
  let nb;
  if (b.type === 'text' && !stripHtml(b.html).trim()) { nb = b; b.html = '/'; renderBlocks(b.id, 'end'); }
  else { nb = mkBlock('text', '/'); nb.indent = b.indent || 0; insertAfter(b.id, nb); renderBlocks(nb.id, 'end'); }
  save();
  const c = $(`.block[data-id="${nb.id}"] .content`);
  if (c) { slash.idx = 0; updateSlash(nb, c, '/'); }
}
function edgeLine(c, edge) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const rects = sel.getRangeAt(0).getClientRects();
  const cr = c.getBoundingClientRect();
  const rect = rects.length ? rects[0] : cr;
  const lh = parseFloat(getComputedStyle(c).lineHeight) || 24;
  return edge === 'top' ? rect.top - cr.top < lh * 0.9 : cr.bottom - rect.bottom < lh * 0.9;
}

function removeBlock(b) {
  snapshot();
  const pg = P(S.current);
  const i = blockIndex(b.id);
  pg.blocks.splice(i, 1);
  if (!pg.blocks.length) pg.blocks.push(mkBlock());
  save();
  return pg.blocks[Math.min(i, pg.blocks.length - 1)];
}
function nonEditableKey(e, b) {
  const pg = P(S.current);
  const i = blockIndex(b.id);
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    if (b.type === 'page') { trashPage(b.pageId); return; }
    const f = removeBlock(b);
    renderBlocks(f.id, 'start');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const nb = mkBlock(); insertAfter(b.id, nb); renderBlocks(nb.id, 'start'); save();
  } else if (e.key === 'ArrowUp') { const j = visIdx(i, -1); if (j >= 0) { e.preventDefault(); focusBlock(pg.blocks[j].id, 'end'); } }
  else if (e.key === 'ArrowDown') { const j = visIdx(i, 1); if (j >= 0) { e.preventDefault(); focusBlock(pg.blocks[j].id, 'start'); } }
}

/* ---------- Menu "/" ---------- */
const SLASH_ITEMS = [
  { k: 'text', t: 'Texto', d: 'Comece a escrever com texto simples.', i: 'Aa', kw: 'texto text paragrafo' },
  { k: 'h1', t: 'Título 1', d: 'Título de seção grande.', i: 'H1', kw: 'titulo heading h1 grande' },
  { k: 'h2', t: 'Título 2', d: 'Título de seção médio.', i: 'H2', kw: 'titulo heading h2 medio' },
  { k: 'h3', t: 'Título 3', d: 'Título de seção pequeno.', i: 'H3', kw: 'titulo heading h3 pequeno' },
  { k: 'todo', t: 'Lista de tarefas', d: 'Acompanhe tarefas com caixas de seleção.', i: '☑', kw: 'tarefa todo checkbox lista' },
  { k: 'bullet', t: 'Lista com marcadores', d: 'Crie uma lista simples.', i: '•', kw: 'lista bullet marcadores' },
  { k: 'numbered', t: 'Lista numerada', d: 'Crie uma lista com numeração.', i: '1.', kw: 'lista numerada numbered' },
  { k: 'toggle', t: 'Lista de alternância', d: 'Oculte e mostre conteúdo dentro dela.', i: '▸', kw: 'toggle alternar recolher expandir' },
  { k: 'page', t: 'Página', d: 'Crie uma subpágina dentro desta.', i: '📄', kw: 'pagina subpagina page' },
  { k: 'video', t: 'Vídeo do YouTube', d: 'Cole um link e assista dentro da página.', i: '▶', kw: 'video youtube vídeo player assistir' },
  { k: 'embed', t: 'Site na página', d: 'Mostre um site dentro da página (redimensionável).', i: '🌐', kw: 'site embed pagina iframe html web incorporar' },
  { k: 'table', t: 'Tabela', d: 'Linhas e colunas editáveis.', i: '▦', kw: 'tabela table grade planilha linhas colunas' },
  { k: 'mention', t: 'Link para página', d: 'Mencione outra página (ou digite [[ ou @).', i: '🔗', kw: 'link mencionar mencao pagina referencia backlink arroba' },
  { k: 'image', t: 'Imagem', d: 'Insira uma imagem do computador.', i: '🖼', kw: 'imagem foto image figura' },
  { k: 'quote', t: 'Citação', d: 'Destaque uma citação.', i: '❝', kw: 'citacao quote' },
  { k: 'callout', t: 'Destaque', d: 'Faça o texto se destacar.', i: '💡', kw: 'destaque callout aviso' },
  { k: 'divider', t: 'Divisor', d: 'Separe o conteúdo visualmente.', i: '—', kw: 'divisor linha divider' },
  { k: 'code', t: 'Código', d: 'Bloco de código com fonte monoespaçada.', i: '</>', kw: 'codigo code' }
];
const slash = { open: false, items: [], idx: 0, blockId: null };

function updateSlash(b, c, txt) {
  if (b.type === 'code' || !txt.startsWith('/')) { closeSlash(); return; }
  const q = norm(txt.slice(1));
  const items = SLASH_ITEMS.filter((it) => !q || norm(it.t + ' ' + it.kw).includes(q));
  if (!items.length) { closeSlash(); return; }
  slash.label = 'Blocos básicos';
  showSlash(b, c, items);
}
function showSlash(b, c, items) {
  slash.open = true; slash.items = items; slash.blockId = b.id;
  if (slash.idx >= items.length) slash.idx = 0;
  drawSlash();
  const r = getSelection().getRangeAt(0).getClientRects()[0] || c.getBoundingClientRect();
  const menu = $('#slash');
  menu.style.display = 'block';
  let top = r.bottom + 6;
  if (top + 340 > innerHeight) top = Math.max(10, r.top - 346);
  menu.style.top = top + 'px';
  menu.style.left = Math.max(8, Math.min(r.left, innerWidth - (isMobile() ? 332 : 340))) + 'px';
}
function drawSlash() {
  const m = $('#slash');
  m.innerHTML = '<div class="pop-label">' + esc(slash.label || 'Blocos básicos') + '</div>';
  slash.items.forEach((it, n) => {
    const d = document.createElement('div');
    d.className = 'pi-item' + (n === slash.idx ? ' sel' : '');
    d.innerHTML = `<div class="pbox">${it.i}</div><div><div class="pt">${it.page ? esc(it.t) : it.t}</div><div class="pd">${it.page ? esc(it.d) : it.d}</div></div>`;
    d.onmousedown = (e) => { e.preventDefault(); applySlash(it); };
    d.onmouseenter = () => { slash.idx = n; [...m.querySelectorAll('.pi-item')].forEach((x, k) => x.classList.toggle('sel', k === n)); };
    m.appendChild(d);
  });
  const sel = m.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function closeSlash() { slash.open = false; $('#slash').style.display = 'none'; }
function applySlash(it) {
  const b = blockById(slash.blockId);
  closeSlash();
  if (!b) return;
  if (it.page) { insertMention(b, it); return; }
  convertBlock(b, it.k);
}
/* ---------- Menções a páginas ([[ ou @) ---------- */
function pagePath(p) { const a = []; let c = p.parent ? S.pages[p.parent] : null; while (c) { a.unshift(iconText(c.icon) + (c.title || 'Sem título')); c = c.parent ? S.pages[c.parent] : null; } return a.join(' / ') || 'Página principal'; }
function updateMention(b, c) {
  if (b.type === 'code') return false;
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !c.contains(sel.anchorNode)) return false;
  const n = getCaret(c);
  const before = c.textContent.slice(0, n);
  const m = before.match(/(?:\[\[|@)([^\[\]\n@]{0,40})$/);
  if (!m) return false;
  const pos = n - m[0].length;
  if (m[0][0] === '@' && pos > 0 && !/\s/.test(before[pos - 1])) return false;
  const q = norm(m[1].trim());
  const items = Object.values(S.pages)
    .filter((p) => !inTrash(p) && p.id !== S.current && (!q || norm(p.title || 'Sem título').includes(q)))
    .slice(0, 30)
    .map((p) => ({ page: p.id, t: p.title || 'Sem título', i: iconText(p.icon).trim() || '📄', d: pagePath(p), start: pos, end: n }));
  if (!items.length) return false;
  slash.label = 'Link para página';
  showSlash(b, c, items);
  return true;
}
function rangeFromOffsets(el, s0, e0) {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0, node, sn = null, so = 0, en = null, eo = 0;
  while ((node = w.nextNode())) {
    const len = node.length;
    if (!sn && s0 <= pos + len) { sn = node; so = s0 - pos; }
    if (!en && e0 <= pos + len) { en = node; eo = e0 - pos; break; }
    pos += len;
  }
  if (!sn || !en) return null;
  const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo); return r;
}
function insertMention(b, it) {
  const c = $(`.block[data-id="${b.id}"] .content`);
  if (!c) return;
  c.focus();
  const r = rangeFromOffsets(c, it.start, it.end);
  if (r) applyRange(r);
  snapshot();
  document.execCommand('insertHTML', false, `<a class="mention" data-pid="${it.page}" contenteditable="false">${esc(it.i + ' ' + it.t)}</a>&nbsp;`);
}
function refreshMentions(el) {
  hydrateEmojis(el);
  el.querySelectorAll('a.mention').forEach((a) => {
    const t = S.pages[a.dataset.pid];
    const ok = t && !inTrash(t);
    a.textContent = ok ? iconText(t.icon) + (t.title || 'Sem título') : '📄 Página removida';
    a.classList.toggle('missing', !ok);
  });
}
function mentionClick(e) {
  const lk = e.target.closest && e.target.closest('a.alink');
  if (lk) { e.preventDefault(); if (window.api && api.openExternal) api.openExternal(lk.getAttribute('href')); return; }
  const a = e.target.closest && e.target.closest('a.mention');
  if (!a) return;
  e.preventDefault();
  const t = S.pages[a.dataset.pid];
  if (!t || inTrash(t)) return;
  if (e.ctrlKey || e.metaKey) openInNewTab(t.id); else go(t.id);
}
function renderBacklinks() {
  const box = $('#backlinks');
  const id = S.current, key = 'data-pid="' + id + '"';
  const found = Object.values(S.pages).filter((p) => p.id !== id && !inTrash(p) && p.blocks.some((b) => (b.html && b.html.includes(key)) || (b.rows && b.rows.some((r) => r.some((h) => h && h.includes(key))))));
  box.innerHTML = '';
  box.style.display = found.length ? 'block' : 'none';
  if (!found.length) return;
  const h = document.createElement('div'); h.className = 'bl-head'; h.textContent = 'Mencionado em'; box.appendChild(h);
  found.forEach((p) => {
    const d = document.createElement('div'); d.className = 'bl-item';
    d.innerHTML = `<span class="bi">${iconHtml(p.icon)}</span><span class="bt">${esc(p.title || 'Sem título')}</span><span class="bp">${esc(pagePath(p))}</span>`;
    d.addEventListener('click', (e) => { if (e.ctrlKey || e.metaKey) openInNewTab(p.id); else go(p.id); });
    box.appendChild(d);
  });
}

function convertBlock(b, kind) {
  snapshot();
  const pg = P(S.current);
  if (kind === 'divider') {
    b.type = 'divider'; b.html = '';
    const nb = mkBlock(); insertAfter(b.id, nb); renderBlocks(nb.id, 'start');
  } else if (kind === 'mention') {
    b.type = 'text'; b.html = ''; renderBlocks(b.id, 'start');
    const cc = $(`.block[data-id="${b.id}"] .content`); if (cc) { cc.focus(); document.execCommand('insertText', false, '[['); }
    return;
  } else if (kind === 'table') {
    b.type = 'table'; b.html = ''; b.hdr = true;
    b.rows = [['', '', ''], ['', '', ''], ['', '', '']];
    if (blockIndex(b.id) === pg.blocks.length - 1) pg.blocks.push(mkBlock());
    renderBlocks(b.id, 'start');
  } else if (kind === 'embed') {
    b.type = 'embed'; b.html = ''; delete b.url; b.w = 100; b.h = 420;
    if (blockIndex(b.id) === P(S.current).blocks.length - 1) P(S.current).blocks.push(mkBlock());
    renderBlocks(b.id); save(); setTimeout(() => { const i = $(`.block[data-id="${b.id}"] .vurl`); if (i) i.focus(); }, 0); return;
  } else if (kind === 'video') {
    b.type = 'video'; b.html = ''; delete b.vid; b.w = 100;
    if (blockIndex(b.id) === pg.blocks.length - 1) pg.blocks.push(mkBlock());
    renderBlocks(); save();
    const inp = $(`.block[data-id="${b.id}"] .vurl`); if (inp) inp.focus();
    return;
  } else if (kind === 'image') {
    b.type = 'text'; b.html = '';
    pendingImg = b.id;
    renderBlocks(b.id, 'start');
    $('#fileInput').click();
  } else if (kind === 'page') {
    const nid = createPage(S.current, { addLink: false });
    b.type = 'page'; b.pageId = nid; b.html = '';
    P(S.current).expanded = true;
    if (blockIndex(b.id) === pg.blocks.length - 1) pg.blocks.push(mkBlock());
    save();
    go(nid, true, true);
    return;
  } else {
    const keepText = stripHtml(b.html).startsWith('/') ? '' : b.html;
    b.type = kind; b.html = keepText;
    if (kind === 'toggle') b.open = true;
    renderBlocks(b.id, 'end');
  }
  save();
}

function insertSubpageAfter(b) {
  const nid = createPage(S.current, { addLink: false });
  insertAfter(b.id, Object.assign(mkBlock('page'), { pageId: nid }));
  save();
  go(nid, true, true);
}

/* ---------- Menus genéricos ---------- */
function openMenu(x, y, items) {
  const m = $('#ctx');
  m.innerHTML = '';
  items.forEach((it) => {
    if (it === '-') { const s = document.createElement('div'); s.className = 'pop-sep'; m.appendChild(s); return; }
    if (it.header) { const h = document.createElement('div'); h.className = 'pop-label'; h.textContent = it.header; m.appendChild(h); return; }
    if (it.text !== undefined) { const t = document.createElement('div'); t.className = 'pop-def'; t.innerHTML = (it.pos ? `<i>${esc(it.pos)}</i> ` : '') + esc(it.text); m.appendChild(t); return; }
    const d = document.createElement('div');
    d.className = 'pi-item pi-simple' + (it.danger ? ' danger' : '') + (it.bold ? ' bold' : '');
    d.innerHTML = (it.swatch ? `<span class="tsw" style="background:${it.swatch[0]}"><i style="background:${it.swatch[1]}"></i></span>` : '') + `<span class="pt">${esc(it.label)}</span>`;
    d.onclick = () => { closeMenu(); it.fn(); };
    if (it.ctx) d.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); it.ctx(e); };
    m.appendChild(d);
  });
  m.style.display = 'block';
  const w = Math.max(m.offsetWidth, 250), h = Math.min(m.offsetHeight || items.length * 32 + 12, innerHeight * 0.8);
  m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
}
function closeMenu() { $('#ctx').style.display = 'none'; }

function blockMenu(b, x, y) {
  const types = [['text', 'Texto'], ['h1', 'Título 1'], ['h2', 'Título 2'], ['h3', 'Título 3'], ['bullet', 'Lista'], ['numbered', 'Lista numerada'], ['todo', 'Tarefa'], ['toggle', 'Alternância'], ['quote', 'Citação'], ['callout', 'Destaque'], ['code', 'Código']];
  const items = [];
  if (b.type === 'page') {
    const target = S.pages[b.pageId];
    if (target) {
      items.push({ label: '↪ Abrir página', fn: () => go(b.pageId) });
      items.push({ label: '✏️ Renomear', fn: () => go(b.pageId, true, true) });
      items.push({ label: '↗ Mover para…', fn: () => openPicker('Mover para…', b.pageId, (t) => { t ? movePage(b.pageId, t, 'inside') : movePage(b.pageId, null, 'root'); }) });
      items.push({ label: '⧉ Duplicar página', fn: () => { duplicatePage(b.pageId, S.current); save(false); renderAll(); } });
      items.push('-');
      items.push({ label: '🗑 Excluir página', danger: true, fn: () => trashPage(b.pageId) });
    } else {
      items.push({ label: '🗑 Remover bloco', danger: true, fn: () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); } });
    }
    openMenu(x, y, items);
    return;
  }
  if (!['divider', 'image', 'video', 'embed', 'table'].includes(b.type)) {
    items.push({ header: 'Transformar em' });
    types.filter(([k]) => k !== b.type).forEach(([k, l]) => items.push({ label: l, fn: () => { b.type = k; if (k === 'code') b.html = esc(stripHtml(b.html)); if (k === 'toggle') b.open = true; renderBlocks(b.id, 'end'); save(); } }));
    items.push('-');
  }
  items.push({ label: '⬆ Mover para cima', fn: () => moveBlock(b, -1) });
  items.push({ label: '⬇ Mover para baixo', fn: () => moveBlock(b, 1) });
  items.push({ label: '📄 Inserir subpágina abaixo', fn: () => insertSubpageAfter(b) });
  items.push({ label: '⧉ Duplicar', fn: () => { const nb = { ...b, id: uid() }; insertAfter(b.id, nb); renderBlocks(); save(); } });
  items.push({ label: '🗑 Excluir', danger: true, fn: () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); } });
  openMenu(x, y, items);
}

/* ---------- Emoji e capa ---------- */
const MAIN_ICONS = '📄 📝 📓 📔 📒 📚 📖 📑 📋 📌 📎 🔖 🗂️ 📁 📂 🗃️ 📅 🗓️ ⏰ 📊 📈 📉 💡 ⭐ 🌟 🔥 ✅ ☑️ ❌ ⚠️ ❓ ❗ 🎯 🚀 🏠 🏢 💼 💰 💳 🛒 🛍️ ✈️ 🚗 🚆 🗺️ 🎬 🎵 🎧 🎮 📺 🍳 🍎 🍕 ☕ 🍷 🌱 🌳 🌍 ☀️ 🌙 ❤️ 💙 💪 🧠 🩺 💊 🏃 🧘 ⚽ 🏋️ 🔧 🛠️ ⚙️ 💻 🖥️ ⌨️ 📱 🔒 🔑 🔔 📧 💬 📞 🎨 ✏️ 🖊️ 📷 🎁 🏆 🎓 🧪 🔬 📐 🧾 📦 🧩 🎲 🐶 🐱 😀 😎 🤔 👋 👍 🙏 🎉'.split(' ');
function iconHtml(ic) {
  if (!ic) return '📄';
  if (ic.slice(0, 4) === 'svg:') { const n = ic.slice(4); const b = window.FEATHER && FEATHER[n]; return b ? `<svg class="sico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${b}</svg>` : '📄'; }
  if (ic.slice(0, 4) === 'img:') { const src = S.images && S.images[ic.slice(4)]; return src ? `<img class="eico-i" src="${src}" draggable="false">` : '📄'; }
  return esc(ic);
}
function iconText(ic) { if (!ic) return '📄 '; return ic.slice(0, 4) === 'svg:' || ic.slice(0, 4) === 'img:' ? '' : ic + ' '; }
function placePopup(m, anchor, w, h) {
  const r = anchor.getBoundingClientRect();
  m.style.display = 'block';
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - h - 8)) + 'px';
}
/* Seletor de ícones/emojis. pick(valor) é chamado ao escolher; allowSvg liga a aba "Simples". */
function emojiFromFile(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const N = 128, cv = document.createElement('canvas'); cv.width = N; cv.height = N;
      const sc = Math.min(N / img.width, N / img.height), w = img.width * sc, h = img.height * sc;
      cv.getContext('2d').drawImage(img, (N - w) / 2, (N - h) / 2, w, h);
      const k = uid(); S.images[k] = cv.toDataURL('image/png'); cb(k);
    };
    img.onerror = () => toast('Não foi possível ler a imagem');
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function iconPicker(anchor, pick, opts) {
  opts = opts || {};
  const m = $('#emoji');
  m.className = 'popup ipick';
  m.innerHTML = '<div class="ip-tabs"><button data-t="main">Principais</button><button data-t="all">Todos</button>' + (opts.svg ? '<button data-t="svg">Simples</button>' : '') + '<button data-t="cus">Personalizado</button>' + '</div><input class="ip-q" placeholder="Buscar…"><div class="ip-body"></div>' + (opts.remove ? '<div class="emoji-remove">Remover ícone</div>' : '');
  const body = $('.ip-body', m), q = $('.ip-q', m);
  let tab = 'main';
  const done = (v) => { m.style.display = 'none'; m.className = 'popup'; pick(v); };
  const cell = (label, html, v, title) => { const s = document.createElement('span'); s.innerHTML = html; if (title) s.title = title; s.onclick = () => done(v); return s; };
  function draw() {
    body.innerHTML = '';
    $$('.ip-tabs button', m).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    const term = q.value.trim().toLowerCase();
    if (tab === 'cus') { /* sem busca */ }
    if (tab === 'cus') { /* ver abaixo */ }
    if (tab === 'main' && !term && false) {}
    if (tab === 'main' && !term) {
      const g = document.createElement('div'); g.className = 'emoji-grid';
      MAIN_ICONS.forEach((e) => g.appendChild(cell(e, e, e)));
      body.appendChild(g);
    } else if (tab === 'cus') {
      const g = document.createElement('div'); g.className = 'emoji-grid cusg';
      const add = document.createElement('span'); add.className = 'cus-add'; add.textContent = '+'; add.title = 'Adicionar imagem (PNG, JPG…)';
      add.onclick = () => pickImageFiles(true, (f) => {
        if ((S.emojis || []).length >= 300) { toast('Limite de 300 emojis personalizados'); return; }
        emojiFromFile(f, (k) => { S.emojis.push({ id: k }); save(); draw(); });
      });
      g.appendChild(add);
      (S.emojis || []).forEach((e) => {
        if (!S.images[e.id]) return;
        const s = document.createElement('span'); s.innerHTML = `<img src="${S.images[e.id]}" draggable="false">`;
        s.onclick = () => done('img:' + e.id);
        const x = document.createElement('i'); x.className = 'cus-x'; x.textContent = '✕'; x.title = 'Excluir este emoji';
        x.onclick = (ev) => { ev.stopPropagation(); S.emojis = S.emojis.filter((z) => z.id !== e.id); save(); draw(); renderAll(); };
        s.appendChild(x); g.appendChild(s);
      });
      body.appendChild(g);
      if (!(S.emojis || []).length) { const h = document.createElement('div'); h.className = 'ip-h'; h.textContent = 'Clique em + para criar seus próprios emojis a partir de imagens'; body.appendChild(h); }
    } else if (tab === 'svg') {
      const g = document.createElement('div'); g.className = 'emoji-grid svgg';
      Object.keys(FEATHER).filter((n) => !term || n.includes(term)).forEach((n) => g.appendChild(cell(n, iconHtml('svg:' + n), 'svg:' + n, n)));
      body.appendChild(g);
    } else {
      (window.EMOJI_GROUPS || []).forEach((gr, gi) => {
        const items = gr.e.filter((x) => !term || x[1].includes(term));
        if (!items.length) return;
        const h = document.createElement('div'); h.className = 'ip-h'; h.textContent = (['Rostos e emoções', 'Pessoas', 'Animais e natureza', 'Comida e bebida', 'Viagens e lugares', 'Atividades', 'Objetos', 'Símbolos', 'Bandeiras'])[gi] || gr.n;
        const g = document.createElement('div'); g.className = 'emoji-grid';
        items.forEach((x) => g.appendChild(cell(x[0], x[0], x[0], x[1].split('|').reverse().filter(Boolean)[0])));
        body.appendChild(h); body.appendChild(g);
      });
      if (!body.children.length) body.innerHTML = '<div class="ip-h">Nada encontrado</div>';
    }
  }
  $$('.ip-tabs button', m).forEach((b) => b.onclick = () => { tab = b.dataset.t; draw(); });
  q.oninput = () => { if (q.value && (tab === 'main' || tab === 'cus')) tab = 'all'; draw(); };
  const rm = $('.emoji-remove', m); if (rm) rm.onclick = () => done('');
  draw();
  placePopup(m, anchor, 360, 420);
  q.focus();
}
function openEmoji(anchor, p) {
  iconPicker(anchor, (v) => { p.icon = v; save(); renderAll(); }, { svg: true, remove: !!p.icon });
}
function pickImageFiles(multi, cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = !!multi;
  inp.onchange = () => { [...inp.files].forEach((f) => cb(f)); };
  inp.click();
}
function openCoverPicker(anchor, p) {
  const m = $('#emoji'); m.className = 'popup ipick cpick';
  m.innerHTML = '<div class="ip-tabs"><button data-t="col">Cores</button><button data-t="img">Imagens</button></div><div class="ip-body"></div>';
  const body = $('.ip-body', m);
  let tab = typeof p.cover === 'string' ? 'img' : 'col';
  const done = (v) => { p.cover = v; m.style.display = 'none'; m.className = 'popup'; save(); renderPage(); };
  function draw() {
    $$('.ip-tabs button', m).forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
    body.innerHTML = '';
    if (tab === 'col') {
      const g = document.createElement('div'); g.className = 'swatches';
      COVERS.forEach((c, i) => { const d = document.createElement('div'); d.style.background = c; d.onclick = () => done(i); g.appendChild(d); });
      body.appendChild(g);
    } else {
      const g = document.createElement('div'); g.className = 'cgrid';
      const add = document.createElement('div'); add.className = 'cadd'; add.innerHTML = '<b>+</b><span>Enviar imagem</span>'; add.title = 'Adicionar imagem de capa';
      add.onclick = () => pickImageFiles(true, (f) => loadImage(f, (src) => { const k = uid(); S.images[k] = src; S.coverLib.push(k); save(); draw(); }));
      g.appendChild(add);
      S.coverLib.forEach((k) => {
        if (!S.images[k]) return;
        const d = document.createElement('div'); d.className = 'cth'; d.style.backgroundImage = `url(${S.images[k]})`;
        d.onclick = () => done('img:' + k);
        const x = document.createElement('span'); x.className = 'cx'; x.textContent = '✕'; x.title = 'Excluir da biblioteca';
        x.onclick = (e) => { e.stopPropagation(); S.coverLib = S.coverLib.filter((z) => z !== k); S.pages && Object.values(S.pages).forEach((pg) => { if (pg.cover === 'img:' + k) delete pg.cover; }); save(); draw(); renderPage(); };
        d.appendChild(x); g.appendChild(d);
      });
      body.appendChild(g);
      if (!S.coverLib.length) { const h = document.createElement('div'); h.className = 'ip-h'; h.textContent = 'As imagens enviadas ficam salvas aqui'; body.appendChild(h); }
    }
  }
  $$('.ip-tabs button', m).forEach((b) => b.onclick = () => { tab = b.dataset.t; draw(); });
  draw();
  placePopup(m, anchor, 360, 380);
}

/* ---------- Busca / seletor de página ---------- */
let sr = { items: [], idx: 0, picker: null };
function openSearch() {
  sr.picker = null;
  $('#searchInput').placeholder = 'Buscar páginas e textos…';
  $('#searchModal').style.display = 'flex';
  const i = $('#searchInput'); i.value = ''; i.focus();
  runSearch('');
}
function openPicker(title, excludeId, cb) {
  sr.picker = { cb, excludeId };
  $('#searchInput').placeholder = title + ' (digite para filtrar)';
  $('#searchModal').style.display = 'flex';
  const i = $('#searchInput'); i.value = ''; i.focus();
  runSearch('');
}
function closeSearch() { $('#searchModal').style.display = 'none'; sr.picker = null; }
function pickResult(it) {
  const pk = sr.picker;
  closeSearch();
  if (pk) pk.cb(it.root ? null : it.p.id); else go(it.p.id);
}
function runSearch(q) {
  const nq = norm(q.trim());
  const res = [];
  if (sr.picker && (!nq || norm('raiz principal').includes(nq))) res.push({ root: true, p: { icon: '🏠', title: 'Página principal (raiz)' }, snip: '', score: -1 });
  Object.values(S.pages).forEach((p) => {
    if (inTrash(p)) return;
    if (sr.picker && (p.id === sr.picker.excludeId || isDescendant(p.id, sr.picker.excludeId))) return;
    const title = p.title || 'Sem título';
    if (!nq) { res.push({ p, snip: '', score: 0 }); return; }
    if (norm(title).includes(nq)) { res.push({ p, snip: '', score: 0 }); return; }
    if (sr.picker) return;
    for (const b of p.blocks) {
      const t = blockText(b);
      const k = norm(t).indexOf(nq);
      if (k >= 0) { res.push({ p, snip: t.slice(Math.max(0, k - 20), k + 60), score: 1 }); break; }
    }
  });
  res.sort((a, b) => (a.score || 0) - (b.score || 0));
  sr.items = res.slice(0, 40); sr.idx = 0;
  drawSearch();
}
function drawSearch() {
  const box = $('#searchResults');
  box.innerHTML = '';
  if (!sr.items.length) { box.innerHTML = '<div class="sr-empty">Nenhum resultado</div>'; return; }
  sr.items.forEach((it, n) => {
    const d = document.createElement('div');
    d.className = 'sr' + (n === sr.idx ? ' sel' : '');
    d.innerHTML = `<span>${iconHtml(it.p.icon)}</span><span class="sn">${esc(it.p.title || 'Sem título')}</span><span class="ss">${esc(it.snip)}</span>`;
    d.onclick = () => pickResult(it);
    box.appendChild(d);
  });
  const s = $('.sel', box); if (s) s.scrollIntoView({ block: 'nearest' });
}

/* ---------- Lixeira ---------- */
function openTrash() { $('#trashModal').style.display = 'flex'; renderTrash(); }
function closeTrash() { $('#trashModal').style.display = 'none'; }
function renderTrash() {
  const box = $('#trashList');
  if ($('#trashModal').style.display === 'none') return;
  box.innerHTML = '';
  const list = trashedTop();
  $('#btnEmptyTrash').style.display = list.length ? '' : 'none';
  if (!list.length) { box.innerHTML = '<div class="sr-empty">A lixeira está vazia.</div>'; return; }
  list.forEach((p) => {
    const n = collect(p.id).length - 1;
    const d = document.createElement('div');
    d.className = 'tr';
    d.innerHTML = `<span>${iconHtml(p.icon)}</span><span class="tn">${esc(p.title || 'Sem título')}${n ? ` <span class="td">(+${n} subpág.)</span>` : ''}</span><span class="td">${new Date(p.trashed).toLocaleDateString('pt-BR')}</span><button data-a="r">Restaurar</button><button data-a="d" class="red">Excluir</button>`;
    d.querySelector('[data-a=r]').onclick = () => restorePage(p.id);
    d.querySelector('[data-a=d]').onclick = () => {
      if (!confirm(`Excluir "${p.title || 'Sem título'}" para sempre? Isso não pode ser desfeito.`)) return;
      purgePage(p.id); renderTrash();
    };
    box.appendChild(d);
  });
}
$('#btnEmptyTrash').onclick = () => {
  const list = trashedTop();
  if (!list.length || !confirm(`Excluir para sempre ${list.length} página(s) da lixeira? Isso não pode ser desfeito.`)) return;
  list.forEach((p) => { if (S.pages[p.id]) purgePage(p.id); });
  renderTrash();
};

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, actionLabel, fn) {
  const t = $('#toast');
  t.innerHTML = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if (actionLabel) { const b = document.createElement('button'); b.textContent = actionLabel; b.onclick = () => { t.style.display = 'none'; fn(); }; t.appendChild(b); }
  t.style.display = 'flex';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, actionLabel ? 8000 : 2200);
}

/* ---------- Barra de formatação ao selecionar texto ---------- */
const TXT_COLORS = ['#787774', '#9f6b53', '#d9730d', '#cb912f', '#448361', '#337ea9', '#9065b0', '#c14c8a', '#d44c47'];
const BG_COLORS = ['#e3e2e0', '#eee0da', '#fadec9', '#fdecc8', '#dbeddb', '#d3e5ef', '#e8deee', '#f5e0e9', '#ffe2dd'];
const ftb = $('#ftb');
function fmt(cmd, val) {
  if (msMode) return msApply(() => fmtNative(cmd, val));
  fmtNative(cmd, val);
}
function fmtNative(cmd, val) {
  document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor');
  document.execCommand(cmd, false, val);
}
function toggleCode() {
  if (msMode) return msApply(toggleCodeNative);
  toggleCodeNative();
}
function toggleCodeNative() {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  let n = sel.anchorNode; n = n.nodeType === 3 ? n.parentElement : n;
  const code = n.closest('code');
  const c = n.closest('.content');
  if (code && c) { code.replaceWith(...code.childNodes); c.dispatchEvent(new Event('input')); return; }
  document.execCommand('insertHTML', false, '<code>' + esc(sel.toString()) + '</code>');
}
function buildFtb() {
  ftb.innerHTML = '';
  const add = (label, title, fn, style) => {
    const b = document.createElement('div'); b.className = 'fb'; b.innerHTML = label; b.title = title; if (style) b.style.cssText = style;
    b.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
    ftb.appendChild(b);
  };
  add('<b>B</b>', 'Negrito (Ctrl+B)', () => fmt('bold'));
  add('<i>I</i>', 'Itálico (Ctrl+I)', () => fmt('italic'));
  add('<u>U</u>', 'Sublinhado (Ctrl+U)', () => fmt('underline'));
  add('<s>S</s>', 'Tachado', () => fmt('strikeThrough'));
  add('&lt;/&gt;', 'Código', toggleCode, 'font-family:monospace;font-size:12px');
  const sep = document.createElement('div'); sep.className = 'fsep'; ftb.appendChild(sep);
  add('<span style="font-size:11px">A</span><span style="font-size:15px">A</span> ▾', 'Tamanho da fonte', () => { saveSel(); const sp = $('.spanel', ftb); $('.cpanel', ftb).style.display = 'none'; sp.style.display = sp.style.display === 'none' ? 'block' : 'none'; });
  add('A ▾', 'Cores', () => { const cp = $('.cpanel', ftb); $('.spanel', ftb).style.display = 'none'; cp.style.display = cp.style.display === 'none' ? 'block' : 'none'; });
  add('✕', 'Limpar formatação', () => fmt('removeFormat'));
  const cp = document.createElement('div'); cp.className = 'cpanel'; cp.style.display = 'none';
  cp.innerHTML = '<div class="clabel">Cor do texto</div><div class="crow" data-k="fg"></div><div class="clabel">Cor de fundo</div><div class="crow" data-k="bg"></div>';
  const fg = $('[data-k=fg]', cp), bg = $('[data-k=bg]', cp);
  TXT_COLORS.forEach((c) => { const s = document.createElement('div'); s.className = 'csw'; s.style.color = c; s.textContent = 'A'; s.addEventListener('mousedown', (e) => { e.preventDefault(); fmt('foreColor', c); }); fg.appendChild(s); });
  BG_COLORS.forEach((c) => { const s = document.createElement('div'); s.className = 'csw'; s.style.background = c; s.addEventListener('mousedown', (e) => { e.preventDefault(); fmt('hiliteColor', c); }); bg.appendChild(s); });
  ftb.appendChild(cp);
  const sp = document.createElement('div'); sp.className = 'cpanel spanel'; sp.style.display = 'none';
  sp.innerHTML = '<div class="clabel">Tamanho da fonte (pt)</div><div class="sgrid"></div><div class="scustom"><input type="number" min="1" max="400" step="1" placeholder="Outro valor" id="fsInput"><button id="fsApply">Aplicar</button></div><div class="sreset">Tamanho padrão</div>';
  const sg = $('.sgrid', sp);
  FONT_SIZES.forEach((n) => { const d = document.createElement('div'); d.className = 'ssz'; d.textContent = n; d.addEventListener('mousedown', (e) => { e.preventDefault(); applyFontSize(n); }); sg.appendChild(d); });
  const inp = $('#fsInput', sp);
  const go2 = () => { const v = parseFloat(inp.value.replace(',', '.')); if (v >= 1 && v <= 400) applyFontSize(v); else toast('Digite um tamanho entre 1 e 400'); };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go2(); } if (e.key === 'Escape') { restoreSel(); } });
  $('#fsApply', sp).addEventListener('mousedown', (e) => { e.preventDefault(); go2(); });
  $('.sreset', sp).addEventListener('mousedown', (e) => { e.preventDefault(); applyFontSize(null); });
  ftb.appendChild(sp);
}
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
let savedRange = null;
function saveSel() { const s = getSelection(); if (s.rangeCount && !s.isCollapsed) savedRange = s.getRangeAt(0).cloneRange(); if (msMode) msSaved = msInfo(); }
function restoreSel() { if (savedRange) applyRange(savedRange.cloneRange()); }
function applyFontSize(pt) {
  if (msMode || msSaved) { const inf = msInfo() || msSaved; msSaved = null; return msApply(() => fontSizeCore(pt), inf); }
  restoreSel();
  fontSizeCore(pt);
}
function fontSizeCore(pt) {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  let n = sel.anchorNode; n = n.nodeType === 3 ? n.parentElement : n;
  const c = n.closest('.content');
  if (!c) return;
  snapshot();
  if (pt === null) {
    c.querySelectorAll('span[style*="font-size"]').forEach((sp) => {
      if (!sel.getRangeAt(0).intersectsNode(sp)) return;
      sp.style.fontSize = '';
      if (!sp.getAttribute('style')) sp.replaceWith(...sp.childNodes);
    });
    c.dispatchEvent(new Event('input')); return;
  }
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  const made = [];
  c.querySelectorAll('font[size="7"]').forEach((f) => {
    const sp = document.createElement('span'); sp.style.fontSize = pt + 'pt';
    while (f.firstChild) sp.appendChild(f.firstChild);
    // remove tamanhos internos conflitantes
    sp.querySelectorAll('span[style*="font-size"]').forEach((x) => { x.style.fontSize = ''; if (!x.getAttribute('style')) x.replaceWith(...x.childNodes); });
    f.replaceWith(sp); made.push(sp);
  });
  if (made.length) { const r = document.createRange(); r.setStartBefore(made[0]); r.setEndAfter(made[made.length - 1]); applyRange(r); savedRange = r.cloneRange(); }
  c.dispatchEvent(new Event('input'));
}
buildFtb();
function updateFtb() {
  if (isMobile()) { ftb.style.display = 'none'; return; }
  const sel = getSelection();
  if (msMode && sel && sel.rangeCount && !sel.isCollapsed && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#ftb'))) {
    const rr = sel.getRangeAt(0).getClientRects()[0];
    if (rr) {
      const wasH = ftb.style.display === 'none';
      ftb.style.display = 'flex';
      if (wasH) $$('.cpanel', ftb).forEach((x) => { x.style.display = 'none'; });
      const w0 = ftb.offsetWidth, h0 = ftb.offsetHeight;
      let t0 = rr.top - h0 - 8; if (t0 < 8) t0 = rr.bottom + 8;
      ftb.style.top = t0 + 'px'; ftb.style.left = Math.max(8, Math.min(rr.left, innerWidth - w0 - 8)) + 'px';
      return;
    }
  }
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#ftb')) return;
  if (!sel || !sel.rangeCount || sel.isCollapsed) { ftb.style.display = 'none'; return; }
  if (msMode) return;
  const a = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
  const f = sel.focusNode && (sel.focusNode.nodeType === 3 ? sel.focusNode.parentElement : sel.focusNode);
  const ca = a && a.closest && a.closest('.content');
  if (!ca || !f || !f.closest || f.closest('.content') !== ca || ca.closest('.t-code')) { ftb.style.display = 'none'; return; }
  const r = sel.getRangeAt(0).getBoundingClientRect();
  if (!r.width && !r.height) { ftb.style.display = 'none'; return; }
  const wasHidden = ftb.style.display === 'none';
  ftb.style.display = 'flex';
  if (wasHidden) $$('.cpanel', ftb).forEach((x) => { x.style.display = 'none'; });
  const w = ftb.offsetWidth, h = ftb.offsetHeight;
  let top = r.top - h - 8;
  if (top < 8) top = r.bottom + 8;
  ftb.style.top = top + 'px';
  ftb.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
}
document.addEventListener('selectionchange', updateFtb);
$('#scroll').addEventListener('scroll', () => { ftb.style.display = 'none'; });

/* ---------- Seleção entre vários blocos ---------- */
let msMode = false, msDown = null, msSaved = null;
const blockOfNode = (n) => { const el = n && (n.nodeType === 3 ? n.parentElement : n); return el && el.closest ? el.closest('#blocks .block') : null; };
function enterMs() {
  if (msMode) return;
  msMode = true; document.documentElement.classList.add('ms');
  $$('#blocks [contenteditable]').forEach((el) => { el.dataset.ce = el.getAttribute('contenteditable'); el.setAttribute('contenteditable', 'false'); });
}
function exitMs() {
  if (!msMode) return;
  msMode = false; document.documentElement.classList.remove('ms');
  $$('#blocks [data-ce]').forEach((el) => { el.setAttribute('contenteditable', el.dataset.ce); delete el.dataset.ce; });
}
function msCheck() {
  if (!msMode || msDown) return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#ftb')) return;
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { exitMs(); return; }
  const a = blockOfNode(sel.anchorNode), f = blockOfNode(sel.focusNode);
  if (a && f && a === f) exitMs();
}
const txtLen = (content, node, off) => { const pre = document.createRange(); pre.selectNodeContents(content); pre.setEnd(node, off); return pre.toString().length; };
const rangeHtml = (rg) => { const d = document.createElement('div'); d.appendChild(rg.cloneContents()); return d.innerHTML; };
function msInfo() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  const parts = [];
  $$('#blocks > .block').forEach((el) => {
    if (!r.intersectsNode(el)) return;
    const c = el.querySelector(':scope > .content');
    const p = { id: el.dataset.id, content: !!c, code: !!(c && c.closest('.t-code')) };
    if (c) {
      const cr = document.createRange(); cr.selectNodeContents(c);
      const len = c.textContent.length;
      const startsBefore = r.compareBoundaryPoints(Range.START_TO_START, cr) <= 0;
      const endsAfter = r.compareBoundaryPoints(Range.END_TO_END, cr) >= 0;
      p.s = startsBefore ? 0 : txtLen(c, r.startContainer, r.startOffset);
      p.e = endsAfter ? len : txtLen(c, r.endContainer, r.endOffset);
      const b1 = document.createRange(); b1.selectNodeContents(c); if (!startsBefore) b1.setEnd(r.startContainer, r.startOffset); else b1.collapse(true);
      const a1 = document.createRange(); a1.selectNodeContents(c); if (!endsAfter) a1.setStart(r.endContainer, r.endOffset); else a1.collapse(false);
      p.before = rangeHtml(b1); p.after = rangeHtml(a1);
    }
    parts.push(p);
  });
  return parts.length ? { parts } : null;
}
function cleanEmptyHtml(h) {
  let p;
  do { p = h; h = h.replace(/<(b|i|u|s|span|code|font|strong|em)(\s[^>]*)?><\/\1>/g, ''); } while (h !== p);
  return stripHtml(h) === '' && !/<img|<a /.test(h) ? '' : h;
}
function msText() {
  const info = msInfo();
  if (!info) return '';
  return info.parts.map((p) => { const c = $(`.block[data-id="${p.id}"] > .content`); return c ? c.textContent.slice(p.s, p.e) : ''; }).join('\n');
}
function deleteMulti() {
  const info = msInfo();
  if (!info) return null;
  snapshot();
  const pg = P(S.current);
  const first = info.parts[0], last = info.parts[info.parts.length - 1];
  const bF = blockById(first.id), bL = blockById(last.id);
  const iF = pg.blocks.indexOf(bF), iL = pg.blocks.indexOf(bL);
  let target = null, caret = 0;
  if (first.content) {
    bF.html = cleanEmptyHtml(first.before + (last.content ? last.after : ''));
    pg.blocks.splice(iF + 1, iL - iF);
    target = bF; caret = stripHtml(first.before).length;
  } else if (last.content) {
    bL.html = cleanEmptyHtml(last.after); pg.blocks.splice(iF, iL - iF); target = bL;
  } else pg.blocks.splice(iF, iL - iF + 1);
  if (!pg.blocks.length) pg.blocks.push(mkBlock());
  if (!target) target = pg.blocks[Math.min(iF, pg.blocks.length - 1)];
  exitMs();
  renderBlocks(target.id, caret);
  save();
  return target;
}
function msReselect(info) {
  const a = info.parts[0], z = info.parts[info.parts.length - 1];
  const ea = $(`.block[data-id="${a.id}"] > .content`), ez = $(`.block[data-id="${z.id}"] > .content`);
  if (!ea || !ez) return;
  enterMs();
  const r1 = rangeFromOffsets(ea, a.s, a.s), r2 = rangeFromOffsets(ez, z.e, z.e);
  if (r1 && r2) getSelection().setBaseAndExtent(r1.startContainer, r1.startOffset, r2.endContainer, r2.endOffset);
}
function msApply(fn, info0) {
  const info = info0 || msInfo();
  if (!info) return;
  snapshot(); exitMs();
  info.parts.forEach((p) => {
    if (!p.content || p.code || p.s >= p.e) return;
    const el = $(`.block[data-id="${p.id}"] > .content`);
    if (!el) return;
    el.focus();
    const r = rangeFromOffsets(el, p.s, p.e);
    if (!r) return;
    applyRange(r); fn();
  });
  msReselect(info);
}
function selectAllBlocks() {
  const dom = $$('#blocks > .block');
  if (!dom.length) return;
  if (dom.length === 1) { const c = $('.content', dom[0]); if (c) { c.focus(); const r = document.createRange(); r.selectNodeContents(c); applyRange(r); } return; }
  enterMs();
  const f = dom[0].querySelector(':scope > .content'), l = dom[dom.length - 1], lc = l.querySelector(':scope > .content');
  getSelection().setBaseAndExtent(f || dom[0], 0, lc || l, (lc || l).childNodes.length);
}
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (msMode && !(e.target.closest && e.target.closest('#ftb, #ctx, #emoji, #slash, #toast, #findbar'))) exitMs();
  const blk = e.target.closest && e.target.closest('#blocks .block');
  msDown = blk && e.target.closest('.content') ? { block: blk } : null;
}, true);
document.addEventListener('mousemove', (e) => {
  if (!msDown || msMode || e.buttons !== 1) return;
  const r = msDown.block.getBoundingClientRect();
  if (e.clientY < r.top - 1 || e.clientY > r.bottom + 1) enterMs();
});
document.addEventListener('mouseup', () => { msDown = null; setTimeout(msCheck, 0); });
document.addEventListener('selectionchange', msCheck);
document.addEventListener('copy', (e) => { if (!msMode) return; e.preventDefault(); e.clipboardData.setData('text/plain', msText()); });
document.addEventListener('cut', (e) => { if (!msMode) return; e.preventDefault(); e.clipboardData.setData('text/plain', msText()); deleteMulti(); });
document.addEventListener('paste', (e) => {
  if (!msMode) return;
  e.preventDefault(); e.stopPropagation();
  const t = deleteMulti(); if (!t) return;
  const c = $(`.block[data-id="${t.id}"] .content`);
  if (c) onPaste(e, t, c);
}, true);
document.addEventListener('keydown', (e) => {
  if (!msMode) return;
  const ctrl = e.ctrlKey || e.metaKey, k = e.key, kl = k.toLowerCase();
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#ftb, #findbar')) return;
  if (ctrl && (kl === 'c' || kl === 'x' || kl === 'v')) return;
  if (ctrl && kl === 'a') { e.preventDefault(); selectAllBlocks(); return; }
  if (ctrl && ['b', 'i', 'u'].includes(kl)) { e.preventDefault(); fmt({ b: 'bold', i: 'italic', u: 'underline' }[kl]); return; }
  if (ctrl || e.altKey) return;
  if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); e.stopPropagation(); deleteMulti(); return; }
  if (k === 'Enter') {
    e.preventDefault(); e.stopPropagation();
    const t = deleteMulti(); if (!t) return;
    const c = $(`.block[data-id="${t.id}"] .content`);
    if (c) doEnter(t, c, { preventDefault() {} });
    return;
  }
  if (k === 'Escape') { exitMs(); getSelection().removeAllRanges(); return; }
  if (k.startsWith('Arrow')) {
    const sel = getSelection(); if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0), toStart = k === 'ArrowLeft' || k === 'ArrowUp';
    const node = toStart ? r.startContainer : r.endContainer, off = toStart ? r.startOffset : r.endOffset;
    e.preventDefault(); exitMs();
    const blk = blockOfNode(node), c = blk && blk.querySelector(':scope > .content');
    if (c) { c.focus(); try { getSelection().collapse(node, off); } catch (x) {} } else getSelection().removeAllRanges();
    return;
  }
  if (k.length === 1) {
    e.preventDefault(); e.stopPropagation();
    const t = deleteMulti(); if (t) document.execCommand('insertText', false, k);
  }
}, true);

/* ---------- Eventos globais ---------- */
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#ctx')) closeMenu();
  if (!e.target.closest('#emoji') && !e.target.closest('.page-icon') && !e.target.closest('.head-actions') && !e.target.closest('.cbtns')) $('#emoji').style.display = 'none';
  if (!e.target.closest('#slash')) closeSlash();
  if (e.target.id === 'searchModal') closeSearch();
  if (e.target.id === 'trashModal') closeTrash();
});
document.addEventListener('dragend', hideDrop);
function newRootPage() { const id = createPage(null); go(id, true, true); }
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  const inSearch = document.activeElement && document.activeElement.id === 'searchInput';
  if (ctrl && (k === 'p' || k === 'k')) { e.preventDefault(); openSearch(); return; }
  if (ctrl && e.altKey && k === 'd') { e.preventDefault(); openToday(); return; }
  if (ctrl && k === 'n') { e.preventDefault(); newRootPage(); return; }
  if (ctrl && e.key === '\\') { e.preventDefault(); toggleSidebar(); return; }
  if (ctrl && k === 'a' && !msMode) { const ae = document.activeElement; if (!ae || ae === document.body || (ae.closest && ae.closest('#blocks'))) { e.preventDefault(); selectAllBlocks(); return; } }
  if (ctrl && k === 's') { e.preventDefault(); if (S && S.pages[S.current]) exportDialog(S.current); return; }
  if (ctrl && k === 'f') { e.preventDefault(); openFind(); return; }
  if (ctrl && k === 't') { e.preventDefault(); newTab(); return; }
  if (ctrl && k === 'w') { e.preventDefault(); closeTab(curTab); return; }
  if (ctrl && e.key === 'Tab') { e.preventDefault(); switchTab((curTab + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length); return; }
  if (ctrl && !inSearch && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (ctrl && !inSearch && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); back(); return; }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); fwd(); return; }
  if (e.key === 'Escape') { closeSearch(); closeTrash(); closeMenu(); closeSlash(); $('#emoji').style.display = 'none'; ftb.style.display = 'none'; }
});
$('#searchInput').addEventListener('input', (e) => runSearch(e.target.value));
$('#searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); sr.idx = Math.min(sr.idx + 1, sr.items.length - 1); drawSearch(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sr.idx = Math.max(sr.idx - 1, 0); drawSearch(); }
  else if (e.key === 'Enter') { const it = sr.items[sr.idx]; if (it) pickResult(it); }
});

function toggleSidebar() {
  if (isMobile()) { mOpen = !mOpen; applySidebar(); return; }
  S.sidebar = !S.sidebar; applySidebar(); save(false);
}
$('#sbBackdrop').addEventListener('click', () => { mOpen = false; applySidebar(); });
$('#btnCollapse').onclick = toggleSidebar;
$('#btnExpand').onclick = toggleSidebar;
$('#btnBack').onclick = back;
$('#btnFwd').onclick = fwd;
$('#btnSearch').onclick = openSearch;
$('#btnNewTop').onclick = newRootPage;
$('#btnAddRoot').onclick = newRootPage;
$('#btnTrash').onclick = openTrash;
$('#btnAddSub').onclick = () => { const nid = createPage(S.current); go(nid, true, true); };
$('#btnAddImg').onclick = () => {
  const pg = P(S.current);
  const last = pg.blocks[pg.blocks.length - 1];
  if (last && last.type === 'text' && !stripHtml(last.html)) pendingImg = last.id;
  else { const nb = mkBlock(); pg.blocks.push(nb); pendingImg = nb.id; renderBlocks(); }
  $('#fileInput').click();
};
const THEMES = [
  { id: 'light', name: 'Claro', sw: ['#ffffff', '#2383e2'] },
  { id: 'dark', name: 'Escuro', sw: ['#191919', '#2383e2'], dark: true },
  { id: 'black', name: 'Preto (OLED)', sw: ['#000000', '#4da3ff'], dark: true },
  { id: 'deepblue', name: 'Deep Blue', sw: ['#0f2038', '#4da3ff'], dark: true },
  { id: 'sepia', name: 'Sépia', sw: ['#f6efdc', '#b5651d'] },
  { id: 'nord', name: 'Nord', sw: ['#2e3440', '#88c0d0'], dark: true },
  { id: 'dracula', name: 'Dracula', sw: ['#282a36', '#bd93f9'], dark: true },
  { id: 'win95', name: 'Anos 2000 (Windows 95)', sw: ['#c0c0c0', '#000080'] },
  { id: 'glass', name: 'Liquid Glass', sw: ['linear-gradient(135deg,#a8c8ff,#ffc2e6)', '#0a84ff'] }
];
const isDarkTheme = () => { const t = THEMES.find((x) => x.id === S.theme); return !!(t && t.dark); };
function setTheme(id) {
  S.theme = id; document.documentElement.dataset.theme = id;
  if (window.Android && window.Android.setDark) window.Android.setDark(isDarkTheme());
  save(false);
}
$('#btnTheme').onclick = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.left, Math.max(8, r.top - THEMES.length * 32 - 40), [{ header: 'Tema' }].concat(THEMES.map((t) => ({ label: (S.theme === t.id ? '✓ ' : '') + t.name, swatch: t.sw, fn: () => setTheme(t.id) }))));
};
/* barra de título própria: controles da janela */
(function () {
  const A = window.api;
  const ico = {
    min: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5.5h10" stroke="currentColor" fill="none"/></svg>',
    max: '<svg width="10" height="10" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" stroke="currentColor" fill="none"/></svg>',
    res: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z" stroke="currentColor" fill="none"/></svg>',
    close: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" fill="none"/></svg>'
  };
  if (!A || !A.winCmd) { $('#winctl').style.display = 'none'; return; }
  document.documentElement.classList.add('frameless');
  $('#wMin').innerHTML = ico.min; $('#wMax').innerHTML = ico.max; $('#wClose').innerHTML = ico.close;
  $('#wMin').onclick = () => A.winCmd('min');
  $('#wMax').onclick = () => A.winCmd('max');
  $('#wClose').onclick = () => { try { snapshot(); captureVersion(S.current, true); flush(); } catch (e) {} A.winCmd('close'); };
  const st = (s2) => { $('#wMax').innerHTML = s2.max ? ico.res : ico.max; $('#wMax').title = s2.max ? 'Restaurar' : 'Maximizar'; document.documentElement.classList.toggle('maxed', !!s2.max); };
  A.onWinState(st);
  Promise.resolve(A.winCmd('state')).then((r) => { if (r && typeof r === 'object') st(r); });
})();
$('#btnFav').onclick = () => { const p = P(S.current); p.fav = !p.fav; save(false); renderSidebar(); renderMeta(); };
$('#btnMore').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu(r.right - 250, r.bottom + 4, pageItems(S.current)); };

// redimensionar a barra lateral
(function () {
  const rz = $('#resizer');
  rz.addEventListener('mousedown', (e) => {
    e.preventDefault();
    rz.classList.add('drag');
    const sb = $('#sidebar');
    sb.style.transition = 'none';
    const move = (ev) => { S.sbw = Math.max(200, Math.min(520, ev.clientX)); applySidebar(); };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); rz.classList.remove('drag'); sb.style.transition = ''; save(false); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
})();

// clicar no espaço vazio abaixo do último bloco
$('#pad').addEventListener('click', () => {
  const pg = P(S.current);
  const last = pg.blocks[pg.blocks.length - 1];
  if (last && last.type === 'text' && !stripHtml(last.html)) { focusBlock(last.id, 'start'); return; }
  const nb = mkBlock(); pg.blocks.push(nb); renderBlocks(nb.id, 'start'); save();
});

/* ---------- Barra de edição (celular) ---------- */
const mbar = $('#mbar');
function focusedBlock() {
  const el = document.activeElement;
  const d = el && el.closest ? el.closest('.block') : null;
  return d ? blockById(d.dataset.id) : null;
}
function buildMbar() {
  mbar.innerHTML = '';
  const add = (label, title, fn) => {
    const x = document.createElement('button');
    x.className = 'mb'; x.innerHTML = label; x.title = title;
    x.addEventListener('mousedown', (e) => e.preventDefault());
    x.addEventListener('click', (e) => { e.preventDefault(); fn(x); });
    mbar.appendChild(x);
  };
  const sep = () => mbar.appendChild(document.createElement('i'));
  const cb = (fn) => () => { const b = focusedBlock(); if (b) fn(b); };
  add('＋', 'Inserir bloco', cb(openInsertMenu));
  add('⋮', 'Opções do bloco', (x) => { const b = focusedBlock(); if (b) { const r = x.getBoundingClientRect(); blockMenu(b, r.left, Math.max(8, r.top - 330)); } });
  sep();
  add('⇤', 'Diminuir recuo', cb((b) => indentBlock(b, -1)));
  add('⇥', 'Aumentar recuo', cb((b) => indentBlock(b, 1)));
  add('↑', 'Mover para cima', cb((b) => moveBlock(b, -1)));
  add('↓', 'Mover para baixo', cb((b) => moveBlock(b, 1)));
  sep();
  add('<b>B</b>', 'Negrito', () => fmt('bold'));
  add('<i>I</i>', 'Itálico', () => fmt('italic'));
  add('<u>U</u>', 'Sublinhado', () => fmt('underline'));
  add('<s>S</s>', 'Tachado', () => fmt('strikeThrough'));
  add('&lt;/&gt;', 'Código', toggleCode);
  add('A▾', 'Cores', (x) => openColorPopup(x));
  sep();
  add('↶', 'Desfazer', undo);
  add('↷', 'Refazer', redo);
}
buildMbar();
function openColorPopup(anchor) {
  const m = $('#emoji');
  m.innerHTML = '<div class="pop-label">Cor do texto</div><div class="crow" data-k="fg"></div><div class="pop-label">Cor de fundo</div><div class="crow" data-k="bg"></div>';
  const sw = (box, c, kind) => { const d = document.createElement('div'); d.className = 'csw'; if (kind === 'fg') { d.style.color = c; d.textContent = 'A'; } else d.style.background = c; d.addEventListener('mousedown', (e) => e.preventDefault()); d.addEventListener('click', () => fmt(kind === 'fg' ? 'foreColor' : 'hiliteColor', c)); box.appendChild(d); };
  TXT_COLORS.forEach((c) => sw($('[data-k=fg]', m), c, 'fg'));
  BG_COLORS.forEach((c) => sw($('[data-k=bg]', m), c, 'bg'));
  m.style.width = 'auto';
  m.style.display = 'block';
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + 'px';
}
function updateMbar() {
  const a = document.activeElement;
  const show = isMobile() && a && a.closest && a.closest('#blocks') && !a.closest('#mbar');
  mbar.classList.toggle('show', !!show);
  document.documentElement.classList.toggle('mbar-on', !!show);
}
document.addEventListener('focusin', updateMbar);
document.addEventListener('focusout', () => setTimeout(updateMbar, 80));

/* ---------- Backup (exportar / importar) ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
async function exportBackup() {
  snapshot();
  const d = new Date();
  const name = `Notas-backup-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}.json`;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(S));
    const res = await window.api.saveFile({ name, filters: [{ name: 'Backup do Notas (.json)', extensions: ['json'] }], bytes });
    if (res && res.ok) toast('Backup salvo: ' + (res.name || String(res.path).split(/[\\/]/).pop()), window.api.revealLabel || 'Mostrar pasta', () => window.api.reveal(res.path));
  } catch (e) { toast('Não foi possível salvar o backup: ' + (e && e.message ? e.message : e)); }
}
$('#backupInput').addEventListener('change', (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(String(fr.result).replace(/^﻿/, ''));
      if (!d || typeof d.pages !== 'object' || !Object.keys(d.pages).length) throw new Error('inválido');
      importDialog(d);
    } catch (err) { toast('Esse arquivo não é um backup do Notas'); }
  };
  fr.readAsText(f);
});
function importDialog(d) {
  const n = Object.values(d.pages).filter((p) => !p.trashed).length;
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.style.display = 'flex';
  ov.innerHTML = `<div class="modal-box xbox"><div class="modal-title"><span>Importar backup</span></div><div class="xtext">O arquivo tem <b>${n}</b> página(s).<br><br><b>Juntar</b> coloca as páginas do backup dentro de uma nova página “Importado em…”, sem mexer nas suas notas atuais.<br><b>Substituir tudo</b> apaga as notas atuais e usa só as do backup.</div><div class="xfoot"><button class="xbtn" id="iCancel">Cancelar</button><button class="xbtn" id="iReplace">Substituir tudo</button><button class="xbtn primary" id="iMerge">Juntar</button></div></div>`;
  const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  $('#iCancel', ov).onclick = close;
  $('#iMerge', ov).onclick = () => { close(); mergeBackup(d); toast('Backup importado'); };
  $('#iReplace', ov).onclick = () => {
    if (!confirm('Substituir TODAS as notas atuais pelas do backup? Isso não pode ser desfeito.')) return;
    close(); replaceAll(d);
  };
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
}
function mergeBackup(d) {
  snapshot();
  const imgs = d.images || {};
  const isTr = (p) => { let c = p; while (c) { if (c.trashed) return true; c = c.parent ? d.pages[c.parent] : null; } return false; };
  const live = Object.values(d.pages).filter((p) => !isTr(p));
  const map = {};
  live.forEach((p) => { map[p.id] = uid(); });
  const holder = uid();
  S.pages[holder] = { id: holder, title: 'Importado em ' + new Date().toLocaleDateString('pt-BR'), icon: '📥', parent: null, children: [], expanded: true, updated: Date.now(), blocks: [mkBlock('text', '')] };
  S.root.push(holder);
  live.forEach((p) => {
    const np = JSON.parse(JSON.stringify(p));
    delete np.trashed; delete np.trashParent; delete np.trashIdx;
    np.id = map[p.id]; np.fav = false; np.expanded = false;
    np.parent = p.parent && map[p.parent] ? map[p.parent] : holder;
    np.children = (p.children || []).filter((c) => map[c]).map((c) => map[c]);
    np.blocks = (p.blocks || []).filter((b) => !(b.type === 'page' && !map[b.pageId])).map((b) => {
      const nb = { ...b, id: uid() };
      if (b.type === 'page') nb.pageId = map[b.pageId];
      if (b.type === 'image') {
        const src = b.src || imgs[b.img];
        if (!src) return null;
        const k = uid(); S.images[k] = src; nb.img = k; delete nb.src;
      }
      return nb;
    }).filter(Boolean);
    if (!np.blocks.length) np.blocks.push(mkBlock());
    S.pages[np.id] = np;
  });
  const order = (d.root || []);
  live.filter((p) => !(p.parent && map[p.parent])).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).forEach((p) => {
    S.pages[holder].children.push(map[p.id]);
    addLinkBlock(holder, map[p.id]);
  });
  save(false);
  go(holder);
}
function replaceAll(d) {
  const keep = { theme: S.theme, sidebar: S.sidebar, sbw: S.sbw };
  S = d; Object.assign(S, keep);
  normalizeState();
  hist = [S.current]; hi = 0; tabs = [{ hist, hi }]; curTab = 0; undoStack = []; redoStack = []; lastSnap = snapStr();
  renderAll(); flush(); toast('Backup restaurado');
}
/* ---------- Modelos, diário e importação ---------- */
const mb = (t, h, x) => Object.assign(mkBlock(t, h || ''), x || {});
const tb = (rows, hdr) => mb('table', '', { rows, hdr: hdr !== false });
const BUILTIN_TEMPLATES = [
  { id: 'reuniao', name: 'Anotações de reunião', icon: '🗓', blocks: () => [
    mb('callout', '<b>Data:</b> &nbsp; <b>Horário:</b> &nbsp; <b>Local / link:</b>'),
    mb('h2', 'Participantes'), mb('bullet', ''), mb('bullet', ''),
    mb('h2', 'Objetivo da reunião'), mb('text', ''),
    mb('h2', 'Pauta'), mb('numbered', ''), mb('numbered', ''), mb('numbered', ''),
    mb('h2', 'Discussão'), mb('text', ''),
    mb('h2', 'Decisões'), mb('bullet', ''),
    mb('h2', 'Itens de ação'),
    tb([['Tarefa', 'Responsável', 'Prazo', 'Status'], ['', '', '', '⬜ Pendente'], ['', '', '', '⬜ Pendente'], ['', '', '', '⬜ Pendente']]),
    mb('h2', 'Próxima reunião'), mb('text', '')] },
  { id: 'diario', name: 'Diário', icon: '📔', blocks: () => [
    mb('callout', '☀️ <i>Uma frase para começar o dia…</i>'),
    mb('h3', 'Como estou me sentindo'),
    mb('todo', '😄 Ótimo'), mb('todo', '🙂 Bem'), mb('todo', '😐 Normal'), mb('todo', '😕 Cansado(a)'), mb('todo', '😞 Para baixo'),
    mb('h3', '3 prioridades de hoje'), mb('todo', ''), mb('todo', ''), mb('todo', ''),
    mb('h3', 'O que aconteceu'), mb('text', ''),
    mb('h3', 'Pelo que sou grato(a)'), mb('bullet', ''), mb('bullet', ''), mb('bullet', ''),
    mb('h3', 'O que aprendi'), mb('text', ''),
    mb('divider'),
    mb('h3', 'Para amanhã'), mb('todo', '')] },
  { id: 'semana', name: 'Planejamento semanal', icon: '📅', blocks: () => [
    mb('callout', '🎯 <b>Foco da semana:</b> '),
    mb('h2', 'Visão da semana'),
    tb([['Dia', 'Prioridade do dia', 'Compromissos', 'Tarefas'], ['Segunda', '', '', ''], ['Terça', '', '', ''], ['Quarta', '', '', ''], ['Quinta', '', '', ''], ['Sexta', '', '', ''], ['Sábado', '', '', ''], ['Domingo', '', '', '']]),
    mb('h2', 'Metas da semana'), mb('todo', ''), mb('todo', ''), mb('todo', ''),
    mb('h2', 'Hábitos'),
    tb([['Hábito', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'], ['', '', '', '', '', '', '', ''], ['', '', '', '', '', '', '', '']]),
    mb('h2', 'Balanço da semana'), mb('bullet', '<b>Deu certo:</b> '), mb('bullet', '<b>Pode melhorar:</b> '), mb('bullet', '<b>Levar para a próxima:</b> ')] },
  { id: 'projeto', name: 'Projeto', icon: '🚀', blocks: () => [
    mb('callout', '🎯 <b>Objetivo:</b> descreva em uma frase o que este projeto precisa entregar.'),
    mb('h2', 'Visão geral'), mb('text', ''),
    mb('h2', 'Escopo'), mb('bullet', '<b>Dentro:</b> '), mb('bullet', '<b>Fora:</b> '),
    mb('h2', 'Cronograma'),
    tb([['Etapa', 'Início', 'Fim', 'Responsável', 'Status'], ['', '', '', '', '⬜ A fazer'], ['', '', '', '', '⬜ A fazer'], ['', '', '', '', '⬜ A fazer']]),
    mb('h2', 'Tarefas'), mb('todo', ''), mb('todo', ''), mb('todo', ''),
    mb('h2', 'Riscos'),
    tb([['Risco', 'Probabilidade', 'Impacto', 'Plano de resposta'], ['', '', '', '']]),
    mb('h2', 'Recursos e links'), mb('bullet', ''),
    mb('h2', 'Anotações'), mb('text', '')] },
  { id: 'cornell', name: 'Estudo (método Cornell)', icon: '📚', blocks: () => [
    mb('callout', '<b>Matéria:</b> &nbsp; <b>Tema:</b> &nbsp; <b>Data:</b>'),
    mb('h2', 'Anotações'),
    tb([['Perguntas-chave / palavras-chave', 'Anotações da aula / leitura'], ['', ''], ['', ''], ['', ''], ['', '']]),
    mb('h2', 'Resumo (com suas palavras)'), mb('callout', ''),
    mb('h2', 'Dúvidas para tirar'), mb('bullet', ''),
    mb('h2', 'Revisão'), mb('todo', 'Revisar em 1 dia'), mb('todo', 'Revisar em 1 semana'), mb('todo', 'Revisar em 1 mês')] },
  { id: 'tarefas', name: 'Lista de tarefas (por prioridade)', icon: '✅', blocks: () => [
    mb('callout', '💡 Mova as tarefas entre as seções conforme a prioridade muda.'),
    mb('h2', '🔥 Urgente e importante'), mb('todo', ''), mb('todo', ''),
    mb('h2', '⭐ Importante, sem pressa'), mb('todo', ''), mb('todo', ''),
    mb('h2', '📥 Caixa de entrada'), mb('todo', ''),
    mb('h2', '⏳ Aguardando alguém'), mb('todo', ''),
    mb('toggle', '✔ Concluídas', { open: false }), mb('text', '', { indent: 1 })] },
  { id: 'metas', name: 'Metas do ano', icon: '🎯', blocks: () => [
    mb('callout', '✨ <b>Palavra / tema do ano:</b> '),
    mb('h2', 'Metas por área'),
    tb([['Área', 'Meta', 'Como vou medir', 'Prazo'], ['💼 Carreira', '', '', ''], ['💰 Finanças', '', '', ''], ['❤️ Saúde', '', '', ''], ['📚 Aprendizado', '', '', ''], ['👨‍👩‍👧 Relações', '', '', ''], ['🌴 Lazer', '', '', '']]),
    mb('h2', 'Trimestres'),
    mb('toggle', '1º trimestre', { open: true }), mb('todo', '', { indent: 1 }), mb('todo', '', { indent: 1 }),
    mb('toggle', '2º trimestre', { open: false }), mb('todo', '', { indent: 1 }),
    mb('toggle', '3º trimestre', { open: false }), mb('todo', '', { indent: 1 }),
    mb('toggle', '4º trimestre', { open: false }), mb('todo', '', { indent: 1 }),
    mb('h2', 'Revisão mensal'), mb('text', '')] },
  { id: 'viagem', name: 'Roteiro de viagem', icon: '✈️', blocks: () => [
    mb('callout', '📍 <b>Destino:</b> &nbsp; <b>Datas:</b> &nbsp; <b>Viajantes:</b>'),
    mb('h2', 'Roteiro dia a dia'),
    tb([['Dia', 'Manhã', 'Tarde', 'Noite'], ['Dia 1', '', '', ''], ['Dia 2', '', '', ''], ['Dia 3', '', '', '']]),
    mb('h2', 'Reservas'), mb('bullet', '<b>Passagens:</b> '), mb('bullet', '<b>Hospedagem:</b> '), mb('bullet', '<b>Passeios:</b> '),
    mb('h2', 'Checklist da mala'), mb('todo', 'Documentos'), mb('todo', 'Carregadores'), mb('todo', 'Roupas'), mb('todo', 'Remédios'), mb('todo', 'Higiene'),
    mb('h2', 'Orçamento'),
    tb([['Item', 'Previsto', 'Gasto'], ['Transporte', '', ''], ['Hospedagem', '', ''], ['Alimentação', '', ''], ['Passeios', '', ''], ['Total', '', '']]),
    mb('h2', 'Contatos e endereços úteis'), mb('bullet', '')] },
  { id: 'livro', name: 'Resumo de livro', icon: '📖', blocks: () => [
    mb('callout', '<b>Título:</b> &nbsp; <b>Autor:</b> &nbsp; <b>Nota:</b> ⭐⭐⭐⭐⭐'),
    mb('h2', 'Ideia central'), mb('text', ''),
    mb('h2', 'Principais aprendizados'), mb('numbered', ''), mb('numbered', ''), mb('numbered', ''),
    mb('h2', 'Citações marcantes'), mb('quote', ''),
    mb('h2', 'O que discordo ou questiono'), mb('bullet', ''),
    mb('h2', 'Como vou aplicar'), mb('todo', ''), mb('todo', '')] },
  { id: 'receita', name: 'Receita', icon: '🍳', blocks: () => [
    mb('callout', '⏱ <b>Preparo:</b> &nbsp; 🍽 <b>Rendimento:</b> &nbsp; 🔥 <b>Dificuldade:</b>'),
    mb('h2', 'Ingredientes'), mb('bullet', ''), mb('bullet', ''), mb('bullet', ''),
    mb('h2', 'Modo de preparo'), mb('numbered', ''), mb('numbered', ''), mb('numbered', ''),
    mb('h2', 'Dicas'), mb('bullet', ''),
    mb('h2', 'Anotações da próxima vez'), mb('text', '')] },
  { id: 'orcamento', name: 'Orçamento mensal', icon: '💰', blocks: () => [
    mb('callout', '💡 Preencha as colunas e some no fim do mês. Use a coluna "Real" para comparar com o planejado.'),
    mb('h2', 'Receitas'),
    tb([['Fonte', 'Previsto', 'Real'], ['Salário', '', ''], ['Extras', '', ''], ['Total', '', '']]),
    mb('h2', 'Despesas fixas'),
    tb([['Item', 'Vencimento', 'Previsto', 'Real', 'Pago'], ['Moradia', '', '', '', '⬜'], ['Contas (luz, água, internet)', '', '', '', '⬜'], ['Transporte', '', '', '', '⬜'], ['Total', '', '', '', '']]),
    mb('h2', 'Despesas variáveis'),
    tb([['Categoria', 'Previsto', 'Real'], ['Mercado', '', ''], ['Lazer', '', ''], ['Saúde', '', ''], ['Outros', '', '']]),
    mb('h2', 'Reserva / metas'), mb('todo', ''), mb('h2', 'Observações do mês'), mb('text', '')] }
];
function pageFromTemplate(t) {
  const id = createPage(null, { title: t.name, icon: t.icon });
  const p = P(id);
  p.blocks = typeof t.blocks === 'function' ? t.blocks() : JSON.parse(JSON.stringify(t.blocks)).map((b) => ({ ...b, id: uid() }));
  if (!p.blocks.length) p.blocks.push(mkBlock());
  save(false); go(id, true, true);
}
function templatesMenu(x, y) {
  const hidden = S.tplHidden || [];
  const items = [{ header: 'Nova página a partir de um modelo' }];
  const visible = BUILTIN_TEMPLATES.filter((t) => !hidden.includes(t.id));
  visible.forEach((t) => items.push({
    label: iconText(t.icon) + t.name, fn: () => pageFromTemplate(t),
    ctx: (e) => openMenu(e.clientX, e.clientY, [
      { label: 'Usar este modelo', fn: () => pageFromTemplate(t) },
      { label: '🗑 Excluir este modelo', danger: true, fn: () => { snapshot(); S.tplHidden = (S.tplHidden || []).concat(t.id); save(false); toast('Modelo excluído'); } }
    ])
  }));
  const mine = S.templates || [];
  if (mine.length) {
    items.push('-'); items.push({ header: 'Meus modelos' });
    mine.forEach((t, i) => items.push({
      label: iconText(t.icon) + t.name, fn: () => pageFromTemplate({ name: t.name === 'Sem título' ? '' : t.name, icon: t.icon, blocks: t.blocks }),
      ctx: (e) => openMenu(e.clientX, e.clientY, [
        { label: 'Usar este modelo', fn: () => pageFromTemplate({ name: t.name === 'Sem título' ? '' : t.name, icon: t.icon, blocks: t.blocks }) },
        { label: '🗑 Excluir este modelo', danger: true, fn: () => { snapshot(); mine.splice(i, 1); save(false); toast('Modelo excluído'); } }
      ])
    }));
  }
  items.push('-');
  items.push({ label: '💾 Salvar esta página como modelo', fn: saveAsTemplate });
  if (hidden.length) items.push({ label: '↺ Restaurar modelos padrão (' + hidden.length + ')', fn: () => { snapshot(); S.tplHidden = []; save(false); toast('Modelos padrão restaurados'); } });
  items.push({ header: 'Dica: botão direito em um modelo para excluí-lo' });
  openMenu(x, y, items);
}
function saveAsTemplate() {
  const p = P(S.current);
  S.templates = S.templates || [];
  S.tplHidden = S.tplHidden || [];
  const blocks = JSON.parse(JSON.stringify(p.blocks)).filter((b) => b.type !== 'page');
  S.templates.push({ name: p.title || 'Sem título', icon: p.icon || '', blocks });
  save(false); toast('Modelo salvo: ' + (p.title || 'Sem título'));
}
function openToday() {
  const d = new Date();
  const title = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  let root = S.root.map(P).find((p) => p.title === 'Diário' && p.icon === '📅' && !inTrash(p));
  if (!root) { const rid = createPage(null, { title: 'Diário', icon: '📅' }); root = P(rid); }
  let day = root.children.map(P).find((p) => p && p.title === title && !inTrash(p));
  if (!day) {
    const wd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const id = createPage(root.id, { title, icon: '🗒', addLink: false });
    P(id).blocks = [mb('callout', wd.charAt(0).toUpperCase() + wd.slice(1)), mb('h3', 'Anotações'), mb('text', ''), mb('h3', 'Tarefas'), mb('todo', '')];
    save(false); go(id); return;
  }
  go(day.id);
}
/* Markdown -> blocos */
function mdToHtml(t) {
  let h = esc(t);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (m, a, b) => '<b>' + (a || b) + '</b>');
  h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  h = h.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<i>$2</i>').replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<i>$2</i>');
  h = h.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)');
  return h;
}
function mdToBlocks(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*$/.test(ln)) continue;
    if (/^```/.test(ln)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); out.push(mb('code', esc(buf.join('\n')))); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) { out.push(mb('divider')); continue; }
    let m;
    if ((m = ln.match(/^(#{1,6})\s+(.*)/))) { out.push(mb('h' + Math.min(3, m[1].length), mdToHtml(m[2]))); continue; }
    if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = []; const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => mdToHtml(c.trim()));
      rows.push(cells(ln)); i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      i--; const nc = Math.max(...rows.map((r) => r.length)); rows.forEach((r) => { while (r.length < nc) r.push(''); });
      out.push(mb('table', '', { rows, hdr: true })); continue;
    }
    const ind = Math.floor((ln.match(/^(\s*)/)[1].replace(/\t/g, '  ').length) / 2);
    if ((m = ln.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)/))) { out.push(mb('todo', mdToHtml(m[2]), { checked: m[1] !== ' ', indent: Math.min(ind, 5) })); continue; }
    if ((m = ln.match(/^\s*[-*+]\s+(.*)/))) { out.push(mb('bullet', mdToHtml(m[1]), { indent: Math.min(ind, 5) })); continue; }
    if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { out.push(mb('numbered', mdToHtml(m[1]), { indent: Math.min(ind, 5) })); continue; }
    if ((m = ln.match(/^>\s?(.*)/))) { out.push(mb('quote', mdToHtml(m[1]))); continue; }
    const par = [ln.trim()];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>|\s*\|)/.test(lines[i + 1])) par.push(lines[++i].trim());
    out.push(mb('text', mdToHtml(par.join(' '))));
  }
  return out;
}
$('#mdInput').addEventListener('change', (e) => {
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  let last = null, n = 0;
  files.forEach((f) => {
    const fr = new FileReader();
    fr.onload = () => {
      const t = String(fr.result).replace(/^\uFEFF/, '');
      const blocks = mdToBlocks(t);
      let title = f.name.replace(/\.(md|markdown|txt)$/i, '');
      if (blocks.length && blocks[0].type === 'h1' && stripHtml(blocks[0].html)) { title = stripHtml(blocks[0].html); blocks.shift(); }
      const id = createPage(null, { title, icon: '📄' });
      P(id).blocks = blocks.length ? blocks : [mkBlock()];
      last = id; n++;
      if (n === files.length) { save(false); go(last); toast(n === 1 ? 'Arquivo importado' : n + ' arquivos importados'); }
    };
    fr.readAsText(f);
  });
});
$('#btnNewTop').addEventListener('contextmenu', (e) => { e.preventDefault(); templatesMenu(e.clientX, e.clientY); });
$('#btnTemplates').onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); templatesMenu(r.right + 4, r.top); };
$('#btnToday').onclick = openToday;

$('#btnBackup').onclick = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  openMenu(r.left, Math.max(8, r.top - 130), [
    { label: '⬇ Exportar backup (todas as notas)', fn: exportBackup },
    { label: '⬆ Importar backup…', fn: () => $('#backupInput').click() },
    '-',
    { label: '📥 Importar Markdown / texto…', fn: () => $('#mdInput').click() }
  ]);
};

/* ---------- Botão "voltar" do Android ---------- */
window.androidBack = function () {
  const ov = [...document.querySelectorAll('.overlay')].some((o) => o.style.display !== 'none');
  const pop = ['#ctx', '#emoji', '#slash'].some((q) => $(q).style.display === 'block');
  if (ov || pop) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return true; }
  if (isMobile() && mOpen) { mOpen = false; applySidebar(); return true; }
  if (hi > 0) { back(); return true; }
  return false;
};
window.addEventListener('pagehide', () => { snapshot(); captureVersion(S.current, true); flush(); });

/* ---------- Histórico de versões ---------- */
const VER_MAX = 20, VER_GAP = 5 * 60 * 1000;
const pageSig = (p) => JSON.stringify([p.title || '', p.icon || '', p.blocks]);
function captureVersion(id, force) {
  const p = S && S.pages[id];
  if (!p || inTrash(p)) return;
  S.versions = S.versions || {};
  const arr = S.versions[id] = S.versions[id] || [];
  const last = arr[arr.length - 1];
  if (last && pageSig(last) === pageSig(p)) return;
  if (last && !force && Date.now() - last.t < VER_GAP) return;
  if (!last && !p.blocks.some((b) => b.type !== 'text' || stripHtml(b.html).trim())) return;
  arr.push({ t: Date.now(), title: p.title || '', icon: p.icon || '', blocks: JSON.parse(JSON.stringify(p.blocks)) });
  while (arr.length > VER_MAX) arr.shift();
}
setInterval(() => { if (S) { captureVersion(S.current); } }, 60000);
function versionsDialog(id) {
  captureVersion(id);
  const p = P(id);
  const list = (S.versions && S.versions[id] || []).slice().reverse();
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.style.display = 'flex';
  ov.innerHTML = `<div class="modal-box vbox2"><div class="modal-title"><span>Histórico de versões — ${esc(p.title || 'Sem título')}</span><button class="link-btn" id="vSave">Salvar versão agora</button></div><div class="vcols"><div class="vlist"></div><iframe class="vprev" sandbox=""></iframe></div><div class="xfoot"><button class="xbtn" id="vClose">Fechar</button><button class="xbtn primary" id="vRestore" disabled>Restaurar esta versão</button></div></div>`;
  let sel = null;
  const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const draw = () => {
    const box = $('.vlist', ov); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="sr-empty">Ainda não há versões salvas. Elas são criadas automaticamente enquanto você edita.</div>'; }
    list.forEach((v, n) => {
      const d = document.createElement('div'); d.className = 'vitem' + (sel === n ? ' sel' : '');
      const chars = v.blocks.reduce((a, b) => a + blockText(b).length, 0);
      d.innerHTML = `<div class="vt">${new Date(v.t).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div><div class="vs">${esc(v.title || 'Sem título')} · ${chars} caracteres</div>`;
      d.onclick = () => { sel = n; draw(); preview(v); $('#vRestore', ov).disabled = false; };
      box.appendChild(d);
    });
  };
  const preview = (v) => {
    const doc = buildHtmlDoc([{ title: v.title, icon: v.icon, blocks: v.blocks, font: p.font, small: p.small }], v.title);
    $('.vprev', ov).srcdoc = doc;
  };
  $('#vClose', ov).onclick = close;
  $('#vSave', ov).onclick = () => { captureVersion(id, true); close(); toast('Versão salva'); versionsDialog(id); };
  $('#vRestore', ov).onclick = () => {
    const v = list[sel]; if (!v) return;
    if (!confirm('Restaurar esta versão? O texto atual será guardado como uma versão antes de voltar.')) return;
    snapshot(); captureVersion(id, true);
    p.title = v.title; p.icon = v.icon || p.icon; p.blocks = JSON.parse(JSON.stringify(v.blocks)); p.updated = Date.now();
    if (!p.blocks.length) p.blocks.push(mkBlock());
    close(); renderAll(); save(false); toast('Versão restaurada');
  };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
  draw();
  if (list.length) { sel = 0; draw(); preview(list[0]); $('#vRestore', ov).disabled = false; }
}

/* ---------- Buscar na página (Ctrl+F) ---------- */
const find = { ranges: [], idx: 0 };
function findScan(q) {
  find.ranges = []; find.idx = 0;
  const nq = norm(q.trim());
  if (nq && typeof Highlight !== 'undefined') {
    const w = document.createTreeWalker($('#page'), NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && n.parentElement.closest('#backlinks, #addRow, #pad, .imgtb, .tmenu, .tadd')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let node;
    while ((node = w.nextNode())) {
      const txt = node.nodeValue; let nt = ''; const map = [];
      for (let i = 0; i < txt.length; i++) { const x = norm(txt[i]); for (let k = 0; k < x.length; k++) { nt += x[k]; map.push(i); } }
      let from = 0, at;
      while ((at = nt.indexOf(nq, from)) >= 0) {
        const r = document.createRange();
        r.setStart(node, map[at]); r.setEnd(node, map[at + nq.length - 1] + 1);
        find.ranges.push(r); from = at + nq.length;
      }
    }
  }
  findPaint(true);
}
function findPaint(scroll) {
  if (typeof Highlight === 'undefined') return;
  CSS.highlights.delete('find'); CSS.highlights.delete('find-active');
  if (find.ranges.length) {
    CSS.highlights.set('find', new Highlight(...find.ranges));
    const a = find.ranges[find.idx];
    CSS.highlights.set('find-active', new Highlight(a));
    if (scroll) { const el = a.startContainer.parentElement; if (el) el.scrollIntoView({ block: 'center' }); }
  }
  $('#findCount').textContent = find.ranges.length ? (find.idx + 1) + ' de ' + find.ranges.length : ($('#findInput').value.trim() ? 'Nada' : '');
}
function findStep(d) { if (!find.ranges.length) return; find.idx = (find.idx + d + find.ranges.length) % find.ranges.length; findPaint(true); }
function openFind() { $('#findbar').classList.add('show'); const i = $('#findInput'); i.focus(); i.select(); if (i.value) findScan(i.value); }
function closeFind() { $('#findbar').classList.remove('show'); find.ranges = []; if (typeof Highlight !== 'undefined') { CSS.highlights.delete('find'); CSS.highlights.delete('find-active'); } $('#findCount').textContent = ''; }
$('#findInput').addEventListener('input', (e) => findScan(e.target.value));
$('#findInput').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
$('#findPrev').onclick = () => findStep(-1);
$('#findNext').onclick = () => findStep(1);
$('#findClose').onclick = closeFind;

/* ---------- Início ---------- */
function normalizeState() {
  if (!S.root) S.root = Object.values(S.pages).filter((p) => !p.parent).map((p) => p.id);
  if (!S.pages[S.current] || inTrash(S.pages[S.current])) S.current = S.root[0] || createPage(null);
  S.theme = S.theme || 'light';
  if (typeof S.sidebar !== 'boolean') S.sidebar = true;
  if (!S.sbw) S.sbw = 260;
  S.images = S.images || {};
  S.versions = S.versions || {};
  S.templates = S.templates || [];
  S.userDict = S.userDict || [];
  S.emojis = S.emojis || []; S.coverLib = S.coverLib || [];
  const used = new Set(S.emojis.map((e) => e.id).concat(S.coverLib));
  Object.values(S.pages).forEach((pg) => { [pg.icon, typeof pg.cover === 'string' ? pg.cover : ''].forEach((v) => { if (v && v.slice(0, 4) === 'img:') used.add(v.slice(4)); }); });
  Object.values(S.pages).forEach((pg) => pg.blocks.forEach((b) => { (b.html || '').replace(/data-k="([^"]+)"/g, (m, k) => used.add(k)); }));
  Object.values(S.pages).forEach((pg) => pg.blocks.forEach((b) => {
    if (b.type !== 'image') return;
    if (b.src) { const k = uid(); S.images[k] = b.src; b.img = k; delete b.src; }
    used.add(b.img);
  }));
  Object.values(S.versions || {}).forEach((arr) => arr.forEach((v) => v.blocks.forEach((b) => { if (b.type === 'image' && b.img) used.add(b.img); })));
  Object.keys(S.images).forEach((k) => { if (!used.has(k)) delete S.images[k]; });
}
$('#btnCollapse').innerHTML = ICO.side; $('#btnExpand').innerHTML = ICO.side; $('#btnBack').innerHTML = ICO.back; $('#btnFwd').innerHTML = ICO.fwd;
(async function init() {
  let data = null;
  try { data = await window.api.load(); } catch (e) {}
  try { VIDEO_BASE = await window.api.videoBase(); } catch (e) {}
  S = data && data.pages && Object.keys(data.pages).length ? data : welcomeState();
  normalizeState();
  tabs = Array.isArray(S.tabs) ? S.tabs.map((t) => ({ hist: (t.hist || []).filter((x) => S.pages[x] && !inTrash(S.pages[x])), hi: t.hi | 0 })).filter((t) => t.hist.length) : [];
  if (!tabs.length) tabs = [{ hist: [S.current], hi: 0 }];
  curTab = Math.max(0, Math.min(S.tab | 0, tabs.length - 1));
  tabs.forEach((t) => { t.hi = Math.max(0, Math.min(t.hi, t.hist.length - 1)); });
  hist = tabs[curTab].hist; hi = tabs[curTab].hi; S.current = hist[hi];
  lastSnap = snapStr();
  renderAll();
  save(false);
})();
