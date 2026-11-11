/* Sinônimos, tradução e dicionário offline (WordNet/OpenWordNet-PT + Dicionário Aberto). */
importScripts('lex_wn.js', 'lex_da.js', 'lex_tr.js');
const WN = self.LEX_WN, DA = self.LEX_DA, TR = self.LEX_TR;
const POS = { n: 'subst.', v: 'verbo', a: 'adj.', s: 'adj.', r: 'adv.' };
const POSEN = { n: 'noun', v: 'verb', a: 'adj.', s: 'adj.', r: 'adv.' };
function enForms(w) {
  const r = [w];
  const add = (x) => { if (x && x.length > 1) r.push(x); };
  if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/(s|x|z|ch|sh)es$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ed$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (/(.)\1ed$/.test(w)) add(w.slice(0, -3)); }
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); if (/(.)\1ing$/.test(w)) add(w.slice(0, -4)); }
  if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
  if (/ly$/.test(w)) add(w.slice(0, -2));
  if (/men$/.test(w)) add(w.slice(0, -3) + 'man');
  return r;
}
const VSUF = ['ávamos', 'áramos', 'ássemos', 'áveis', 'aremos', 'ámos', 'aste', 'astes', 'aram', 'ávam', 'ávais', 'ía', 'íamos', 'íam', 'êssemos', 'eremos', 'eram', 'ando', 'endo', 'indo', 'ado', 'ada', 'ados', 'adas', 'ido', 'ida', 'idos', 'idas', 'amos', 'emos', 'imos', 'am', 'em', 'ou', 'eu', 'iu', 'ei', 'o', 'a', 'as', 'e', 'es', 'ava', 'avam', 'avamos', 'aram', 'eram', 'iram', 'ará', 'erá', 'irá', 'aria', 'eria', 'iria', 'asse', 'esse', 'isse', 'ar', 'er', 'ir', 'ando', 'ou'];
function ptForms(w) {
  const r = [w];
  const add = (x) => { if (x && x.length > 1) r.push(x); };
  if (/ões$/.test(w)) add(w.slice(0, -3) + 'ão');
  if (/ães$/.test(w)) add(w.slice(0, -3) + 'ão');
  if (/ãos$/.test(w)) add(w.slice(0, -1));
  if (/ais$/.test(w)) add(w.slice(0, -2) + 'al');
  if (/eis$/.test(w)) add(w.slice(0, -2) + 'el');
  if (/éis$/.test(w)) add(w.slice(0, -3) + 'el');
  if (/óis$/.test(w)) add(w.slice(0, -3) + 'ol');
  if (/uis$/.test(w)) add(w.slice(0, -2) + 'ul');
  if (/ns$/.test(w)) add(w.slice(0, -2) + 'm');
  if (/res$|zes$|ses$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w)) add(w.slice(0, -1));
  if (/(a|as)$/.test(w)) { const b = w.replace(/as?$/, ''); add(b + 'o'); add(b); add(b + 'e'); }
  if (/(os)$/.test(w)) add(w.slice(0, -2) + 'o');
  if (/ora$/.test(w)) add(w.slice(0, -1));
  if (/(íssimo|íssima)s?$/.test(w)) add(w.replace(/íssim[oa]s?$/, 'o'));
  if (/mente$/.test(w)) add(w.slice(0, -5));
  const seen = new Set();
  for (const s of VSUF) {
    if (w.length > s.length + 2 && w.endsWith(s) && !seen.has(s)) {
      seen.add(s);
      const st = w.slice(0, -s.length);
      add(st + 'ar'); add(st + 'er'); add(st + 'ir'); add(st + 'or');
      if (/ç$/.test(st)) add(st.slice(0, -1) + 'çar');
      if (/c$/.test(st)) { add(st.slice(0, -1) + 'çar'); }
      if (/qu$/.test(st)) add(st.slice(0, -2) + 'car');
      if (/gu$/.test(st)) add(st.slice(0, -2) + 'gar');
    }
  }
  return r;
}
const hasIdx = (lang, w) => Object.prototype.hasOwnProperty.call(WN[lang], w);
function resolve(word, hint) {
  const w = word.toLowerCase().replace(/’/g, "'").trim();
  const find = (lang) => {
    const fs = lang === 'en' ? enForms(w) : ptForms(w);
    for (const f of fs) if (hasIdx(lang, f) || (lang === 'pt' && DA[f])) return f;
    return null;
  };
  const pt = find('pt'), en = find('en');
  const asciiOnly = /^[a-z'\- ]+$/.test(w);
  let lang = null;
  if (pt && en) lang = hint === 'en' ? 'en' : hint === 'pt' ? 'pt' : (pt === w && en !== w ? 'pt' : en === w && pt !== w ? 'en' : (asciiOnly && hint !== 'pt' ? 'en' : 'pt'));
  else if (pt) lang = 'pt'; else if (en) lang = 'en';
  if (!lang) return null;
  return { lang, lemma: lang === 'pt' ? pt : en };
}
function sidsOf(lang, lemma) { const s = WN[lang][lemma]; return s ? s.split(',').map(Number) : []; }
function rank(map, skip) {
  const seen = new Set(), out = [];
  [...map.entries()].filter((e) => e[0].toLowerCase() !== skip).sort((a, b) => b[1] - a[1]).forEach((e) => {
    const k = e[0].toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push(k === e[0] || e[0][0] === e[0][0].toLowerCase() ? e[0] : (/^[A-Z]/.test(e[0]) && e[0].length > 1 && e[0] === e[0].toUpperCase() ? e[0] : e[0]));
  });
  return out.filter((w) => !(w.endsWith('s') && seen.has(w.slice(0, -1).toLowerCase())));
}
function syns(r) {
  const m = new Map();
  sidsOf(r.lang, r.lemma).slice(0, 8).forEach((id, i) => {
    const s = WN.S[id];
    (r.lang === 'en' ? s[1] : s[2]).split('|').forEach((l) => { if (l) m.set(l, (m.get(l) || 0) + 10 - i); });
  });
  return rank(m, r.lemma).slice(0, 25);
}
function trans(r, nsyn) {
  const m = new Map();
  sidsOf(r.lang, r.lemma).slice(0, nsyn || 10).forEach((id, i) => {
    const s = WN.S[id];
    (r.lang === 'en' ? s[2] : s[1]).split('|').forEach((l) => { if (l) m.set(l, (m.get(l) || 0) + 10 - i); });
  });
  return rank(m, '').slice(0, 20);
}
function defs(r) {
  const out = [];
  if (r.lang === 'pt') {
    (DA[r.lemma] || []).forEach((s) => out.push({ pos: s[0], text: s[1] }));
    if (out.length < 3) {
      const seenG = new Set();
      sidsOf('pt', r.lemma).slice(0, 6).forEach((id) => { const s = WN.S[id]; if (out.length >= 5) return; const g = s[4] || s[3]; if (g && !seenG.has(g)) { seenG.add(g); out.push({ pos: POS[s[0]] + (s[4] ? '' : ' (en)'), text: g }); } });
    }
    if (!out.length) sidsOf('pt', r.lemma).slice(0, 5).forEach((id) => { const s = WN.S[id]; const g = s[4]; if (g) out.push({ pos: POS[s[0]], text: g }); });
    if (!out.length) sidsOf('pt', r.lemma).slice(0, 4).forEach((id) => { const s = WN.S[id]; if (s[3]) out.push({ pos: POS[s[0]] + ' (en)', text: s[3] }); });
  } else {
    sidsOf('en', r.lemma).slice(0, 8).forEach((id) => { const s = WN.S[id]; if (s[3]) out.push({ pos: POSEN[s[0]], text: s[3] + (s[5] ? ' — “' + s[5] + '”' : '') }); });
  }
  return out;
}
function cleanWn(items, lemma) {
  const seen = new Set();
  return items.filter((x) => {
    const k = x.toLowerCase();
    if (k === lemma || seen.has(k) || /-lpar-|-rpar-|_/.test(x) || x.split(/\s+/).length > 3) return false;
    if (/^[A-Z]/.test(x) && /^[a-z]/.test(lemma)) return false;
    seen.add(k); return true;
  });
}
function trGroups(word, hint, dom) {
  const w = word.toLowerCase().replace(/’/g, "'").trim();
  const mk = (lang) => {
    const forms = lang === 'en' ? enForms(w) : ptForms(w);
    let strong = null, weak = null;
    for (const f of forms) { if (!strong && TR[lang][f] && TR[lang][f].length) strong = f; if (!weak && hasIdx(lang, f)) weak = f; if (strong) break; }
    const lemma = strong || weak; if (!lemma) return null;
    const items = (strong ? TR[lang][strong].slice() : []);
    const have = new Set(items.map((x) => x.toLowerCase()));
    if (weak || strong) {
      const r = { lang, lemma: weak || strong };
      cleanWn(trans(r, strong ? 3 : 10), lemma).slice(0, strong ? 5 : 20).forEach((x) => { if (!have.has(x.toLowerCase())) { have.add(x.toLowerCase()); items.push(x); } });
    }
    if (!items.length) return null;
    return { lang, lemma, exact: lemma === w, strong: !!strong, items: items.slice(0, 24), title: lang === 'en' ? 'Inglês → Português' : 'Português → Inglês' };
  };
  let gs = ['en', 'pt'].map(mk).filter(Boolean);
  if (gs.length > 1 && gs.filter((g) => g.exact).length === 1 && !(hint === 'en' || hint === 'pt')) gs = gs.filter((g) => g.exact);
  if (gs.length > 1) {
    if (hint === 'en' || hint === 'pt') { const only = gs.filter((g) => g.lang === hint); if (only.length) gs = only; }
    else if (gs.some((g) => g.strong)) gs = gs.filter((g) => g.strong);
    else gs = gs.filter((g) => g.lang === dom);
  }
  gs.sort((a, b) => (a.lang === (hint || dom) ? -1 : 1) - (b.lang === (hint || dom) ? -1 : 1));
  return gs;
}
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.kind === 'tr') {
    const gs = trGroups(m.word, m.hint, m.dom || 'pt');
    self.postMessage(gs.length ? { id: m.id, groups: gs } : { id: m.id, none: true });
    return;
  }
  const r = resolve(m.word, m.hint || m.dom);
  if (!r) { self.postMessage({ id: m.id, none: true }); return; }
  const res = { id: m.id, lang: r.lang, lemma: r.lemma };
  if (m.kind === 'syn') res.items = syns(r);
  else if (m.kind === 'tr') res.items = trans(r);
  else res.items = defs(r);
  self.postMessage(res);
};
self.postMessage({ ready: true });
