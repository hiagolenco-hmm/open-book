/* Links, sites embutidos, caixa de texto simples, Ctrl+K */
const escA = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function askText(title, value, cb, opts) {
  opts = opts || {};
  document.querySelectorAll('.askbox').forEach((x) => x.remove());
  const d = document.createElement('div'); d.className = 'askbox';
  d.innerHTML = `<label>${esc(title)}</label><input spellcheck="false"><div class="row"><button class="no">Cancelar</button><button class="pri ok">OK</button></div>`;
  document.body.appendChild(d);
  const inp = d.querySelector('input'); inp.value = value || '';
  const x = opts.x != null ? opts.x : innerWidth / 2 - 170, y = opts.y != null ? opts.y : innerHeight / 3;
  d.style.left = Math.max(8, Math.min(x, innerWidth - 350)) + 'px'; d.style.top = Math.max(8, Math.min(y, innerHeight - 120)) + 'px';
  const close = () => d.remove();
  const ok = () => { const v = inp.value.trim(); close(); if (v || opts.allowEmpty) cb(v); };
  d.querySelector('.ok').onclick = ok; d.querySelector('.no').onclick = close;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') close(); });
  setTimeout(() => { inp.focus(); inp.select(); }, 0);
  setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!d.contains(e.target)) { close(); document.removeEventListener('mousedown', h); } if (!d.isConnected) document.removeEventListener('mousedown', h); }), 0);
}
const normUrl = (u) => { u = (u || '').trim(); if (!u) return ''; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return /^https?:\/\//i.test(u) ? u : ''; };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

function linkHtml(url, text, hl) { return `<a class="alink${hl ? ' hl' : ''}" href="${escA(url)}">${esc(text || url)}</a>`; }
function caretXY(c) {
  const sel = getSelection(); let r = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  let q = r && r.getClientRects()[0];
  if (!q) { const b = (r && r.startContainer.nodeType === 1 ? r.startContainer : c).getBoundingClientRect(); q = { left: b.left + 10, bottom: b.top + 20, top: b.top }; }
  return [q.left, q.bottom + 4];
}
function insertEmbedAfter(b, url) {
  const pg = P(S.current); snapshot();
  const nb = mkBlock('embed'); nb.url = url; nb.w = 100; nb.h = 420;
  const i = blockIndex(b.id);
  if (b.type === 'text' && !stripHtml(b.html).trim()) { Object.assign(b, { type: 'embed', url, w: 100, h: 420, html: '' }); } else pg.blocks.splice(i + 1, 0, nb);
  if (!pg.blocks.some((x, k) => k > i && x.type === 'text')) pg.blocks.push(mkBlock());
  renderBlocks(); save();
}
function insertVideoAfter(b, y) {
  const pg = P(S.current); snapshot();
  if (b.type === 'text' && !stripHtml(b.html).trim()) { Object.assign(b, { type: 'video', html: '', vid: y.id, start: y.start, w: 100 }); }
  else { const nb = mkBlock('video'); nb.vid = y.id; nb.start = y.start; nb.w = 100; pg.blocks.splice(blockIndex(b.id) + 1, 0, nb); }
  if (blockIndex(b.id) === pg.blocks.length - 1 || pg.blocks[pg.blocks.length - 1].type !== 'text') pg.blocks.push(mkBlock());
  renderBlocks(); save();
}
function pasteUrl(url, b, c) {
  const sel = getSelection(); const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const restore = () => { c.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
  const asLink = () => { restore(); document.execCommand('insertHTML', false, linkHtml(url) + '&nbsp;'); };
  const y = ytParse(url);
  if (!y) { asLink(); return; }
  const [x, yy] = caretXY(c);
  openMenu(x, yy, [
    { header: 'Link do YouTube' },
    { label: '🔗  Colar só o link', fn: asLink },
    { label: '▶  Colar como player de vídeo', fn: () => insertVideoAfter(blockById(b.id) || b, y) },
    { label: 'Aa  Colar como texto simples', fn: () => { restore(); document.execCommand('insertText', false, url); } },
  ]);
}

/* barra de ferramentas do vídeo/site: aparece ao passar o mouse e some (fade) após 10 s se o mouse não for para ela */
function tbAuto(box, tb, wrap) {
  let t = 0, over = false;
  const hide = () => { if (!over) box.classList.remove('tbshow'); };
  const show = () => { box.classList.add('tbshow'); clearTimeout(t); if (!over) t = setTimeout(hide, 10000); };
  box.addEventListener('mouseenter', show);
  box.addEventListener('mousemove', () => { if (!box.classList.contains('tbshow')) show(); });
  wrap.addEventListener('focus', show);
  tb.addEventListener('mouseenter', () => { over = true; clearTimeout(t); });
  tb.addEventListener('mouseleave', () => { over = false; clearTimeout(t); t = setTimeout(hide, 10000); });
  box.addEventListener('touchstart', show, { passive: true });
}

/* ---------- bloco: site embutido ---------- */
function embedEl(b) {
  const w = document.createElement('div'); w.className = 'ewrap'; w.tabIndex = 0;
  if (!b.url) {
    w.classList.add('vempty');
    w.innerHTML = '<span class="vic">🌐</span><input class="vurl" placeholder="Cole o endereço do site e tecle Enter" spellcheck="false"><button class="vok">Inserir</button><button class="vno" title="Cancelar">✕</button>';
    const inp = w.querySelector('.vurl');
    const ok = () => { const u = normUrl(inp.value); if (!u) { toast('Endereço inválido'); return; } snapshot(); b.url = u; b.w = 100; b.h = 420; renderBlocks(b.id); save(); };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ok(); } if (e.key === 'Escape') { e.preventDefault(); w.querySelector('.vno').click(); } });
    w.querySelector('.vok').onclick = ok;
    w.querySelector('.vno').onclick = () => { const f = removeBlock(b); renderBlocks(f.id, 'start'); };
    return w;
  }
  const box = document.createElement('div'); box.className = 'ebox';
  box.style.width = (b.w || 100) + '%'; box.style.height = (b.h || 420) + 'px';
  const f = document.createElement('iframe'); f.src = b.url; f.title = 'Site'; f.referrerPolicy = 'no-referrer';
  f.allow = 'fullscreen; autoplay; encrypted-media; clipboard-write';
  box.appendChild(f);
  const lab = document.createElement('div'); lab.className = 'eurl'; lab.textContent = hostOf(b.url); box.appendChild(lab);
  ['l', 'r'].forEach((side) => { const h = document.createElement('div'); h.className = 'rh ' + side; h.title = 'Arraste para redimensionar'; h.addEventListener('pointerdown', (e) => startResize(e, b, w, box, side)); box.appendChild(h); });
  const rv = document.createElement('div'); rv.className = 'rv'; rv.title = 'Arraste para alterar a altura';
  rv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); snapshot(); w.focus();
    const sy = e.clientY, sh = box.getBoundingClientRect().height; document.body.classList.add('dragging'); document.body.style.cursor = 'ns-resize';
    const mv = (ev) => { box.style.height = Math.max(120, Math.min(2000, sh + ev.clientY - sy)) + 'px'; };
    const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.body.classList.remove('dragging'); document.body.style.cursor = ''; b.h = Math.round(box.getBoundingClientRect().height); save(); };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  });
  box.appendChild(rv);
  const tb = document.createElement('div'); tb.className = 'imgtb';
  const btn = (label, title, fn) => { const x = document.createElement('span'); x.innerHTML = label; x.title = title; x.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); tb.appendChild(x); };
  [50, 75, 100].forEach((n) => btn(n + '%', 'Largura ' + n + '%', () => { b.w = n; renderBlocks(b.id); save(); }));
  const sep = document.createElement('i'); tb.appendChild(sep);
  btn('Abrir no navegador', 'Abrir no navegador padrão', () => api.openExternal(b.url));
  btn('Trocar link', 'Trocar o endereço', () => { snapshot(); delete b.url; renderBlocks(b.id); save(); const i = document.querySelector(`.block[data-id="${b.id}"] .vurl`); if (i) i.focus(); });
  btn('Virar link', 'Transformar em link de texto', () => { snapshot(); const u = b.url; b.type = 'text'; b.html = linkHtml(u, hostOf(u), true); delete b.url; renderBlocks(b.id); save(); });
  btn(ICO.trash, 'Excluir', () => { const f2 = removeBlock(b); renderBlocks(f2.id, 'start'); });
  box.appendChild(tb);
  tbAuto(box, tb, w);
  w.appendChild(box);
  w.addEventListener('keydown', (e) => { if (e.target === w) nonEditableKey(e, b); });
  return w;
}

