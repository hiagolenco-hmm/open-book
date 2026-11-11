'use strict';

/* =====================================================
   Exportação: Word (.docx), PDF, HTML, Markdown e texto
   (usa as variáveis e funções globais de app.js)
   ===================================================== */

const EXPORT_FORMATS = [
  { k: 'docx', name: 'Word', ext: 'docx', desc: 'Documento .docx', ico: 'W', color: '#2b579a' },
  { k: 'pdf', name: 'PDF', ext: 'pdf', desc: 'Pronto para imprimir', ico: 'PDF', color: '#d44c47' },
  { k: 'html', name: 'HTML', ext: 'html', desc: 'Página da web', ico: '&lt;/&gt;', color: '#d9730d' },
  { k: 'md', name: 'Markdown', ext: 'md', desc: 'Texto com formatação', ico: 'MD', color: '#448361' },
  { k: 'txt', name: 'Texto', ext: 'txt', desc: 'Texto simples', ico: 'TXT', color: '#787774' }
];

const safeName = (t) => ((t || 'Sem título').replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, 80)) || 'pagina';

function exportPages(id, withSub) {
  const out = [];
  const walk = (pid) => {
    const p = S.pages[pid];
    if (!p || inTrash(p)) return;
    out.push(p);
    if (withSub) p.children.forEach(walk);
  };
  walk(id);
  return out;
}

/* ---------- texto formatado -> "runs" ---------- */
function toHex(c) {
  if (!c) return null;
  const m = String(c).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const h = String(c).match(/^#([0-9a-f]{6})$/i);
  return h ? h[1].toUpperCase() : null;
}
function runsOf(html) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  const out = [];
  const walk = (n, st) => {
    if (n.nodeType === 3) {
      const t = n.nodeValue.replace(/ /g, ' ');
      if (t) out.push({ ...st, text: t });
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === 'BR') { out.push({ br: true }); return; }
    const s = { ...st };
    if (tag === 'B' || tag === 'STRONG') s.bold = true;
    if (tag === 'I' || tag === 'EM') s.italic = true;
    if (tag === 'U') s.underline = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
    if (tag === 'CODE') s.code = true;
    const css = n.style;
    if (css) {
      if (css.fontWeight) s.bold = css.fontWeight === 'bold' || css.fontWeight === 'bolder' || parseInt(css.fontWeight, 10) >= 600;
      if (css.fontStyle) s.italic = css.fontStyle === 'italic';
      const td = (css.textDecorationLine || css.textDecoration || '');
      if (td.includes('underline')) s.underline = true;
      if (td.includes('line-through')) s.strike = true;
      const col = toHex(css.color); if (col) s.color = col;
      const bg = toHex(css.backgroundColor); if (bg) s.bg = bg;
      if (css.fontSize) { const m = css.fontSize.match(/^([\d.]+)(pt|px)$/); if (m) s.size = Math.round((m[2] === 'px' ? +m[1] * 0.75 : +m[1]) * 2) / 2; }
    }
    if ((tag === 'DIV' || tag === 'P') && out.length && !out[out.length - 1].br) out.push({ br: true });
    n.childNodes.forEach((c) => walk(c, s));
  };
  root.childNodes.forEach((c) => walk(c, {}));
  while (out.length && out[out.length - 1].br) out.pop();
  return out;
}
const runsText = (runs) => runs.map((r) => (r.br ? '\n' : r.text)).join('');

function runsHtml(runs) {
  return runs.map((r) => {
    if (r.br) return '<br>';
    let t = esc(r.text);
    const st = [];
    if (r.color) st.push('color:#' + r.color);
    if (r.bg) st.push('background:#' + r.bg);
    if (r.size) st.push('font-size:' + r.size + 'pt');
    if (r.bold === false) st.push('font-weight:normal');
    if (r.code) t = '<code>' + t + '</code>';
    if (r.bold) t = '<b>' + t + '</b>';
    if (r.italic) t = '<i>' + t + '</i>';
    if (r.underline) t = '<u>' + t + '</u>';
    if (r.strike) t = '<s>' + t + '</s>';
    if (st.length) t = '<span style="' + st.join(';') + '">' + t + '</span>';
    return t;
  }).join('');
}

