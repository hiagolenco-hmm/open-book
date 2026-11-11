/* Correção ortográfica (PT/EN), menu de palavra (sinônimos/tradução/dicionário) e menu de área vazia. */
(function () {
  const WORD_RE = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
  const SKIP = '.t-code, a.mention, code, .bctl, .vurl';
  let sw = null, lw = null, seq = 0; const pend = {};
  const cache = new Map();        // palavra(lower) -> {bad, lang}
  let timer = 0, drawTimer = 0, running = false;
  const hasHL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

  function startWorker() {
    if (sw) return;
    try {
      sw = new Worker('spell-worker.js');
      sw.onmessage = (e) => { const m = e.data; if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
      sw.onerror = () => { sw = null; };
      sendUser();
    } catch (err) { sw = null; }
  }
  function call(w, msg) {
    return new Promise((res) => { const id = ++seq; pend[id] = res; msg.id = id; try { w.postMessage(msg); } catch (e) { res({}); } });
  }
  function sendUser() { if (sw) call(sw, { op: 'user', words: (S && S.userDict) || [] }); }

  /* ----- varredura e sublinhado ----- */
  function collect() {
    const out = [];
    const root = document.getElementById('blocks'); if (!root) return out;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => { const p = n.parentElement; return p && p.closest('.content') && !p.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    let n;
    while ((n = w.nextNode())) {
      const t = n.nodeValue; WORD_RE.lastIndex = 0; let m;
      while ((m = WORD_RE.exec(t))) out.push({ node: n, start: m.index, end: m.index + m[0].length, word: m[0] });
    }
    return out;
  }
  function caretWord() {
    const sel = getSelection(); if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const a = document.activeElement; if (!a || !a.classList || !a.classList.contains('content')) return null;
    return { node: sel.anchorNode, off: sel.anchorOffset };
  }
  let lastList = null;
  function draw(fresh) {
    if (!hasHL) return;
    if (!S || S.spellOff) { CSS.highlights.delete('misspell'); return; }
    const cw = caretWord(), ranges = [];
    if (fresh !== false || !lastList) lastList = collect();
    for (const x of lastList) {
      if (!x.node.isConnected || x.node.nodeValue.substr(x.start, x.end - x.start) !== x.word) continue;
      const c = cache.get(x.word.toLowerCase());
      if (!c || !c.bad) continue;
      if (cw && cw.node === x.node && cw.off >= x.start && cw.off <= x.end) continue; // palavra sendo digitada
      const r = document.createRange(); r.setStart(x.node, x.start); r.setEnd(x.node, x.end); ranges.push(r);
    }
    if (ranges.length) CSS.highlights.set('misspell', new Highlight(...ranges)); else CSS.highlights.delete('misspell');
  }
  async function run() {
    if (running) { schedule(); return; }
    if (!S || S.spellOff) { draw(); return; }
    startWorker(); if (!sw) return;
    running = true;
    try {
      const need = new Set();
      for (const x of collect()) { const k = x.word.toLowerCase(); if (!cache.has(k)) need.add(x.word); }
      const arr = [...need];
      for (let i = 0; i < arr.length; i += 1500) {
        const part = arr.slice(i, i + 1500);
        const r = await call(sw, { op: 'check', words: part });
        if (!r.bad) break;
        part.forEach((w, j) => cache.set(w.toLowerCase(), { bad: !!r.bad[j], lang: r.langs[j] }));
      }
    } finally { running = false; }
    draw();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(run, 500); }
  function drawSoon() { clearTimeout(drawTimer); drawTimer = setTimeout(() => draw(false), 150); }

  window.spellInit = function () {
    const root = document.getElementById('blocks');
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
    document.addEventListener('selectionchange', drawSoon);
    setTimeout(run, 800);
  };

  /* ----- palavra sob o cursor ----- */
  function wordAt(x, y) {
    const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (!r || r.startContainer.nodeType !== 3) return null;
    const node = r.startContainer, par = node.parentElement;
    if (!par || !par.closest('.content') || par.closest(SKIP)) return null;
    const t = node.nodeValue, off = r.startOffset; WORD_RE.lastIndex = 0; let m;
    while ((m = WORD_RE.exec(t))) {
      if (off >= m.index && off <= m.index + m[0].length) {
        const rg = document.createRange(); rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        const hit = [...rg.getClientRects()].some((q) => x >= q.left - 2 && x <= q.right + 2 && y >= q.top - 2 && y <= q.bottom + 2);
        return hit ? { range: rg, word: m[0] } : null;
      }
    }
    return null;
  }
  function replaceWord(range, text) {
    const c = range.startContainer.parentElement.closest('.content'); if (!c) return;
    c.focus();
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const w = range.toString();
    document.execCommand('insertText', false, matchCase(w, text));
  }
  function matchCase(src, c) {
    if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) return c.toUpperCase();
    if (src[0] !== src[0].toLowerCase() && c[0] === c[0].toLowerCase()) return c[0].toUpperCase() + c.slice(1);
    return c;
  }
  function domLang() {
    let pt = 0, en = 0;
    cache.forEach((v) => { if (v.lang === 'pt') pt++; else if (v.lang === 'en') en++; });
    return en > pt * 1.5 ? 'en' : 'pt';
  }

  /* ----- léxico (sinônimos, tradução, dicionário) ----- */
  function lexCall(msg) {
    if (!lw) { try { lw = new Worker('lex-worker.js'); lw.onmessage = (e) => { const m = e.data; if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } }; } catch (e) { return Promise.resolve({ none: true }); } }
    return call(lw, msg);
  }
  let menuTok = 0;
  const toggleItem = () => ({ label: (S.spellOff ? '☐ ' : '☑ ') + 'Correção ortográfica', fn: () => { S.spellOff = !S.spellOff; save(false); draw(); if (!S.spellOff) run(); toast(S.spellOff ? 'Correção ortográfica desligada' : 'Correção ortográfica ligada'); } });

  async function wordMenu(x, y, wa) {
    const tok = ++menuTok, word = wa.word, key = word.toLowerCase();
    startWorker();
    let info = cache.get(key);
    if (!info && sw) { const r = await call(sw, { op: 'check', words: [word] }); info = { bad: !!(r.bad && r.bad[0]), lang: r.langs && r.langs[0] }; cache.set(key, info); }
    if (tok !== menuTok) return;
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(wa.range);
    if (info && info.bad && !S.spellOff) {
      openMenu(x, y, [{ header: 'Procurando sugestões…' }, '-', toggleItem()]);
      const r = await call(sw, { op: 'suggest', word, pref: domLang() });
      if (tok !== menuTok) return;
      const items = [];
      if (r.list && r.list.length) r.list.forEach((s) => items.push({ label: s, bold: true, fn: () => replaceWord(wa.range, s) }));
      else items.push({ header: 'Nenhuma sugestão' });
      items.push('-', { label: 'Adicionar ao dicionário', fn: () => { S.userDict = S.userDict || []; if (!S.userDict.includes(key)) S.userDict.push(key); save(false); cache.set(key, { bad: false, lang: '' }); sendUser(); draw(); toast('“' + word + '” adicionada ao dicionário'); } });
      items.push(toggleItem());
      openMenu(x, y, items);
      return;
    }
    const hint = info && (info.lang === 'pt' || info.lang === 'en') ? info.lang : '', dom = domLang();
    const back = () => wordMenu(x, y, wa);
    const lookup = async (kind) => {
      const t = ++menuTok;
      openMenu(x, y, [{ header: 'Carregando…' }]);
      const r = await lexCall({ word, kind, hint, dom });
      if (t !== menuTok) return null;
      return r;
    };
    const none = (title) => openMenu(x, y, [{ header: title }, { text: 'Nada encontrado para “' + word + '”.' }, '-', { label: '‹ Voltar', fn: back }]);
    openMenu(x, y, [
      { label: 'Sinônimos  ›', fn: async () => {
        const r = await lookup('syn'); if (!r) return;
        if (r.none || !r.items.length) return none('Sinônimos');
        openMenu(x, y, [{ header: 'Sinônimos de “' + (r.lemma) + '”' }, ...r.items.map((s) => ({ label: s, fn: () => replaceWord(wa.range, s) })), '-', { label: '‹ Voltar', fn: back }]);
      } },
      { label: 'Tradução  ›', fn: async () => {
        const r = await lookup('tr'); if (!r) return;
        if (r.none || !r.groups) return none('Tradução');
        const its = [];
        r.groups.forEach((g, i) => { if (i) its.push('-'); its.push({ header: g.title + '  (' + g.lemma + ')' }); g.items.forEach((s) => its.push({ label: s, fn: () => replaceWord(wa.range, s) })); });
        openMenu(x, y, [...its, '-', { label: '‹ Voltar', fn: back }]);
      } },
      { label: 'Dicionário  ›', fn: async () => {
        const r = await lookup('def'); if (!r) return;
        if (r.none || !r.items.length) return none('Dicionário');
        openMenu(x, y, [{ header: r.lemma + (r.lang === 'en' ? '  (inglês)' : '  (português)') }, ...r.items.map((d) => ({ text: d.text, pos: d.pos })), '-', { label: '‹ Voltar', fn: back }]);
      } },
      '-', toggleItem()
    ]);
  }

  function insertEmojiValue(v) {
    if (v.slice(0, 4) === 'img:') { const k = v.slice(4); document.execCommand('insertHTML', false, `<img class="eico" data-k="${k}" src="${S.images[k] || ''}">`); }
    else document.execCommand('insertText', false, v);
  }
  /* ----- menu de área vazia ----- */
  function contentForEvent(e) {
    const bl = e.target.closest && e.target.closest('.block');
    const pg = P(S.current);
    let b = bl ? blockById(bl.dataset.id) : pg.blocks[pg.blocks.length - 1];
    const textual = (x) => x && ['text', 'h1', 'h2', 'h3', 'bullet', 'numbered', 'todo', 'toggle', 'quote', 'callout', 'code'].includes(x.type);
    if (!textual(b)) {
      const nb = mkBlock(); if (b && !bl) pg.blocks.push(nb); else if (b) insertAfter(b.id, nb); else pg.blocks.push(nb);
      renderBlocks(nb.id, 'start'); save(); b = nb;
    }
    return { b, c: document.querySelector(`.block[data-id="${b.id}"] .content`) };
  }
  function placeCaret(c, e) {
    c.focus();
    const sel = getSelection();
    let r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (!r || !c.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(c); r.collapse(false); }
    sel.removeAllRanges(); sel.addRange(r);
    return r.cloneRange();
  }
  async function emptyMenu(e) {
    const { b, c } = contentForEvent(e); if (!c) return;
    const range = placeCaret(c, e);
    const info = (window.api && api.clipInfo) ? await api.clipInfo() : { text: true, image: false };
    const items = [];
    if (info.text) items.push({ label: 'Colar', fn: () => { c.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(range); api.clipPaste(); } });
    if (info.image) items.push({ label: 'Colar imagem', fn: async () => {
      const url = await api.clipImage(); if (!url) return;
      const blob = await (await fetch(url)).blob();
      loadImage(new File([blob], 'imagem.png', { type: 'image/png' }), (src) => {
        let t = blockById(b.id) || b; if (stripHtml(t.html) || t.type !== 'text') { const nb = mkBlock(); insertAfter(t.id, nb); t = nb; }
        setImage(t, src);
      });
    } });
    items.push({ label: 'Inserir emoji', fn: () => {
      const anchor = { getBoundingClientRect: () => ({ left: e.clientX, bottom: e.clientY, top: e.clientY, right: e.clientX }) };
      iconPicker(anchor, (v) => { if (!v) return; c.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(range); insertEmojiValue(v); }, { svg: false });
    } });
    items.push({ label: 'Inserir imagem', fn: () => {
      let t = blockById(b.id) || b;
      if (stripHtml(t.html) || t.type !== 'text') { const nb = mkBlock(); insertAfter(t.id, nb); t = nb; renderBlocks(nb.id, 'start'); }
      pendingImg = t.id; $('#fileInput').click();
    } });
    items.push('-', toggleItem());
    openMenu(e.clientX, e.clientY, items);
  }

  document.addEventListener('contextmenu', (e) => {
    if (e.defaultPrevented) return;
    const t = e.target;
    if (!t.closest || t.closest('#sidebar, #tabbar, #findbar, #ctx, .popup, .modal, #backlinks, #ftb, #topbar, #breadcrumb')) return;
    if (!t.closest('#scroll')) return;
    if (t.closest('.t-image, .t-video, .t-table, .t-page, .bctl, #cover, .cover, .page-icon, #title, .title, .page-title, .meta')) return;
    e.preventDefault();
    const al = t.closest('a.alink');
    if (al) { linkMenu(e.clientX, e.clientY, al); return; }
    const wa = wordAt(e.clientX, e.clientY);
    if (wa) { wordMenu(e.clientX, e.clientY, wa); return; }
    emptyMenu(e);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(window.spellInit, 0)); else setTimeout(window.spellInit, 0);
})();