/* ---------- menu do botão direito em link ---------- */
function linkMenu(x, y, a) {
  const url = a.getAttribute('href'), bl = a.closest('.block'), b = bl && blockById(bl.dataset.id), c = a.closest('.content');
  const touch = () => c.dispatchEvent(new Event('input', { bubbles: true }));
  const items = [
    { label: '↗  Abrir no navegador', fn: () => api.openExternal(url) },
    { label: '🖼  Inserir site na página', fn: () => insertEmbedAfter(b, url) },
  ];
  const y2 = ytParse(url);
  if (y2) items.push({ label: '▶  Inserir como player de vídeo', fn: () => insertVideoAfter(b, y2) });
  if (!a.classList.contains('hl') || a.textContent === url) items.push({ label: '🔤  Transformar em hyperlink…', fn: () => askText('Texto que será exibido', hostOf(url), (t) => { a.textContent = t; a.classList.add('hl'); touch(); }, { x, y }) });
  items.push({ label: '✎  Editar texto e endereço…', fn: () => askText('Endereço do link', url, (u) => { const nu = normUrl(u); if (!nu) return toast('Endereço inválido'); if (a.textContent === url) a.textContent = nu; a.setAttribute('href', nu); touch(); }, { x, y }) });
  items.push({ label: '⧉  Copiar endereço', fn: () => { try { navigator.clipboard.writeText(url); toast('Endereço copiado'); } catch (e) {} } });
  items.push('-', { label: 'Remover link (manter texto)', fn: () => { a.replaceWith(document.createTextNode(a.textContent)); touch(); } });
  openMenu(x, y, items);
}

