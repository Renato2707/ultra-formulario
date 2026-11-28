/*
 * ui-fields.js - laudo: campos, linhas críticas, contadores, abas/rascunho, lista de opções.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-fields', function (UI, R) {
  'use strict';
  var CRIT_A, critSnap, critGone, HYP_U_RE, MAX_DRAFTS, OPEN_ORD, oOrd, queued;   /* deste arquivo */
  var $, on, esc, hasCls, addCls, rmCls, closest, qsa, trim, now, S, editor, inlineHtml, fieldFilled,
      textLines, lineText, saveRange, setRange, focusEditor, keepInView, replaceNodeWithHtml, edText, edHtml,
      editorLines, syncHypotheses, updTitle;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.PH, UI.saveTimer, UI.TAB, UI.TAB_ALIVE_MS, UI.TAB_STAY_MAX,
     UI.OPEN_TPL, UI.OPEN_MODEL, UI.BASE_TITLE, UI.TAB_ORD, UI.popupFor, UI.popupIdx, UI.popupSel */
  UI.critFix = critFix; UI.critState = critState; UI.checkFields = checkFields;
  UI.updatePrintHold = updatePrintHold; UI.printNow = printNow; UI.afterChange = afterChange;
  UI.tabsMap = tabsMap; UI.stayMap = stayMap; UI.markAlive = markAlive; UI.enqueueSessOpen = enqueueSessOpen;
  UI.pickTab = pickTab; UI.saveDraft = saveDraft; UI.gotoLine = gotoLine; UI.jumpNextCrit = jumpNextCrit;
  UI.nextField = nextField; UI.focusField = focusField; UI.filledSel = filledSel; UI.selMark = selMark;
  UI.multiChipHtml = multiChipHtml; UI.multiToggle = multiToggle; UI.multiApply = multiApply;
  UI.openSelect = openSelect; UI.popupKbd = popupKbd; UI.closePopup = closePopup; UI.chooseOption = chooseOption;   /* usadas por outros arquivos */

  /* ================= fields, critical lines, counters ================= */
  function markCritOrig() {
    var l = qsa(editor, '.crit'), i;
    for (i = 0; i < l.length; i++) { if (l[i].getAttribute('data-orig') === null) { l[i].setAttribute('data-orig', lineText(l[i])); } }
  }
  /* C11b: the critical mark lives on the line <div>. Deleting across lines makes the browser keep the FIRST line's
     <div> and pull the rest of the last line into it, so the mark went to the line below (or a critical line's text
     lost it when pulled into a plain line). After each edit the merged line takes the mark only from the line(s) whose
     text actually survived in it: start of the first old line and/or end of the last old line. */
  R(function () {
    CRIT_A = ['data-orig', 'data-res', 'data-conf'], critSnap = [];
  });
  function critSnapTake() {
    var l = editorLines(), i, a = [];
    for (i = 0; i < l.length; i++) { a.push({ el: l[i], t: lineText(l[i]), c: hasCls(l[i], 'crit') ? 'crit' : (hasCls(l[i], 'crit-instr') ? 'crit-instr' : ''), ok: hasCls(l[i], 'crit-ok'), at: critAttrs(l[i]) }); }
    critSnap = a;
  }
  function critAttrs(el) { var o = {}, i; for (i = 0; i < CRIT_A.length; i++) { o[CRIT_A[i]] = el.getAttribute(CRIT_A[i]); } return o; }
  function critSet(el, src) {
    rmCls(el, 'crit'); rmCls(el, 'crit-instr'); rmCls(el, 'crit-ok');
    var i, v;
    for (i = 0; i < CRIT_A.length; i++) {
      v = src && src.c ? src.at[CRIT_A[i]] : null;
      if (v === null) { el.removeAttribute(CRIT_A[i]); } else { el.setAttribute(CRIT_A[i], v); }
    }
    if (src && src.c) { addCls(el, src.c); if (src.ok) { addCls(el, 'crit-ok'); } }
    if (el.getAttribute('class') === '') { el.removeAttribute('class'); }
  }
  function critWord(t) { return /[0-9A-Za-z\u00c0-\u024f]/.test(t); }
  R(function () {
    critGone = [];   /* critical lines removed by a merge, so Ctrl+Z (which brings the text back) brings the mark back */
  });
  function critFix(ev) {
    var old = critSnap, now = editorLines(), h = 0, e = 0, i, j, d, t, o0, o1, s, p, src = null;
    if (ev && /^history(Undo|Redo)$/.test(ev.inputType || '') && critGone.length) {
      for (i = 0; i < now.length; i++) {
        if (hasCls(now[i], 'crit') || hasCls(now[i], 'crit-instr')) { continue; }
        t = lineText(now[i]);
        for (j = critGone.length - 1; j >= 0; j--) { if (critGone[j].t === t) { critSet(now[i], critGone[j]); critGone.splice(j, 1); break; } }
      }
    }
    if (!old.length) { return; }
    while (h < old.length && h < now.length && old[h].el === now[h] && old[h].t === lineText(now[h])) { h++; }
    while (e < old.length - h && e < now.length - h && old[old.length - 1 - e].el === now[now.length - 1 - e] && old[old.length - 1 - e].t === lineText(now[now.length - 1 - e])) { e++; }
    /* lote: an edit that leaves 2+ lines (Enter, multi-line paste/typing over a selection): the browser copies the
       class and data-* of the line it split onto every new line, so pasted plain text became "critical". A marked
       line keeps the mark only when the text of a critical line survived in it (its start / end), when it is the
       same unchanged line, or when it was just inserted with its own mark (no data-orig yet: bank/recognized line) */
    if (now.length - h - e >= 2 || now.length - h - e > old.length - h - e) {
      o0 = old.length - h - e ? old[h] : null; o1 = old.length - h - e ? old[old.length - 1 - e] : null;
      var keepIt;
      for (i = h; i < now.length - e; i++) {
        d = now[i]; if (!hasCls(d, 'crit') && !hasCls(d, 'crit-instr')) { continue; }
        if (d.getAttribute('data-orig') === null) { continue; }
        t = lineText(d); src = null;
        for (j = h; j < old.length - e && !src; j++) { if (old[j].el === d && old[j].t === t && old[j].c) { src = old[j]; } }
        if (!src && t === d.getAttribute('data-orig') && critWord(t)) { continue; }   /* the critical text itself, moved down by Enter */
        if (!src && i === h && o0 && o0.c) { for (p = 0; p < t.length && p < o0.t.length && t.charAt(p) === o0.t.charAt(p); p++) {} if (p && critWord(o0.t.substring(0, p))) { src = o0; } }
        if (!src && i === now.length - 1 - e && o1 && o1.c) { for (s = 0; s < t.length && s < o1.t.length && t.charAt(t.length - 1 - s) === o1.t.charAt(o1.t.length - 1 - s); s++) {} if (s && critWord(o1.t.substring(o1.t.length - s))) { src = o1; } }
        keepIt = src && hasCls(d, src.c) && d.getAttribute('data-orig') === src.at['data-orig'];
        if (!keepIt) { critSet(d, src); }
      }
      for (j = h; j < old.length - e; j++) { if (old[j].c && now.indexOf(old[j].el) < 0) { critGone.push(old[j]); } }
      if (critGone.length > 30) { critGone.splice(0, critGone.length - 30); }
      return;
    }
    if (old.length - h - e < 2 || now.length - h - e !== 1) { return; }   /* only a merge of 2+ old lines into one */
    d = now[h]; t = lineText(d); o0 = old[h]; o1 = old[old.length - 1 - e];
    for (s = 0; s < t.length && s < o1.t.length && t.charAt(t.length - 1 - s) === o1.t.charAt(o1.t.length - 1 - s); s++) {}
    for (p = 0; p < t.length - s && p < o0.t.length && t.charAt(p) === o0.t.charAt(p); p++) {}
    if (p && o0.c && critWord(o0.t.substring(0, p))) { src = o0; }
    else if (s && o1.c && critWord(o1.t.substring(o1.t.length - s))) { src = o1; }
    for (i = h; i < old.length - e; i++) { if (old[i].c && old[i] !== src) { critGone.push(old[i]); } }
    if (critGone.length > 30) { critGone.splice(0, critGone.length - 30); }
    if ((src ? src.c : '') === (hasCls(d, 'crit') ? 'crit' : (hasCls(d, 'crit-instr') ? 'crit-instr' : '')) && (!src || d.getAttribute('data-orig') === src.at['data-orig'])) { return; }
    critSet(d, src);
  }
  function critState() {
    var pend = [], instr = [], l = qsa(editor, '.crit'), i, el;
    for (i = 0; i < l.length; i++) {
      el = l[i];
      /* only an explicit Confirmar in the review counts; changing a confirmed line makes it pending again (D3) */
      if (hasCls(el, 'crit-ok')) {
        if (el.getAttribute('data-conf') === null || lineText(el) === el.getAttribute('data-conf')) { continue; }
        rmCls(el, 'crit-ok'); el.removeAttribute('data-res'); el.removeAttribute('data-conf');
      }
      pend.push(el);
    }
    l = qsa(editor, '.crit-instr');
    for (i = 0; i < l.length; i++) { if (trim(lineText(l[i])) !== '') { instr.push(l[i]); } }
    return { pend: pend, instr: instr };
  }
  function checkFields() {
    var l = qsa(editor, '.fld'), i, f, t, unf = [];
    for (i = 0; i < l.length; i++) {
      f = l[i]; t = f.getAttribute('data-t');
      var filled = fieldFilled(f);
      if (filled) { addCls(f, 'f-ok'); } else { rmCls(f, 'f-ok'); unf.push(f); }
      var bir = (t === 'n' || t === 'd') && window.UFBirads && UFBirads.isMarkFld(f);   /* C7: BI-RADS: 0-6 com 4A/4B/4C */
      if (filled && bir) { if (UFBirads.normCat(f.textContent)) { rmCls(f, 'f-bad'); f.removeAttribute('title'); } else { addCls(f, 'f-bad'); f.title = 'BI-RADS: 0, 1, 2, 3, 4A, 4B, 4C, 5 ou 6'; } continue; }
      if (filled && (t === 'n' || t === 'd') && !/^\s*-?\d+([.,]\d+)?\s*$/.test(f.textContent)) { addCls(f, 'f-bad'); f.title = 'Valor numérico esperado'; }
      else { rmCls(f, 'f-bad'); if (t !== 's') { f.removeAttribute('title'); } }
    }
    return unf;
  }
  /* print safeguard: while anything would stop Copiar (pending critical lines / instructions, or empty fields
     with the warning on), the print stylesheet hides the report and prints a notice instead (class on <html>,
     so it also covers the browser menu / Ctrl+P when the key can't be intercepted). Only the app's own
     print (after the review) lifts it, for that one print. */
  function printPending() {
    var cs = critState();
    return cs.pend.length + cs.instr.length > 0 || (S.settings.warnFields && checkFields().length > 0);
  }
  function updatePrintHold() {
    var h = document.documentElement, hold = !S.printAllowed && trim(textLines(editor, '').join('')) !== '' && printPending();
    if (hold) { addCls(h, 'print-hold'); } else { rmCls(h, 'print-hold'); }
  }
  function printNow() {
    S.printAllowed = true; updatePrintHold();
    setTimeout(function () {
      try { window.print(); } catch (e) {}
      /* print() returns after the print dialog (Chrome/IE) or after the page was snapshotted (Firefox):
         the allowance is for that single print only */
      S.printAllowed = false; updatePrintHold();
    }, 0);
  }
  function updateCounters() {
    var cs = critState(), unf = checkFields(), b = $('btnCritCount'), n = cs.pend.length + cs.instr.length;
    b.hidden = n === 0;
    b.innerHTML = '&#9888; ' + n + (n === 1 ? ' crítica' : ' críticas');
    b.title = n + (n === 1 ? ' linha crítica pendente' : ' linhas críticas pendentes') + ' (clique para ir à próxima)';
    var fb = $('btnFieldCount');
    fb.hidden = unf.length === 0;
    fb.innerHTML = unf.length + (unf.length === 1 ? ' campo' : ' campos');
    fb.title = unf.length + (unf.length === 1 ? ' campo a preencher' : ' campos a preencher') + ' (clique para ir ao próximo)';
    if ($('centerFoot')) { $('centerFoot').hidden = b.hidden && fb.hidden; }
    updatePrintHold();
  }
  R(function () {
    UI.saveTimer = null;
    /* "Hipótese/Impressão diagnóstica:" heading lines get class hypu (underlined via CSS when the setting is on) */
    HYP_U_RE = /^\s*hip[\u00f3o]tese\s*\/\s*impress[\u00e3a]o\s+diagn[\u00f3o]stica\b[^:]*:\s*$/i;
  });
  function markHypUnderline() {
    var l = editorLines(), i, on1;
    for (i = 0; i < l.length; i++) {
      on1 = HYP_U_RE.test(lineText(l[i]));
      if (on1 && !hasCls(l[i], 'hypu')) { addCls(l[i], 'hypu'); } else if (!on1 && hasCls(l[i], 'hypu')) { rmCls(l[i], 'hypu'); }
    }
  }
  function afterChange(fast) {
    /* C7a: remember if the report separates paragraphs with a blank line.
       Cleared when the report is wiped; kept if later edits leave no blank (truncation). */
    var ls = editorLines ? editorLines() : [], i, has = false, st = 0, blank;
    for (i = 0; i < ls.length; i++) {
      blank = trim(lineText(ls[i])) === '' && !(ls[i].querySelector && ls[i].querySelector('.fld'));
      if (blank) { if (st === 1) { st = 2; } }
      else { has = true; if (st === 2) { S.paraFromModel = true; } st = 1; }
    }
    if (!has) { S.paraFromModel = false; }
    selTidy();
    updTitle();
    syncHypotheses();
    markHypUnderline();
    markCritOrig();
    updateCounters();
    critSnapTake();
    clearTimeout(UI.saveTimer);
    UI.saveTimer = setTimeout(saveDraft, fast ? 50 : 700);
  }
  /* ---- per-tab drafts: each browser tab keeps its own report (key draft.<tabId>).
     The tab id lives in sessionStorage (survives reload, private to the tab; window.name
     as fallback). A tab that is still open marks itself in 'tabs' (heartbeat), so a NEW
     tab never takes over the report of another open tab, but does recover the most recent
     report of a tab that was closed. Bank/settings stay shared in localStorage. */
  R(function () {
    UI.TAB = null, UI.TAB_ALIVE_MS = 15000, MAX_DRAFTS = 10;
  });
  function ssGet() { try { return window.sessionStorage.getItem('uf.tab'); } catch (e) { return null; } }
  function ssSet(v) { try { window.sessionStorage.setItem('uf.tab', v); } catch (e) {} try { window.name = 'uf.tab=' + v; } catch (e2) {} }
  function tabsMap() { var m = UStore.get('tabs', {}); return (m && typeof m === 'object') ? m : {}; }
  /* C10: "ainda aberta" independente do intervalo de 15 s (o Edge/Chrome atrasam o timer
     nas abas de fundo). Só some no pagehide/beforeunload (aba de verdade fechada). */
  R(function () {
    UI.TAB_STAY_MAX = 7 * 24 * 3600 * 1000;
  });
  function stayMap() { var m = UStore.get('tabStay', {}); return (m && typeof m === 'object') ? m : {}; }
  function markStay(on) {
    var s = stayMap(), k, t = now();
    if (on) { s[UI.TAB] = t; } else { delete s[UI.TAB]; }
    for (k in s) { if (s.hasOwnProperty(k) && t - s[k] > UI.TAB_STAY_MAX) { delete s[k]; } }
    UStore.set('tabStay', s);
  }
  function markAlive(on) {
    var m = tabsMap(); if (on) { m[UI.TAB] = now(); } else { delete m[UI.TAB]; } UStore.set('tabs', m);
    markStay(on);
  }
  /* C6n: aba aberta por "Sessões" (index.html#ufopen=<nome do modelo>)
     C8: cartão de modelo é um link (index.html#ufmodel=<id>): botão direito, Ctrl+clique e clique do meio
     abrem o mesmo arquivo noutra guia, com esse modelo carregado. O id vai no hash (funciona em file:// e no IE11). */
  R(function () {
    UI.OPEN_TPL = null, UI.OPEN_MODEL = null, UI.BASE_TITLE = document.title;
    OPEN_ORD = 0, UI.TAB_ORD = 0;
  });
  function rawHash() {
    var href = '', i;
    try { href = String(window.location.href || ''); } catch (e1) { href = ''; }
    i = href.indexOf('#');
    if (i >= 0) { return href.slice(i); }
    try { return String(window.location.hash || ''); } catch (e2) { return ''; }
  }
  /* valor de um parâmetro do hash; corta só em &ufopen= / &uford= / &ufmodel= (um & no nome, se o
     navegador já tiver decodificado o hash, continua a fazer parte do valor) */
  function hashParam(name) {
    var h = rawHash(), key = name + '=', i = h.indexOf(key), rest, cut;
    if (i < 0) { return null; }
    if (i > 0 && h.charAt(i - 1) !== '#' && h.charAt(i - 1) !== '&') { return null; }
    rest = h.slice(i + key.length);
    cut = rest.search(/&uf(?:open|ord|model)=/);
    if (cut >= 0) { rest = rest.slice(0, cut); }
    try { return decodeURIComponent(rest); } catch (eD) { return rest; }
  }
  /* C10: ler o hash pelo href (rawHash), não por location.hash — em file:// o Edge
     às vezes deixa location.hash vazio. Se o hash sumir no window.open, a fila sessOpen.*
     (localStorage) ainda entrega o modelo. */
  function takeSessOpen() {
    var ks, cand, i, k, item, t = now(), claim, got;
    try { ks = UStore.keys(); } catch (eK) { return null; }
    cand = [];
    for (i = 0; i < ks.length; i++) {
      k = ks[i];
      if (String(k).indexOf('sessOpen.') !== 0) { continue; }
      item = UStore.get(k, null);
      if (!item || t - item.t > 60000) { UStore.remove(k); continue; }
      if (item.claim) { continue; }
      cand.push({ k: k, item: item });
    }
    cand.sort(function (a, b) { return (a.item.ord - b.item.ord) || (a.item.t - b.item.t); });
    for (i = 0; i < cand.length; i++) {
      claim = 'c' + t + '-' + Math.floor(Math.random() * 1e9);
      cand[i].item.claim = claim;
      UStore.set(cand[i].k, cand[i].item);
      got = UStore.get(cand[i].k, null);
      if (got && got.claim === claim) {
        UStore.remove(cand[i].k);
        return got;
      }
    }
    return null;
  }
  function enqueueSessOpen(item) {
    var id = 'sessOpen.' + (item.ord || now()) + '.' + now() + '.' + Math.floor(Math.random() * 1e6);
    item.t = now();
    UStore.set(id, item);
    return id;
  }
  R(function () {
    try { UI.OPEN_TPL = hashParam('ufopen'); } catch (eH) { UI.OPEN_TPL = null; }
    try { oOrd = hashParam('uford'); OPEN_ORD = oOrd ? (parseInt(oOrd, 10) || 0) : 0; } catch (eO) { OPEN_ORD = 0; }
    try { UI.OPEN_MODEL = hashParam('ufmodel'); } catch (eM) { UI.OPEN_MODEL = null; }
    if (UI.OPEN_TPL === null && UI.OPEN_MODEL === null) {
      try {
        queued = takeSessOpen();
        if (queued) {
          UI.OPEN_TPL = queued.name || null;
          UI.OPEN_MODEL = queued.id || null;
          OPEN_ORD = queued.ord || 0;
        }
      } catch (eQ) {}
    }
  });
  function draftIndex() { var m = UStore.get('drafts', {}); return (m && typeof m === 'object') ? m : {}; }
  function pickTab() {
    var id = ssGet(), m = tabsMap(), idx = draftIndex(), t = now(), k, best = null, legacy;
    if (UI.OPEN_TPL !== null || UI.OPEN_MODEL !== null) { id = null; m = {}; idx = {}; }   /* C6n/C8: sessão ou #ufmodel: sempre uma aba nova, vazia */
    else if (!id && /^uf\.tab=/.test(String(window.name || ''))) { id = String(window.name).slice(7); }
    if (id && m[id] && t - m[id] < UI.TAB_ALIVE_MS) {           /* duplicated tab: same id still alive elsewhere */
      var nid = 't' + t.toString(36) + Math.floor(Math.random() * 1e6).toString(36), d0 = UStore.get('draft.' + id, null);
      if (d0) { UStore.set('draft.' + nid, d0); idx[nid] = t; UStore.set('drafts', idx); }
      id = nid;
    }
    if (!id) {                                                /* new tab: adopt the newest draft of a closed tab */
      legacy = UStore.get('draft', null);                       /* single draft from versions before B21 */
      if (legacy && legacy.html) { UStore.set('draft.legacy', legacy); idx.legacy = legacy.t || 1; UStore.remove('draft'); UStore.set('drafts', idx); }
      for (k in idx) { if (idx.hasOwnProperty(k) && !(m[k] && t - m[k] < UI.TAB_ALIVE_MS) && (!best || idx[k] > idx[best])) { best = k; } }
      id = ((UI.OPEN_TPL === null && UI.OPEN_MODEL === null) && best) || ('t' + t.toString(36) + Math.floor(Math.random() * 1e6).toString(36));
    }
    UI.TAB = id; ssSet(id); markAlive(true);
    if (UI.OPEN_TPL !== null || UI.OPEN_MODEL !== null) { idx = draftIndex(); }
    var dd = UStore.get('draft.' + UI.TAB, null); UI.TAB_ORD = OPEN_ORD || (dd && dd.ord) || t;   /* C6n: ordem de abertura da aba (sessões) */
    /* prune: keep the newest MAX_DRAFTS drafts, drop drafts older than 30 days */
    var ks = []; for (k in idx) { if (idx.hasOwnProperty(k)) { ks.push(k); } }
    ks.sort(function (a, b) { return idx[b] - idx[a]; });
    for (var i = 0; i < ks.length; i++) { if (ks[i] !== UI.TAB && (i >= MAX_DRAFTS || t - idx[ks[i]] > 2592000000)) { UStore.remove('draft.' + ks[i]); delete idx[ks[i]]; } }
    UStore.set('drafts', idx);
  }
  function saveDraft() {
    if (!UI.TAB || S.noDraft) { return; }   /* noDraft: drafts were cleared in another tab; resumes on the next edit here */
    var html = editor.innerHTML.replace(/<mark class="hl( cur)?">|<\/mark>/g, '');
    var idx = draftIndex(); idx[UI.TAB] = now(); UStore.set('drafts', idx);
    UStore.set('draft.' + UI.TAB, { html: html, model: S.activeModelId, exam: S.activeExam, nav: { level: S.level, exam: S.navExam }, t: now(), ord: UI.TAB_ORD });
  }
  function flash(el) { addCls(el, 'crit-flash'); setTimeout(function () { rmCls(el, 'crit-flash'); }, 1200); }
  function gotoLine(el) {
    keepInView(el);
    var r = document.createRange(); r.selectNodeContents(el); focusEditor(); setRange(r); saveRange(); flash(el);
  }
  function jumpNextCrit() {
    var cs = critState(), all = cs.pend.concat(cs.instr);
    if (!all.length) { return; }
    var sel = S.savedRange, i, pick = all[0];
    if (sel) {
      for (i = 0; i < all.length; i++) {
        var r = document.createRange(); r.selectNode(all[i]);
        if (sel.compareBoundaryPoints(Range.START_TO_START, r) < 0) { pick = all[i]; break; }
      }
    }
    gotoLine(pick);
  }

  /* Tab / Shift+Tab between unfilled fields */
  function nextField(back, noWrap) {
    var unf = checkFields();
    if (!unf.length) {   /* C6o: everything filled (review): every field in order, selected to overwrite; the end stays as before */
      var al = qsa(editor, '.fld'), q;
      for (q = 0; q < al.length; q++) { if (!closest(al[q].parentNode, function (n) { return hasCls(n, 'fld'); }, editor)) { unf.push(al[q]); } }
      noWrap = true;
      if (!unf.length) { return false; }
    }
    var sel = window.getSelection(), cur = sel.rangeCount ? sel.getRangeAt(0) : null, i, pick = null;
    if (cur && !editor.contains(cur.commonAncestorContainer)) { cur = S.savedRange; }
    var curChip = cur ? closest(cur.startContainer, function (n) { return hasCls(n, 'fld'); }, editor) : null;
    if (cur && !curChip && cur.startContainer.nodeType === 1 && !cur.collapsed) {   /* whole chip selected (choice fields) */
      var at = cur.startContainer.childNodes[cur.startOffset];
      if (at && at.nodeType === 1 && hasCls(at, 'fld')) { curChip = at; }
    }
    if (!curChip && UI.popupFor) { curChip = UI.popupFor; }
    if (cur) {
      for (i = back ? unf.length - 1 : 0; back ? i >= 0 : i < unf.length; i += back ? -1 : 1) {
        if (unf[i] === curChip) { continue; }
        var r = document.createRange(); r.selectNode(unf[i]);
        var cmp = cur.compareBoundaryPoints(Range.START_TO_START, r);
        if (back ? cmp > 0 : cmp <= 0) { pick = unf[i]; break; }
      }
    }
    if (!pick && noWrap) { return false; }
    if (!pick) { pick = back ? unf[unf.length - 1] : unf[0]; }
    focusField(pick);
    return true;
  }
  /* scroll the editor so `el` sits at the vertical centre (offset maths, no scrollIntoView options) */
  function centerInEditor(el) {
    if (!el || !el.getBoundingClientRect) { return; }
    var w = $('editorWrap'), wr = w.getBoundingClientRect(), r = el.getBoundingClientRect();
    var want = w.scrollTop + (r.top - wr.top) - (w.clientHeight - (r.bottom - r.top)) / 2;
    w.scrollTop = Math.max(0, Math.round(want));
  }
  function focusField(f) {
    centerInEditor(f);
    var r = document.createRange();
    focusEditor();
    if (f.getAttribute('data-t') === 's') { r.selectNode(f); setRange(r); saveRange(); openSelect(f); }
    else { r.selectNodeContents(f); setRange(r); saveRange(); }
  }

  /* C11: a CHOSEN choice is plain editable text (never an atomic contenteditable=false block: Backspace at its end
     used to erase the whole phrase). Its text as chosen is kept in an expando (_ufx); once the text is edited by
     hand it stops being a choice (a bare <span>, same nodes, so caret and native undo stay). The blank "escolher"
     chip stays atomic. */
  function filledSel(n) { return n && n.nodeType === 1 && hasCls(n, 'fld') && hasCls(n, 'f-ok') && n.getAttribute('data-t') === 's' && editor.contains(n); }
  function selMark() {
    var l = qsa(editor, '.fld.f-sel.f-ok'), i;
    for (i = 0; i < l.length; i++) {
      if (l[i].getAttribute('contenteditable') !== null) { l[i].removeAttribute('contenteditable'); }
      if (l[i]._ufx === undefined) { l[i]._ufx = l[i].textContent; }
    }
  }
  function selPlain(c) {
    var a = ['contenteditable', 'data-t', 'data-m', 'data-v', 'data-o', 'title'], i;
    if (UI.popupFor === c) { closePopup(); }
    c.className = ''; c.removeAttribute('class');
    for (i = 0; i < a.length; i++) { c.removeAttribute(a[i]); }
    c._ufx = undefined;
  }
  function selTidy() {
    var l = qsa(editor, '.fld.f-sel.f-ok'), i;
    for (i = 0; i < l.length; i++) { if (l[i]._ufx !== undefined && l[i].textContent !== l[i]._ufx) { selPlain(l[i]); } }
    selMark();
  }
  /* dropdown popup for ?[a|b] */
  R(function () {
    UI.popupFor = null, UI.popupIdx = 0;
    /* ---- C6h: multiple choice ?+[a|b|c]: ticks in the list, result "a, b e c" ---- */
    UI.popupSel = null;   /* ticked indices while a multi list is open (null = single list) */
  });
  function joinList(a) { return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' e ' + a[a.length - 1]; }
  function isSem(t) { return /^\s*sem\b/i.test(t); }
  function multiVals(chip) { var v = chip.getAttribute('data-v'), o = [], i, a; if (v === null || v === '') { return o; } a = v.split(','); for (i = 0; i < a.length; i++) { o.push(parseInt(a[i], 10)); } return o; }
  function multiChipHtml(oj, sel, opts, keep) {   /* keep: the pasted order (otherwise the bank order) */
    var t = [], i; sel = keep ? sel.slice(0) : sel.slice(0).sort(function (a, b) { return a - b; }); for (i = 0; i < sel.length; i++) { t.push(opts[sel[i]]); }
    if (!sel.length) { return '<span class="fld f-sel f-multi" contenteditable="false" data-t="s" data-m="1" data-o="' + esc(oj) + '">' + UI.PH.s + '</span>'; }
    return '<span class="fld f-sel f-multi f-ok" data-t="s" data-m="1" data-v="' + sel.join(',') + '" data-o="' + esc(oj) + '" title="Clique para trocar (várias opções)">' + esc(UltraParser.joinMulti(t)) + '</span>';   /* C6i: common beginning written once */
  }
  function multiPaint() {
    var l = qsa($('popup'), '.opt[data-i]'), i, k;
    for (i = 0; i < l.length; i++) { k = parseInt(l[i].getAttribute('data-i'), 10); if (UI.popupSel.indexOf(k) >= 0) { addCls(l[i], 'on'); } else { rmCls(l[i], 'on'); } l[i].firstChild.innerHTML = UI.popupSel.indexOf(k) >= 0 ? '&#9745;' : '&#9744;'; }
  }
  function multiToggle(k) {
    var opts = JSON.parse(UI.popupFor.getAttribute('data-o')), at = UI.popupSel.indexOf(k), i;
    if (at >= 0) { UI.popupSel.splice(at, 1); }
    else {
      /* "sem ..." contradicts the others: ticking it clears them, ticking another clears it */
      if (isSem(opts[k])) { UI.popupSel = []; } else { for (i = UI.popupSel.length - 1; i >= 0; i--) { if (isSem(opts[UI.popupSel[i]])) { UI.popupSel.splice(i, 1); } } }
      UI.popupSel.push(k);
    }
    multiPaint();
  }
  function multiApply(move, back) {   /* write the ticked options into the report (one undo step) */
    var chip = UI.popupFor, sel = UI.popupSel; closePopup();
    if (!chip || !chip.parentNode || !editor.contains(chip)) { return; }
    var old = multiVals(chip).sort().join(','), nw = sel.slice(0).sort().join(',');
    if (old !== nw || chip.getAttribute('data-v') === null && sel.length) {
      var ub = edHtml(), ubt = edText(), par = chip.parentNode, prev = chip.previousSibling;
      replaceNodeWithHtml(chip, multiChipHtml(chip.getAttribute('data-o'), sel, JSON.parse(chip.getAttribute('data-o'))));
      afterChange(true);
      if (window.UFTirads && UFTirads.runTxt) { UFTirads.runTxt(); }
      S.lastChoice = null; S.lastRemoval = null;
      S.insStack.push({ before: ub, beforeText: ubt, after: edHtml(), afterText: edText() }); S.insRedo = [];
      if (S.insStack.length > 30) { S.insStack.shift(); }
      var nc = prev && prev.parentNode === par ? prev.nextSibling : par.firstChild;
      if (nc) { chip = nc; }
    }
    editor.focus();
    var r = document.createRange(); r.selectNode(chip); r.collapse(!!back); setRange(r); saveRange();
    if (move) { nextField(!!back, true); }
  }
  function openSelect(chip) {
    var opts = [];
    try { opts = JSON.parse(chip.getAttribute('data-o')) || []; } catch (e) { opts = []; }
    var p = $('popup'), html = '', i;
    UI.popupSel = chip.getAttribute('data-m') === '1' ? multiVals(chip) : null;
    for (i = 0; i < opts.length; i++) { html += '<div class="opt' + (UI.popupSel ? ' opt-m' : '') + '" data-i="' + i + '">' + (UI.popupSel ? '<span class="ck"></span> ' : '') + (i < 9 ? '<b>' + (i + 1) + '.</b> ' : '') + esc(opts[i]) + '</div>'; }
    if (UI.popupSel) { html += '<div class="opt opt-ok" data-ok="1">&#10003; Pronto <small>(Tab)</small></div>'; }
    p.innerHTML = html; if (UI.popupSel) { multiPaint(); }
    var rc = chip.getBoundingClientRect();
    p.style.left = (rc.left + (window.pageXOffset || document.documentElement.scrollLeft)) + 'px';
    p.style.top = (rc.bottom + 2 + (window.pageYOffset || document.documentElement.scrollTop)) + 'px';
    p.hidden = false; UI.popupFor = chip; UI.popupIdx = 0; popupKbd();
    addCls(chip, 'f-cur');
  }
  function popupKbd() {
    var l = qsa($('popup'), '.opt'), i;
    for (i = 0; i < l.length; i++) { if (i === UI.popupIdx) { addCls(l[i], 'kbd'); } else { rmCls(l[i], 'kbd'); } }
  }
  function closePopup() { UI.popupSel = null; $('popup').hidden = true; if (UI.popupFor) { rmCls(UI.popupFor, 'f-cur'); } UI.popupFor = null; }
  function chooseOption(i) {
    var chip = UI.popupFor; if (!chip || !chip.parentNode || !editor.contains(chip)) { closePopup(); return; }
    var opts = JSON.parse(chip.getAttribute('data-o')), opt = opts[i];
    closePopup();
    if (opt === undefined) { return; }
    var nested = UltraParser.fieldsOf(opt).length > 0;
    if (nested || opt.indexOf('\n') >= 0) {
      /* C6c: option with fields inside: the next field must be the FIRST inner one, so restart the search
         from where the chosen chip was (replaceNodeWithHtml leaves the caret after the inserted text) */
      var npar = chip.parentNode, nprev = chip.previousSibling;
      replaceNodeWithHtml(chip, inlineHtml(opt));
      var nr = document.createRange();
      if (nprev && nprev.parentNode === npar) { nr.setStartAfter(nprev); } else { nr.setStart(npar, 0); }
      nr.collapse(true); setRange(nr); saveRange();
      if (nprev && nprev.nodeType === 3 && nprev.parentNode === npar) { nr = document.createRange(); nr.setStart(nprev, 0); nr.collapse(true); setRange(nr); saveRange(); }
    }
    else {
      var oldHtml = chip.outerHTML, prevSib = chip.previousSibling, par = chip.parentNode;
      replaceNodeWithHtml(chip, '<span class="fld f-sel f-ok" data-t="s" data-v="' + i + '" data-o="' +
        esc(chip.getAttribute('data-o')) + '" title="Clique para trocar">' + esc(opt) + '</span>');
      /* own one-step undo for the choice (the DOM replace is not in the browser's undo stack) */
      var ne = null, cs = par.childNodes, q;
      for (q = 0; q < cs.length; q++) { if (cs[q].nodeType === 1 && hasCls(cs[q], 'f-ok') && cs[q].getAttribute('data-v') === String(i) && cs[q].textContent === opt) { ne = cs[q]; } }
      S.lastChoice = ne ? { el: ne, html: oldHtml } : null; S.insStack = []; S.insRedo = [];
    }
    afterChange(true);
    nextField(false, true);
  }
  R(function () {
    on($('popup'), 'mousedown', function (e) {
      var o = closest(e.target, function (n) { return hasCls(n, 'opt'); });
      /* C6c: stop here, or the document mousedown sees the (now detached) option and closes the NEXT field's list */
      if (o && UI.popupSel) { e.preventDefault(); if (e.stopPropagation) { e.stopPropagation(); } if (o.getAttribute('data-ok')) { multiApply(true); } else { UI.popupIdx = parseInt(o.getAttribute('data-i'), 10); popupKbd(); multiToggle(UI.popupIdx); } return; }
      if (o) { e.preventDefault(); if (e.stopPropagation) { e.stopPropagation(); } chooseOption(parseInt(o.getAttribute('data-i'), 10)); }
    });
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls;
    closest = UI.closest; qsa = UI.qsa; trim = UI.trim; now = UI.now; S = UI.S; editor = UI.editor;
    inlineHtml = UI.inlineHtml; fieldFilled = UI.fieldFilled; textLines = UI.textLines; lineText = UI.lineText;
    saveRange = UI.saveRange; setRange = UI.setRange; focusEditor = UI.focusEditor; keepInView = UI.keepInView;
    replaceNodeWithHtml = UI.replaceNodeWithHtml; edText = UI.edText; edHtml = UI.edHtml;
    editorLines = UI.editorLines; syncHypotheses = UI.syncHypotheses; updTitle = UI.updTitle;
  };
});