/* numeração igual à do editor */
function numbering(blocks) {
  const nums = [];
  let n = 0;
  blocks.forEach((b, i) => {
    if (b.type === 'numbered') {
      const same = i > 0 && blocks[i - 1].type === 'numbered' && (blocks[i - 1].indent || 0) === (b.indent || 0);
      n = same ? n + 1 : 1;
      nums[i] = n;
    }
  });
  return nums;
}
function trimmedBlocks(p) {
  const bl = p.blocks.slice();
  while (bl.length && bl[bl.length - 1].type === 'text' && !runsText(runsOf(bl[bl.length - 1].html)).trim()) bl.pop();
  return bl;
}
const pageLabel = (b) => { const t = S.pages[b.pageId]; return t && !inTrash(t) ? (t.title || 'Sem título') : 'Página removida'; };
const imgBlockOk = (b) => /^data:image\/(png|jpe?g|gif);base64,/i.test(imgSrc(b));

/* ---------- HTML (também usado para o PDF) ---------- */
const EXPORT_CSS = `
@page { size: A4; margin: 18mm 17mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #2f2e2b; font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { max-width: 820px; margin: 40px auto; padding: 0 24px; } }
.pg + .pg { break-before: page; page-break-before: always; }
.pg.font-serif { font-family: Georgia, "Times New Roman", serif; }
.pg.font-mono { font-family: Consolas, "Courier New", monospace; }
.pg.small { font-size: 9.5pt; }
h1.title { font-size: 26pt; line-height: 1.2; margin: 0 0 14pt; }
h2, h3, h4 { break-after: avoid; page-break-after: avoid; line-height: 1.3; }
h2 { font-size: 18pt; margin: 18pt 0 6pt; } h3 { font-size: 14.5pt; margin: 14pt 0 5pt; } h4 { font-size: 12.5pt; margin: 12pt 0 4pt; }
p { margin: 0 0 5pt; min-height: 1em; white-space: pre-wrap; }
.li { display: flex; margin: 0 0 3pt; } .li .mk { flex: 0 0 18pt; } .li .tx { flex: 1; min-width: 0; white-space: pre-wrap; }
.li.done .tx { color: #8b8a86; text-decoration: line-through; }
.cb { display: inline-block; width: 9pt; height: 9pt; border: 1.2pt solid #5d5c58; border-radius: 2pt; position: relative; top: 1pt; }
.cb.on { background: #2383e2; border-color: #2383e2; } .cb.on::after { content: ""; position: absolute; left: 2.2pt; top: .3pt; width: 2.2pt; height: 5pt; border: solid #fff; border-width: 0 1.3pt 1.3pt 0; transform: rotate(40deg); }
blockquote { margin: 6pt 0; padding: 1pt 0 1pt 11pt; border-left: 3pt solid #2f2e2b; font-size: 12.5pt; white-space: pre-wrap; }
.callout { margin: 6pt 0; padding: 9pt 11pt; background: #f1f1ef; border-radius: 4pt; white-space: pre-wrap; }
pre { margin: 6pt 0; padding: 9pt 11pt; background: #f7f6f3; border: .5pt solid #e3e2e0; border-radius: 4pt; font-family: Consolas, "Courier New", monospace; font-size: 9pt; white-space: pre-wrap; word-break: break-word; }
code { background: rgba(135,131,120,.18); border-radius: 3pt; padding: 0 3pt; font-family: Consolas, "Courier New", monospace; font-size: 90%; color: #c4423d; }
hr { border: 0; border-top: .75pt solid #d3d2ce; margin: 10pt 0; }
.im { margin: 6pt 0; display: flex; } .im.c { justify-content: center; } .im.r { justify-content: flex-end; } .im.wl { float: left; display: block; margin: 4pt 12pt 6pt 0; } .im.wr { float: right; display: block; margin: 4pt 0 6pt 12pt; } .im.wl img, .im.wr img { width: 100%; }
.im img { max-width: 100%; height: auto; break-inside: avoid; page-break-inside: avoid; border-radius: 3pt; }
.pl { margin: 0 0 4pt; font-weight: 600; }
.tb { border-collapse: collapse; width: 100%; margin: 6pt 0; table-layout: fixed; } .tb td, .tb th { border: .75pt solid #d3d2ce; padding: 3.5pt 6pt; vertical-align: top; text-align: left; word-break: break-word; } .tb th { background: #f1f1ef; } .tb tr { break-inside: avoid; page-break-inside: avoid; }
`;