/* ---------- Ctrl+K: criar/editar hyperlink na seleção ---------- */
document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
  const ae = document.activeElement; if (!ae || !ae.classList || !ae.classList.contains('content')) return;
  const sel = getSelection(); if (!sel.rangeCount) return;
  e.preventDefault();
  const range = sel.getRangeAt(0).cloneRange(), txt = range.toString();
  const [x, y] = caretXY(ae);
  const cur = range.startContainer.parentElement && range.startContainer.parentElement.closest('a.alink');
  askText('Endereço do link', cur ? cur.getAttribute('href') : 'https://', (v) => {
    const u = normUrl(v); if (!u) return toast('Endereço inválido');
    ae.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
    if (cur) { cur.setAttribute('href', u); ae.dispatchEvent(new Event('input', { bubbles: true })); }
    else document.execCommand('insertHTML', false, linkHtml(u, txt || u, !!txt) + '&nbsp;');
  }, { x, y });
});
/* digitou um endereço e apertou espaço/Enter: vira link clicável */
document.addEventListener('input', (e) => {
  if (e.inputType !== 'insertText' || e.data !== ' ') return;
  const c = e.target.closest && e.target.closest('.content'); if (!c || c.closest('.t-code')) return;
  const sel = getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return;
  const n = sel.anchorNode; if (n.nodeType !== 3 || n.parentElement.closest('a')) return;
  const before = n.nodeValue.slice(0, sel.anchorOffset - 1).replace(/ /g, ' ');
  const m = before.match(/(https?:\/\/[^\s]+)$/i); if (!m) return;
  const start = sel.anchorOffset - 1 - m[1].length;
  const r = document.createRange(); r.setStart(n, start); r.setEnd(n, start + m[1].length);
  sel.removeAllRanges(); sel.addRange(r);
  document.execCommand('insertHTML', false, linkHtml(m[1]));
  const s2 = getSelection(); if (s2.rangeCount) { const r2 = s2.getRangeAt(0); r2.collapse(false); }
  document.execCommand('insertText', false, ' ');
}, true);

