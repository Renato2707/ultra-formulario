/* store.js - minimal key/value store (ES5). localStorage when available,
   otherwise in-memory. Real pendrive file storage comes in Etapa D. */
var UStore = (function () {
  'use strict';
  var PREFIX = 'uf.', mem = {}, ls = null, lastError = '';
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
  function set(key, value) {
    var raw = JSON.stringify(value);
    mem[key] = raw;
    if (!ls) { return false; }
    try { ls.setItem(PREFIX + key, raw); return true; } catch (e) { lastError = String(e && e.message || e); return false; }
  }
  function remove(key) {
    delete mem[key];
    try { if (ls) { ls.removeItem(PREFIX + key); } } catch (e) {}
  }
  return { get: get, set: set, remove: remove, persistent: function () { return !!ls; },
           lastError: function () { return lastError; } };
})();