function pageHtml(p) {
  const bl = trimmedBlocks(p);
  const nums = numbering(bl);
  const out = [`<section class="pg${p.font ? ' font-' + p.font : ''}${p.small ? ' small' : ''}">`, `<h1 class="title">${esc(p.title || 'Sem título')}</h1>`];
  bl.forEach((b, i) => {
    const ind = (b.indent || 0) * 18;
    const st = ind ? ` style="margin-left:${ind}pt"` : '';
    const rh = () => runsHtml(runsOf(b.html));
    switch (b.type) {
      case 'h1': out.push(`<h2${st}>${rh()}</h2>`); break;
      case 'h2': out.push(`<h3${st}>${rh()}</h3>`); break;
      case 'h3': out.push(`<h4${st}>${rh()}</h4>`); break;
      case 'bullet': out.push(`<div class="li"${st}><span class="mk">•</span><span class="tx">${rh()}</span></div>`); break;
      case 'numbered': out.push(`<div class="li"${st}><span class="mk">${nums[i]}.</span><span class="tx">${rh()}</span></div>`); break;
      case 'todo': out.push(`<div class="li${b.checked ? ' done' : ''}"${st}><span class="mk"><span class="cb${b.checked ? ' on' : ''}"></span></span><span class="tx">${rh()}</span></div>`); break;
      case 'toggle': out.push(`<div class="li"${st}><span class="mk">▸</span><span class="tx">${rh()}</span></div>`); break;
      case 'quote': out.push(`<blockquote${st}>${rh()}</blockquote>`); break;
      case 'callout': out.push(`<div class="callout"${st}>${rh()}</div>`); break;
      case 'code': out.push(`<pre${st}>${esc(stripHtml(b.html))}</pre>`); break;
      case 'divider': out.push('<hr>'); break;
      case 'image':
        if (imgBlockOk(b)) out.push(b.wrap ? `<div class="im w${b.wrap}" style="width:${b.w || 40}%"><img src="${imgSrc(b)}"></div>` : `<div class="im ${b.align === 'center' ? 'c' : b.align === 'right' ? 'r' : ''}"><img src="${imgSrc(b)}" ${b.w ? `style="width:${b.w}%"` : ''}></div>`);
        break;
      case 'table': out.push('<table class="tb">' + (b.rows || []).map((r, ri) => '<tr>' + r.map((h) => (b.hdr && ri === 0 ? '<th>' : '<td>') + runsHtml(runsOf(h)) + (b.hdr && ri === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('') + '</table>'); break;
      case 'embed': if (b.url) out.push(`<p class="pl">🌐 <a href="${b.url}">${b.url}</a></p>`); break;
      case 'video': if (b.file) { out.push(`<p class="pl">▶ Vídeo (arquivo): ${esc(b.file.replace(/^[^_]*_/, ''))}</p>`); break; } if (b.vid) out.push(`<p class="pl">▶ Vídeo: <a href="${ytWatch(b)}">${ytWatch(b)}</a></p>`); break;
      case 'page': out.push(`<p class="pl">→ ${esc(pageLabel(b))}</p>`); break;
      default: out.push(`<p${st}>${rh() || '&nbsp;'}</p>`);
    }
  });
  out.push('</section>');
  return out.join('\n');
}
function buildHtmlDoc(pages, title) {
  return `<!DOCTYPE html>\n<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${EXPORT_CSS}</style></head><body>\n${pages.map(pageHtml).join('\n')}\n</body></html>`;
}

/* ---------- Markdown e texto ---------- */
function mdInline(runs) {
  return runs.map((r) => {
    if (r.br) return '  \n';
    let t = r.text;
    if (r.code) t = '`' + t + '`';
    if (r.bold) t = '**' + t + '**';
    if (r.italic) t = '*' + t + '*';
    if (r.strike) t = '~~' + t + '~~';
    return t;
  }).join('');
}
function pageMd(p) {
  const bl = trimmedBlocks(p);
  const nums = numbering(bl);
  const out = [`# ${p.title || 'Sem título'}`, ''];
  bl.forEach((b, i) => {
    const pad = '    '.repeat(b.indent || 0);
    const t = mdInline(runsOf(b.html));
    switch (b.type) {
      case 'h1': out.push('## ' + t, ''); break;
      case 'h2': out.push('### ' + t, ''); break;
      case 'h3': out.push('#### ' + t, ''); break;
      case 'bullet': out.push(pad + '- ' + t); break;
      case 'numbered': out.push(pad + nums[i] + '. ' + t); break;
      case 'todo': out.push(pad + '- [' + (b.checked ? 'x' : ' ') + '] ' + t); break;
      case 'toggle': out.push(pad + '- ▸ ' + t); break;
      case 'quote': out.push('> ' + t.replace(/\n/g, '\n> '), ''); break;
      case 'callout': out.push('> 💡 ' + t.replace(/\n/g, '\n> '), ''); break;
      case 'code': out.push('```', stripHtml(b.html), '```', ''); break;
      case 'divider': out.push('---', ''); break;
      case 'image': if (imgBlockOk(b)) out.push(`![imagem](${imgSrc(b)})`, ''); break;
      case 'table': { const rows = (b.rows || []).map((r) => r.map((h) => stripHtml(h).replace(/\|/g, '\\|').replace(/\n/g, '<br>'))); if (rows.length) { out.push('| ' + rows[0].join(' | ') + ' |', '| ' + rows[0].map(() => '---').join(' | ') + ' |'); rows.slice(1).forEach((r) => out.push('| ' + r.join(' | ') + ' |')); out.push(''); } break; }
      case 'embed': if (b.url) out.push(`[🌐 ${b.url}](${b.url})`, ''); break;
      case 'video': if (b.file) { out.push('[▶ Vídeo (arquivo): ' + b.file.replace(/^[^_]*_/, '') + ']', ''); break; } if (b.vid) out.push(`[▶ Vídeo no YouTube](${ytWatch(b)})`, ''); break;
      case 'page': out.push(pad + '- 📄 ' + pageLabel(b)); break;
      default: out.push(t, '');
    }
    const nx = bl[i + 1];
    const isList = ['bullet', 'numbered', 'todo', 'toggle', 'page'].includes(b.type);
    if (isList && (!nx || !['bullet', 'numbered', 'todo', 'toggle', 'page'].includes(nx.type))) out.push('');
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
function pageTxt(p) {
  const bl = trimmedBlocks(p);
  const nums = numbering(bl);
  const out = [p.title || 'Sem título', '='.repeat(Math.min(60, Math.max(3, (p.title || 'Sem título').length))), ''];
  bl.forEach((b, i) => {
    const pad = '  '.repeat(b.indent || 0);
    const t = runsText(runsOf(b.html));
    switch (b.type) {
      case 'h1': case 'h2': case 'h3': out.push('', t.toUpperCase(), ''); break;
      case 'bullet': out.push(pad + '• ' + t); break;
      case 'numbered': out.push(pad + nums[i] + '. ' + t); break;
      case 'todo': out.push(pad + (b.checked ? '[x] ' : '[ ] ') + t); break;
      case 'toggle': out.push(pad + '> ' + t); break;
      case 'quote': out.push('"' + t + '"'); break;
      case 'code': out.push(stripHtml(b.html)); break;
      case 'divider': out.push('-'.repeat(40)); break;
      case 'image': out.push('[imagem]'); break;
      case 'table': (b.rows || []).forEach((r) => out.push(r.map((h) => stripHtml(h).replace(/\n/g, ' ')).join(' | '))); break;
      case 'embed': if (b.url) out.push('Site: ' + b.url); break;
      case 'video': if (b.file) { out.push('Vídeo (arquivo): ' + b.file.replace(/^[^_]*_/, '')); break; } if (b.vid) out.push('Vídeo: ' + ytWatch(b)); break;
      case 'page': out.push(pad + '→ ' + pageLabel(b)); break;
      default: out.push(t);
    }
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/* ---------- ZIP (sem compressão) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dtime, true); lh.setUint16(12, ddate, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dtime, true); ch.setUint16(14, ddate, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + size;
  });
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = parts.concat(central, [new Uint8Array(end.buffer)]);
  const total = all.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  all.forEach((c) => { out.set(c, pos); pos += c.length; });
  return out;
}

/* ---------- Word (.docx) ---------- */
const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const WFONT = { '': 'Calibri', serif: 'Georgia', mono: 'Consolas' };

function wRun(r, base) {
  if (r.br) return '<w:r><w:br/></w:r>';
  const font = r.code ? 'Consolas' : (base.font || '');
  let rp = '';
  if (font) rp += `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`;
  const bold = r.bold !== undefined ? r.bold : base.bold;
  if (bold) rp += '<w:b/>'; else if (r.bold === false) rp += '<w:b w:val="0"/>';
  if (r.italic || base.italic) rp += '<w:i/>';
  if (r.strike || base.strike) rp += '<w:strike/>';
  const col = r.color || base.color || (r.code ? 'C4423D' : '');
  if (col) rp += `<w:color w:val="${col}"/>`;
  const hs = r.size ? Math.round(r.size * 2) : base.size;
  if (hs) rp += `<w:sz w:val="${hs}"/><w:szCs w:val="${hs}"/>`;
  if (r.underline) rp += '<w:u w:val="single"/>';
  const fill = r.bg || (r.code ? 'EDECE9' : '');
  if (fill) rp += `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
  return `<w:r>${rp ? `<w:rPr>${rp}</w:rPr>` : ''}<w:t xml:space="preserve">${xe(r.text)}</w:t></w:r>`;
}
function wPara(o) {
  let pp = '';
  if (o.style) pp += `<w:pStyle w:val="${o.style}"/>`;
  if (o.keepNext) pp += '<w:keepNext/>';
  if (o.pageBreakBefore) pp += '<w:pageBreakBefore/>';
  if (o.num) pp += `<w:numPr><w:ilvl w:val="${o.num.lvl}"/><w:numId w:val="${o.num.id}"/></w:numPr>`;
  if (o.bdr) pp += `<w:pBdr>${o.bdr}</w:pBdr>`;
  if (o.shd) pp += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
  if (o.spacing) pp += o.spacing;
  if (o.ind) pp += o.ind;
  if (o.jc) pp += `<w:jc w:val="${o.jc}"/>`;
  return `<w:p>${pp ? `<w:pPr>${pp}</w:pPr>` : ''}${o.runs || ''}</w:p>`;
}
const wInd = (left, hanging) => `<w:ind w:left="${left}"${hanging ? ` w:hanging="${hanging}"` : ''}/>`;

function dataUrlBytes(url) {
  const m = url.match(/^data:image\/(png|jpe?g|gif);base64,(.*)$/is);
  if (!m) return null;
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const kind = m[1].toLowerCase().replace('jpg', 'jpeg');
  return { bytes: u8, ext: kind };
}
function imageSize(url) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = url; });
}

async function buildDocx(pages) {
  const images = [];     // {name, bytes, ext}
  const nums = [];       // numIds extras para listas numeradas (reiniciam)
  let nextNum = 2, docPrId = 1;
  const body = [];
  const MAXW = 5943600;  // 6.5" em EMU
  const MAXH = 8229600;  // 9"

  for (let pi = 0; pi < pages.length; pi++) {
    const p = pages[pi];
    const base = { font: WFONT[p.font || ''], size: p.small ? 20 : 0 };
    body.push(wPara({ style: 'Title', pageBreakBefore: pi > 0, runs: wRun({ text: p.title || 'Sem título' }, { font: base.font }) }));
    const bl = trimmedBlocks(p);
    let curNum = null;
    for (let i = 0; i < bl.length; i++) {
      const b = bl[i];
      const prev = bl[i - 1];
      const lvl = Math.min(b.indent || 0, 5);
      const runs = () => runsOf(b.html).map((r) => wRun(r, base)).join('');
      if (b.type !== 'numbered') curNum = null;
      switch (b.type) {
        case 'h1': case 'h2': case 'h3':
          body.push(wPara({ style: 'Heading' + b.type[1], ind: b.indent ? wInd(360 * b.indent) : '', runs: runsOf(b.html).map((r) => wRun(r, { font: base.font })).join('') })); break;
        case 'bullet': body.push(wPara({ style: 'ListParagraph', num: { id: 1, lvl }, runs: runs() })); break;
        case 'numbered': {
          const same = prev && prev.type === 'numbered' && (prev.indent || 0) === (b.indent || 0);
          if (!curNum || !same) { curNum = nextNum++; nums.push(curNum); }
          body.push(wPara({ style: 'ListParagraph', num: { id: curNum, lvl }, runs: runs() }));
          break;
        }
        case 'todo': case 'toggle': {
          const mark = b.type === 'toggle' ? '▸' : (b.checked ? '☑' : '☐');
          const mr = wRun({ text: mark + '  ' }, { font: 'Segoe UI Symbol', color: b.checked ? '2383E2' : '5D5C58' });
          const tr = runsOf(b.html).map((r) => wRun(r, { ...base, strike: b.type === 'todo' && b.checked, color: b.type === 'todo' && b.checked ? '8B8A86' : '' })).join('');
          body.push(wPara({ ind: wInd(360 + 360 * (b.indent || 0), 360), runs: mr + tr }));
          break;
        }
        case 'quote':
          body.push(wPara({ bdr: '<w:left w:val="single" w:sz="18" w:space="10" w:color="2F2E2B"/>', spacing: '<w:spacing w:before="80" w:after="80"/>', ind: wInd(240 + 360 * (b.indent || 0)), runs: runsOf(b.html).map((r) => wRun(r, { ...base, size: p.small ? 22 : 25 })).join('') }));
          break;
        case 'callout': {
          const box = ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="6" w:color="F1F1EF"/>`).join('');
          body.push(wPara({ bdr: box, shd: 'F1F1EF', spacing: '<w:spacing w:before="120" w:after="120"/>', ind: `<w:ind w:left="${240 + 360 * (b.indent || 0)}" w:right="240"/>`, runs: runs() }));
          break;
        }
        case 'code': {
          const lines = stripHtml(b.html).split('\n');
          const r = lines.map((ln, k) => (k ? '<w:r><w:br/></w:r>' : '') + wRun({ text: ln }, { font: 'Consolas', size: 19 })).join('');
          const box = ['top', 'left', 'bottom', 'right'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="6" w:color="E3E2E0"/>`).join('');
          body.push(wPara({ bdr: box, shd: 'F7F6F3', spacing: '<w:spacing w:before="120" w:after="120"/>', ind: `<w:ind w:left="${160 + 360 * (b.indent || 0)}" w:right="160"/>`, runs: r }));
          break;
        }
        case 'divider':
          body.push(wPara({ bdr: '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="D3D2CE"/>', spacing: '<w:spacing w:before="120" w:after="120"/>' })); break;
        case 'image': {
          if (!imgBlockOk(b)) break;
          const data = dataUrlBytes(imgSrc(b));
          const sz = await imageSize(imgSrc(b));
          if (!data || !sz) break;
          const name = `image${images.length + 1}.${data.ext === 'jpeg' ? 'jpeg' : data.ext}`;
          images.push({ name, bytes: data.bytes, ext: data.ext });
          let cx = b.w ? Math.round(MAXW * b.w / 100) : Math.min(sz.w * 9525, MAXW);
          let cy = Math.round(cx * sz.h / sz.w);
          if (cy > MAXH) { cx = Math.round(cx * MAXH / cy); cy = MAXH; }
          const id = docPrId++;
          const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Imagem ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImg${images.length}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
          body.push(wPara({ jc: b.align === 'center' ? 'center' : (b.align === 'right' || b.wrap === 'r') ? 'right' : '', spacing: '<w:spacing w:before="80" w:after="120"/>', runs: drawing }));
          break;
        }
        case 'table': {
          const rows = b.rows || []; if (!rows.length) break;
          const nc = Math.max(1, ...rows.map((r) => r.length)), cw = Math.floor(9360 / nc);
          const bd = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="D3D2CE"/>`;
          let x = `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${bd('top')}${bd('left')}${bd('bottom')}${bd('right')}${bd('insideH')}${bd('insideV')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + cw + '"/>'.repeat(nc)}</w:tblGrid>`;
          rows.forEach((r, ri) => {
            const hd = b.hdr && ri === 0;
            x += '<w:tr><w:trPr><w:cantSplit/>' + (hd ? '<w:tblHeader/>' : '') + '</w:trPr>';
            for (let ci = 0; ci < nc; ci++) {
              const rr = runsOf(r[ci] || '');
              x += `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${hd ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F1EF"/>' : ''}</w:tcPr>` + wPara({ spacing: '<w:spacing w:before="0" w:after="0"/>', runs: rr.map((q) => wRun(q, { ...base, bold: hd ? true : base.bold })).join('') }) + '</w:tc>';
            }
            x += '</w:tr>';
          });
          body.push(x + '</w:tbl>');
          body.push(wPara({ spacing: '<w:spacing w:before="0" w:after="80"/>', runs: '' }));
          break;
        }
        case 'embed':
          if (b.url) body.push(wPara({ runs: wRun({ text: 'Site: ' + b.url, color: '2383E2' }, base) })); break;
        case 'video':
          if (b.file) { body.push(wPara({ runs: wRun({ text: '▶ Vídeo (arquivo): ' + b.file.replace(/^[^_]*_/, '') }, base) })); break; }
          if (b.vid) body.push(wPara({ runs: wRun({ text: '▶ Vídeo: ' + ytWatch(b), color: '2383E2' }, base) })); break;
        case 'page':
          body.push(wPara({ ind: wInd(360 * (b.indent || 0)), runs: wRun({ text: '→ ' + pageLabel(b), bold: true }, base) })); break;
        default:
          body.push(wPara({ ind: b.indent ? wInd(360 * b.indent) : '', runs: runs() }));
      }
    }
  }

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const documentXml = `${HEAD}<w:document ${NS}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const hdr = (id, name, sz, before, after) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="${after}"/><w:outlineLvl w:val="${id.slice(-1) - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:style>`;
  const stylesXml = `${HEAD}<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
    + `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="10"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="280" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:b/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>`
    + hdr('Heading1', 'heading 1', 36, 360, 120) + hdr('Heading2', 'heading 2', 30, 280, 100) + hdr('Heading3', 'heading 3', 26, 220, 80)
    + `<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style></w:styles>`;

  const lvl = (i, fmt, text, font) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + 360 * i}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr>` : ''}</w:lvl>`;
  const bullets = ['•', '◦', '▪', '•', '◦', '▪'].map((c, i) => lvl(i, 'bullet', c, 'Arial')).join('');
  const nfmt = ['decimal', 'lowerLetter', 'lowerRoman', 'decimal', 'lowerLetter', 'lowerRoman'];
  const numbered = nfmt.map((f, i) => lvl(i, f, `%${i + 1}.`, '')).join('');
  const overrides = [0, 1, 2, 3, 4, 5].map((i) => `<w:lvlOverride w:ilvl="${i}"><w:startOverride w:val="1"/></w:lvlOverride>`).join('');
  const numberingXml = `${HEAD}<w:numbering ${NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${numbered}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.map((n) => `<w:num w:numId="${n}"><w:abstractNumId w:val="1"/>${overrides}</w:num>`).join('')}</w:numbering>`;

  const rels = [
    '<Relationship Id="rIdSt" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
  ].concat(images.map((im, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.name}"/>`));
  const docRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
  const exts = new Set(images.map((im) => im.ext));
  const types = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${exts.has('png') ? '<Default Extension="png" ContentType="image/png"/>' : ''}${exts.has('jpeg') ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''}${exts.has('gif') ? '<Default Extension="gif" ContentType="image/gif"/>' : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
  const rootRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const enc = new TextEncoder();
  const files = [
    { name: '[Content_Types].xml', data: enc.encode(types) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'word/document.xml', data: enc.encode(documentXml) },
    { name: 'word/styles.xml', data: enc.encode(stylesXml) },
    { name: 'word/numbering.xml', data: enc.encode(numberingXml) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) }
  ].concat(images.map((im) => ({ name: 'word/media/' + im.name, data: im.bytes })));
  return zipStore(files);
}

/* ---------- Executar exportação ---------- */
async function doExport(id, fmt, withSub) {
  const root = S.pages[id];
  const pages = exportPages(id, withSub);
  const title = root.title || 'Sem título';
  const f = EXPORT_FORMATS.find((x) => x.k === fmt);
  const name = safeName(title) + '.' + f.ext;
  const enc = new TextEncoder();
  try {
    let res;
    if (fmt === 'pdf') {
      res = await window.api.exportPdf({ name, html: buildHtmlDoc(pages, title) });
    } else {
      let bytes;
      if (fmt === 'docx') bytes = await buildDocx(pages);
      else if (fmt === 'html') bytes = enc.encode(buildHtmlDoc(pages, title));
      else if (fmt === 'md') bytes = enc.encode('﻿' + pages.map(pageMd).join('\n---\n\n'));
      else bytes = enc.encode('﻿' + pages.map(pageTxt).join('\n\n' + '-'.repeat(40) + '\n\n'));
      res = await window.api.saveFile({ name, filters: [{ name: f.name + ' (.' + f.ext + ')', extensions: [f.ext] }], bytes });
    }
    if (res && res.ok && !res.silent) toast('Exportado: ' + (res.name || String(res.path).split(/[\\/]/).pop()), window.api.revealLabel || 'Mostrar pasta', () => window.api.reveal(res.path));
    return res;
  } catch (e) {
    console.error(e);
    toast('Não foi possível exportar: ' + (e && e.message ? e.message.replace(/^Error invoking remote method '[^']+': /, '') : e));
  }
}

/* ---------- Diálogo ---------- */
function exportDialog(id) {
  const p = S.pages[id];
  if (!p) return;
  const hasSub = p.children.some((c) => S.pages[c] && !inTrash(S.pages[c]));
  const state = { fmt: 'docx', sub: false };
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.display = 'flex';
  ov.innerHTML = `<div class="modal-box xbox"><div class="modal-title"><span>Exportar “${esc(p.title || 'Sem título')}”</span></div><div class="xgrid"></div>${hasSub ? '<label class="xsub"><input type="checkbox" id="xSub"> Incluir subpáginas</label>' : ''}<div class="xfoot"><button class="xbtn" id="xCancel">Cancelar</button><button class="xbtn primary" id="xGo">Exportar</button></div></div>`;
  const grid = ov.querySelector('.xgrid');
  const draw = () => {
    grid.innerHTML = '';
    EXPORT_FORMATS.forEach((f) => {
      const d = document.createElement('div');
      d.className = 'xfmt' + (state.fmt === f.k ? ' sel' : '');
      d.innerHTML = `<span class="xic" style="background:${f.color}">${f.ico}</span><span><b>${f.name}</b><small>${f.desc}</small></span>`;
      d.onclick = () => { state.fmt = f.k; draw(); };
      d.ondblclick = () => go_();
      grid.appendChild(d);
    });
  };
  const close = () => { document.removeEventListener('keydown', onKey, true); ov.remove(); };
  const go_ = () => { const fmt = state.fmt, sub = hasSub && ov.querySelector('#xSub').checked; close(); doExport(id, fmt, sub); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go_(); } };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  ov.querySelector('#xCancel').onclick = close;
  ov.querySelector('#xGo').onclick = go_;
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(ov);
  draw();
  ov.querySelector('#xGo').focus();
}
