/* Open Book — ponte web/iPad (substitui o Electron): dados em IndexedDB, tudo offline */
(function () {
  if (window.api) return;
  var H = document.documentElement;
  H.classList.add('webapp');
  var dbp = null;
  function db() {
    return dbp || (dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('openbook', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('kv'); d.createObjectStore('videos'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    }));
  }
  function get(store, key) {
    return db().then(function (d) { return new Promise(function (res, rej) {
      var q = d.transaction(store).objectStore(store).get(key); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    }); });
  }
  function put(store, key, val) {
    return db().then(function (d) { return new Promise(function (res, rej) {
      var t = d.transaction(store, 'readwrite'); t.objectStore(store).put(val, key);
      t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); };
    }); });
  }
  var chain = Promise.resolve();
  function dl(name, blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  window.api = {
    revealLabel: 'Abrir',
    load: function () {
      return Promise.all([get('kv', 'notas'), get('kv', 'imagens')]).then(function (r) {
        var d = r[0]; if (!d) return null;
        d.images = r[1] || d.images || {}; return d;
      }).catch(function () { return null; });
    },
    save: function (data, images) {
      chain = chain.then(function () {
        var p = [put('kv', 'notas', data)];
        if (images) p.push(put('kv', 'imagens', images));
        return Promise.all(p);
      }).catch(function () {});
      return chain.then(function () { return true; });
    },
    saveFile: function (o) {
      return Promise.resolve().then(function () {
        var n = o.name, mime = 'application/octet-stream';
        if (/\.json$/i.test(n)) mime = 'application/json';
        else if (/\.docx$/i.test(n)) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (/\.html?$/i.test(n)) mime = 'text/html';
        else if (/\.md$/i.test(n)) mime = 'text/markdown';
        else if (/\.txt$/i.test(n)) mime = 'text/plain';
        dl(n, new Blob([o.bytes], { type: mime }));
        return { ok: true, name: n, path: n };
      });
    },
    exportPdf: function (o) {
      return new Promise(function (res) {
        var f = document.createElement('iframe');
        f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        f.onload = function () {
          setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 60000); res({ ok: true, silent: true }); }, 400);
        };
        f.srcdoc = o.html; document.body.appendChild(f);
      });
    },
    reveal: function () { return Promise.resolve(true); },
    openExternal: function (u) { window.open(u, '_blank', 'noopener'); return Promise.resolve(true); },
    clipInfo: function () { return Promise.resolve({ text: !!(navigator.clipboard && navigator.clipboard.readText), image: false }); },
    clipImage: function () { return Promise.resolve(null); },
    clipPaste: function () {
      return (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText() : Promise.resolve('')).then(function (t) {
        if (t) document.execCommand('insertText', false, t);
      }).catch(function () {});
    },
    /* Vídeos: guardados no IndexedDB e servidos pelo service worker (com suporte a Range) em ob-video/ */
    videoBase: function () { return Promise.resolve(new URL('ob-video/', location.href).href); },
    videoImportFile: function (f) {
      var ext = ((f.name || '').match(/\.[^.]+$/) || ['.mp4'])[0].toLowerCase();
      var base = (f.name || 'video').replace(/\.[^.]+$/, '').replace(/[^\w\-. ()À-ſ]/g, '_').slice(0, 60) || 'video';
      var name = Date.now().toString(36) + '_' + base + ext;
      return put('videos', name, f).then(function () { return { name: name }; }).catch(function () { return { error: 'Sem espaço para guardar o vídeo' }; });
    },
    videoImport: function () { return Promise.resolve({ error: 'Use o botão de arquivo' }); },
    videoReveal: function (n) {
      return get('videos', n).then(function (b) { if (b) dl(n.replace(/^[^_]*_/, ''), b); });
    }
  };

  /* iPad: toque longo = botão direito (menus de contexto) */
  var t0 = null, tm = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, el: e.target };
    clearTimeout(tm);
    tm = setTimeout(function () {
      if (!t0) return;
      var ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: t0.x, clientY: t0.y, button: 2 });
      t0.el.dispatchEvent(ev); t0 = null;
    }, 550);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!t0) return; var t = e.touches[0];
    if (Math.abs(t.clientX - t0.x) + Math.abs(t.clientY - t0.y) > 10) { clearTimeout(tm); t0 = null; }
  }, { passive: true });
  ['touchend', 'touchcancel'].forEach(function (n) { document.addEventListener(n, function () { clearTimeout(tm); t0 = null; }, { passive: true }); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    var had = !!navigator.serviceWorker.controller, pending = false;
    var typing = function () { var a = document.activeElement; return a && (a.isContentEditable || /^(INPUT|TEXTAREA)$/.test(a.tagName)); };
    var tryReload = function () { if (pending && !typing()) location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (had) { pending = true; tryReload(); } had = true; });
    document.addEventListener('focusout', function () { setTimeout(tryReload, 1500); });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) {
        var chk = function () { try { r.update(); } catch (e) {} };
        document.addEventListener('visibilitychange', function () { if (!document.hidden) chk(); });
        setInterval(chk, 30 * 60 * 1000);
      }).catch(function () {});
    });
  }
})();
