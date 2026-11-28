/*
 * ui-layout.js - layout: larguras das colunas, painel da direita, atalhos do editor.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-layout', function (UI, R) {
  'use strict';
  var navList, reloadAt, lastExamClick, examDblAt, DBL_MS, phTip, tipFor, dragId, chipExit;   /* deste arquivo */
  var $, on, esc, hasCls, addCls, rmCls, closest, qsa, trim, now, toast, S, saveSearch, editor, setBank,
      examNames, getModel, sortedModels, examSections, fieldFilled, lineText, saveRange, setRange, focusEditor,
      exec, ensureNotEmpty, insertBlock, replaceNodeWithHtml, undoRemoval, critFix, critState, afterChange,
      nextField, filledSel, selMark, multiApply, openSelect, closePopup, chooseOption, reportText, critGroups,
      removeGroup, clearRepMarks, navItems, loadedModel, renderNav, modelHref, sentenceCase, rawHtml, navKeyOf,
      goLevel, navBack, activateNav, selectCard, anchorHits, directiveRule, edText, edHtml, undoInsert,
      insertCard, editorLines, useModel, modelDialog, cloneModel, phraseDialog, importDialog, settingsDialog,
      allIssues, interText, recognizeText;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.popupSel */
  UI.applyLayout = applyLayout; UI.loadBankFile = loadBankFile; UI.defaultModelOf = defaultModelOf;
  UI.wholeField = wholeField; UI.fieldInner = fieldInner;   /* usadas por outros arquivos */

  /* ================= layout: column widths, right panel ================= */
  function applyLayout() {
    var st = S.settings, maxL = Math.max(200, Math.floor(window.innerWidth * 0.45));
    st.leftW = Math.max(200, Math.min(maxL, st.leftW || 300));
    st.rightW = Math.max(200, Math.min(420, st.rightW || 280));
    $('left').style.width = st.leftW + 'px';
    var r = $('right');
    if (st.rightCollapsed) { addCls(r, 'collapsed'); r.style.width = ''; } else { rmCls(r, 'collapsed'); r.style.width = st.rightW + 'px'; }
    $('rightToggle').innerHTML = st.rightCollapsed ? '&#8249;' : '&#8250;';
    $('splitR').style.display = st.rightCollapsed ? 'none' : '';
  }
  function readBankFile(f, cb) {
    function read(enc, next) { var fr = new FileReader(); fr.onload = function () { next(fr.result); }; fr.readAsText(f, enc); }
    read('UTF-8', function (t) { if (t.indexOf('\ufffd') >= 0) { read('windows-1252', cb); } else { cb(t); } });
  }
  function loadBankFile(f) {
    readBankFile(f, function (txt) {
      setBank(txt, f.name);
      if (!UStore.set('bank', { name: f.name, text: txt })) { toast('Banco carregado (não será lembrado na próxima vez).'); }
      if (UFolder.status() === 'folder') { UFolder.saveBank(f, function (w) { if (!w) { toast('Atenção: não foi possível gravar o banco na pasta de dados.'); } }); } else { UFolder.saveBank(f); }
    });
  }
  R(function () {
    on($('bankFile0'), 'change', function () { var f = this.files && this.files[0]; if (f) { loadBankFile(f); } this.value = ''; });
    on($('btnSettings'), 'click', settingsDialog);


    /* navigator events */
    navList = $('navList');
  });
  function navCard(t) { return closest(t, function (n) { return hasCls(n, 'card'); }, navList); }
  R(function () {
    on($('navBack'), 'click', navBack);
    /* the name fills the box; trocar is a separate button and is ignored here */
    reloadAt = 0;
    on($('examReload'), 'click', function (e) {
      var m, a;
      if (closest(e.target, function (n) { return n.id === 'navBack'; })) { return; }
      a = $('examName');
      m = loadedModel();
      if (a.getAttribute('href') && !sameTabClick(e)) { return; }   /* C8: Ctrl/meio/botão direito seguem o href */
      if (a.getAttribute('href')) {
        if (e.preventDefault) { e.preventDefault(); }
        e.returnValue = false;
      }
      if (!m || m.exam !== S.navExam) { return; }
      if ((e.detail || 1) > 1 && now() - reloadAt < 800) { return; }
      reloadAt = now();
      useModel(m, true);
    });
    on($('tabModelos'), 'click', function () { if (S.navExam) { goLevel(2); } });
    on($('tabFrases'), 'click', function () { if (!S.navExam) { return; } S.activeExam = S.navExam; goLevel(3); });
    on($('examBox'), 'keydown', function (e) {
      var k = e.keyCode;
      if (k === 27) { e.preventDefault(); navBack(); return; }
      if ((k === 37 || k === 39) && (e.target === $('tabModelos') || e.target === $('tabFrases'))) {
        e.preventDefault();
        if (S.level === 2) { S.activeExam = S.navExam; goLevel(3); } else if (S.level === 3) { goLevel(2); }
      }
    });
    /* exam double-click, detected manually: the 1st click re-renders the list (level 2),
       so the 2nd click / dblclick lands on a different element */
    lastExamClick = null, examDblAt = 0, DBL_MS = 600;
  });
  function defaultModelOf(exam) {
    var arr = sortedModels(), i, first = null;
    for (i = 0; i < arr.length; i++) {
      if (arr[i].exam !== exam) { continue; }
      if (!first) { first = arr[i]; }
      if (/padr[ãa]o/i.test(arr[i].name)) { return arr[i]; }
    }
    return first;
  }
  function examDouble() {
    var ex = lastExamClick && lastExamClick.exam; lastExamClick = null; examDblAt = now();
    var m = defaultModelOf(ex);
    if (m) { S.selModel = m.id; useModel(m, true); } else { goLevel(2, ex); }
  }
  function inExamDbl() { return lastExamClick && now() - lastExamClick.t < DBL_MS; }
  /* clique simples fica nesta guia; Ctrl/Cmd/Shift/Alt ou outro botão seguem o href (nova guia/janela) */
  function sameTabClick(e) {
    var b = e.button;
    if ((b === undefined || b === null || b === 0) && e.which && e.which > 1) { b = e.which - 1; }
    if (b && b !== 0) { return false; }
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) { return false; }
    return true;
  }
  R(function () {
    on(navList, 'click', function (e) {
      var c = navCard(e.target);
      if (inExamDbl()) { e.preventDefault(); examDouble(); return; }
      if (!c) { return; }
      /* C8: exame e modelo são links (#ufmodel=). Clique simples fica aqui; Ctrl/meio seguem o href. */
      if (c.nodeName === 'A' && (c.getAttribute('data-exam') !== null || c.getAttribute('data-model') !== null)) {
        if (!sameTabClick(e)) { return; }
        if (e.preventDefault) { e.preventDefault(); }
        e.returnValue = false;
      }
      if (c.getAttribute('data-exam') !== null && (e.detail || 1) <= 1) { lastExamClick = { exam: c.getAttribute('data-exam'), t: now() }; }
      if (c.getAttribute('data-ph') !== null) {
        if (closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-insbtn') !== null; })) {   /* arrow on the card edge: insert */
          if ((e.detail || 1) > 1) { return; }
          selectCard(c.getAttribute('data-ph')); insertCard(c.getAttribute('data-ph')); return;
        }
        selectCard(c.getAttribute('data-ph')); return;   /* single click selects = full verbatim text */
      }
      if (c.getAttribute('data-model') !== null && e.detail > 1) { return; }
      activateNav(c);
    });
    /* C6: insert plain text lines as one block at the saved caret (or at the very end of the report when there is
       no caret in the report); one Ctrl+Z undoes the whole block (same snapshot as insertCard). Returns 'caret'/'end'. */
    window.UFInsertLines = function (lines) {
      var undoBefore = edHtml(), undoBeforeText = edText(), html = '', i, how, r = S.savedRange;
      for (i = 0; i < lines.length; i++) { html += '<div>' + (lines[i] ? esc(lines[i]) : '<br>') + '</div>'; }
      if (r && editor.contains(r.commonAncestorContainer)) { how = 'caret'; }
      else { how = 'end'; ensureNotEmpty(); focusEditor(); var e = document.createRange(); e.selectNodeContents(editor); e.collapse(false); setRange(e); saveRange(); }
      insertBlock(html);
      S.insStack.push({ before: undoBefore, beforeText: undoBeforeText, after: edHtml(), afterText: edText() }); S.insRedo = [];
      if (S.insStack.length > 30) { S.insStack.shift(); }
      S.lastChoice = null; S.lastRemoval = null; S.userCaret = true;
      return how;
    };
    /* C6e: insert ready-made inline HTML (fields included). If the report still has an unchosen choice chip that offers
       exactly this option text (optText), the chip is replaced (as if the option had been chosen); otherwise the HTML goes
       on its own line at the caret / end (UFInsertLines rules). One Ctrl+Z undoes it. Returns 'chip'/'caret'/'end'. */
    window.UFInsertHtml = function (html, optText, post, at) {
      var undoBefore = edHtml(), undoBeforeText = edText(), how, cs = qsa(editor, '.fld[data-t="s"]'), i, o, chip = null, r = S.savedRange;
      /* C7: at = {el, mode: 'replace'|'after'}: a line of the report to fill (blank bank line) or to insert after */
      if (at && at.el && at.el.parentNode && editor.contains(at.el)) {
        if (at.mode === 'replace') { at.el.innerHTML = html; how = 'line'; }
        else {
          /* C7a: if the report (or its loaded model) separates paragraphs with a blank line,
             the new finding gets one before it and, if needed, one after; both are marked
             (data-brsep) and leave with the finding (data-brins). */
          var nd = document.createElement('div'), nx, sep = null, trail = null;
          function nextEl(n) { n = n ? n.nextSibling : null; while (n && n.nodeType !== 1) { n = n.nextSibling; } return n; }
          function lineIsBlank(n) { return n && n.nodeType === 1 && !n.querySelector('.fld') && trim(n.textContent || '') === ''; }
          function editorHasContent() {
            var ls = editorLines(), i, t;
            for (i = 0; i < ls.length; i++) { t = trim(lineText(ls[i])); if (t || (ls[i].querySelector && ls[i].querySelector('.fld'))) { return true; } }
            return false;
          }
          function editorHasBlank() {
            var ls = editorLines(), i, st = 0, blank;
            for (i = 0; i < ls.length; i++) {
              blank = trim(lineText(ls[i])) === '' && !(ls[i].querySelector && ls[i].querySelector('.fld'));
              if (blank) { if (st === 1) { st = 2; } }
              else { if (st === 2) { return true; } st = 1; }
            }
            return false;
          }
          /* S.paraFromModel is set when the model is loaded and cleared if the report is wiped (empty). */
          function usesBlankPara() { return editorHasContent() && (editorHasBlank() || !!S.paraFromModel); }
          nd.innerHTML = html;
          nd.setAttribute('data-brins', '1');
          nx = nextEl(at.el);
          if (usesBlankPara()) {
            if (lineIsBlank(nx)) { at.el.parentNode.insertBefore(nd, nextEl(nx)); }
            else {
              sep = document.createElement('div'); sep.setAttribute('data-brsep', '1'); sep.innerHTML = '<br>';
              at.el.parentNode.insertBefore(sep, nx);
              at.el.parentNode.insertBefore(nd, nx);
            }
            if (!lineIsBlank(nextEl(nd))) {
              trail = document.createElement('div'); trail.setAttribute('data-brsep', '1'); trail.innerHTML = '<br>';
              nd.parentNode.insertBefore(trail, nextEl(nd));
            }
          } else { at.el.parentNode.insertBefore(nd, nx); }
          how = 'after';
        }
        afterChange(true); optText = null; cs = [];
      }
      for (i = 0; i < cs.length && !chip && optText; i++) {
        if (cs[i].getAttribute('data-v') !== null) { continue; }
        try { o = JSON.parse(cs[i].getAttribute('data-o')) || []; } catch (e) { o = []; }
        if (o.indexOf(optText) >= 0) { chip = cs[i]; }
      }
      if (chip) { how = 'chip'; replaceNodeWithHtml(chip, html); afterChange(true); }
      else if (!how) {
        if (r && editor.contains(r.commonAncestorContainer)) { how = 'caret'; }
        else { how = 'end'; ensureNotEmpty(); focusEditor(); var e2 = document.createRange(); e2.selectNodeContents(editor); e2.collapse(false); setRange(e2); saveRange(); }
        insertBlock('<div>' + html + '</div>');
      }
      if (post) { post(); }   /* lines the calculators write must be part of the same undo step */
      S.insStack.push({ before: undoBefore, beforeText: undoBeforeText, after: edHtml(), afterText: edText() }); S.insRedo = [];
      if (S.insStack.length > 30) { S.insStack.shift(); }
      S.lastChoice = null; S.lastRemoval = null; S.userCaret = true;
      return how;
    };
    window.UFTest = { recognizeText: recognizeText, interText: interText, allIssues: function () { return allIssues(); }, S: S, removeGroup: removeGroup, critGroups: critGroups, critState: critState, examNames: examNames, examSections: examSections, sortedModels: sortedModels, useModel: useModel, modelHref: modelHref, defaultModelOf: defaultModelOf, sentenceCase: sentenceCase,
                      insertCard: insertCard, editorLines: editorLines, lineText: lineText, openSelect: openSelect, chooseOption: chooseOption, reportText: reportText, directiveRule: directiveRule, anchorHits: anchorHits };
    on(navList, 'dblclick', function (e) {
      if (now() - examDblAt < DBL_MS || inExamDbl()) { return; }   /* handled by the click pair */
      var c = navCard(e.target); if (!c) { return; }
      if (c.getAttribute('data-ph') !== null) {
        if (closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-insbtn') !== null; })) { return; }   /* arrow already inserted on click */
        insertCard(c.getAttribute('data-ph')); return;
      }
      if (c.getAttribute('data-model') !== null) { S.selModel = c.getAttribute('data-model'); useModel(getModel(S.selModel), true); return; }
      if (c.getAttribute('data-exam') !== null) { S.selModel = null; goLevel(2, c.getAttribute('data-exam')); }
    });
    /* hover tooltip on phrase cards: only the verbatim txt lines (title line bold) */
    phTip = document.createElement('div'); phTip.id = 'phTip'; phTip.className = 'phtip'; phTip.style.display = 'none'; document.body.appendChild(phTip);
    tipFor = null;
    on(navList, 'mouseover', function (e) {
      var c = navCard(e.target), card = c && c.getAttribute('data-ph') !== null ? S.phraseIndex[c.getAttribute('data-ph')] : null;
      if (!card || hasCls(c, 'sel')) { phTip.style.display = 'none'; tipFor = null; return; }
      if (tipFor === c) { return; }
      tipFor = c; phTip.innerHTML = rawHtml(card.src, '');
      var rc = c.getBoundingClientRect();
      phTip.style.display = 'block';
      phTip.style.left = Math.round(rc.right + 6) + 'px';
      phTip.style.top = Math.round(Math.max(4, Math.min(rc.top, (window.innerHeight || 600) - phTip.offsetHeight - 4))) + 'px';
    });
    on(navList, 'mouseleave', function () { phTip.style.display = 'none'; tipFor = null; });
    on(navList, 'scroll', function () { phTip.style.display = 'none'; tipFor = null; });
    on(navList, 'mousedown', function () { phTip.style.display = 'none'; tipFor = null; });
    on(navList, 'keydown', function (e) {
      var c = navCard(e.target); if (!c) { return; }
      var l = navItems(), i = l.indexOf(c), k = e.keyCode, j = -1;
      if (k === 13 || k === 32) {
        e.preventDefault();
        if (c.getAttribute('data-ph') !== null) { selectCard(c.getAttribute('data-ph')); insertCard(c.getAttribute('data-ph')); } else { activateNav(c); }
        return;
      }
      if (k === 39 && c.getAttribute('data-sec') !== null && !S.openSecs[c.getAttribute('data-sec')]) { e.preventDefault(); activateNav(c); return; }
      if (k === 37 && c.getAttribute('data-sec') !== null && S.openSecs[c.getAttribute('data-sec')]) { e.preventDefault(); activateNav(c); return; }
      if (k === 40) { j = i + 1; } else if (k === 38) { j = i - 1; } else if (k === 36) { j = 0; } else if (k === 35) { j = l.length - 1; }
      else if (k === 8 || k === 27 || k === 37) { e.preventDefault(); navBack(); return; }
      if (j === -1 && k === 38) { e.preventDefault(); $('navSearch').focus(); return; }
      if (j >= 0 && l[j]) { e.preventDefault(); l[j].focus(); if (l[j].getAttribute('data-ph') !== null) { selectCard(l[j].getAttribute('data-ph')); } }
    });
    on(navList, 'focusin', function (e) { var c = navCard(e.target); if (c) { S.navFocus = navKeyOf(c); } });
    on($('navSearch'), 'keydown', function (e) {
      var k = e.keyCode;
      if (k === 40 || k === 13) { e.preventDefault(); var l = navItems(), f = l[0], i;
        if (S.level === 3 && trim(this.value)) { for (i = 0; i < l.length; i++) { if (l[i].getAttribute('data-ph') !== null) { f = l[i]; break; } } }
        if (f) { f.focus(); if (f.getAttribute('data-ph') !== null) { selectCard(f.getAttribute('data-ph')); } } return; }
      if (k === 27) { e.preventDefault(); e.stopPropagation(); if (this.value) { clearNavSearch(); } else { navBack(); } return; }
      /* C6e: Backspace in the search box only edits the text (it used to go back to the templates when empty) */
    });
    on($('navSearch'), 'input', function () { S.navSearch[S.level - 1] = this.value; saveSearch(); renderNav(); });
  });
  function clearNavSearch() { var si = $('navSearch'); si.value = ''; S.navSearch[S.level - 1] = ''; saveSearch(); renderNav(); si.focus(); }
  R(function () {
    on($('navSearchX'), 'mousedown', function (e) { e.preventDefault(); });
    on($('navSearchX'), 'click', clearNavSearch);
    on($('navTools'), 'click', function (e) {
      var b = closest(e.target, function (n) { return n.nodeName === 'BUTTON'; }); if (!b) { return; }
      var id = b.id, m, c;
      if (id === 'tMAdd') { modelDialog(null); }
      else if (id === 'tMEdit') { m = getModel(S.selModel || S.activeModelId); if (m) { modelDialog(m); } else { toast('Selecione um modelo.'); } }
      else if (id === 'tMClone') { cloneModel(); }
      else if (id === 'tPAdd') { phraseDialog(null); }
      else if (id === 'tPImp') { importDialog(); }
      else if (id === 'tPEdit') { c = S.phraseIndex[S.selCard]; if (c) { phraseDialog(c); } else { toast('Selecione uma frase.'); } }
    });
    dragId = null;
    on(navList, 'dragstart', function (e) {
      var it = navCard(e.target); if (!it || it.getAttribute('data-model') === null) { return; }
      dragId = it.getAttribute('data-model'); try { e.dataTransfer.setData('text', dragId); } catch (x) {}
    });
    on(navList, 'dragover', function (e) {
      if (!dragId) { return; } e.preventDefault();
      var l = navItems(), i, it = navCard(e.target);
      for (i = 0; i < l.length; i++) { if (l[i] === it) { addCls(l[i], 'dragover'); } else { rmCls(l[i], 'dragover'); } }
    });
    on(navList, 'drop', function (e) {
      e.preventDefault();
      var it = navCard(e.target);
      if (!dragId || !it || it.getAttribute('data-model') === null) { dragId = null; return; }
      var ids = [], arr = sortedModels(), i, target = it.getAttribute('data-model');
      for (i = 0; i < arr.length; i++) { if (arr[i].id !== dragId) { ids.push(arr[i].id); } }
      ids.splice(Math.max(0, ids.indexOf(target)), 0, dragId);
      S.order = ids; UStore.set('order', ids);
      if (S.settings.sortByUsage) { toast('Desligue "Ordenar por frequência" para ver a ordem manual.'); }
      dragId = null; renderNav();
    });
    on(document, 'mousedown', function (e) {
      if (!$('popup').hidden && !closest(e.target, function (n) { return n.id === 'popup'; })) { if (UI.popupSel) { multiApply(false); } else { closePopup(); } }   /* C6h: clicking outside keeps the ticks */
    });

    /* editor */
    on(editor, 'keyup', function (e) { var k = e.keyCode; if ((k >= 33 && k <= 40) || k === 13 || k === 8 || k === 46 || k > 47) { S.userCaret = true; } saveRange(); afterChange(false); });
    on(editor, 'mouseup', function (e) {
      S.userCaret = true; saveRange();
      /* D3c: a click anywhere on a blank field (also its very edges) selects the whole placeholder, so typing replaces it */
      var x = e.clientX, y = e.clientY;
      setTimeout(function () {
        var sel = window.getSelection(), r, n, k, c = [], i, f, rc;
        if (!sel || !sel.rangeCount || !sel.isCollapsed) { return; }
        r = sel.getRangeAt(0); n = r.startContainer;
        if (n.nodeType === 3) { c.push(n.parentNode); if (r.startOffset === 0) { c.push(n.previousSibling); } if (r.startOffset === n.nodeValue.length) { c.push(n.nextSibling); } }
        else { k = n.childNodes; c.push(n, k[r.startOffset - 1], k[r.startOffset]); }
        for (i = 0; i < c.length; i++) {
          f = c[i];
          if (!f || f.nodeType !== 1 || !hasCls(f, 'fld') || f.getAttribute('data-t') === 's' || !editor.contains(f) || fieldFilled(f)) { continue; }
          rc = f.getBoundingClientRect();
          if (x >= rc.left - 2 && x <= rc.right + 2 && y >= rc.top - 2 && y <= rc.bottom + 2) { r = document.createRange(); r.selectNodeContents(f); setRange(r); saveRange(); return; }
        }
      }, 0);
    });
    /* C6b: double click on a filled field selects its whole value (the browser's word selection stops at "," / ".") */
    on(editor, 'dblclick', function (e) {
      var f = closest(e.target, function (n) { return hasCls(n, 'fld'); }, editor);
      if (!isTxtFld(f) || !fieldFilled(f)) { return; }
      var r = document.createRange(); r.selectNodeContents(f); setRange(r); saveRange();
    });
    on(editor, 'input', critFix);   /* C11b: before afterChange counts the critical lines */
    on(editor, 'input', function () { afterChange(false); });
    (function () { var ev = ['keydown', 'mousedown', 'paste', 'cut', 'dragstart', 'drop'], i; for (i = 0; i < ev.length; i++) { if (editor.addEventListener) { editor.addEventListener(ev[i], selMark, true); } } })();   /* C11 */
    on(editor, 'blur', saveRange);
    on(document, 'selectionchange', function () { if (document.activeElement === editor) { saveRange(); } });
    on(editor, 'click', function (e) {
      var chip = closest(e.target, function (n) { return hasCls(n, 'fld') && n.getAttribute('data-t') === 's'; }, editor);
      if (chip && filledSel(chip)) {   /* C11: chosen text is editable: keep the caret where clicked */
        var cs = window.getSelection();
        if (cs && cs.rangeCount && cs.isCollapsed) { saveRange(); openSelect(chip); }
        return;
      }
      if (chip) { var r = document.createRange(); r.selectNode(chip); setRange(r); saveRange(); openSelect(chip); }
    });
    on(editor, 'input', function () { S.lastChoice = null; S.lastRemoval = null; S.noDraft = false; });
    on(editor, 'keydown', function (e) {
      var cz = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (cz && !e.shiftKey && e.keyCode === 90 && !S.lastChoice && !S.lastRemoval && S.insStack.length && undoInsert(false)) { e.preventDefault(); return; }
      if (cz && ((e.shiftKey && e.keyCode === 90) || (!e.shiftKey && e.keyCode === 89)) && S.insRedo.length && undoInsert(true)) { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.keyCode === 90 && (S.lastChoice || S.lastRemoval)) {
        if (!S.lastChoice) { e.preventDefault(); undoRemoval(); return; }
        var lc = S.lastChoice; S.lastChoice = null;
        if (editor.contains(lc.el)) { e.preventDefault(); replaceNodeWithHtml(lc.el, lc.html); afterChange(false); return; }
      }
      if (e.keyCode === 9) { if (nextField(e.shiftKey)) { e.preventDefault(); } return; }
      if (e.keyCode === 13) {
        /* Enter on an empty field just moves on (never replaces the field with a line break) */
        var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
        var chip = r ? closest(r.startContainer, function (n) { return hasCls(n, 'fld') && n.getAttribute('data-t') !== 's'; }, editor) : null;
        if (chip) {   /* Enter confirms the field and jumps to the next unfilled one */
          e.preventDefault();
          if (!nextField(false, true)) { caretAfterChip(chip); }
          afterChange(false); return;
        }
      }
      if (S.repMarks.length) { clearRepMarks(); }
    });
  });
  /* C6b: Chromium/Edge delete the field <span> when its whole text is replaced or erased (the value then turns into
     plain text and is no longer a field). Before the browser edits: a selection that is exactly a field's whole text is
     moved INSIDE the span (typing then replaces the value and keeps the field); erasing the last character(s) writes the
     placeholder back with insertText instead (native undo keeps working). */
  function isTxtFld(n) { return n && n.nodeType === 1 && hasCls(n, 'fld') && n.getAttribute('data-t') !== 's' && editor.contains(n); }
  /* field touched by range r: {f, pos} with pos 'in' (inside), 'before' or 'after' (caret right next to it) */
  function fieldAt(r) {
    var c = r.startContainer, o = r.startOffset, f = closest(c, function (n) { return hasCls(n, 'fld'); }, editor);
    if (f) { return isTxtFld(f) ? { f: f, pos: 'in' } : null; }
    var nx = c.nodeType === 3 ? (o === c.nodeValue.length ? c.nextSibling : null) : c.childNodes[o];
    var pv = c.nodeType === 3 ? (o === 0 ? c.previousSibling : null) : c.childNodes[o - 1];
    if (isTxtFld(nx)) { return { f: nx, pos: 'before' }; }
    if (isTxtFld(pv)) { return { f: pv, pos: 'after' }; }
    return null;
  }
  function wholeField(r) {
    if (!r) { return null; }
    var a = fieldAt(r), l, i, hit = null;
    if (!a && !r.collapsed) {   /* selection dragged from outside: the one field it touches */
      l = qsa(editor, '.fld');
      for (i = 0; i < l.length; i++) { if (r.intersectsNode(l[i])) { if (hit) { return null; } hit = l[i]; } }
      if (isTxtFld(hit)) { a = { f: hit, pos: 'in' }; }
    }
    if (!a) { return null; }
    var t = a.f.textContent || '';
    if (t === '') { return null; }
    if (r.collapsed) { return t.length === 1 ? { f: a.f, one: true, pos: a.pos } : null; }
    return r.toString().replace(/^\s+|\s+$/g, '') === t && r.intersectsNode(a.f) ? { f: a.f, one: false } : null;   /* blanks dragged in at the edges are kept */
  }
  function fieldInner(f) { var r = document.createRange(); r.selectNodeContents(f); setRange(r); return r; }
  R(function () {
    on(editor, 'keydown', function (e) {
      var k = e.keyCode; if ((k !== 8 && k !== 46) || e.ctrlKey || e.metaKey || e.altKey) { return; }
      var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null, w = wholeField(r);
      if (!w) { return; }
      if (w.one) {   /* collapsed caret: only when this key would erase the single remaining character */
        var c = r.startContainer, o = r.startOffset;
        var atEnd = w.pos === 'after' || (w.pos === 'in' && (c.nodeType === 3 ? o === c.nodeValue.length : o >= c.childNodes.length));
        var atStart = w.pos === 'before' || (w.pos === 'in' && o === 0);
        if (!((k === 8 && atEnd) || (k === 46 && atStart))) { return; }
      }
      e.preventDefault();
      var ph = w.f.getAttribute('data-ph') || '___';
      fieldInner(w.f);
      if (!exec('insertText', ph)) { w.f.textContent = ph; }
      if (editor.contains(w.f)) { fieldInner(w.f); }
      saveRange(); afterChange(false);
    });
    on(editor, 'keypress', function (e) {
      var ch = e.charCode || e.which; if (!ch || ch < 32 || e.ctrlKey || e.metaKey) { return; }
      var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null, w = r && !r.collapsed ? wholeField(r) : null;
      if (w) { fieldInner(w.f); }   /* the browser then replaces the value inside the span */
      /* caret on the outer edge of a filled numeric field (a click at its first/last digit puts it outside the span):
         a digit or decimal sign goes into the field, never as loose text next to it */
      var a = r && r.collapsed ? fieldAt(r) : null, t = a ? a.f.getAttribute('data-t') : '';
      if (a && a.pos !== 'in' && (t === 'n' || t === 'd') && fieldFilled(a.f) && /[0-9.,]/.test(String.fromCharCode(ch))) {
        /* direct text edit: the browser would move a caret at the span's edge back outside it */
        e.preventDefault();
        var tn = a.f.firstChild; if (!tn || tn.nodeType !== 3) { tn = document.createTextNode(''); a.f.insertBefore(tn, a.f.firstChild); }
        if (a.pos === 'before') { tn = a.f.firstChild; tn.insertData(0, String.fromCharCode(ch)); }
        else { tn = a.f.lastChild.nodeType === 3 ? a.f.lastChild : a.f.appendChild(document.createTextNode('')); tn.appendData(String.fromCharCode(ch)); }
        var ir = document.createRange(); ir.setStart(tn, a.pos === 'before' ? 1 : tn.nodeValue.length); ir.collapse(true); setRange(ir); saveRange();
        var ev; try { ev = new Event('input', { bubbles: true }); } catch (x) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
        editor.dispatchEvent(ev);
      }
    });
    /* C6c: a highlighted (selected) choice chip opens with ArrowDown, Alt+ArrowDown or Enter instead of moving the caret */
    on(editor, 'keydown', function (e) {
      var k = e.keyCode, dg = k >= 49 && k <= 57 ? k - 49 : (k >= 97 && k <= 105 ? k - 97 : -1);   /* lote: 1-9 (also keypad) = that option */
      if (!$('popup').hidden || e.ctrlKey || e.metaKey || e.altKey && dg >= 0 || e.shiftKey || (k !== 40 && k !== 13 && dg < 0)) { return; }
      var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null, c;
      if (!r || r.collapsed) { return; }
      c = r.startContainer.nodeType === 1 ? r.startContainer.childNodes[r.startOffset] : null;
      if (!c || c.nodeType !== 1 || !hasCls(c, 'fld') || c.getAttribute('data-t') !== 's' || r.endContainer !== r.startContainer || r.endOffset !== r.startOffset + 1) { return; }
      if (dg >= 0) { var no = []; try { no = JSON.parse(c.getAttribute('data-o')) || []; } catch (x) { no = []; } if (dg >= no.length) { e.preventDefault(); return; } }   /* no such option: the number must not overwrite the field */
      e.preventDefault(); if (e.stopPropagation) { e.stopPropagation(); }
      openSelect(c);
      if (dg >= 0) { if (UI.popupSel) { UI.popupIdx = dg; UI.popupKbd(); UI.multiToggle(dg); } else { chooseOption(dg); } }
    });
    /* caret as plain text right after a chip: typing must not merge into the field value */
    chipExit = null;
  });
  function caretAfterChip(chip) {
    var n = chip.nextSibling;
    if (!n || n.nodeType !== 3) { n = document.createTextNode(''); chip.parentNode.insertBefore(n, chip.nextSibling); }
    var ra = document.createRange(); ra.setStart(n, 0); ra.collapse(true); setRange(ra); saveRange();
    chipExit = chip;
  }
  R(function () {
    on(editor, 'keypress', function (e) {
      var chip = chipExit, ch = e.charCode || e.which;
      if (!chip || !ch || ch < 32 || e.ctrlKey || e.metaKey) { return; }
      var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!r || !r.collapsed || !editor.contains(chip)) { chipExit = null; return; }
      var inChip = closest(r.startContainer, function (n) { return n === chip; }, editor);
      var n = chip.nextSibling, atAfter = n && n.nodeType === 3 && r.startContainer === n && r.startOffset === 0;
      if (!inChip && !atAfter && !(r.startContainer === chip.parentNode && r.startOffset === Array.prototype.indexOf.call(chip.parentNode.childNodes, chip) + 1)) { chipExit = null; return; }
      e.preventDefault();
      if (!n || n.nodeType !== 3) { n = document.createTextNode(''); chip.parentNode.insertBefore(n, chip.nextSibling); }
      n.insertData(0, String.fromCharCode(ch));
      var ra = document.createRange(); ra.setStart(n, 1); ra.collapse(true); setRange(ra); saveRange();
      chipExit = null;
      afterChange(false);
    });
    on(editor, 'mousedown', function () { chipExit = null; });
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls;
    closest = UI.closest; qsa = UI.qsa; trim = UI.trim; now = UI.now; toast = UI.toast; S = UI.S;
    saveSearch = UI.saveSearch; editor = UI.editor; setBank = UI.setBank; examNames = UI.examNames;
    getModel = UI.getModel; sortedModels = UI.sortedModels; examSections = UI.examSections;
    fieldFilled = UI.fieldFilled; lineText = UI.lineText; saveRange = UI.saveRange; setRange = UI.setRange;
    focusEditor = UI.focusEditor; exec = UI.exec; ensureNotEmpty = UI.ensureNotEmpty;
    insertBlock = UI.insertBlock; replaceNodeWithHtml = UI.replaceNodeWithHtml; undoRemoval = UI.undoRemoval;
    critFix = UI.critFix; critState = UI.critState; afterChange = UI.afterChange; nextField = UI.nextField;
    filledSel = UI.filledSel; selMark = UI.selMark; multiApply = UI.multiApply; openSelect = UI.openSelect;
    closePopup = UI.closePopup; chooseOption = UI.chooseOption; reportText = UI.reportText;
    critGroups = UI.critGroups; removeGroup = UI.removeGroup; clearRepMarks = UI.clearRepMarks;
    navItems = UI.navItems; loadedModel = UI.loadedModel; renderNav = UI.renderNav; modelHref = UI.modelHref;
    sentenceCase = UI.sentenceCase; rawHtml = UI.rawHtml; navKeyOf = UI.navKeyOf; goLevel = UI.goLevel;
    navBack = UI.navBack; activateNav = UI.activateNav; selectCard = UI.selectCard; anchorHits = UI.anchorHits;
    directiveRule = UI.directiveRule; edText = UI.edText; edHtml = UI.edHtml; undoInsert = UI.undoInsert;
    insertCard = UI.insertCard; editorLines = UI.editorLines; useModel = UI.useModel;
    modelDialog = UI.modelDialog; cloneModel = UI.cloneModel; phraseDialog = UI.phraseDialog;
    importDialog = UI.importDialog; settingsDialog = UI.settingsDialog; allIssues = UI.allIssues;
    interText = UI.interText; recognizeText = UI.recognizeText;
  };
});
