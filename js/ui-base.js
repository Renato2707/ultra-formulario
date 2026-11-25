/*
 * ui-base.js - utilitários, estado e configurações, modal, banco/modelos, frases por exame.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-base', function (UI, R) {
  'use strict';
  var FA, FB, UA, UB, toastTimer, DEFAULT_SETTINGS, fullAt, modalOnClose;   /* deste arquivo */
  var renderAll;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.searchSeen */
  UI.$ = $; UI.on = on; UI.esc = esc; UI.hasCls = hasCls; UI.addCls = addCls; UI.rmCls = rmCls;
  UI.closest = closest; UI.qsa = qsa; UI.trim = trim; UI.now = now; UI.foldKeep = foldKeep;
  UI.stripAccents = stripAccents; UI.highlight = highlight; UI.toast = toast; UI.loadSettings = loadSettings;
  UI.saveSettings = saveSettings; UI.searchNow = searchNow; UI.saveSearch = saveSearch; UI.sxShow = sxShow;
  UI.modal = modal; UI.closeModal = closeModal; UI.confirmModal = confirmModal; UI.armDelete = armDelete;
  UI.setBank = setBank; UI.findExam = findExam; UI.examNames = examNames; UI.buildModels = buildModels;
  UI.getModel = getModel; UI.modelRaw = modelRaw; UI.modelTemplate = modelTemplate;
  UI.sortedModels = sortedModels; UI.examSections = examSections;   /* usadas por outros arquivos */

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, capture) { el.addEventListener(ev, fn, !!capture); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hasCls(el, c) { return el && el.nodeType === 1 && (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addCls(el, c) { if (!hasCls(el, c)) { el.className = (el.className ? el.className + ' ' : '') + c; } }
  function rmCls(el, c) { if (el && el.className) { el.className = (' ' + el.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); } }
  function closest(node, fn, stop) {
    while (node && node !== stop) { if (node.nodeType === 1 && fn(node)) { return node; } node = node.parentNode; }
    return null;
  }
  function qsa(root, sel) { var l = root.querySelectorAll(sel), a = [], i; for (i = 0; i < l.length; i++) { a.push(l[i]); } return a; }
  function trim(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
  function now() { return new Date().getTime(); }

  /* accent/case fold keeping length (for search with highlight) */
  R(function () {
    FA = '\u00e1\u00e0\u00e2\u00e3\u00e4\u00e9\u00e8\u00ea\u00eb\u00ed\u00ec\u00ee\u00ef\u00f3\u00f2\u00f4\u00f5\u00f6\u00fa\u00f9\u00fb\u00fc\u00e7\u00f1';
    FB = 'aaaaaeeeeiiiiooooouuuucn';
  });
  function foldKeep(s) {
    var l = String(s).toLowerCase(), o = '', i, c, k;
    for (i = 0; i < l.length; i++) { c = l.charAt(i); k = FA.indexOf(c); o += k >= 0 ? FB.charAt(k) : c; }
    return o;
  }
  /* accent strip preserving case (ASCII mode) */
  R(function () {
    UA = '\u00c1\u00c0\u00c2\u00c3\u00c4\u00c9\u00c8\u00ca\u00cb\u00cd\u00cc\u00ce\u00cf\u00d3\u00d2\u00d4\u00d5\u00d6\u00da\u00d9\u00db\u00dc\u00c7\u00d1';
    UB = 'AAAAAEEEEIIIIOOOOOUUUUCN';
  });
  function stripAccents(s) {
    var o = '', i, c, k;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i); k = FA.indexOf(c);
      if (k >= 0) { o += FB.charAt(k); continue; }
      k = UA.indexOf(c);
      o += k >= 0 ? UB.charAt(k) : c;
    }
    return o;
  }
  function highlight(text, q) {
    if (!q) { return esc(text); }
    var f = foldKeep(text), fq = foldKeep(q), out = '', pos = 0, i;
    if (f.length !== text.length) { return esc(text); }
    while ((i = f.indexOf(fq, pos)) >= 0) {
      out += esc(text.substring(pos, i)) + '<mark class="hl">' + esc(text.substring(i, i + fq.length)) + '</mark>';
      pos = i + fq.length;
    }
    return out + esc(text.substring(pos));
  }

  R(function () {
    toastTimer = null;
  });
  function toast(msg) {
    var t = $('toast'); t.innerHTML = esc(msg); addCls(t, 'show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { rmCls(t, 'show'); }, 1500);
  }

  /* ================= state ================= */
  R(function () {
    DEFAULT_SETTINGS = {
      dragReorder: false, sortByUsage: false, showUsage: false, divider: 0.75,
      normPunct: true, normSymbols: false, eol: 'crlf', ascii: false, warnFields: true, theme: 'light', paperDark: false,
      leftW: 300, rightW: 280, rightCollapsed: false, autoNextSec: true, hypUnderline: true, dragInReport: true, blockCopy: true
    };
  });
  var S = UI.S = {
    bank: null, bankName: '', settings: {}, usage: UStore.get('usage', {}), usageLast: UStore.get('usageLast', {}) || {}, order: UStore.get('order', []),
    userModels: UStore.get('userModels', []), userPhrases: UStore.get('userPhrases', []),
    overrides: UStore.get('overrides', {}), hidden: UStore.get('hidden', {}),
    models: [], activeModelId: null, activeExam: null, selCard: null, savedRange: null,
    phraseIndex: {}, repMarks: [], repCur: -1, phMatches: [], phCur: -1,
    level: 1, navExam: null, openSecs: {}, navSearch: ['', '', ''], navFocus: null
  };
  /* (re)load the saved settings (shared by all tabs) into S.settings */
  function loadSettings() {
    var st = UStore.get('settings', {}) || {}, k;
    for (k in DEFAULT_SETTINGS) { if (DEFAULT_SETTINGS.hasOwnProperty(k)) { S.settings[k] = st.hasOwnProperty(k) ? st[k] : DEFAULT_SETTINGS[k]; } }
  }
  R(function () {
    loadSettings();
  });
  function saveSettings() { UStore.set('settings', S.settings); }
  R(function () {
    fullAt = 0;
    UStore.onFail(function () {   /* browser storage full: the value is kept in this window (and in the data folder, if any) */
      if (now() - fullAt < 60000) { return; } fullAt = now();
      setTimeout(function () { toast('Navegador sem espaço: a última alteração ficou só nesta janela' + (UFolder.status() === 'folder' ? ' e na pasta de dados.' : '.')); }, 0);
    });
    /* typed search words, per field, shared by all tabs (key 'search'): survive navigation, reload, new tabs */
    (function () {
      var q = UStore.get('search', {}) || {};
      S.navSearch = [String(q.nav1 || ''), String(q.nav2 || ''), String(q.nav3 || '')];
      S.repQuery = String(q.rep || '');
    })();
    /* only the field(s) changed in THIS tab are written, so two tabs never overwrite each other's words (D2) */
    UI.searchSeen = { nav1: S.navSearch[0], nav2: S.navSearch[1], nav3: S.navSearch[2], rep: S.repQuery };
  });
  function searchNow() { return { nav1: S.navSearch[0], nav2: S.navSearch[1], nav3: S.navSearch[2], rep: S.repQuery || '' }; }
  function saveSearch() {
    var cur = searchNow(), st = UStore.get('search', {}) || {}, k, ch = false;
    for (k in cur) { if (cur.hasOwnProperty(k) && cur[k] !== UI.searchSeen[k]) { st[k] = cur[k]; UI.searchSeen[k] = cur[k]; ch = true; } }
    if (ch) { UStore.set('search', st); }
  }
  /* the small x inside a search field: visible only when the field has text */
  function sxShow(inp) { var x = inp && inp.nextSibling; if (x && hasCls(x, 'sx')) { x.hidden = !inp.value; } }

  var editor = UI.editor = $('editor');

  /* ================= modal ================= */
  R(function () {
    modalOnClose = null;
  });
  function modal(title, bodyHtml, buttons, onClose) {
    $('modalTitle').innerHTML = esc(title);
    var oldBody = $('modalBody'), nb = oldBody.cloneNode(false);
    oldBody.parentNode.replaceChild(nb, oldBody);   /* drop old listeners */
    nb.innerHTML = bodyHtml;
    var foot = $('modalFoot'); foot.innerHTML = '';
    var i, first = null;
    for (i = 0; i < buttons.length; i++) {
      (function (b) {
        var el = document.createElement('button');
        el.type = 'button'; el.className = 'btn ' + (b.cls || ''); el.innerHTML = esc(b.label);
        if (b.id) { el.id = b.id; }
        on(el, 'click', function () { if (b.click && b.click(el) === false) { return; } closeModal(); });
        foot.appendChild(el);
        if (!first && b.focus) { first = el; }
      })(buttons[i]);
    }
    modalOnClose = onClose || null;
    $('modalBack').hidden = false;
    var inp = nb.querySelector('input[type=text],textarea,select');
    $('modal').scrollTop = 0;
    setTimeout(function () { (inp || first || foot.lastChild || foot).focus(); if (!inp) { $('modal').scrollTop = 0; } }, 0);
  }
  function closeModal() {
    $('modalBack').hidden = true;
    var f = modalOnClose; modalOnClose = null;
    if (f) { f(); }
  }
  function confirmModal(title, text, okLabel, ok, danger) {
    modal(title, '<p>' + esc(text) + '</p>', [
      { label: 'Cancelar' },
      { label: okLabel, cls: danger ? 'btn-danger armed' : 'btn-primary', focus: true, click: function () { setTimeout(ok, 0); } }
    ]);
  }
  /* two-click delete button inside modal */
  function armDelete(btn, action) {
    if (!hasCls(btn, 'armed')) { addCls(btn, 'armed'); btn.innerHTML = 'Confirmar exclusão'; return false; }
    action(); return true;
  }

  /* ================= bank / models ================= */
  function setBank(text, name, silent) {
    S.bank = UltraParser.parse(text);
    S.bankName = name || '';
    S.srcLines = String(text).split(/\r?\n/);
    var st = S.bank.stats;
    void st;
    buildModels();
    if (S.activeExam && !findExam(S.activeExam) && !userExam(S.activeExam)) { S.activeExam = null; }
    if (S.navExam && !findExam(S.navExam) && !userExam(S.navExam)) { S.navExam = null; S.level = 1; }
    renderAll();
    if (!silent) { toast('Banco de frases carregado.'); }
  }
  function findExam(name) {
    if (!S.bank) { return null; }
    var i; for (i = 0; i < S.bank.exams.length; i++) { if (S.bank.exams[i].name === name) { return S.bank.exams[i]; } }
    return null;
  }
  function userExam(name) { var i; for (i = 0; i < S.userModels.length; i++) { if (S.userModels[i].exam === name) { return true; } } return false; }
  function examNames() {
    var a = [], i;
    if (S.bank) { for (i = 0; i < S.bank.exams.length; i++) { a.push(S.bank.exams[i].name); } }
    for (i = 0; i < S.userModels.length; i++) { if (a.indexOf(S.userModels[i].exam) < 0) { a.push(S.userModels[i].exam); } }
    return a;
  }
  function buildModels() {
    var list = [], seen = {}, e, t, ex, tp, id, i, ov;
    if (S.bank) {
      for (e = 0; e < S.bank.exams.length; e++) {
        ex = S.bank.exams[e];
        for (t = 0; t < ex.templates.length; t++) {
          tp = ex.templates[t];
          id = 'b:' + ex.name + '|' + tp.name;
          if (seen[id]) { id += '#' + t; }
          seen[id] = 1;
          if (S.hidden[id]) { continue; }
          ov = S.overrides[id];
          list.push({ id: id, name: ov && ov.name ? ov.name : tp.name, exam: ex.name, bank: true, tpl: tp, override: ov || null });
        }
      }
    }
    for (i = 0; i < S.userModels.length; i++) {
      var u = S.userModels[i];
      list.push({ id: u.id, name: u.name, exam: u.exam, user: true, text: u.text });
    }
    S.models = list;
  }
  function getModel(id) { var i; for (i = 0; i < S.models.length; i++) { if (S.models[i].id === id) { return S.models[i]; } } return null; }
  function modelRaw(m) { return m.user ? m.text : (m.override ? m.override.text : m.tpl.rawBody); }
  function modelTemplate(m) {
    if (m.bank && !m.override) { return m.tpl; }
    var r = UltraParser.parse('@@EXAME X\n@@TEMPLATE M\n' + modelRaw(m));
    return r.exams[0] && r.exams[0].templates[0] ? r.exams[0].templates[0] : { body: '', fields: [], critical: [] };
  }
  /* "Ordenar por frequência de uso" (D2): the model used LAST in each exam always first, then by use count */
  function sortedModels() {
    var arr = S.models.slice(0), ord = S.order, top = {}, i, ul = S.usageLast || {};
    if (S.settings.sortByUsage) {
      for (i = 0; i < arr.length; i++) { var t = ul[arr[i].id] || 0, ex = arr[i].exam; if (t && (!top[ex] || t > ul[top[ex]])) { top[ex] = arr[i].id; } }
    }
    arr.sort(function (a, b) {
      if (S.settings.sortByUsage) {
        var ta = top[a.exam] === a.id ? 1 : 0, tb = top[b.exam] === b.id ? 1 : 0;
        if (ta !== tb) { return tb - ta; }
        var d = (S.usage[b.id] || 0) - (S.usage[a.id] || 0);
        if (d) { return d; }
      }
      var ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
      if (ia < 0) { ia = 100000 + S.models.indexOf(a); }
      if (ib < 0) { ib = 100000 + S.models.indexOf(b); }
      return ia - ib;
    });
    return arr;
  }

  /* ================= phrases (per exam) ================= */
  function parsePhrase(titleLine, body) {
    var tl = trim(titleLine); if (!/:$/.test(tl)) { tl += ':'; }
    var r = UltraParser.parse('@@EXAME X\n##SECTION S\n' + tl + '\n' + body);
    var sec = r.exams[0] && r.exams[0].sections[0];
    return sec && sec.phrases[0] ? sec.phrases[0] : { title: trim(titleLine), help: '', hypothesis: '', body: body, fields: [], critical: [] };
  }
  function cardFromBank(p, srcExam, secName, idx) {
    var id = 'p:' + srcExam + '|' + secName + '|' + idx;
    if (S.hidden[id]) { return null; }
    var ov = S.overrides[id], ph = p;
    if (ov) { ph = parsePhrase(ov.titleLine, ov.body); }
    /* verbatim source text: the exact lines of the .txt (title line + body lines) */
    var src = ov ? ov.titleLine + '\n' + ov.body : null;
    if (!src && S.srcLines && p.line) {
      var end = (p.bodyLine || p.line + 1) - 1 + String(p.rawBody).split('\n').length;
      src = S.srcLines.slice(p.line - 1, end).join('\n');
    }
    if (!src) { src = p.rawTitle + '\n' + p.rawBody; }
    return { id: id, ph: ph, bank: true, srcExam: srcExam, section: secName, src: src,
             titleLine: ov ? ov.titleLine : p.rawTitle, rawBody: ov ? ov.body : p.rawBody };
  }
  function cardFromUser(u) {
    return { id: u.id, ph: parsePhrase(u.titleLine, u.body), user: true, section: u.section, src: u.titleLine + '\n' + u.body,
             titleLine: u.titleLine, rawBody: u.body };
  }
  function sectionKey(n) { return UltraParser.fold(n); }
  /* a repeated ##SECTION (same name, no phrases and no directive of its own: a position marker) follows the
     FIRST mention of that name in the txt (file order): its @@SUBSTITUI / @@ABAIXO_DE (phrases come via the usual reference) */
  function firstMentionPlace(name) {
    if (!S.bank) { return null; }
    var k = sectionKey(name), e, j, sc;
    for (e = 0; e < S.bank.exams.length; e++) {
      sc = S.bank.exams[e].sections;
      for (j = 0; j < sc.length; j++) { if (sectionKey(sc[j].name) === k) { return sc[j].place || null; } }
    }
    return null;
  }
  function examSections(examName) {
    var out = [], keys = {}, i, j, ex = findExam(examName), glob = S.bank && S.bank.global;
    function addSec(sec, exObj) {
      var k = sectionKey(sec.name);
      if (keys[k]) { return; }
      keys[k] = 1;
      var cards = [], src = null, list = sec.phrases, srcExam = exObj.name, srcName = sec.name, secPlace = sec.place || (sec.phrases.length ? null : firstMentionPlace(sec.name));
      if (!list.length && sec.resolvedSection) {
        var se = findExam(sec.resolvedFrom), s2;
        for (s2 = 0; se && s2 < se.sections.length; s2++) {
          if (se.sections[s2].name === sec.resolvedSection) { list = se.sections[s2].phrases; secPlace = secPlace || se.sections[s2].place || null; break; }
        }
        srcExam = sec.resolvedFrom; srcName = sec.resolvedSection;
        src = sec.resolvedSection + (sec.resolvedFrom !== exObj.name ? ' — ' + sec.resolvedFrom : '');
      }
      for (j = 0; j < list.length; j++) { var c = cardFromBank(list[j], srcExam, srcName, j); if (c) { c.secPlace = secPlace; cards.push(c); } }
      out.push({ name: sec.name, key: k, src: src, reserved: !!sec.isReserved, cards: cards });
    }
    if (ex) { for (i = 0; i < ex.sections.length; i++) { addSec(ex.sections[i], ex); } }
    if (glob && glob !== ex) { for (i = 0; i < glob.sections.length; i++) { addSec(glob.sections[i], glob); } }
    for (i = 0; i < S.userPhrases.length; i++) {
      var u = S.userPhrases[i];
      if (u.exam && u.exam !== examName && u.exam !== UltraParser.GLOBAL_EXAM) { continue; }
      var k2 = sectionKey(u.section || 'MINHAS FRASES'), found = null;
      for (j = 0; j < out.length; j++) { if (out[j].key === k2) { found = out[j]; break; } }
      if (!found) { found = { name: u.section || 'MINHAS FRASES', key: k2, src: null, reserved: false, cards: [] }; out.push(found); }
      found.reserved = false;
      found.cards.push(cardFromUser(u));
    }
    return out;
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    renderAll = UI.renderAll;
  };
});
