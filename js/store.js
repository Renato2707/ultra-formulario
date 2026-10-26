/* store.js - minimal key/value store (ES5). localStorage when available,
   otherwise in-memory. localStorage is the live working copy shared between tabs;
   folder.js (UFolder) mirrors it into the chosen "Pasta de dados" (Etapa D, rodada D1). */
var UStore = (function () {
  'use strict';
  var PREFIX = 'uf.', mem = {}, ls = null, lastError = '', hooks = [];
  function fire(key, value) { for (var i = 0; i < hooks.length; i++) { try { hooks[i](key, value); } catch (e) {} } }
  try {
    ls = window.localStorage;
    ls.setItem(PREFIX + 'probe', '1'); ls.removeItem(PREFIX + 'probe');
  } catch (e) { ls = null; }

  function get(key, def) {
    var raw = null;
    try { raw = ls ? ls.getItem(PREFIX + key) : (mem.hasOwnProperty(key) ? mem[key] : null); } catch (e) { raw = null; }
    if (raw === null || raw === undefined) { return def; }
    try { return JSON.parse(raw); } catch (e2) { return def; }
  }
  function set(key, value, quiet) {
    var raw = JSON.stringify(value);
    if (!quiet) { fire(key, value); }
    mem[key] = raw;
    if (!ls) { return false; }
    try { ls.setItem(PREFIX + key, raw); return true; } catch (e) { lastError = String(e && e.message || e); return false; }
  }
  function remove(key, quiet) {
    if (!quiet) { fire(key, undefined); }
    delete mem[key];
    try { if (ls) { ls.removeItem(PREFIX + key); } } catch (e) {}
  }
  /* all keys (without prefix) */
  function keys() {
    var out = [], i, k;
    if (ls) { for (i = 0; i < ls.length; i++) { k = ls.key(i); if (k && k.indexOf(PREFIX) === 0) { out.push(k.slice(PREFIX.length)); } } }
    else { for (k in mem) { if (mem.hasOwnProperty(k)) { out.push(k); } } }
    return out;
  }
  return { get: get, set: set, remove: remove, keys: keys, onWrite: function (fn) { hooks.push(fn); }, persistent: function () { return !!ls; },
           lastError: function () { return lastError; } };
})();
