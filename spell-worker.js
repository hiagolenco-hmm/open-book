/* Corretor ortográfico offline (PT-BR + EN) — filtro de Bloom + geração de candidatos. */
importScripts('dict_pt.js', 'dict_en.js');
const D = {};
function prep(k, d) {
  const bin = atob(d.b), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  D[k] = { m: d.m, k: d.k, bits: u, tri: new Set(d.t.split(' ')) };
  d.b = null;
}
prep('pt', self.DICT_pt); prep('en', self.DICT_en);
function mix(h) { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
function has(lang, w) {
  const d = D[lang]; let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < w.length; i++) { const c = w.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = (Math.imul(b, 33) ^ c) >>> 0; }
  a = mix(a); b = (mix((b | 1) >>> 0) | 1) >>> 0;
  for (let i = 0; i < d.k; i++) { const p = (a + i * b) % d.m; if (!(d.bits[p >> 3] & (1 << (p & 7)))) return false; }
  return true;
}
const user = new Set();
const CLIT = new Set('me te se lhe lhes nos vos o a os as lo la los las no na nas lho lha lhos lhas mo ma to ta á iam ia ei ão ás emos ias'.split(' '));
function okWord(w) {
  w = w.toLowerCase().replace(/’/g, "'");
  if (!w || user.has(w)) return true;
  if (/\d/.test(w) || w.length === 1) return true;
  if (has('pt', w) || has('en', w)) return true;
  if (w.indexOf('-') > 0) {
    const ps = w.split('-').filter(Boolean);
    if (ps.length > 1 && ps.every((p, i) => user.has(p) || has('pt', p) || has('en', p) || (i > 0 && CLIT.has(p)))) return true;
  }
  if (/^[^a-zà-ÿ]*$/.test(w)) return true;
  // possessivo/contrações do inglês
  if (/'s$/.test(w) && has('en', w.slice(0, -2))) return true;
  if (/n't$|'(ll|re|ve|d|m)$/.test(w)) return has('en', w.replace(/n't$|'(ll|re|ve|d|m)$/, '')) || has('en', w.replace(/'.*$/, '')) || has('en', w);
  return false;
}
const ALPHA = { pt: 'abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüç'.split(''), en: "abcdefghijklmnopqrstuvwxyz'".split('') };
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function edits1(w, lang) {
  const al = ALPHA[lang], out = new Set(), n = w.length;
  for (let i = 0; i < n; i++) out.add(w.slice(0, i) + w.slice(i + 1));
  for (let i = 0; i < n - 1; i++) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  for (let i = 0; i < n; i++) for (const c of al) if (c !== w[i]) out.add(w.slice(0, i) + c + w.slice(i + 1));
  for (let i = 0; i <= n; i++) for (const c of al) out.add(w.slice(0, i) + c + w.slice(i));
  return out;
}
function plausible(lang, c) {
  const tri = D[lang].tri, x = '^' + c + '$';
  for (let i = 0; i < x.length - 2; i++) if (!tri.has(x.substr(i, 3))) return false;
  return true;
}
function cands(w, lang, deep) {
  const e1 = edits1(w, lang), r = [];
  for (const c of e1) if (plausible(lang, c) && has(lang, c)) r.push([c, 1]);
  if (deep && r.length < 8 && w.length > 3 && w.length < 14) {
    const seen = new Set(e1);
    outer: for (const e of e1) {
      for (const c of edits1(e, lang)) {
        if (seen.has(c)) continue; seen.add(c);
        if (plausible(lang, c) && has(lang, c)) { r.push([c, 2]); if (r.length > 25) break outer; }
      }
    }
  }
  return r;
}
function score(w, c, d) {
  let s = d * 10;
  if (strip(c) === strip(w)) s -= 8;            // só acento
  if (c[0] !== w[0]) s += 3;                    // primeira letra diferente
  s += Math.abs(c.length - w.length);
  if (/^[a-zà-ÿ]+$/.test(c) === false) s += 2;
  return s;
}
function matchCase(src, c) {
  if (src.length > 1 && src === src.toUpperCase()) return c.toUpperCase();
  if (src[0] !== src[0].toLowerCase()) return c[0].toUpperCase() + c.slice(1);
  return c;
}
function suggest(word, pref) {
  const lw = word.toLowerCase().replace(/’/g, "'");
  const nonAscii = /[à-ÿ]/.test(lw);
  const langs = nonAscii ? ['pt'] : (pref === 'en' ? ['en', 'pt'] : ['pt', 'en']);
  const all = [];
  langs.forEach((lang, li) => {
    for (const [c, d] of cands(lw, lang, true)) {
      if (c === lw) continue;
      all.push([c, score(lw, c, d) + li * 4]);
    }
  });
  all.sort((a, b) => a[1] - b[1]);
  const seen = new Set(), out = [];
  for (const [c] of all) { if (!seen.has(c)) { seen.add(c); out.push(matchCase(word, c)); if (out.length >= 6) break; } }
  return out;
}
function langOf(word) {
  const w = word.toLowerCase(); const p = has('pt', w), e = has('en', w);
  return p && !e ? 'pt' : e && !p ? 'en' : p && e ? 'both' : '';
}
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.op === 'check') {
    self.postMessage({ id: m.id, bad: m.words.map((w) => (okWord(w) ? 0 : 1)), langs: m.words.map(langOf) });
  } else if (m.op === 'suggest') {
    self.postMessage({ id: m.id, list: suggest(m.word, m.pref), lang: langOf(m.word) });
  } else if (m.op === 'user') {
    user.clear(); (m.words || []).forEach((w) => user.add(String(w).toLowerCase()));
    self.postMessage({ id: m.id });
  }
};
self.postMessage({ ready: true });
