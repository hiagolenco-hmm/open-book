/* OCR offline (Tesseract compilado para WebAssembly) */
let Tess = null, api = null;
const post = (m) => self.postMessage(m);
function readFile(url) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('GET', url); x.responseType = 'arraybuffer';
    x.onload = () => (x.status === 0 || x.status === 200 ? res(new Uint8Array(x.response)) : rej(new Error('HTTP ' + x.status)));
    x.onerror = () => rej(new Error('Falha ao ler ' + url)); x.send();
  });
}
const simdOk = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } };
async function init(langs) {
  post({ type: 'status', text: 'Carregando o motor de leitura…' });
  importScripts(simdOk() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js');
  Tess = await self.TesseractCore({ TesseractProgress: (p) => post({ type: 'progress', value: Math.max(0, (p - 30) / 70) }) });
  post({ type: 'status', text: 'Carregando dicionários de idioma…' });
  for (const l of langs) Tess.FS.writeFile('./' + l + '.traineddata', await readFile(l + '.traineddata'));
  api = new Tess.TessBaseAPI();
  const st = api.Init(null, langs.join('+'), 1);
  if (st === -1) throw new Error('Falha ao iniciar o reconhecimento');
}
self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.op === 'recognize') {
      if (!api) await init(m.langs || ['por', 'eng']);
      post({ type: 'status', text: 'Lendo o texto…' });
      Tess.FS.writeFile('/input', new Uint8Array(m.bytes));
      api.SetVariable('tessedit_pageseg_mode', String(m.psm || 3));
      api.SetVariable('preserve_interword_spaces', '1');
      if (api.SetImageFile(1, 0) === 1) throw new Error('Não foi possível ler a imagem');
      api.Recognize(null);
      post({ type: 'done', text: api.GetUTF8Text(), conf: api.MeanTextConf ? api.MeanTextConf() : null });
    }
  } catch (e) { post({ type: 'error', text: String(e && e.message || e) }); }
};
