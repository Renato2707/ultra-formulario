/* folder.js - "Pasta de dados" (Etapa D, rodada D1). Strict ES5, no dependencies.
 * Uses the File System Access API (Chrome/Edge: showDirectoryPicker) to keep the
 * app's data as plain files in a folder chosen once by the user (e.g. on the pendrive):
 *   banco-de-frases.txt   the phrase bank, byte-for-byte as chosen ("Trocar arquivo")
 *   configuracoes.json    settings
 *   dados.json            own models/phrases, edits, hidden items, order, usage, searches
 *   rascunhos/<aba>.json  per-tab drafts (the report being written)
 *   backups/              previous banks (last 10)
 * localStorage (UStore) stays the live working copy shared between tabs; every local
 * write is mirrored into the folder shortly after. Without the API (Firefox, IE11) or
 * after "Usar só o navegador" the app works exactly as before (browser only).
 * The folder handle is kept in IndexedDB; the browser may ask for permission again
 * after a restart: then a small "Reconectar" bar is shown (one click). */
var UFolder = (function () {
  'use strict';
  var BANK = 'banco-de-frases.txt', CONF = 'configuracoes.json', DATA = 'dados.json', DRAFTS = 'rascunhos', BACKUPS = 'backups', MAX_BACKUPS = 10;
  var DATA_KEYS = ['userModels', 'userPhrases', 'overrides', 'hidden', 'order', 'usage', 'usageLast', 'search', 'searchHist'];
  var available = false;
  try { available = typeof window.showDirectoryPicker === 'function' && !!window.indexedDB && typeof window.Promise === 'function'; } catch (e0) { available = false; }
  var dir = null, state = available ? 'browser' : 'unavailable', listeners = [], pending = {}, timer = null, chain = null, decoder = null, lastErr = '';
  var touched = {}, lateFns = [];   /* D3: keys written by the app while the folder was still being read (slow pendrive) */

  function setState(s, msg) { state = s; if (msg) { lastErr = msg; } for (var i = 0; i < listeners.length; i++) { try { listeners[i](s); } catch (e) {} } }
  function mode() { return UStore.get('storeMode', null) || 'auto'; }   /* 'folder' | 'browser' | 'auto' (unknown: look for a saved folder) */
  function decode(file, cb) {
    if (decoder) { decoder(file, cb); return; }
    /* same rule as "Escolher arquivo": UTF-8, or Windows-1252 when it is not valid UTF-8 (Word "Texto sem formatação") */
    function read(enc, next) { var fr = new FileReader(); fr.onload = function () { next(fr.result); }; fr.readAsText(file, enc); }
    read('UTF-8', function (t) { if (t.indexOf('\ufffd') >= 0) { read('windows-1252', cb); } else { cb(t); } });
  }
  function q(fn) { chain = (chain || Promise.resolve()).then(fn, fn); return chain; }  /* serialize folder writes */

  /* ---------- IndexedDB: remember the folder handle ---------- */
  function idb(fn) {
    var r;
    try { r = window.indexedDB.open('ultra-formulario', 1); } catch (e) { fn(null); return; }
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { fn(r.result); };
    r.onerror = function () { fn(null); };
  }
  function idbPut(v, cb) {
    idb(function (db) {
      if (!db) { if (cb) { cb(); } return; }
      var t = db.transaction('kv', 'readwrite');
      if (v === null) { t.objectStore('kv')['delete']('dir'); } else { t.objectStore('kv').put(v, 'dir'); }
      t.oncomplete = t.onerror = function () { db.close(); if (cb) { cb(); } };
    });
  }
  function idbGet(cb) {
    idb(function (db) {
      if (!db) { cb(null); return; }
      var g;
      try { g = db.transaction('kv', 'readonly').objectStore('kv').get('dir'); } catch (e) { cb(null); return; }
      g.onsuccess = function () { db.close(); cb(g.result || null); };
      g.onerror = function () { db.close(); cb(null); };
    });
  }

  /* ---------- file helpers (all return promises) ---------- */
  function sub(name, create) { return dir.getDirectoryHandle(name, { create: !!create }); }
  function split(path) { var i = path.indexOf('/'); return i < 0 ? [null, path] : [path.slice(0, i), path.slice(i + 1)]; }
  function getFile(path) {
    var p = split(path), d = p[0] ? sub(p[0], false) : Promise.resolve(dir);
    return d.then(function (h) { return h.getFileHandle(p[1]); }).then(function (fh) { return fh.getFile(); })['catch'](function () { return null; });
  }
  function writeFile(path, data) {
    return q(function () {
      if (!dir) { return null; }
      var p = split(path), d = p[0] ? sub(p[0], true) : Promise.resolve(dir), fh;
      return d.then(function (h) { return h.getFileHandle(p[1], { create: true }); })
        .then(function (h) { fh = h; return h.createWritable(); })
        .then(function (w) { return w.write(data).then(function () { return w.close(); }); })
        .then(function () { return fh.getFile(); })
        ['catch'](function (e) { fail(e); return null; });
    });
  }
  function removeFile(path) {
    return q(function () {
      if (!dir) { return null; }
      var p = split(path), d = p[0] ? sub(p[0], false) : Promise.resolve(dir);
      return d.then(function (h) { return h.removeEntry(p[1]); })['catch'](function () { return null; });
    });
  }
  function listDir(name) {   /* -> [{name, handle}] (files only); [] when missing */
    return sub(name, false).then(function (h) {
      var out = [], it = h.values();
      function step() {
        return it.next().then(function (r) {
          if (r.done) { return out; }
          if (r.value.kind === 'file') { out.push(r.value); }
          return step();
        });
      }
      return step();
    })['catch'](function () { return []; });
  }
  function readJSON(path) {
    return getFile(path).then(function (f) {
      if (!f) { return null; }
      return f.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } });
    });
  }
  function fail(e) {
    var m = String(e && (e.name || e.message) || e);
    if (state === 'folder') { setState('error', m); }
  }
  function json(v) { return JSON.stringify(v, null, 2); }
  function dataObj() { var o = {}, i; for (i = 0; i < DATA_KEYS.length; i++) { o[DATA_KEYS[i]] = UStore.get(DATA_KEYS[i], null); } return o; }

  /* ---------- mirror local writes into the folder ---------- */
  function mirrorKey(key) {
    if (key === 'settings') { return CONF; }
    if (DATA_KEYS.indexOf(key) >= 0) { return DATA; }
    if (key.indexOf('draft.') === 0) { return DRAFTS + '/' + key.slice(6) + '.json'; }
    return null;    /* bank (written as bytes), tabs, drafts index, meta keys */
  }
  UStore.onWrite(function (key) {
    var f = mirrorKey(key); if (!f) { return; }
    if (state === 'loading') { touched[key] = 1; pending[f] = key; if (key.indexOf('draft.') !== 0) { UStore.set('folderDirty', 1, true); } return; }   /* written after the late read finishes */
    if (state !== 'folder') { if (dir && key.indexOf('draft.') !== 0) { UStore.set('folderDirty', 1, true); } return; }
    pending[f] = key; if (!timer) { timer = setTimeout(flush, 400); }
  });
  function flush() {
    timer = null;
    var f, all = [], k;
    for (f in pending) {
      if (!pending.hasOwnProperty(f)) { continue; }
      k = pending[f];
      if (f === CONF) { all.push(writeFile(CONF, json(UStore.get('settings', {})))); }
      else if (f === DATA) { all.push(writeFile(DATA, json(dataObj()))); }
      else { var v = UStore.get(k, null); all.push(v ? writeFile(f, json(v)) : removeFile(f)); }
    }
    pending = {};
    return Promise.all(all);
  }

  /* ---------- whole-folder import / export ---------- */
  function importAll() {   /* -> 'exported' (folder was empty) | 'imported' (something changed) | 'same' */
    var had = false, before = snap();
    return readJSON(CONF).then(function (c) {
      if (c && typeof c === 'object') { had = true; if (!touched.settings) { UStore.set('settings', c, true); } }
      return readJSON(DATA);
    }).then(function (d) {
      var i;
      if (d && typeof d === 'object') { had = true; for (i = 0; i < DATA_KEYS.length; i++) { if (d[DATA_KEYS[i]] !== null && d[DATA_KEYS[i]] !== undefined && !touched[DATA_KEYS[i]]) { UStore.set(DATA_KEYS[i], d[DATA_KEYS[i]], true); } } }
      return getFile(BANK);
    }).then(function (f) {
      if (!f) { return null; }
      had = true;
      return new Promise(function (ok) {
        decode(f, function (txt) {
          var cur = UStore.get('bank', null);
          if (!touched.bank && (!cur || cur.text !== txt)) { UStore.set('bank', { name: BANK, text: txt }, true); }
          UStore.set('folderBankMod', f.lastModified, true); ok();
        });
      });
    }).then(function () { return listDir(DRAFTS); }).then(function (files) {
      var idx = UStore.get('drafts', {}) || {};
      return Promise.all(files.map(function (fh) {
        if (!/\.json$/.test(fh.name)) { return null; }
        return fh.getFile().then(function (f) { return f.text(); }).then(function (t) {
          var o, id = fh.name.replace(/\.json$/, ''), loc;
          try { o = JSON.parse(t); } catch (e) { return; }
          if (!o || !o.html) { return; }
          loc = UStore.get('draft.' + id, null);
          if (!touched['draft.' + id] && (!loc || (o.t || 0) > (loc.t || 0))) { UStore.set('draft.' + id, o, true); idx[id] = o.t || 1; }
        })['catch'](function () {});
      })).then(function () { UStore.set('drafts', idx, true); });
    }).then(function () {
      if (!had) { return exportAll().then(function () { return 'exported'; }); }
      return snap() === before ? 'same' : 'imported';
    });
  }
  function snap() {
    var ks = ['settings', 'bank'].concat(DATA_KEYS), o = [], i;
    for (i = 0; i < ks.length; i++) { o.push(JSON.stringify(UStore.get(ks[i], null))); }
    return o.join('\n');
  }
  function exportAll(skipBank) {
    var ws = [writeFile(CONF, json(UStore.get('settings', {}))), writeFile(DATA, json(dataObj()))], b = UStore.get('bank', null), ks = UStore.keys(), i;
    if (b && b.text && !skipBank) { ws.push(writeBankText(b.text)); }
    for (i = 0; i < ks.length; i++) { if (ks[i].indexOf('draft.') === 0) { ws.push(writeFile(DRAFTS + '/' + ks[i].slice(6) + '.json', json(UStore.get(ks[i], null)))); } }
    return Promise.all(ws);
  }
  function stamp() {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var d = new Date();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
  }
  function backupBank() {   /* copy the current bank to backups/, keep the newest MAX_BACKUPS */
    return getFile(BANK).then(function (old) {
      if (!old) { return null; }
      return writeFile(BACKUPS + '/banco-de-frases_' + stamp() + '.txt', old).then(function () { return listDir(BACKUPS); }).then(function (fs) {
        var names = fs.map(function (f) { return f.name; }).filter(function (n) { return /^banco-de-frases_.*\.txt$/.test(n); }).sort(), i, rm = [];
        for (i = 0; i < names.length - MAX_BACKUPS; i++) { rm.push(removeFile(BACKUPS + '/' + names[i])); }
        return Promise.all(rm);
      });
    });
  }
  function noteBank(f) { if (f) { UStore.set('folderBankMod', f.lastModified, true); } return f; }
  function writeBankText(text) { return writeFile(BANK, text).then(noteBank); }

  /* ---------- public ---------- */
  function boot(start) {
    var done = false;
    function go() { if (!done) { done = true; start(); } }
    if (!available || mode() === 'browser') { go(); return; }
    var late = false;
    /* never block the app: after 4 s it starts with the browser copy; when the folder read ends the screen is refreshed (D3) */
    setTimeout(function () { if (!done) { late = true; setState('loading'); go(); } }, 4000);
    function ready(how) {
      if (!late) { setState('folder'); go(); return; }
      setState('folder'); touched = {}; UStore.remove('folderDirty', true);
      if (!timer) { timer = setTimeout(flush, 0); }   /* what was changed meanwhile goes to the folder */
      for (var i = 0; i < lateFns.length; i++) { try { lateFns[i](how); } catch (e) {} }
    }
    idbGet(function (h) {
      if (!h) { go(); return; }
      UStore.set('storeMode', 'folder', true);
      dir = h;
      var qp = h.queryPermission ? h.queryPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      qp.then(function (p) {
        if (p !== 'granted') { pending = {}; touched = {}; setState('needperm'); go(); return; }
        if (UStore.get('folderDirty', 0)) {   /* edits made while disconnected (last session) go to the folder first */
          return exportAll(true).then(function () { UStore.remove('folderDirty', true); return importAll(); }).then(ready);
        }
        return importAll().then(ready);
      })['catch'](function (e) { if (state === 'loading') { UStore.set('folderDirty', 1, true); } setState('needperm', String(e)); go(); });
    });
  }
  function useHandle(h, cb) {   /* after the picker (or a test stand-in handle) */
    dir = h;
    idbPut(h, function () {
      UStore.set('storeMode', 'folder', true);
      importAll().then(function (how) { setState('folder'); cb(null, how); }, function (e) { fail(e); cb(e); });
    });
  }
  function choose(cb) {
    if (!available) { cb(new Error('indisponível')); return; }
    window.showDirectoryPicker({ id: 'ultra-formulario-dados', mode: 'readwrite' }).then(function (h) {
      var rp = h.requestPermission ? h.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      return rp.then(function (p) { if (p !== 'granted') { throw new Error('permissão negada'); } UStore.remove('folderDirty', true); useHandle(h, cb); });
    })['catch'](function (e) { cb(e); });
  }
  function reconnect(cb) {   /* must run inside a click */
    var go = function (h) {
      var rp = h.requestPermission ? h.requestPermission({ mode: 'readwrite' }) : Promise.resolve('granted');
      rp.then(function (p) {
        if (p !== 'granted') { cb(new Error('permissão negada')); return; }
        dir = h;
        /* changed something while disconnected? then this computer's copy wins (bank excluded:
           an external edit of the txt is offered by checkBank); otherwise the folder wins */
        var p2 = UStore.get('folderDirty', 0) ? exportAll(true).then(function () { return 'exported'; }) : importAll();
        p2.then(function (how) { UStore.remove('folderDirty', true); setState('folder'); cb(null, how); }, function (e) { cb(e); });
      }, function (e) { cb(e); });
    };
    if (dir) { go(dir); } else { idbGet(function (h) { if (h) { go(h); } else { cb(new Error('nenhuma pasta')); } }); }
  }
  function useBrowser(cb) { dir = null; UStore.set('storeMode', 'browser', true); idbPut(null, function () { setState(available ? 'browser' : 'unavailable'); if (cb) { cb(); } }); }
  function saveBank(blobOrText, cb) {   /* "Trocar arquivo": backup the old bank, write the new one byte-for-byte */
    if (state !== 'folder') { if (cb) { cb(null); } return; }
    backupBank().then(function () { return writeFile(BANK, blobOrText); }).then(function (f) { noteBank(f); if (cb) { cb(f); } },
      function (e) { fail(e); if (cb) { cb(null); } });   /* the caller always gets an answer */
  }
  function checkBank(cb) {   /* external edit? cb(file) when banco-de-frases.txt changed since we last read/wrote it */
    if (state !== 'folder' || !dir) { return; }
    getFile(BANK).then(function (f) {
      if (f && f.lastModified !== UStore.get('folderBankMod', 0)) { cb(f); }
    }, function (e) { fail(e); });
  }
  function acceptBank(f, cb) { decode(f, function (txt) { noteBank(f); cb(txt); }); }
  function clearDrafts(keep) {   /* remove every draft except the current tab's (browser + folder) */
    var ks = UStore.keys(), i, idx = UStore.get('drafts', {}) || {}, n = 0;
    for (i = 0; i < ks.length; i++) { if (ks[i].indexOf('draft.') === 0 && ks[i] !== 'draft.' + keep) { UStore.remove(ks[i]); delete idx[ks[i].slice(6)]; n++; } }
    UStore.remove('draft', true); UStore.set('drafts', idx);
    UStore.set('draftsCleared', { t: new Date().getTime(), keep: keep }, true);   /* D3: other open tabs stop re-saving theirs */
    if (state === 'folder') {
      listDir(DRAFTS).then(function (fs) { fs.forEach(function (f) { if (f.name !== keep + '.json') { removeFile(DRAFTS + '/' + f.name); } }); });
    }
    return n;
  }
  return {
    available: available, boot: boot, choose: choose, reconnect: reconnect, useBrowser: useBrowser, useHandle: useHandle,
    saveBank: saveBank, writeBankText: function (t) { return state === 'folder' ? writeBankText(t) : Promise.resolve(null); },
    checkBank: checkBank, acceptBank: acceptBank, clearDrafts: clearDrafts, flush: flush, exportAll: exportAll,
    status: function () { return state; }, folderName: function () { return dir && dir.name || ''; }, lastError: function () { return lastErr; },
    onStatus: function (fn) { listeners.push(fn); }, onLate: function (fn) { lateFns.push(fn); }, setDecoder: function (fn) { decoder = fn; }
  };
})();