/* ---------- Transcrever imagem/câmera (OCR offline) ---------- */
(function () {
  let ow = null, idleT = 0;
  function worker() {
    clearTimeout(idleT);
    if (!ow) ow = new Worker('ocr/ocr-worker.js');
    return ow;
  }
  function releaseSoon() { clearTimeout(idleT); idleT = setTimeout(() => { if (ow) { ow.terminate(); ow = null; } }, 90000); }
  const CAM = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  function modal(html) {
    const o = document.createElement('div'); o.className = 'ocr-ov';
    o.innerHTML = `<div class="ocr-box">${html}</div>`;
    document.body.appendChild(o);
    const close = () => { o.remove(); };
    return { o, close, q: (s) => o.querySelector(s) };
  }
  function prepare(source, w, h) {
    const max = 2600, min = 1400; let sc = 1;
    if (Math.max(w, h) > max) sc = max / Math.max(w, h); else if (Math.max(w, h) < min) sc = Math.min(2, min / Math.max(w, h));
    const cv = document.createElement('canvas'); cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(source, 0, 0, cv.width, cv.height);
    return cv;
  }
  /* melhora o contraste e remove sombras (limiar adaptativo) para o modo offline */
  function enhance(cv) {
    const w = cv.width, h = cv.height, x = cv.getContext('2d'), im = x.getImageData(0, 0, w, h), d = im.data;
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const ii = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let xx = 0; xx < w; xx++) { row += g[y * w + xx]; ii[(y + 1) * (w + 1) + xx + 1] = ii[y * (w + 1) + xx + 1] + row; } }
    const r = Math.max(15, Math.round(Math.min(w, h) / 20));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (let xx = 0; xx < w; xx++) {
        const x0 = Math.max(0, xx - r), x1 = Math.min(w, xx + r + 1);
        const s = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
        const mean = s / ((x1 - x0) * (y1 - y0)), v = g[y * w + xx] < mean * 0.86 ? 0 : 255, k = (y * w + xx) * 4;
        d[k] = d[k + 1] = d[k + 2] = v;
      }
    }
    x.putImageData(im, 0, 0); return cv;
  }
  function runOcr(cv, onDone) {
    runOffline(cv, onDone);
  }
  function runOffline(cv, onDone) {
    cv = enhance(cv);
    const m = modal('<h3>Transcrevendo…</h3><div class="ocr-status">Preparando…</div><div class="ocr-bar"><i></i></div><div class="ocr-actions"><button class="no">Cancelar</button></div>');
    const w = worker(); let dead = false;
    m.q('.no').onclick = () => { dead = true; w.terminate(); ow = null; m.close(); };
    w.onmessage = (e) => {
      if (dead) return; const d = e.data;
      if (d.type === 'status') m.q('.ocr-status').textContent = d.text;
      else if (d.type === 'progress') m.q('.ocr-bar i').style.width = Math.round(d.value * 100) + '%';
      else if (d.type === 'error') { m.close(); toast('Erro na transcrição: ' + d.text); releaseSoon(); }
      else if (d.type === 'done') { m.close(); releaseSoon(); onDone(d.text || ''); }
    };
    cv.toBlob(async (blob) => { const buf = await blob.arrayBuffer(); w.postMessage({ op: 'recognize', bytes: buf, langs: ['por', 'eng'], psm: 6 }, [buf]); }, 'image/png');
  }
  function review(text) {
    const m = modal('<h3>Texto reconhecido</h3><textarea class="ocr-text" spellcheck="false"></textarea><div class="ocr-note">Confira e corrija se precisar. O texto será inserido no fim da página atual.</div><div class="ocr-actions"><button class="cp">Copiar</button><button class="no">Cancelar</button><button class="pri ok">Inserir na página</button></div>');
    const ta = m.q('.ocr-text'); ta.value = text.replace(/\n{3,}/g, '\n\n').trim();
    if (!ta.value) m.q('.ocr-note').textContent = 'Nenhum texto foi encontrado na imagem. Tente uma foto mais nítida e bem iluminada.';
    m.q('.no').onclick = m.close;
    m.q('.cp').onclick = () => { try { navigator.clipboard.writeText(ta.value); toast('Texto copiado'); } catch (e) { ta.select(); document.execCommand('copy'); } };
    m.q('.ok').onclick = () => {
      const paras = ta.value.split(/\n\s*\n/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
      m.close(); if (!paras.length) return;
      const pg = P(S.current); snapshot();
      const last = pg.blocks[pg.blocks.length - 1];
      if (last && last.type === 'text' && !stripHtml(last.html).trim()) pg.blocks.pop();
      let lastId = null;
      paras.forEach((t) => { const nb = mkBlock(); nb.html = esc(t); pg.blocks.push(nb); lastId = nb.id; });
      pg.blocks.push(mkBlock());
      renderBlocks(lastId, 'end'); save(); toast(paras.length + (paras.length === 1 ? ' parágrafo inserido' : ' parágrafos inseridos'));
    };
    ta.focus();
  }
  function fromFile(f) {
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { const cv = prepare(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); runOcr(cv, review); };
    img.onerror = () => toast('Não foi possível abrir a imagem');
    img.src = url;
  }
  async function camera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Câmera indisponível neste computador'); return; }
    const m = modal('<h3>Câmera</h3><video class="ocr-video" autoplay playsinline muted></video><select class="ocr-dev" style="display:none"></select><div class="ocr-actions"><button class="no">Cancelar</button><button class="pri ok">Capturar</button></div>');
    const v = m.q('video'), sel = m.q('.ocr-dev'); let stream = null;
    const stop = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    const start = async (id) => {
      stop();
      try { stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id }, width: { ideal: 1920 } } : { width: { ideal: 1920 } } }); v.srcObject = stream; }
      catch (e) { m.close(); toast('Não foi possível acessar a câmera (' + (e.name || 'erro') + ')'); return; }
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      if (devs.length > 1) { sel.style.display = ''; sel.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${esc(d.label || 'Câmera ' + (i + 1))}</option>`).join(''); const cur = stream.getVideoTracks()[0].getSettings().deviceId; if (cur) sel.value = cur; }
    };
    sel.onchange = () => start(sel.value);
    m.q('.no').onclick = () => { stop(); m.close(); };
    m.q('.ok').onclick = () => {
      if (!v.videoWidth) return;
      const cv = prepare(v, v.videoWidth, v.videoHeight); stop(); m.close(); runOcr(cv, review);
    };
    start();
  }
  function init() {
    const b = document.createElement('button'); b.id = 'ocrBtn'; b.title = 'Transcrever imagem em texto'; b.innerHTML = CAM; document.body.appendChild(b);
    b.onclick = () => { const r = b.getBoundingClientRect(); openMenu(r.left - 150, r.top - 96, [
      { header: 'Transcrever para texto' },
      { label: '📷  Câmera', fn: camera },
      { label: '🖼  Enviar imagem', fn: () => pickImageFiles(false, fromFile) },
    ]); };
  }
  window.ocrFromFile = fromFile; window.ocrReview = review; window.ocrRun = runOcr;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
