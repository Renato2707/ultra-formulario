/*
 * ui-history.js - histórico de buscas (D2).
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-history', function (UI, R) {
  'use strict';
  var HIST_MAX, histOpen, heldPrint, dragSplit;   /* deste arquivo */
  var $, on, esc, hasCls, addCls, rmCls, closest, qsa, trim, now, foldKeep, toast, S, loadSettings,
      saveSettings, searchNow, saveSearch, sxShow, editor, closeModal, setBank, buildModels, setRange,
      updatePrintHold, afterChange, markAlive, saveDraft, nextField, filledSel, multiToggle, multiApply,
      popupKbd, closePopup, chooseOption, output, repSearch, repStep, renderNav, showBar, hideBar, applyTheme,
      applyLayout, replyTabPing;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.searchSeen, UI.saveTimer, UI.TAB, UI.popupFor, UI.popupIdx,
     UI.popupSel, UI.setSaved, UI.BE */

  /* ================= search history (D2) =================
     per field ('nav1'..'nav3' = exam / model / phrase search, 'rep' = report search); a term enters only when
     the search is confirmed (Enter, leaving the field, choosing a result), never on each letter.
     Order: the LAST term searched always first, then by how often it was used. Each term has its own x. */
  R(function () {
    HIST_MAX = 30, histOpen = null;
  });
  function histField(inp) { return inp && inp.id === 'repSearch' ? 'rep' : 'nav' + S.level; }
  function histAll() { var h = UStore.get('searchHist', {}); return (h && typeof h === 'object') ? h : {}; }
  function histList(field) {
    var l = (histAll()[field] || []).slice(0), top = null, i;
    for (i = 0; i < l.length; i++) { if (!top || l[i].l > top.l) { top = l[i]; } }
    l.sort(function (a, b) { if (a === top) { return -1; } if (b === top) { return 1; } return (b.n - a.n) || (b.l - a.l); });
    return l;
  }
  function histCommit(inp) {
    var t = trim(inp.value); if (t.length < 2) { return; }
    var h = histAll(), f = histField(inp), l = h[f] || [], k = foldKeep(t), i, hit = null;
    for (i = 0; i < l.length; i++) { if (foldKeep(l[i].t) === k) { hit = l[i]; break; } }
    if (hit && hit.l > now() - 1500 && hit.t === t) { return; }   /* the same confirmation seen twice (Enter, then blur) */
    if (hit) { hit.n++; hit.l = now(); hit.t = t; } else { l.push({ t: t, n: 1, l: now() }); }
    if (l.length > HIST_MAX) { l.sort(function (a, b) { return b.l - a.l; }); l.length = HIST_MAX; }
    h[f] = l; UStore.set('searchHist', h);
  }
  function histRemove(field, t) {
    var h = histAll(), l = h[field] || [], i;
    for (i = l.length - 1; i >= 0; i--) { if (l[i].t === t) { l.splice(i, 1); } }
    h[field] = l; UStore.set('searchHist', h);
  }
  function histRender() {
    var box = $('shist'), inp = histOpen; if (!inp) { box.hidden = true; return; }
    var f = histField(inp), q = foldKeep(trim(inp.value)), l = histList(f), html = '', i, n = 0;
    for (i = 0; i < l.length && n < 10; i++) {
      if (q && foldKeep(l[i].t).indexOf(q) < 0) { continue; }
      if (q && foldKeep(l[i].t) === q) { continue; }   /* already typed */
      html += '<div class="sh-item" data-t="' + esc(l[i].t) + '"><span class="sh-t">' + esc(l[i].t) + '</span>' +
        '<button type="button" class="sh-x" tabindex="-1" title="Remover do histórico" aria-label="Remover do histórico">&#215;</button></div>';
      n++;
    }
    if (!n) { box.hidden = true; return; }
    box.innerHTML = html;
    var r = inp.getBoundingClientRect();
    box.style.left = Math.round(r.left) + 'px'; box.style.top = Math.round(r.bottom + 2) + 'px'; box.style.minWidth = Math.round(r.width) + 'px';
    box.hidden = false;
  }
  function histShow(inp) { histOpen = inp; histRender(); }
  function histHide() { histOpen = null; $('shist').hidden = true; }
  function histPick(inp, t) {
    inp.value = t;
    if (inp.id === 'repSearch') { S.repQuery = t; saveSearch(); sxShow(inp); repSearch(false); }
    else { S.navSearch[S.level - 1] = t; saveSearch(); renderNav(); }
    histCommit(inp); histHide(); inp.focus();
  }
  R(function () {
    on($('shist'), 'mousedown', function (e) { e.preventDefault(); });   /* keep the focus in the search field */
    on($('shist'), 'click', function (e) {
      var it = closest(e.target, function (n) { return hasCls(n, 'sh-item'); }, $('shist')), inp = histOpen; if (!it || !inp) { return; }
      var t = it.getAttribute('data-t');
      if (hasCls(e.target, 'sh-x')) { histRemove(histField(inp), t); histRender(); return; }
      histPick(inp, t);
    });
    (function () {
      var fs = [$('navSearch'), $('repSearch')], i;
      for (i = 0; i < fs.length; i++) {
        on(fs[i], 'focus', function () { histShow(this); });
        on(fs[i], 'input', function () { histShow(this); });
        on(fs[i], 'blur', function () { histCommit(this); histHide(); });
        on(fs[i], 'keydown', function (e) { if (e.keyCode === 13) { histCommit(this); histHide(); } else if (e.keyCode === 27 || e.keyCode === 40) { histHide(); } }, true);
      }
    })();

    /* report search */
    on($('repSearch'), 'keyup', function (e) {
      if (e.keyCode === 13) { repStep(e.shiftKey ? -1 : 1); return; }
      if (e.keyCode === 27) { $('repSearch').value = ''; }
      S.repQuery = $('repSearch').value; saveSearch(); sxShow($('repSearch'));
      repSearch(false);
    });
    on($('repSearch'), 'input', function () { S.repQuery = this.value; saveSearch(); sxShow(this); });
    on($('repPrev'), 'click', function () { repStep(-1); });
    on($('repNext'), 'click', function () { repStep(1); });
    on($('repSearchX'), 'mousedown', function (e) { e.preventDefault(); });
    on($('repSearchX'), 'click', function () { var si = $('repSearch'); si.value = ''; S.repQuery = ''; saveSearch(); sxShow(si); repSearch(false); si.focus(); });

    on($('btnCopy'), 'click', function () { output('copy'); });
    on($('btnGen'), 'click', function () { output('gen'); });
    on($('btnPrint'), 'click', function () { output('print'); });
    /* browser print menu / Ctrl+P not caught: re-check right before printing; afterwards open the review */
    heldPrint = false;
    if (window.addEventListener) {
      window.addEventListener('beforeprint', function () { updatePrintHold(); heldPrint = hasCls(document.documentElement, 'print-hold'); }, false);
      window.addEventListener('afterprint', function () {
        S.printAllowed = false; updatePrintHold();
        if (heldPrint) { heldPrint = false; setTimeout(function () { toast('Impressão bloqueada: revise as linhas críticas / campos.'); output('print'); }, 0); }
      }, false);
    }


    /* splitters: mouse drag or keyboard arrows */
    dragSplit = null;
  });
  function startSplit(which, e) { e.preventDefault(); dragSplit = which; addCls($(which === 'L' ? 'splitL' : 'splitR'), 'drag'); }
  R(function () {
    on($('splitL'), 'mousedown', function (e) { startSplit('L', e); });
    on($('splitR'), 'mousedown', function (e) { startSplit('R', e); });
    on(document, 'mousemove', function (e) {
      if (!dragSplit) { return; }
      if (dragSplit === 'L') { S.settings.leftW = e.clientX - $('left').getBoundingClientRect().left; }
      else { S.settings.rightW = $('right').getBoundingClientRect().right - e.clientX; }
      applyLayout();
    });
    on(document, 'mouseup', function () { if (dragSplit) { rmCls($('split' + dragSplit), 'drag'); dragSplit = null; saveSettings(); } });
  });
  function splitKey(which) {
    return function (e) {
      var k = e.keyCode, st = S.settings, d = e.shiftKey ? 40 : 10;
      if (k !== 37 && k !== 39) { return; }
      e.preventDefault();
      if (which === 'L') { st.leftW += k === 39 ? d : -d; } else { st.rightW += k === 37 ? d : -d; }
      applyLayout(); saveSettings();
    };
  }
  R(function () {
    on($('splitL'), 'keydown', splitKey('L'));
    on($('splitR'), 'keydown', splitKey('R'));
    on($('splitL'), 'dblclick', function () { S.settings.leftW = 300; applyLayout(); saveSettings(); });
    on($('splitR'), 'dblclick', function () { S.settings.rightW = 280; applyLayout(); saveSettings(); });
    on($('rightToggle'), 'click', function () { S.settings.rightCollapsed = !S.settings.rightCollapsed; applyLayout(); saveSettings(); });
    on(window, 'resize', applyLayout);

    /* modal: X, click outside, Esc */
    on($('modalX'), 'click', closeModal);
    on($('modalBack'), 'mousedown', function (e) { if (e.target === this) { closeModal(); } });

    /* global keys: dropdown popup + modal */
    on(document, 'keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.keyCode === 80) {   /* Ctrl+P = the app's Imprimir (with review) */
        e.preventDefault(); e.stopPropagation();
        if ($('modalBack').hidden && !UI.BE.open) { output('print'); }
        return;
      }
      if (!$('popup').hidden) {
        var n = qsa($('popup'), '.opt[data-i]').length, pk = e.keyCode;
        /* C11: list opened on a CHOSEN choice: Backspace, Delete, Space and letters edit its text (the list closes) */
        if (UI.popupFor && filledSel(UI.popupFor) && !e.ctrlKey && !e.metaKey && !e.altKey && (pk === 8 || pk === 46 || pk === 32 || (pk >= 65 && pk <= 90) || (pk >= 96 && pk <= 111) || pk >= 186)) { closePopup(); return; }
        if (UI.popupSel) {   /* multi list: Space / number ticks, Enter = done (next field), Tab = done + move, Esc = keep as it was */
          if (e.keyCode === 32 || (e.keyCode >= 49 && e.keyCode <= 57 && e.keyCode - 49 < n)) { e.preventDefault(); e.stopPropagation(); if (e.keyCode !== 32) { UI.popupIdx = e.keyCode - 49; popupKbd(); } multiToggle(UI.popupIdx); return; }
          /* C6j: Enter marks/unmarks the focused option (list stays open); Enter on "Pronto" confirms */
          if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); if (UI.popupIdx >= n) { multiApply(true); } else { multiToggle(UI.popupIdx); } return; }
          if (e.keyCode === 9) { e.preventDefault(); e.stopPropagation(); multiApply(true, e.shiftKey); return; }
          if (e.keyCode === 40) { e.preventDefault(); UI.popupIdx = Math.min(n, UI.popupIdx + 1); popupKbd(); return; }
          if (e.keyCode === 38) { e.preventDefault(); UI.popupIdx = Math.max(0, UI.popupIdx - 1); popupKbd(); return; }
        }
        if (e.keyCode === 40) { e.preventDefault(); UI.popupIdx = Math.min(n - 1, UI.popupIdx + 1); popupKbd(); return; }
        if (e.keyCode === 38) { e.preventDefault(); UI.popupIdx = Math.max(0, UI.popupIdx - 1); popupKbd(); return; }
        if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); chooseOption(UI.popupIdx); return; }
        if (e.keyCode === 9) { e.preventDefault(); e.stopPropagation(); var pf = UI.popupFor; closePopup(); if (pf) { var rr = document.createRange(); rr.selectNode(pf); rr.collapse(e.shiftKey); editor.focus(); setRange(rr); } nextField(e.shiftKey); return; }
        if (e.keyCode === 27) { e.preventDefault(); closePopup(); editor.focus(); return; }
        if (e.keyCode >= 49 && e.keyCode <= 57 && e.keyCode - 49 < n) { e.preventDefault(); chooseOption(e.keyCode - 49); return; }
        /* while the option list is open, typing must not overwrite the dropdown */
        if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.keyCode === 8 || e.keyCode === 46 || e.keyCode === 32 || e.keyCode >= 48)) {
          e.preventDefault(); toast(UI.popupSel ? 'Marque com Enter, Espaço ou o número; Tab ou "Pronto" confirma. Esc cancela.' : 'Escolha uma opção (setas + Enter, ou o número). Esc fecha a lista.'); return;
        }
      }
      if (!$('modalBack').hidden && e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); closeModal(); }
    }, true);
    window.onbeforeunload = function () { saveDraft(); markAlive(false); };
  });
  /* another tab changed shared data: take it over live so this tab never writes back stale copies */
  function onStorage(e) {
    var k = e && e.key; if (!k || k.indexOf('uf.') !== 0) { return; }
    k = k.slice(3);
    if (k === 'settings') {
      loadSettings();
      if (!$('modalBack').hidden && $('stSave') && !UI.setSaved) {   /* settings dialog open here: keep the theme preview */
        var tr = document.getElementsByName('st_theme'), q;
        for (q = 0; q < tr.length; q++) { if (tr[q].checked) { S.settings.theme = tr[q].value; } }
        if ($('st_paperDark')) { S.settings.paperDark = $('st_paperDark').checked; }
      }
      applyTheme(); applyLayout(); afterChange(true);
    } else if (k === 'bank') {
      var bk = UStore.get('bank', null);
      if (bk && bk.text) { setBank(bk.text, bk.name, true); buildModels(); renderNav(); toast('Banco de frases atualizado (carregado em outra aba).'); }
    } else if (k === 'search') {
      var sq = UStore.get('search', {}) || {}, si2 = $('navSearch');
      S.navSearch = [String(sq.nav1 || ''), String(sq.nav2 || ''), String(sq.nav3 || '')]; S.repQuery = String(sq.rep || '');
      UI.searchSeen = searchNow();
      if (document.activeElement !== si2) { renderNav(); }
      if (document.activeElement !== $('repSearch') && $('repSearch').value !== S.repQuery) { $('repSearch').value = S.repQuery; sxShow($('repSearch')); try { repSearch(false); } catch (eRs2) {} }
    } else if (k === 'draftsCleared') {
      var dc = UStore.get('draftsCleared', null);
      if (dc && dc.keep !== UI.TAB) {
        S.noDraft = true; clearTimeout(UI.saveTimer); UStore.remove('draft.' + UI.TAB, true);
        showBar('Rascunhos apagados em outra aba: este laudo continua na tela, mas não está mais guardado (volta a ser guardado se você editá-lo).', 'Ok', hideBar);
      }
    } else if (k === 'searchHist') { if (histOpen) { histRender(); }
    } else if (k === 'userModels' || k === 'userPhrases' || k === 'order' || k === 'overrides' || k === 'usage' || k === 'usageLast' || k === 'hidden') {
      S[k] = UStore.get(k, S[k]); buildModels(); renderNav();
    } else if (k === 'tabPing') {
      replyTabPing();
    }
  }
  R(function () {
    if (window.addEventListener) { window.addEventListener('storage', onStorage, false);
      window.addEventListener('pagehide', function () { saveDraft(); markAlive(false); }, false);
      window.addEventListener('beforeunload', function () { saveDraft(); markAlive(false); }, false);
      window.addEventListener('unload', function () { markAlive(false); }, false);
      document.addEventListener('visibilitychange', function () {
        try {
          if (document.hidden || document.msHidden || document.visibilityState === 'hidden') { saveDraft(); markAlive(true); }
          else { markAlive(true); }
        } catch (eVis) {}
      }, false);
    }
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls;
    closest = UI.closest; qsa = UI.qsa; trim = UI.trim; now = UI.now; foldKeep = UI.foldKeep; toast = UI.toast;
    S = UI.S; loadSettings = UI.loadSettings; saveSettings = UI.saveSettings; searchNow = UI.searchNow;
    saveSearch = UI.saveSearch; sxShow = UI.sxShow; editor = UI.editor; closeModal = UI.closeModal;
    setBank = UI.setBank; buildModels = UI.buildModels; setRange = UI.setRange;
    updatePrintHold = UI.updatePrintHold; afterChange = UI.afterChange; markAlive = UI.markAlive;
    saveDraft = UI.saveDraft; nextField = UI.nextField; filledSel = UI.filledSel; multiToggle = UI.multiToggle;
    multiApply = UI.multiApply; popupKbd = UI.popupKbd; closePopup = UI.closePopup;
    chooseOption = UI.chooseOption; output = UI.output; repSearch = UI.repSearch; repStep = UI.repStep;
    renderNav = UI.renderNav; showBar = UI.showBar; hideBar = UI.hideBar; applyTheme = UI.applyTheme;
    applyLayout = UI.applyLayout; replyTabPing = UI.replyTabPing;
  };
});
