/*
 * ui.js - Editor de Laudos (Etapa B). Strict ES5, no dependencies.
 * Needs parser.js (UltraParser), store.js (UStore) and folder.js (UFolder).
 * The code is split by function into js/ui-*.js (loaded by index.html after
 * this file, plain <script> tags, no modules); each file registers one part.
 * UFMain runs after UFolder.boot (the data folder, if any, is read first).
 * Clinical text from the bank is never modified: it is rendered as-is
 * (only the leading *** critical markers are hidden, see parser.js).
 */
var UFUI = {
  /* order of the parts = order of the original code; 'ui' (start) is the last part, below */
  ORDER: ['ui-base', 'ui-editor', 'ui-fields', 'ui-output', 'ui-nav', 'ui-placement', 'ui-actions',
          'ui-settings', 'ui-bank-editor', 'ui-layout', 'ui-import', 'ui-history', 'ui-sessions', 'ui'],
  parts: {},
  part: function (name, fn) { UFUI.parts[name] = fn; }
};
var UFMain = function () {
  'use strict';
  /* 1) each part declares its functions (and exports in UI the ones other parts use);
     2) every part links the names it uses from the others;
     3) the top-level code of all parts runs in the original order. */
  var UI = {}, runs = [], links = [], i, f;
  function R(fn) { runs.push(fn); }
  for (i = 0; i < UFUI.ORDER.length; i++) {
    f = UFUI.parts[UFUI.ORDER[i]];
    if (!f) { throw new Error('ui.js: falta o arquivo js/' + UFUI.ORDER[i] + '.js'); }
    links.push(f(UI, R));
  }
  for (i = 0; i < links.length; i++) { links[i](); }
  for (i = 0; i < runs.length; i++) { runs[i](); }
};

/* ================= start (last part) ================= */
UFUI.part('ui', function (UI, R) {
  'use strict';
  var saved, d, bootModel;   /* deste arquivo */
  var $, toast, S, sxShow, editor, setBank, buildModels, getModel, ensureNotEmpty, afterChange, markAlive,
      pickTab, reportText, repSearch, renderNav, useModel, folderStatus, applyTheme, applyLayout, updTitle,
      findModelByName;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.TAB, UI.OPEN_TPL, UI.OPEN_MODEL */

  /* ================= start ================= */
  R(function () {
    applyTheme(); applyLayout();
    folderStatus(UFolder.status());
    saved = UStore.get('bank', null);
    if (saved && saved.text) { setBank(saved.text, saved.name, true); }
    pickTab(); setInterval(function () { markAlive(true); }, 5000);
    d = UStore.get('draft.' + UI.TAB, null);
    try {
      if (d && d.html) { editor.innerHTML = d.html; S.activeModelId = d.model || null; if (d.exam) { S.activeExam = d.exam; }
        if (d.nav && d.nav.exam) { S.navExam = d.nav.exam; S.level = d.nav.level || 2; } }
      ensureNotEmpty();
      buildModels(); renderNav(); afterChange(true);
    } catch (initErr) {   /* a stale draft/state from an older version must never block the app */
      UStore.remove('draft.' + UI.TAB); editor.innerHTML = '<div><br></div>'; S.activeModelId = null; S.level = 1;
      buildModels(); renderNav(); afterChange(true);
      toast('Rascunho anterior incompatível foi descartado.');
    }
    if (UI.OPEN_TPL !== null || UI.OPEN_MODEL !== null) {   /* C6n sessão (#ufopen) ou C8 link (#ufmodel): carrega e limpa o endereço */
      try { if (window.history && window.history.replaceState) { window.history.replaceState(null, '', String(window.location.href).replace(/#.*$/, '')); } } catch (eR) {}
      bootModel = UI.OPEN_MODEL !== null ? getModel(UI.OPEN_MODEL) : null;
      if (!bootModel && UI.OPEN_TPL !== null) { bootModel = findModelByName(UI.OPEN_TPL); }
      if (bootModel) { useModel(bootModel, true); }
    }
    updTitle();
    $('repSearch').value = S.repQuery || ''; sxShow($('repSearch'));
    if (S.repQuery) { try { repSearch(false); } catch (eRs) {} }

    /* hook for automated tests (no effect on normal use) */
    window.UFApp = { state: S, reportText: reportText };
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; toast = UI.toast; S = UI.S; sxShow = UI.sxShow; editor = UI.editor; setBank = UI.setBank;
    buildModels = UI.buildModels; getModel = UI.getModel; ensureNotEmpty = UI.ensureNotEmpty;
    afterChange = UI.afterChange; markAlive = UI.markAlive; pickTab = UI.pickTab; reportText = UI.reportText;
    repSearch = UI.repSearch; renderNav = UI.renderNav; useModel = UI.useModel; folderStatus = UI.folderStatus;
    applyTheme = UI.applyTheme; applyLayout = UI.applyLayout; updTitle = UI.updTitle;
    findModelByName = UI.findModelByName;
  };
});
