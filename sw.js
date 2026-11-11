/* Open Book — service worker: funciona offline + serve vídeos importados com Range */
const V = "ob-2.5.1";
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'extras.js', 'export.js', 'spell.js', 'web.js', 'emoji-data.js', 'spell-worker.js', 'lex-worker.js', 'dict_pt.js', 'dict_en.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
function idbGet(name) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('openbook', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('videos'); };
    r.onsuccess = () => { const q = r.result.transaction('videos').objectStore('videos').get(name); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); };
    r.onerror = () => rej(r.error);
  });
}
async function video(req, url) {
  const name = decodeURIComponent(url.pathname.split('/ob-video/')[1] || '');
  const blob = await idbGet(name);
  if (!blob) return new Response('', { status: 404 });
  const type = blob.type || 'video/mp4', size = blob.size, h = req.headers.get('range');
  if (!h) return new Response(blob, { status: 200, headers: { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' } });
  const m = /bytes=(\d*)-(\d*)/.exec(h);
  let s = m[1] ? parseInt(m[1], 10) : 0, e = m[2] ? parseInt(m[2], 10) : size - 1;
  if (!m[1] && m[2]) { s = Math.max(0, size - parseInt(m[2], 10)); e = size - 1; }
  e = Math.min(e, size - 1);
  return new Response(blob.slice(s, e + 1), { status: 206, headers: { 'Content-Type': type, 'Content-Length': e - s + 1, 'Content-Range': `bytes ${s}-${e}/${size}`, 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (url.origin !== location.origin || req.method !== 'GET') return;
  if (url.pathname.includes('/ob-video/')) { e.respondWith(video(req, url)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && r.status === 200) { const c = r.clone(); caches.open(V).then((ca) => ca.put(req, c)); }
    return r;
  })));
});
