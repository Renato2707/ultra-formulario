/*
 * ui.js - Editor de Laudos (Etapa B). Strict ES5, no dependencies.
 * Needs parser.js (UltraParser) and store.js (UStore).
 * Clinical text from the bank is never modified: it is rendered as-is
 * (only the leading *** critical markers are hidden, see parser.js).
 */
(function () {
  'use strict';

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
  var FA = '\u00e1\u00e0\u00e2\u00e3\u00e4\u00e9\u00e8\u00ea\u00eb\u00ed\u00ec\u00ee\u00ef\u00f3\u00f2\u00f4\u00f5\u00f6\u00fa\u00f9\u00fb\u00fc\u00e7\u00f1';
  var FB = 'aaaaaeeeeiiiiooooouuuucn';
  function foldKeep(s) {
    var l = String(s).toLowerCase(), o = '', i, c, k;
    for (i = 0; i < l.length; i++) { c = l.charAt(i); k = FA.indexOf(c); o += k >= 0 ? FB.charAt(k) : c; }
    return o;
  }
  /* accent strip preserving case (ASCII mode) */
  var UA = '\u00c1\u00c0\u00c2\u00c3\u00c4\u00c9\u00c8\u00ca\u00cb\u00cd\u00cc\u00ce\u00cf\u00d3\u00d2\u00d4\u00d5\u00d6\u00da\u00d9\u00db\u00dc\u00c7\u00d1';
  var UB = 'AAAAAEEEEIIIIOOOOOUUUUCN';
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

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast'); t.innerHTML = esc(msg); addCls(t, 'show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { rmCls(t, 'show'); }, 1500);
  }

  /* ================= state ================= */
  var DEFAULT_SETTINGS = {
    dragReorder: false, sortByUsage: false, showUsage: false, divider: 0.75,
    normPunct: true, normSymbols: false, eol: 'crlf', ascii: false, warnFields: true, theme: 'light', paperDark: false,
    leftW: 260, rightW: 340, rightCollapsed: false, autoNextSec: true, hypUnderline: true, dragInReport: true, blockCopy: true
  };
  var S = {
    bank: null, bankName: '', settings: {}, usage: UStore.get('usage', {}), order: UStore.get('order', []),
    userModels: UStore.get('userModels', []), userPhrases: UStore.get('userPhrases', []),
    overrides: UStore.get('overrides', {}), hidden: UStore.get('hidden', {}),
    models: [], activeModelId: null, activeExam: null, selCard: null, savedRange: null,
    phraseIndex: {}, repMarks: [], repCur: -1, phMatches: [], phCur: -1,
    level: 1, navExam: null, openSecs: {}, navSearch: ['', '', ''], navFocus: null
  };
  (function () {
    var st = UStore.get('settings', {}), k;
    for (k in DEFAULT_SETTINGS) { if (DEFAULT_SETTINGS.hasOwnProperty(k)) { S.settings[k] = st.hasOwnProperty(k) ? st[k] : DEFAULT_SETTINGS[k]; } }
  })();
  function saveSettings() { UStore.set('settings', S.settings); }
  /* typed search words, per field, shared by all tabs (key 'search'): survive navigation, reload, new tabs */
  (function () {
    var q = UStore.get('search', {}) || {};
    S.navSearch = [String(q.nav1 || ''), String(q.nav2 || ''), String(q.nav3 || '')];
    S.repQuery = String(q.rep || '');
  })();
  function saveSearch() { UStore.set('search', { nav1: S.navSearch[0], nav2: S.navSearch[1], nav3: S.navSearch[2], rep: S.repQuery || '' }); }
  /* the small x inside a search field: visible only when the field has text */
  function sxShow(inp) { var x = inp && inp.nextSibling; if (x && hasCls(x, 'sx')) { x.hidden = !inp.value; } }

  var editor = $('editor');

  /* ================= modal ================= */
  var modalOnClose = null;
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
  function sortedModels() {
    var arr = S.models.slice(0), ord = S.order;
    arr.sort(function (a, b) {
      if (S.settings.sortByUsage) {
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

  /* ================= rendering bank text into editor HTML ================= */
  var PH = { n: '___', d: '__,_', t: 'texto', s: 'escolher' };
  function chipHtml(f) {
    if (f.type === 'select') {
      return '<span class="fld f-sel" contenteditable="false" data-t="s" data-o="' + esc(JSON.stringify(f.options)) + '">' + PH.s + '</span>';
    }
    var t = f.type === 'text' ? 't' : (f.decimal ? 'd' : 'n');
    return '<span class="fld" data-t="' + t + '" data-ph="' + PH[t] + '">' + PH[t] + '</span>';
  }
  /* body -> line <div>s with field chips; critical lines get class crit / crit-instr */
  function renderLines(body, fields, critical) {
    var crit = {}, i, c, l;
    critical = critical || [];
    for (i = 0; i < critical.length; i++) {
      c = critical[i];
      if (c.kind === 'block') { for (l = c.bodyLine; l <= c.bodyLine + (c.endLine - c.line); l++) { crit[l] = 'crit-instr'; } }
      else { crit[c.bodyLine] = 'crit'; }
    }
    var lines = [''], bodyLineOf = [0], extra = 0, pos = 0, fs = (fields || []).slice(0);
    fs.sort(function (a, b) { return a.offset - b.offset; });
    function pushText(t) {
      var parts = t.split('\n'), k;
      for (k = 0; k < parts.length; k++) {
        if (k > 0) { lines.push(''); bodyLineOf.push(lines.length - 1 + extra); }
        lines[lines.length - 1] += esc(parts[k]);
      }
    }
    for (i = 0; i < fs.length; i++) {
      if (fs[i].offset < pos) { continue; }
      pushText(body.substring(pos, fs[i].offset));
      lines[lines.length - 1] += chipHtml(fs[i]);
      extra += fs[i].raw.split('\n').length - 1;
      pos = fs[i].offset + fs[i].raw.length;
    }
    pushText(body.substring(pos));
    var out = [];
    for (i = 0; i < lines.length; i++) {
      var cls = crit[bodyLineOf[i]];
      out.push('<div' + (cls ? ' class="' + cls + '"' : '') + '>' + (lines[i] || '<br>') + '</div>');
    }
    return out.join('');
  }
  function inlineHtml(text) {
    var fs = UltraParser.fieldsOf(text), out = '', pos = 0, i;
    for (i = 0; i < fs.length; i++) {
      out += esc(text.substring(pos, fs[i].offset)).replace(/\n/g, '<br>') + chipHtml(fs[i]);
      pos = fs[i].offset + fs[i].raw.length;
    }
    return out + esc(text.substring(pos)).replace(/\n/g, '<br>');
  }

  /* ================= editor text extraction ================= */
  var BLOCK = { DIV: 1, P: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, PRE: 1, TR: 1, TABLE: 1 };
  function fieldFilled(f) {
    if (f.getAttribute('data-t') === 's') { return f.getAttribute('data-v') !== null; }
    var t = f.textContent || '';
    return trim(t) !== '' && t !== f.getAttribute('data-ph');
  }
  function textLines(root, unfilled) {
    var lines = [], cur = '';
    function flush() { lines.push(cur); cur = ''; }
    function walk(n) {
      var c = n.firstChild;
      while (c) {
        if (c.nodeType === 3) { cur += c.nodeValue; }
        else if (c.nodeType === 1) {
          var tag = c.nodeName;
          if (tag === 'BR') { flush(); }
          else if (hasCls(c, 'fld')) { cur += fieldFilled(c) ? (c.textContent || '') : unfilled; }
          else if (BLOCK[tag]) { if (cur !== '') { flush(); } walk(c); if (cur !== '') { flush(); } }
          else { walk(c); }
        }
        c = c.nextSibling;
      }
    }
    walk(root);
    if (cur !== '') { flush(); }
    for (var i = 0; i < lines.length; i++) { lines[i] = lines[i].replace(/\u00a0/g, ' '); }
    return lines;
  }
  function lineText(el) { return textLines(el, '___').join('\n'); }

  /* ================= caret tracking & insertion ================= */
  function saveRange() {
    var sel = window.getSelection ? window.getSelection() : null;
    if (sel && sel.rangeCount) {
      var r = sel.getRangeAt(0);
      if (editor.contains(r.commonAncestorContainer)) { S.savedRange = r.cloneRange(); }
    }
  }
  function setRange(r) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  function focusEditor() {
    var w = $('editorWrap'), top = w.scrollTop;
    try { editor.focus({ preventScroll: true }); } catch (e) { editor.focus(); }
    w.scrollTop = top;
  }
  /* scroll the report only as needed so that el is visible */
  function keepInView(el) {
    if (!el || !el.getBoundingClientRect) { return; }
    var w = $('editorWrap'), wr = w.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.bottom > wr.bottom - 10) { w.scrollTop += r.bottom - wr.bottom + 40; }
    else if (r.top < wr.top + 10) { w.scrollTop -= wr.top - r.top + 40; }
  }
  /* triple-click selects a paragraph plus the start of the next block; trim it
     back so it behaves like a drag selection of the paragraph text */
  function normalizeRange(r) {
    if (r.collapsed) { return r; }
    var sb = lineOf(r.startContainer), eb = lineOf(r.endContainer);
    if (!eb || eb === sb) { return r; }
    var t = document.createRange(); t.setStart(eb, 0); t.setEnd(r.endContainer, r.endOffset);
    if (t.toString() !== '' || t.cloneContents().querySelector('.fld')) { return r; }
    /* block that precedes eb in document order */
    var n = eb, p = null;
    while (n && n !== editor && !p) {
      p = n.previousSibling;
      while (p && p.nodeType === 3 && trim(p.nodeValue) === '') { p = p.previousSibling; }
      if (!p) { n = n.parentNode; }
    }
    if (!p || p.nodeType !== 1) { return r; }
    while (p.lastChild && p.lastChild.nodeType === 1 && BLOCK[p.lastChild.nodeName]) { p = p.lastChild; }
    var last = p.lastChild;
    if (last && last.nodeName === 'BR') { r.setEndBefore(last); } else { r.setEnd(p, p.childNodes.length); }
    return r;
  }
  function restoreRange() {
    focusEditor();
    var r = S.savedRange;
    if (!r || !editor.contains(r.commonAncestorContainer)) {
      r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
    }
    setRange(r);
    return r;
  }
  var canExecHtml = (function () { try { return !!(document.queryCommandSupported && document.queryCommandSupported('insertHTML')); } catch (e) { return false; } })();
  function exec(cmd, val) { try { return document.execCommand(cmd, false, val); } catch (e) { return false; } }
  function lineOf(node) { return closest(node, function (n) { return BLOCK[n.nodeName] && n !== editor; }, editor); }
  function ensureNotEmpty() { if (!editor.firstChild) { editor.innerHTML = '<div><br></div>'; } }

  /* Insert block HTML on its own line at caret (replaces selection). Uses
     execCommand so native undo (Ctrl+Z) keeps working. */
  function insertBlock(html) {
    clearRepMarks();
    ensureNotEmpty();
    var w = $('editorWrap'), top = w.scrollTop;
    var r = normalizeRange(restoreRange());
    setRange(r);
    if (!r.collapsed) { exec('delete'); r = window.getSelection().getRangeAt(0); }
    var line = lineOf(r.startContainer);
    if (canExecHtml) {
      if (!line || trim(lineText(line)) !== '') {
        if (line) { var r2 = document.createRange(); r2.selectNodeContents(line); r2.collapse(false); setRange(r2); }
        exec('insertParagraph');
        line = lineOf(window.getSelection().getRangeAt(0).startContainer);
        /* Chrome copies the previous line's class/data-* (e.g. a critical line) onto the new empty paragraph,
           and then nests the inserted lines inside it: the new line must be a plain line */
        if (line && line !== editor && line.attributes) {
          var at = [], ai; for (ai = 0; ai < line.attributes.length; ai++) { at.push(line.attributes[ai].name); }
          for (ai = 0; ai < at.length; ai++) { line.removeAttribute(at[ai]); }
        }
      }
      if (line) { var r3 = document.createRange(); r3.selectNodeContents(line); setRange(r3); }
      exec('insertHTML', html);
    } else {
      /* IE11 fallback (no insertHTML): direct DOM insert (this step is not undoable) */
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      var frag = document.createDocumentFragment(), last = null;
      while (tmp.firstChild) { last = tmp.firstChild; frag.appendChild(last); }
      if (line && trim(lineText(line)) === '') { line.parentNode.replaceChild(frag, line); }
      else if (line) { line.parentNode.insertBefore(frag, line.nextSibling); }
      else { editor.appendChild(frag); }
      if (last) { var r4 = document.createRange(); r4.selectNodeContents(last); r4.collapse(false); setRange(r4); }
    }
    saveRange();
    w.scrollTop = top;
    var sel = window.getSelection();
    if (sel.rangeCount) { keepInView(lineOf(sel.getRangeAt(0).startContainer) || editor); }
    afterChange(true);
  }
  /* choice/field replacement: always direct DOM (never execCommand insertHTML: Chrome splits the line when the
     replaced non-editable chip starts the line). Adjacent text nodes are merged afterwards. */
  function replaceNodeWithHtml(node, html) {
    var w = $('editorWrap'), top = w.scrollTop, par = node.parentNode;
    var tmp = document.createElement('span'); tmp.innerHTML = html;
    var frag = document.createDocumentFragment(), last = null; while (tmp.firstChild) { last = tmp.firstChild; frag.appendChild(last); }
    par.replaceChild(frag, node);
    if (par.normalize) { par.normalize(); }
    focusEditor();
    if (last && last.parentNode) { var cr = document.createRange(); cr.setStartAfter(last); cr.collapse(true); setRange(cr); }
    w.scrollTop = top;
    saveRange();
  }
  /* remove whole report lines by direct DOM removal. (Never execCommand('delete') on a selected line: Chrome
     keeps the deleted line's <div> and pulls the NEXT line's text into it, so removing that div afterwards
     also deleted the line below.) Own one-step undo (Ctrl+Z) in S.lastRemoval. */
  function removeLines(els) {
    var undo = [], k, el;
    for (k = 0; k < els.length; k++) {
      el = els[k];
      if (!el || !el.parentNode || !editor.contains(el)) { continue; }
      undo.push({ el: el, par: el.parentNode, next: el.nextSibling });
    }
    for (k = undo.length - 1; k >= 0; k--) { undo[k].par.removeChild(undo[k].el); }
    /* a wrapper <div> left empty (lines inserted at the end are nested in one) would show as an extra blank line */
    var pre = [];
    for (k = 0; k < undo.length; k++) {
      var pp = undo[k].par;
      if (pp !== editor && editor.contains(pp) && !pp.firstChild) { pre.push({ el: pp, par: pp.parentNode, next: pp.nextSibling }); pp.parentNode.removeChild(pp); }
    }
    undo = { pre: pre, items: undo };
    ensureNotEmpty();
    S.lastChoice = null;
    S.lastRemoval = undo.items.length ? undo : null;
    afterChange(true);
  }
  function undoRemoval() {
    var U = S.lastRemoval, k; S.lastRemoval = null;
    if (!U) { return false; }
    function put(x) {
      var nx = x.next && x.next.parentNode === x.par ? x.next : null;
      x.par.insertBefore(x.el, nx);
    }
    for (k = U.pre.length - 1; k >= 0; k--) { if (!editor.contains(U.pre[k].par) && U.pre[k].par !== editor) { return false; } put(U.pre[k]); }
    var u = U.items;
    for (k = 0; k < u.length; k++) { if (!editor.contains(u[k].par) && u[k].par !== editor) { return false; } }
    if (editor.childNodes.length === 1 && isBlankLine(editor.firstChild) && u[0].par === editor) { editor.removeChild(editor.firstChild); }
    for (k = u.length - 1; k >= 0; k--) {   /* last first: each line's next sibling is already back */
      put(u[k]);
      if (hasCls(u[k].el, 'crit')) { rmCls(u[k].el, 'crit-ok'); u[k].el.removeAttribute('data-res'); }
    }
    afterChange(true);
    return true;
  }
  function loadIntoEditor(html) {
    clearRepMarks();
    editor.focus();
    if (canExecHtml) {
      exec('selectAll'); exec('delete');
      ensureNotEmpty();
      var r = document.createRange(); r.selectNodeContents(editor); setRange(r);
      exec('insertHTML', html);
    } else { editor.innerHTML = html; }
    var r0 = document.createRange(); r0.selectNodeContents(editor); r0.collapse(true); setRange(r0); saveRange();
    S.userCaret = false;   /* caret at top after loading is not a user choice */
    $('editorWrap').scrollTop = 0;
    afterChange(true);
  }

  /* ================= fields, critical lines, counters ================= */
  function markCritOrig() {
    var l = qsa(editor, '.crit'), i;
    for (i = 0; i < l.length; i++) { if (l[i].getAttribute('data-orig') === null) { l[i].setAttribute('data-orig', lineText(l[i])); } }
  }
  function critState() {
    var pend = [], instr = [], l = qsa(editor, '.crit'), i, el;
    for (i = 0; i < l.length; i++) {
      el = l[i];
      if (hasCls(el, 'crit-ok')) { continue; }
      if (el.getAttribute('data-orig') !== null && lineText(el) !== el.getAttribute('data-orig')) {
        addCls(el, 'crit-ok'); el.setAttribute('data-res', 'editado'); continue;
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
    updatePrintHold();
  }
  var saveTimer = null;
  /* "Hipótese/Impressão diagnóstica:" heading lines get class hypu (underlined via CSS when the setting is on) */
  var HYP_U_RE = /^\s*hip[\u00f3o]tese\s*\/\s*impress[\u00e3a]o\s+diagn[\u00f3o]stica\b[^:]*:\s*$/i;
  function markHypUnderline() {
    var l = editorLines(), i, on1;
    for (i = 0; i < l.length; i++) {
      on1 = HYP_U_RE.test(lineText(l[i]));
      if (on1 && !hasCls(l[i], 'hypu')) { addCls(l[i], 'hypu'); } else if (!on1 && hasCls(l[i], 'hypu')) { rmCls(l[i], 'hypu'); }
    }
  }
  function afterChange(fast) {
    syncHypotheses();
    markHypUnderline();
    markCritOrig();
    updateCounters();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, fast ? 50 : 700);
  }
  /* ---- per-tab drafts: each browser tab keeps its own report (key draft.<tabId>).
     The tab id lives in sessionStorage (survives reload, private to the tab; window.name
     as fallback). A tab that is still open marks itself in 'tabs' (heartbeat), so a NEW
     tab never takes over the report of another open tab, but does recover the most recent
     report of a tab that was closed. Bank/settings stay shared in localStorage. */
  var TAB = null, TAB_ALIVE_MS = 15000, MAX_DRAFTS = 10;
  function ssGet() { try { return window.sessionStorage.getItem('uf.tab'); } catch (e) { return null; } }
  function ssSet(v) { try { window.sessionStorage.setItem('uf.tab', v); } catch (e) {} try { window.name = 'uf.tab=' + v; } catch (e2) {} }
  function tabsMap() { var m = UStore.get('tabs', {}); return (m && typeof m === 'object') ? m : {}; }
  function markAlive(on) {
    var m = tabsMap(); if (on) { m[TAB] = now(); } else { delete m[TAB]; } UStore.set('tabs', m);
  }
  function draftIndex() { var m = UStore.get('drafts', {}); return (m && typeof m === 'object') ? m : {}; }
  function pickTab() {
    var id = ssGet(), m = tabsMap(), idx = draftIndex(), t = now(), k, best = null, legacy;
    if (!id && /^uf\.tab=/.test(String(window.name || ''))) { id = String(window.name).slice(7); }
    if (id && m[id] && t - m[id] < TAB_ALIVE_MS) {           /* duplicated tab: same id still alive elsewhere */
      var nid = 't' + t.toString(36) + Math.floor(Math.random() * 1e6).toString(36), d0 = UStore.get('draft.' + id, null);
      if (d0) { UStore.set('draft.' + nid, d0); idx[nid] = t; UStore.set('drafts', idx); }
      id = nid;
    }
    if (!id) {                                                /* new tab: adopt the newest draft of a closed tab */
      legacy = UStore.get('draft', null);                       /* single draft from versions before B21 */
      if (legacy && legacy.html) { UStore.set('draft.legacy', legacy); idx.legacy = legacy.t || 1; UStore.remove('draft'); UStore.set('drafts', idx); }
      for (k in idx) { if (idx.hasOwnProperty(k) && !(m[k] && t - m[k] < TAB_ALIVE_MS) && (!best || idx[k] > idx[best])) { best = k; } }
      id = best || ('t' + t.toString(36) + Math.floor(Math.random() * 1e6).toString(36));
    }
    TAB = id; ssSet(id); markAlive(true);
    /* prune: keep the newest MAX_DRAFTS drafts, drop drafts older than 30 days */
    var ks = []; for (k in idx) { if (idx.hasOwnProperty(k)) { ks.push(k); } }
    ks.sort(function (a, b) { return idx[b] - idx[a]; });
    for (var i = 0; i < ks.length; i++) { if (ks[i] !== TAB && (i >= MAX_DRAFTS || t - idx[ks[i]] > 2592000000)) { UStore.remove('draft.' + ks[i]); delete idx[ks[i]]; } }
    UStore.set('drafts', idx);
  }
  function saveDraft() {
    if (!TAB) { return; }
    var html = editor.innerHTML.replace(/<mark class="hl( cur)?">|<\/mark>/g, '');
    var idx = draftIndex(); idx[TAB] = now(); UStore.set('drafts', idx);
    UStore.set('draft.' + TAB, { html: html, model: S.activeModelId, exam: S.activeExam, nav: { level: S.level, exam: S.navExam }, t: now() });
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
    var unf = checkFields(); if (!unf.length) { return false; }
    var sel = window.getSelection(), cur = sel.rangeCount ? sel.getRangeAt(0) : null, i, pick = null;
    if (cur && !editor.contains(cur.commonAncestorContainer)) { cur = S.savedRange; }
    var curChip = cur ? closest(cur.startContainer, function (n) { return hasCls(n, 'fld'); }, editor) : null;
    if (cur && !curChip && cur.startContainer.nodeType === 1 && !cur.collapsed) {   /* whole chip selected (choice fields) */
      var at = cur.startContainer.childNodes[cur.startOffset];
      if (at && at.nodeType === 1 && hasCls(at, 'fld')) { curChip = at; }
    }
    if (!curChip && popupFor) { curChip = popupFor; }
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

  /* dropdown popup for ?[a|b] */
  var popupFor = null, popupIdx = 0;
  function openSelect(chip) {
    var opts = [];
    try { opts = JSON.parse(chip.getAttribute('data-o')) || []; } catch (e) { opts = []; }
    var p = $('popup'), html = '', i;
    for (i = 0; i < opts.length; i++) { html += '<div class="opt" data-i="' + i + '">' + (i < 9 ? '<b>' + (i + 1) + '.</b> ' : '') + esc(opts[i]) + '</div>'; }
    p.innerHTML = html;
    var rc = chip.getBoundingClientRect();
    p.style.left = (rc.left + (window.pageXOffset || document.documentElement.scrollLeft)) + 'px';
    p.style.top = (rc.bottom + 2 + (window.pageYOffset || document.documentElement.scrollTop)) + 'px';
    p.hidden = false; popupFor = chip; popupIdx = 0; popupKbd();
    addCls(chip, 'f-cur');
  }
  function popupKbd() {
    var l = qsa($('popup'), '.opt'), i;
    for (i = 0; i < l.length; i++) { if (i === popupIdx) { addCls(l[i], 'kbd'); } else { rmCls(l[i], 'kbd'); } }
  }
  function closePopup() { $('popup').hidden = true; if (popupFor) { rmCls(popupFor, 'f-cur'); } popupFor = null; }
  function chooseOption(i) {
    var chip = popupFor; if (!chip || !chip.parentNode || !editor.contains(chip)) { closePopup(); return; }
    var opts = JSON.parse(chip.getAttribute('data-o')), opt = opts[i];
    closePopup();
    if (opt === undefined) { return; }
    var nested = UltraParser.fieldsOf(opt).length > 0;
    if (nested || opt.indexOf('\n') >= 0) { replaceNodeWithHtml(chip, inlineHtml(opt)); }
    else {
      var oldHtml = chip.outerHTML, prevSib = chip.previousSibling, par = chip.parentNode;
      replaceNodeWithHtml(chip, '<span class="fld f-sel f-ok" contenteditable="false" data-t="s" data-v="' + i + '" data-o="' +
        esc(chip.getAttribute('data-o')) + '" title="Clique para trocar">' + esc(opt) + '</span>');
      /* own one-step undo for the choice (the DOM replace is not in the browser's undo stack) */
      var ne = null, cs = par.childNodes, q;
      for (q = 0; q < cs.length; q++) { if (cs[q].nodeType === 1 && hasCls(cs[q], 'f-ok') && cs[q].getAttribute('data-v') === String(i) && cs[q].textContent === opt) { ne = cs[q]; } }
      S.lastChoice = ne ? { el: ne, html: oldHtml } : null;
    }
    afterChange(true);
    nextField(false, true);
  }
  on($('popup'), 'mousedown', function (e) {
    var o = closest(e.target, function (n) { return hasCls(n, 'opt'); });
    if (o) { e.preventDefault(); chooseOption(parseInt(o.getAttribute('data-i'), 10)); }
  });

  /* ================= output (copy / generate) ================= */
  function normalize(text) {
    var st = S.settings;
    if (st.normPunct) {
      text = text.replace(/[\u201c\u201d\u201e\u00ab\u00bb]/g, '"').replace(/[\u2018\u2019\u201a]/g, "'")
                 .replace(/[\u2013\u2014\u2212]/g, '-').replace(/\u2022/g, '-').replace(/\u2026/g, '...');
    }
    if (st.normSymbols) {
      text = text.replace(/\u00b3/g, '3').replace(/\u00b2/g, '2').replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
                 .replace(/\u00b1/g, '+/-').replace(/\u00d7/g, 'x').replace(/\u00b5/g, 'u');
    }
    if (st.ascii) { text = stripAccents(text).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?'); }
    return text;
  }
  function reportText() {
    clearRepMarks();
    var lines = textLines(editor, '___');
    while (lines.length && trim(lines[lines.length - 1]) === '') { lines.pop(); }
    var i;
    for (i = 0; i < lines.length; i++) { lines[i] = normalize(lines[i]); }
    if (S.settings.eol === 'single') {
      var o = []; for (i = 0; i < lines.length; i++) { if (trim(lines[i])) { o.push(trim(lines[i])); } }
      return o.join(' ');
    }
    return lines.join(S.settings.eol === 'lf' ? '\n' : '\r\n');
  }
  function copyPlain(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      done(ok);
    }
    if (window.clipboardData && window.clipboardData.setData) { done(!!window.clipboardData.setData('Text', text)); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { navigator.clipboard.writeText(text).then(function () { done(true); }, fallback); return; } catch (e) {}
    }
    fallback();
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fileName() {
    var m = getModel(S.activeModelId), d = new Date();
    var base = m ? m.name : (S.activeExam || 'laudo');
    base = base.replace(/[\\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
    return base + '_' + pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear() + '_' + pad(d.getHours()) + 'h' + pad(d.getMinutes()) + '.txt';
  }
  function saveTxt(text) {
    var name = fileName(), blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    if (window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, name); }
    else {
      var a = document.createElement('a'), url = URL.createObjectURL(blob);
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    }
    toast('Arquivo gerado: ' + name);
  }
  /* Copiar / Gerar: one single review step (critical lines + empty fields), or none if nothing is pending */
  function output(kind) {
    closePopup();
    if (trim(textLines(editor, '').join('')) === '') { toast('O laudo está vazio.'); return; }
    var cs = critState(), unf = checkFields();
    function go() {
      var t = reportText();
      S.lastOutput = t;
      if (kind === 'copy') { copyPlain(t, function (ok) { toast(ok ? 'Copiado' : 'Não foi possível copiar. Selecione o texto e use Ctrl+C.'); }); }
      else if (kind === 'print') { printNow(); }
      else { saveTxt(t); }
    }
    var warnF = unf.length && S.settings.warnFields;
    if (!cs.pend.length && !cs.instr.length && !warnF) { go(); return; }
    reviewDialog(kind, cs, warnF ? unf : [], go);
  }
  /* review step (pre-B7 layout): one click per critical line; resolving the LAST line copies/generates automatically */
  /* consecutive pending critical lines (adjacent report lines, nothing between) = ONE review item */
  function critGroups(pend) {
    var L = editorLines(), g = [], i, cur = null, ix, last = -2;
    for (i = 0; i < pend.length; i++) {
      ix = L.indexOf(pend[i]);
      if (cur && ix >= 0 && ix === last + 1) { cur.push(pend[i]); } else { cur = [pend[i]]; g.push(cur); }
      last = ix;
    }
    return g;
  }
  /* remove a group of lines; also the blank separator line above it when it was the phrase's own
     (blank above AND blank/nothing below), never other neighbours */
  function removeGroup(els) {
    var L = editorLines(), a = L.indexOf(els[0]), b = L.indexOf(els[els.length - 1]), k;
    var sep = a > 0 && isBlankLine(L[a - 1]) && (b + 1 >= L.length || isBlankLine(L[b + 1])) ? L[a - 1] : null;
    removeLines(sep ? [sep].concat(els) : els.slice(0));
  }
  function reviewDialog(kind, cs, unf, go) {
    var items = critGroups(cs.pend), i, html = '', left;
    for (i = 0; i < cs.instr.length; i++) { items.push([cs.instr[i]]); }
    left = items.length;
    var verb = kind === 'copy' ? 'Copiar' : (kind === 'print' ? 'Imprimir' : 'Gerar');
    function finish() { closeModal(); afterChange(true); go(); }
    function backToFields() {   /* confirmations already made stay (crit-ok) */
      closeModal(); afterChange(true);
      var f = checkFields()[0];
      setTimeout(function () { if (f) { focusField(f); } toast('Preencha os campos vazios'); }, 0);
    }
    var nf = unf.length + ' campo(s) vazio(s).';
    if (!items.length) {   /* only empty fields */
      modal('Campos vazios', '<p>' + nf + '</p>', [
        { label: verb + ' assim mesmo', cls: 'btn-quiet', click: function () { finish(); return false; } },
        { label: 'Voltar e preencher', cls: 'btn-primary', focus: true, click: function () { backToFields(); return false; } }
      ]);
      return;
    }
    html = '<p>Antes de liberar o laudo, revise cada linha marcada. Esta etapa não pode ser pulada.</p>';
    for (i = 0; i < items.length; i++) {
      var instr = hasCls(items[i][0], 'crit-instr'), tl = [], q;
      for (q = 0; q < items[i].length; q++) { tl.push(esc(lineText(items[i][q]))); }
      html += '<div class="chk-item' + (items[i].length > 1 ? ' grp' : '') + '" data-i="' + i + '"><div class="txt">' + (instr ? '<b>Instrução (apague antes de liberar):</b> ' : '') +
        (items[i].length > 1 ? '<span class="muted">' + items[i].length + ' linhas juntas:</span><br>' : '') + tl.join('<br>') + '</div>' +
        (instr ? '' : '<button type="button" class="btn btn-primary" data-a="ok">Confirmar</button>') +
        '<button type="button" class="btn" data-a="edit">Editar</button>' +
        '<button type="button" class="btn btn-danger" data-a="rm">Remover</button></div>';
    }
    if (unf.length) {
      html += '<div class="chk-fields">' + nf + ' <button type="button" class="btn btn-primary" data-a="fill">Voltar e preencher</button>' +
        '<button type="button" class="btn btn-quiet" data-a="anyway" disabled title="Disponível quando não houver linhas críticas pendentes">' + verb + ' assim mesmo</button></div>';
    }
    modal('Linhas críticas — revisão obrigatória', html, [{ label: 'Cancelar' }]);
    on($('modalBody'), 'click', function (e) {
      var b = closest(e.target, function (n) { return n.nodeName === 'BUTTON' && n.getAttribute('data-a'); }, $('modalBody'));
      if (!b || b.disabled) { return; }
      var a = b.getAttribute('data-a');
      if (a === 'fill') { backToFields(); return; }
      if (a === 'anyway') { finish(); return; }
      var box = closest(b, function (n) { return hasCls(n, 'chk-item'); }), grp = items[parseInt(box.getAttribute('data-i'), 10)], q;
      if (a === 'edit') { closeModal(); gotoLine(grp[0]); return; }
      if (a === 'ok') { for (q = 0; q < grp.length; q++) { addCls(grp[q], 'crit-ok'); grp[q].setAttribute('data-res', 'confirmado'); } }
      else if (a === 'rm') { removeGroup(grp); }
      addCls(box, 'done');
      var bs = box.getElementsByTagName('button'), k; for (k = 0; k < bs.length; k++) { bs[k].disabled = true; }
      left--;
      if (left <= 0) {
        if (checkFields().length) { backToFields(); }   /* empty fields: never copy with '___' from here */
        else { finish(); }                               /* inside the click: clipboard keeps the user gesture */
      }
    });
  }

  /* ================= report search ================= */
  function clearRepMarks() {
    var l = qsa(editor, 'mark.hl'), i, m, p;
    for (i = 0; i < l.length; i++) {
      m = l[i]; p = m.parentNode;
      while (m.firstChild) { p.insertBefore(m.firstChild, m); }
      p.removeChild(m); if (p.normalize) { p.normalize(); }
    }
    S.repMarks = [];
  }
  function repSearch(keepIdx) {
    clearRepMarks();
    var q = $('repSearch').value, fq = foldKeep(q);
    if (!q) { $('repSearchCount').innerHTML = ''; return; }
    var nodes = [], w = document.createTreeWalker(editor, 4, null, false), n;
    while ((n = w.nextNode())) { nodes.push(n); }
    var i, marks = [];
    for (i = 0; i < nodes.length; i++) {
      var tn = nodes[i], f = foldKeep(tn.nodeValue), idx, hits = [], pos = 0;
      if (f.length !== tn.nodeValue.length) { continue; }
      while ((idx = f.indexOf(fq, pos)) >= 0) { hits.push(idx); pos = idx + fq.length; }
      var j, node = tn, consumed = 0;
      for (j = 0; j < hits.length; j++) {
        var mid = node.splitText(hits[j] - consumed);
        var rest = mid.splitText(fq.length);
        var mk = document.createElement('mark'); mk.className = 'hl';
        mid.parentNode.replaceChild(mk, mid); mk.appendChild(mid);
        marks.push(mk); node = rest; consumed = hits[j] + fq.length;
      }
    }
    S.repMarks = marks;
    if (!keepIdx || S.repCur >= marks.length || S.repCur < 0) { S.repCur = 0; }
    showRepCur();
  }
  function showRepCur() {
    var m = S.repMarks, i;
    $('repSearchCount').innerHTML = m.length ? (S.repCur + 1) + '/' + m.length : '0/0';
    for (i = 0; i < m.length; i++) { m[i].className = i === S.repCur ? 'hl cur' : 'hl'; }
    if (m[S.repCur]) { keepInView(m[S.repCur]); }
  }
  function repStep(d) {
    if (!S.repMarks.length || !editor.contains(S.repMarks[0])) { repSearch(true); }
    if (!S.repMarks.length) { return; }
    S.repCur = (S.repCur + d + S.repMarks.length) % S.repMarks.length; showRepCur();
  }

  /* ================= navigator (left column) ================= */
  /* Level 1 = exams, Level 2 = models of exam, Level 3 = sections/phrases */
  var ICON = { add: '+', edit: '&#9998;', clone: '&#10697;', imp: '&#8681;', ins: '&#8594;' };
  function navItems() { return qsa($('navList'), '.card'); }
  function examCount(nm) {
    var ex = findExam(nm), nt = 0, np = 0, i;
    for (i = 0; i < S.models.length; i++) { if (S.models[i].exam === nm) { nt++; } }
    if (ex) { for (i = 0; i < ex.sections.length; i++) { np += ex.sections[i].phrases.length; } }
    return nt + (nt === 1 ? ' modelo' : ' modelos') + (np ? ' · ' + np + ' frases' : '');
  }
  function crumbHtml() {
    var h = '';
    if (S.level === 1) { return 'Exames'; }
    h = '<a class="c1" data-go="1">Exames</a><span class="sepc">›</span>';
    if (S.level === 2) { return h + '<span class="c2 clast" title="' + esc(S.navExam) + '">' + esc(S.navExam) + '</span>'; }
    var m = getModel(S.activeModelId);
    h += '<a class="c2" data-go="2" title="' + esc(S.navExam) + '">' + esc(S.navExam) + '</a>';
    if (m && m.exam === S.navExam) { h += '<span class="sepc">›</span><a class="ccur clast" data-cur="' + esc(m.id) + '" title="' + esc(m.name) + ' — clique para recarregar do zero (Ctrl+Z desfaz)">' + esc(m.name) + '</a>'; }
    return h;
  }
  function toolsHtml() {
    function b(id, ic, t) { return '<button type="button" class="ib" id="' + id + '" title="' + t + '" aria-label="' + t + '">' + ic + '</button>'; }
    if (S.level === 2) { return b('tMAdd', ICON.add, 'Adicionar modelo') + b('tMEdit', ICON.edit, 'Editar modelo selecionado') + b('tMClone', ICON.clone, 'Clonar modelo selecionado'); }
    if (S.level === 3) { return b('tPAdd', ICON.add, 'Adicionar frase') + b('tPImp', ICON.imp, 'Importar frases') + b('tPEdit', ICON.edit, 'Editar frase selecionada') + b('tPIns', ICON.ins, 'Inserir frase selecionada no laudo'); }
    return '';
  }
  var PLACE = ['', 'Pesquisar exame...', 'Pesquisar modelo...', 'Pesquisar frases...'];
  function renderNav(keepFocus) {
    var noBank = !S.bank && !S.userModels.length;
    $('noBank').hidden = !noBank;
    $('navHead').style.display = noBank ? 'none' : '';
    $('navList').style.display = noBank ? 'none' : '';
    if (noBank) { return; }
    if (S.level > 1 && !S.navExam) { S.level = 1; }
    $('navBack').disabled = S.level === 1;
    $('crumb').innerHTML = crumbHtml();
    $('navTools').innerHTML = toolsHtml();
    var si = $('navSearch');
    si.setAttribute('placeholder', PLACE[S.level]);
    if (si.value !== S.navSearch[S.level - 1]) { si.value = S.navSearch[S.level - 1]; }
    sxShow(si);
    var q = foldKeep(trim(si.value)), html = '', i;
    $('navCount').innerHTML = '';
    if (S.level === 1) {
      var names = examNames(), n = 0;
      for (i = 0; i < names.length; i++) {
        var nm = names[i], label = nm === UltraParser.GLOBAL_EXAM ? 'TODOS (comuns a todos)' : nm;
        if (q && foldKeep(label).indexOf(q) < 0) { continue; }
        n++;
        html += '<button type="button" class="card' + (nm === S.activeExam ? ' sel' : '') + '" data-exam="' + esc(nm) + '"><div class="ct">' +
          esc(label) + '</div><div class="cm">' + esc(examCount(nm)) + '</div></button>';
      }
      if (!n) { html = '<div class="empty">Nenhum exame encontrado</div>'; }
    } else if (S.level === 2) {
      html = renderModelsLevel(q);
    } else {
      html = renderPhrasesLevel(trim(si.value));
    }
    $('navList').innerHTML = html;
    if (keepFocus) { restoreNavFocus(); }
  }
  function modelCard(m) {
    return '<button type="button" class="card' + (m.id === (S.selModel || S.activeModelId) ? ' sel' : '') + '" data-model="' + esc(m.id) + '"' +
      (S.settings.dragReorder ? ' draggable="true"' : '') + '>' +
      (S.settings.showUsage ? '<span class="n">(' + (S.usage[m.id] || 0) + ')</span>' : '') +
      '<div class="ct">' + (S.settings.dragReorder ? '<span class="grip">&#8942;</span>' : '') + esc(m.name) + '</div>' +
      (m.user ? '<div class="cm">meu modelo</div>' : (m.override ? '<div class="cm">editado neste computador</div>' : '')) + '</button>';
  }
  function renderModelsLevel(q) {
    var arr = sortedModels(), html = '', glob = '', i, m, n = 0;
    for (i = 0; i < arr.length; i++) {
      m = arr[i];
      if (q && foldKeep(m.name).indexOf(q) < 0) { continue; }
      if (m.exam === S.navExam) { html += modelCard(m); n++; }
      else if (m.exam === UltraParser.GLOBAL_EXAM && S.navExam !== UltraParser.GLOBAL_EXAM) { glob += modelCard(m); n++; }
    }
    if (glob) { html += '<div class="glabel">Comuns a todos os exames</div>' + glob; }
    if (!n && q) { html = '<div class="empty">Nenhum modelo encontrado</div>'; }
    html += '<button type="button" class="card special" data-go="3"><div class="ct">Ver frases sem carregar modelo</div></button>';
    return html;
  }
  /* verbatim txt lines; first (title) line in bold */
  function rawHtml(src, q) {
    var ls = String(src).split('\n'), out = [], i;
    for (i = 0; i < ls.length; i++) {
      if (i === 0) { out.push('<b>' + highlight(ls[i], q) + '</b>'); }
      else if (UltraParser.parsePlacement(ls[i])) { out.push('<span class="dirl">' + highlight(ls[i], q) + '</span>'); }   /* @@SUBSTITUI / @@ABAIXO_DE: verbatim, light gray */
      else { out.push(highlight(ls[i], q)); }
    }
    return out.join('\n');
  }
  /* with a search query: sections of the current exam first, then every other exam of the txt
     (each phrase once; origin shown discreetly only for other exams) */
  function phraseScope(q) {
    var secs = examSections(S.navExam), i, j, all = [], seen = {}, ex = examNames(), cur = S.navExam;
    for (i = 0; i < secs.length; i++) { secs[i].org = ''; all.push(secs[i]); }
    if (!q) { return all; }
    for (i = 0; i < all.length; i++) { for (j = 0; j < all[i].cards.length; j++) { seen[all[i].cards[j].id] = 1; } }
    for (i = 0; i < ex.length; i++) {
      if (ex[i] === cur) { continue; }
      var os = examSections(ex[i]), k;
      for (j = 0; j < os.length; j++) {
        var cs = [];
        for (k = 0; k < os[j].cards.length; k++) { if (!seen[os[j].cards[k].id]) { seen[os[j].cards[k].id] = 1; cs.push(os[j].cards[k]); } }
        if (cs.length) { all.push({ name: os[j].name, key: os[j].key + '|' + ex[i], src: os[j].src, reserved: false, cards: cs, org: ex[i] }); }
      }
    }
    return all;
  }
  function renderPhrasesLevel(q) {
    var secs = phraseScope(q), html = '', i, j, c, ph, fq = foldKeep(q), matches = [];
    S.phraseIndex = {};
    for (i = 0; i < secs.length; i++) {
      var s = secs[i], inner = '', shown = 0;
      for (j = 0; j < s.cards.length; j++) {
        c = s.cards[j]; ph = c.ph;
        if (q && foldKeep(c.src + ' ' + ph.body).indexOf(fq) < 0) { if (!S.phraseIndex[c.id]) { S.phraseIndex[c.id] = c; c.dispSec = s.name; } continue; }
        S.phraseIndex[c.id] = c; c.dispSec = s.name;
        shown++; if (q) { matches.push(c.id); }
        var meta = (ph.help ? '(' + ph.help + ')' : '') + (ph.help && ph.hypothesis ? ' · ' : '') + (ph.hypothesis ? ph.hypothesis : '');
        inner += '<button type="button" class="card pcard' + (c.user ? ' user' : '') + (c.id === S.selCard ? ' sel' : '') + '" data-ph="' + esc(c.id) +
          '">' +
          '<div class="ph1"><b>' + highlight(ph.title, q) + '</b>' + (meta ? '<span class="meta">' + highlight(meta, q) + '</span>' : '') +
          ((ph.critical && ph.critical.length) ? '<span class="wf" title="Contém linha crítica">&#9888;</span>' : '') + '</div>' +
          '<div class="pb">' + highlight(ph.body, q) + '</div><div class="raw">' + rawHtml(c.src, q) + '</div>' +
          '<span class="pins" data-insbtn="1" title="Inserir no laudo">&#8594;</span></button>';
      }
      if (q && !shown) { continue; }
      var open = q ? true : !!S.openSecs[s.key];
      html += '<div class="sec' + (open ? ' open' : '') + (open && S.animSec === s.key ? ' sec-anim' : '') + '"><button type="button" class="card" data-sec="' + esc(s.key) + '" aria-expanded="' + open + '">' +
        '<span class="arr">' + (open ? '&#9662;' : '&#9656;') + '</span><span class="ct">' + esc(s.name) + (s.org ? '<span class="org"> \u00b7 ' + esc(s.org) + '</span>' : '') + '</span><span class="n">' +
        (s.cards.length ? (q ? shown + '/' : '') + s.cards.length : '') + '</span></button>';
      if (open) {
        html += '<div class="sec-body">' +
          (s.cards.length ? inner : '<div class="empty">Sem frases ainda</div>') + '</div>';
      }
      html += '</div>';
    }
    S.phMatches = matches;
    if (q) { $('navCount').innerHTML = matches.length + (matches.length === 1 ? ' frase' : ' frases'); }
    return html || '<div class="empty">' + (q ? 'Nenhuma frase encontrada' : 'Este exame não tem seções.') + '</div>';
  }
  function navKeyOf(el) {
    if (!el) { return null; }
    var a = ['data-exam', 'data-model', 'data-sec', 'data-ph', 'data-go'], i;
    for (i = 0; i < a.length; i++) { if (el.getAttribute(a[i]) !== null) { return a[i] + '=' + el.getAttribute(a[i]); } }
    return null;
  }
  function restoreNavFocus() {
    var l = navItems(), i;
    for (i = 0; i < l.length; i++) { if (navKeyOf(l[i]) === S.navFocus) { l[i].focus(); return; } }
  }
  function goLevel(lv, exam) {
    if (exam !== undefined) { S.navExam = exam; }
    S.level = lv; S.navFocus = null;
    renderNav();
    var l = navItems(), i, want = null;
    for (i = 0; i < l.length; i++) {
      if ((lv === 1 && l[i].getAttribute('data-exam') === S.navExam) || (lv === 2 && hasCls(l[i], 'sel'))) { want = l[i]; break; }
    }
    (want || l[0] || $('navSearch')).focus();
    if (want && want.scrollIntoView) { want.scrollIntoView(false); }
  }
  function navBack() { if (S.level > 1) { goLevel(S.level - 1); } }
  function activateNav(el) {
    var v;
    if ((v = el.getAttribute('data-go')) !== null) {
      v = parseInt(v, 10);
      if (v === 3) { S.activeExam = S.navExam; }
      goLevel(v); return;
    }
    if ((v = el.getAttribute('data-exam')) !== null) { S.selModel = null; goLevel(2, v); return; }
    if ((v = el.getAttribute('data-model')) !== null) { S.selModel = v; useModel(getModel(v)); return; }
    if ((v = el.getAttribute('data-sec')) !== null) {
      S.openSecs[v] = !S.openSecs[v]; S.navFocus = navKeyOf(el); renderNav(true); if (S.openSecs[v]) { secToTop(v); } return;
    }
    if ((v = el.getAttribute('data-ph')) !== null) { selectCard(v); insertCard(v); }
  }
  function selectCard(id) {
    S.selCard = id;
    var l = qsa($('navList'), '.pcard'), i;
    for (i = 0; i < l.length; i++) { if (l[i].getAttribute('data-ph') === id) { addCls(l[i], 'sel'); } else { rmCls(l[i], 'sel'); } }
  }
  /* ---------- auto-placement: find the phrase's section in the report ---------- */
  var GENERIC = { GERAL: 1, GERAIS: 1, OUTROS: 1, OUTRAS: 1, OUTRO: 1, OUTRA: 1, OBS: 1, OBSERVACAO: 1, OBSERVACOES: 1, ABD: 1, ADICIONAL: 1, ADICIONAIS: 1 };
  var STOP = { DE: 1, DA: 1, DO: 1, DAS: 1, DOS: 1, E: 1, A: 1, O: 1 };
  function cleanWords(t) {
    var w = UltraParser.words(String(t).replace(/[^A-Za-z\u00C0-\u00FF0-9\s\/]/g, ' ')), out = [], i;
    for (i = 0; i < w.length; i++) { if (w[i]) { out.push(w[i]); } }
    return out;
  }
  function sigWords(ws) {
    var out = [], i; for (i = 0; i < ws.length; i++) { if (!GENERIC[ws[i]]) { out.push(ws[i]); } }
    return out;
  }
  function eqWord(a, b) {
    if (a === b || UltraParser.wordsEqualPlural([a], [b])) { return true; }
    function m(x) { return x.replace(/NS$/, 'M').replace(/IS$/, 'L'); }   /* RINS->RIM, RENAIS->RENAL-ish */
    return m(a) === b || m(b) === a || m(a) === m(b);
  }
  function prefixEq(lw, v) {
    if (lw.length < v.length) { return false; }
    for (var i = 0; i < v.length; i++) { if (!eqWord(lw[i], v[i])) { return false; } }
    return true;
  }
  /* full-name variants (exact, sides stripped, '/' parts, generic words removed) */
  function secNameVariants(name) {
    var P = UltraParser, out = [], seen = {}, parts = String(name).split('/'), i, w;
    function add(ws) { if (ws.length && ws[0] && !seen[ws.join(' ')]) { seen[ws.join(' ')] = 1; out.push(ws); } }
    function addAll(t) { w = cleanWords(t); add(w); add(P.stripSides(w)); add(sigWords(w)); add(sigWords(P.stripSides(w))); }
    addAll(String(name).replace(/\//g, ' '));
    if (parts.length > 1) { for (i = 0; i < parts.length; i++) { addAll(parts[i]); } }
    return out;
  }
  /* first significant word of each variant (e.g. AORTA ABDOMINAL GERAL -> AORTA) */
  function secFirstWords(name) {
    var v = secNameVariants(name), out = [], seen = {}, i, k, w;
    for (i = 0; i < v.length; i++) {
      for (k = 0; k < v[i].length; k++) { w = v[i][k]; if (!STOP[w] && w.length >= 3) { break; } w = null; }
      if (w && !seen[w]) { seen[w] = 1; out.push([w]); }
    }
    return out;
  }
  /* does the line start with the section name? 'head' (line is just the name) or 'para' */
  function matchSecLine(text, variants) {
    var lw = cleanWords(text), v, k;
    for (k = 0; k < variants.length; k++) {
      v = variants[k];
      if (!prefixEq(lw, v)) { continue; }
      var sideless = UltraParser.stripSides(lw), colon = /:\s*$/.test(trim(text));
      if (lw.length === v.length || sigWords(sideless).length <= v.length || (colon && lw.length <= v.length + 2)) { return colon || lw.length <= v.length + 1 ? 'head' : 'para'; }
      return 'para';
    }
    return null;
  }
  /* the full name appears among the first words of the line (not as its 1st word) */
  function nearStart(text, vars) {
    var lw = cleanWords(text), i, k, seen = 0;
    for (i = 0; i < lw.length && seen < 4; i++) {
      if (STOP[lw[i]]) { continue; }
      seen++;
      if (i === 0) { continue; }
      for (k = 0; k < vars.length; k++) { if (prefixEq(lw.slice(i), vars[k])) { return true; } }
    }
    return false;
  }
  function otherSecVariants(own) {
    var secs = examSections(S.activeExam || S.navExam), out = [], i, v, k, fo = UltraParser.fold(own);
    for (i = 0; i < secs.length; i++) {
      if (UltraParser.fold(secs[i].name) === fo) { continue; }
      v = secNameVariants(secs[i].name); for (k = 0; k < v.length; k++) { if (v[k].length > 1) { out.push(' ' + v[k].join(' ') + ' '); } }
    }
    return out;
  }
  function mentionsOther(text, others) {
    var t = ' ' + cleanWords(text).join(' ') + ' ', i;
    for (i = 0; i < others.length; i++) { if (t.indexOf(others[i]) >= 0) { return true; } }
    return false;
  }
  function tplOrigSet() {
    var m = getModel(S.activeModelId), set = {}, d, l, i;
    if (!m) { return set; }
    var tp = modelTemplate(m); d = document.createElement('div'); d.innerHTML = renderLines(tp.body, tp.fields, tp.critical);
    l = textLines(d, '___'); for (i = 0; i < l.length; i++) { set[trim(l[i])] = 1; }
    return set;
  }
  function isBlankLine(el) { return trim(lineText(el)) === ''; }
  /* -> { range, replace } or null */
  function findSectionTarget(secNames) {
    var L = editorLines(), i, n, pass, kind = null, start = -1, secName = null, from = 0;
    /* never touch the report title / technique: search below 'Relatório ...' (or below the 1st line) */
    for (i = 0; i < L.length; i++) { if (/^\s*relat[óo]rio/i.test(lineText(L[i]))) { from = i + 1; break; } }
    if (!from) { for (i = 0; i < L.length; i++) { if (!isBlankLine(L[i])) { from = i + 1; break; } } }
    /* pass 0: line starts with the name; 1: starts with its first significant word;
       2: paragraph opening that names it within its first words ('Glândula tireoide...', 'Tendão subescapular:') */
    for (pass = 0; pass < 3 && start < 0; pass++) {
      for (n = 0; n < secNames.length && start < 0; n++) {
        if (!secNames[n]) { continue; }
        var vars = secNameVariants(secNames[n]);
        if (pass === 1) { continue; }   /* (first-word-only matching dropped: 'Nervo ulnar' must not hit 'Nervo mediano') */
        for (i = from; i < L.length; i++) {
          if (isHypEl(L[i]) || isBlankLine(L[i]) || cgIdx([L[i]]) === 0) { continue; }
          if (pass === 2) { kind = (i === 0 || isBlankLine(L[i - 1])) && nearStart(lineText(L[i]), vars) ? 'para' : null; }
          else { kind = matchSecLine(lineText(L[i]), vars); }
          if (kind) { start = i; secName = secNames[n]; break; }
        }
      }
    }
    if (start < 0) { return null; }
    var first = kind === 'head' ? start + 1 : start, last = first - 1;
    var others = otherSecVariants(secName);
    for (i = first; i < L.length && !isBlankLine(L[i]) && !isHypEl(L[i]); i++) {
      if (i > start && kind === 'para' && mentionsOther(lineText(L[i]), others)) { break; }   /* e.g. 'Tronco da veia porta' inside the Fígado paragraph */
      last = i;
    }
    var r = document.createRange();
    if (last < first) {   /* heading only: insert right below it */
      r.selectNodeContents(L[start]); r.collapse(false); return { range: r, replace: false, how: 'heading' };
    }
    S.lastPlacementLine = lineText(L[start]); S.lastAnchor = lineText(L[first <= last ? first : start]); S.lastSpan = last - first + 1;
    var orig = tplOrigSet(), isDefault = true;
    /* side-specific section (OVÁRIO DIREITO) on a shared paragraph ('Ovários ...'): never replace */
    var sw = cleanWords(secName), lt = ' ' + cleanWords(lineText(L[start])).join(' ') + ' ', q;
    for (q = 0; q < sw.length; q++) { if (/^(DIREIT[OA]|ESQUERD[OA])$/.test(sw[q]) && lt.indexOf(' ' + sw[q] + ' ') < 0) { isDefault = false; } }
    for (i = first; i <= last; i++) { if (!orig[trim(lineText(L[i]))] || hasCls(L[i], 'chg')) { isDefault = false; break; } }
    if (isDefault) { r.setStart(L[first], 0); r.setEnd(L[last], L[last].childNodes.length); return { range: r, replace: true, how: 'replace' }; }
    r.selectNodeContents(L[last]); r.collapse(false); return { range: r, replace: false, how: 'below' };
  }
  /* end of report, but above the HIPÓTESE block / 'Considerações gerais' */
  function endTarget() {
    var L = editorLines(), i, stop = L.length, last = -1;
    for (i = 0; i < L.length; i++) { if (hasCls(L[i], 'hyph') || hasCls(L[i], 'hyps') && L[i + 1] && hasCls(L[i + 1], 'hyph') || cgIdx([L[i]]) === 0 || (HYP_HEAD.test(lineText(L[i])) && !isHypEl(L[i]) && L[i].getAttribute('data-hyp') === null)) { stop = i; break; } }
    for (i = stop - 1; i >= 0; i--) { if (!isBlankLine(L[i])) { last = i; break; } }
    var r = document.createRange();
    if (last < 0) { r.selectNodeContents(editor); r.collapse(false); return r; }
    r.selectNodeContents(L[last]); r.collapse(false); return r;
  }
  function caretInEditor() {
    var r = S.savedRange;
    return S.userCaret && r && editor.contains(r.commonAncestorContainer) ? r : null;
  }
  /* ================= PLACEMENT RULES (special cases) =================
     There are NO built-in rules: every special placement comes from the bank txt
     (@@SUBSTITUI / @@ABAIXO_DE). Rule objects built from those directives:
       sec    : regexp on the section name (folded: upper case, no accents, words joined by single spaces)
       mode   : 'appendAfter' -> insert after the END of the anchor paragraph(s) (consecutive paragraphs whose
                                 first line matches `anchor`), after phrases already placed by this rule;
                                 never replaces the default text
                'replaceLine' -> the first LINE matching `anchor`: replaced if it still equals the template
                                 default, otherwise the phrase goes right below it (after earlier ones)
       anchor : regexp on the folded line text (^ = line start)
     If the anchor is not in the report, the generic section-name matching / fallback applies. */
  function foldedLine(el) { return cleanWords(lineText(el)).join(' '); }
  /* directive matching also sees the options of an UNFILLED choice list ?[a|b]: the line is tried once per
     option (all unfilled lists take option k), so "@@SUBSTITUI = Embrião" matches "?[Embrião|Feto] identificado...".
     A filled list counts as its chosen text (as before). */
  function lineVariants(el) {
    var ch = qsa(el, '.f-sel'), un = [], i, k, n = 0, out = [foldedLine(el)];
    for (i = 0; i < ch.length; i++) { if (!fieldFilled(ch[i])) { un.push(i); } }
    if (!un.length) { return out; }
    var opts = [];
    for (i = 0; i < un.length; i++) { try { opts.push(JSON.parse(ch[un[i]].getAttribute('data-o')) || []); } catch (e) { opts.push([]); } n = Math.max(n, opts[i].length); }
    for (k = 0; k < Math.min(n, 12); k++) {
      var cl = el.cloneNode(true), cc = qsa(cl, '.f-sel'), u;
      for (u = 0; u < un.length; u++) {
        var o = opts[u], t = o.length ? o[Math.min(k, o.length - 1)] : '';
        cc[un[u]].parentNode.replaceChild(document.createTextNode(t), cc[un[u]]);
      }
      out.push(cleanWords(lineText(cl)).join(' '));
    }
    return out;
  }
  function anchorHits(anchor, el) { var v = lineVariants(el), i; for (i = 0; i < v.length; i++) { if (anchor.test(v[i])) { return true; } } return false; }
  /* rule built from a user directive (@@SUBSTITUI / @@ABAIXO_DE) */
  function directiveRule(pd) {
    var w = cleanWords(pd.text).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!w) { return null; }
    var aw = cleanWords(pd.text);
    /* anchor = the line STARTS with these words (singular/plural tolerant: 'Rim' also matches 'Rins') */
    return { id: 'u:' + w.replace(/[^A-Z0-9]+/g, '_').substring(0, 40), mode: pd.mode, anyLine: true, user: true,
             anchor: { test: function (folded) { return prefixEq(String(folded).split(' '), aw); } } };
  }
  /* anchors of all directives of the current exam (a SUBSTITUI block stops before another directive's line) */
  function examAnchors(exceptId) {
    var secs = examSections(S.activeExam || S.navExam), out = [], seen = {}, i, j, d, c;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) {
        c = secs[i].cards[j];
        var ps = [c.secPlace, c.ph && c.ph.place], k;
        for (k = 0; k < ps.length; k++) { if (ps[k] && (d = directiveRule(ps[k])) && d.id !== exceptId && !seen[d.id]) { seen[d.id] = 1; out.push(d.anchor); } }
      }
    }
    return out;
  }
  /* -> { range, replace, blank } or null when the anchor is missing */
  function ruleTarget(rule) {
    var L = editorLines(), i, r = document.createRange();
    if (rule.mode === 'replaceLine') {
      var at = -1;
      for (i = 0; i < L.length; i++) { if (!isHypEl(L[i]) && anchorHits(rule.anchor, L[i])) { at = i; break; } }
      if (at < 0) {   /* the anchor line was already replaced: go below the phrases this rule placed there */
        for (i = 0; i < L.length; i++) { if (L[i].getAttribute('data-rule') === rule.id) { at = i; break; } }
        if (at < 0) { return null; }
      }
      var last = at, placed = L[at].getAttribute('data-rule') === rule.id;
      S.lastAnchor = lineText(L[at]);
      if (!placed) {
        /* block = the anchor line + following lines of the same paragraph, stopping before a blank line,
           an edited/inserted line, or the line of ANOTHER directive (e.g. 'Tronco da veia porta') */
        var stops = examAnchors(rule.id), others = rule.secName ? otherSecVariants(rule.secName) : [], orig = tplOrigSet(), allDef = !hasCls(L[at], 'chg') && !!orig[trim(lineText(L[at]))], q, stop;
        while (L[last + 1] && !isBlankLine(L[last + 1]) && !isHypEl(L[last + 1]) && !hasCls(L[last + 1], 'chg') && L[last + 1].getAttribute('data-rule') === null) {
          stop = false; for (q = 0; q < stops.length; q++) { if (anchorHits(stops[q], L[last + 1])) { stop = true; break; } }
          if (stop || mentionsOther(lineText(L[last + 1]), others)) { break; }   /* also stop at a line naming another section */
          last++; if (!orig[trim(lineText(L[last]))]) { allDef = false; }
        }
        S.lastSpan = last - at + 1;
        if (allDef) { r.setStart(L[at], 0); r.setEnd(L[last], L[last].childNodes.length); return { range: r, replace: true, blank: false }; }
      }
      while (L[last + 1] && L[last + 1].getAttribute('data-rule') === rule.id) { last++; }   /* after phrases already placed here */
      r.selectNodeContents(L[last]); r.collapse(false); return { range: r, replace: false, blank: false };
    }
    /* appendAfter: paragraphs = runs of non-blank lines; a paragraph matches when its FIRST line (or, with
       rule.anyLine, ANY line) matches the anchor, or it was placed by this rule; the first run of matching
       paragraphs is the target, the phrase goes after its end */
    var paras = [], cur = null, p, k, end = -1, usesBlank = false, started = false;
    for (i = 0; i < L.length; i++) {
      if (isBlankLine(L[i]) || isHypEl(L[i])) { cur = null; continue; }
      if (!cur) { cur = { s: i, e: i }; paras.push(cur); } else { cur.e = i; }
    }
    for (p = 0; p < paras.length; p++) {
      var hit = L[paras[p].s].getAttribute('data-rule') === rule.id;
      for (k = paras[p].s; !hit && k <= (rule.anyLine ? paras[p].e : paras[p].s); k++) { hit = anchorHits(rule.anchor, L[k]); }
      if (hit) { if (!started) { S.lastAnchor = lineText(L[paras[p].s]); } started = true; end = paras[p].e; }
      else if (started) { break; }
    }
    if (end < 0) { return null; }
    if (!L[end + 1] || isBlankLine(L[end + 1])) { usesBlank = true; }   /* also at the end of the report: keep the blank-line separation */
    r.selectNodeContents(L[end]); r.collapse(false); return { range: r, replace: false, blank: usesBlank };
  }
  function flashBlock(lines) {
    if (!lines.length) { return; }
    var w = $('editorWrap'), wr = w.getBoundingClientRect(), top = 1e9, bot = -1e9, left = 1e9, right = -1e9, i, rc;
    for (i = 0; i < lines.length; i++) {
      rc = lines[i].getBoundingClientRect();
      top = Math.min(top, rc.top); bot = Math.max(bot, rc.bottom); left = Math.min(left, rc.left); right = Math.max(right, rc.right);
    }
    var o = document.createElement('div'); o.className = 'chg-flash';
    o.style.top = (top - wr.top + w.scrollTop - 3) + 'px'; o.style.left = (left - wr.left + w.scrollLeft - 5) + 'px';
    o.style.width = (right - left + 10) + 'px'; o.style.height = (bot - top + 6) + 'px';
    w.appendChild(o);
    setTimeout(function () { addCls(o, 'out'); }, 1600);
    setTimeout(function () { if (o.parentNode) { o.parentNode.removeChild(o); } }, 2300);
  }
  /* @@SEMPRE phrases of this exam (and of TODOS): inserted at their placement after a template is loaded from
     scratch; skipped when their text is already in the report. Caret/scroll are kept as the template left them. */
  function insertAlways(exam) {
    var secs = examSections(exam), i, j, c, n = 0, sel = window.getSelection(), keep = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var w = $('editorWrap'), top = w.scrollTop;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) {
        c = secs[i].cards[j];
        if (!c.ph || !c.ph.always) { continue; }
        var first = cleanWords(trim(String(c.ph.body).split('\n')[0])).join(' ');
        if (first && cleanWords(textLines(editor, '___').join(' ')).join(' ').indexOf(first) >= 0) { continue; }   /* already present */
        c.dispSec = secs[i].name; S.phraseIndex[c.id] = c;
        insertCard(c.id, true); n++;
      }
    }
    if (n) {
      if (keep && editor.contains(keep.startContainer)) { try { setRange(keep); saveRange(); } catch (e) {} }
      w.scrollTop = top;
    }
    return n;
  }
  function insertCard(id, quiet) {
    var c = S.phraseIndex[id]; if (!c) { return; }
    var before = qsa(editor, '.fld'), i, f = null;
    var hyp = trim(c.ph.hypothesis || '');
    var html = renderLines(c.ph.body, c.ph.fields, c.ph.critical);   /* body only: no title/help/hypothesis */
    var tag = 'c' + now();
    html = html.replace(/<div( class="([^"]*)")?>/g, function (t, a, cl) { return '<div class="' + (cl ? cl + ' ' : '') + 'chg" data-ins="' + tag + '">'; });
    if (hyp) { html = html.replace(/<div( class="[^"]*")?/g, function (t, cl) { return '<div' + (cl || '') + ' data-hyp="' + esc(hyp) + '"'; }); }
    /* precedence: phrase directive > section directive (both from the txt) > generic section-name matching */
    var rule = null, kr = null, cand = [c.ph && c.ph.place ? directiveRule(c.ph.place) : null, c.secPlace ? directiveRule(c.secPlace) : null], ci;
    for (ci = 0; ci < cand.length && !kr; ci++) { if (cand[ci]) { rule = cand[ci]; rule.secName = c.dispSec || c.section; kr = ruleTarget(rule); } }
    if (!kr) { rule = null; }
    var tgt = kr ? null : findSectionTarget([c.dispSec, c.section]), msg = 'Inserida: ' + c.ph.title, how;
    if (rule) { html = html.replace(/<div /g, '<div data-rule="' + rule.id + '" '); }
    if (kr) {
      how = 'rule:' + rule.id + (kr.replace ? ':replace' : ''); focusEditor(); setRange(kr.range); saveRange();
      if (kr.blank) { html = '<div><br></div>' + html; }
      S.lastPlacementLine = rule.id; msg += kr.replace ? ' (substituiu o texto padrão)' : ' (regra: ' + rule.id + ')';
    }
    else if (tgt) { how = tgt.how; focusEditor(); setRange(tgt.range); saveRange(); msg += tgt.replace ? ' (substituiu o texto padrão)' : ' (na seção ' + (c.dispSec || c.section) + ')'; }
    else if (!quiet && caretInEditor()) { how = 'caret'; }
    else { how = 'end'; focusEditor(); setRange(endTarget()); saveRange(); html = '<div><br></div>' + html; }
    S.lastPlacement = how; if (!tgt && !kr) { S.lastPlacementLine = ''; }
    insertBlock(html);
    if (!quiet) { S.userCaret = true; }
    var ins = qsa(editor, '[data-ins="' + tag + '"]'), k;
    for (k = 0; k < ins.length; k++) { ins[k].removeAttribute('data-ins'); }
    if (hyp) { addHypothesis(hyp); }
    if (quiet) { S.lastPlacement = how; afterChange(false); return; }
    flashBlock(ins);
    var after = qsa(editor, '.fld');
    for (i = 0; i < after.length; i++) { if (before.indexOf(after[i]) < 0 && !fieldFilled(after[i])) { f = after[i]; break; } }
    if (f) { focusField(f); }
    toast(msg);
    if (S.settings.autoNextSec && S.level === 3 && !trim($('navSearch').value)) { advanceSection(id); }
  }
  /* close the phrase's section in the accordion and open the next one */
  /* opened section: scroll the left list (only the list) so the section header is at its top */
  function secToTop(key) {
    var nl = $('navList'), l = qsa(nl, '[data-sec]'), k;
    for (k = 0; k < l.length; k++) {
      if (l[k].getAttribute('data-sec') === key) {
        var sec = l[k].parentNode || l[k], want = nl.scrollTop + sec.getBoundingClientRect().top - nl.getBoundingClientRect().top;
        var pad = $('navPad'); if (pad) { pad.parentNode.removeChild(pad); }
        /* blank space below the list so even the last section can reach the top */
        pad = document.createElement('div'); pad.id = 'navPad'; pad.style.height = nl.clientHeight + 'px'; nl.appendChild(pad);
        nl.scrollTop = Math.max(0, want);
        return;
      }
    }
  }
  function advanceSection(id) {
    var secs = examSections(S.navExam), i, j;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) { if (secs[i].cards[j].id === id) { break; } }
      if (j < secs[i].cards.length) { break; }
    }
    if (i >= secs.length) { return; }
    S.openSecs[secs[i].key] = false;
    var nx = secs[i + 1];
    if (nx) { S.openSecs[nx.key] = true; }
    var top = $('navList').scrollTop;
    S.animSec = nx ? nx.key : null;
    renderNav(); $('navList').scrollTop = top;
    S.animSec = null;
    var nlS = $('navList'); addCls(nlS, 'smooth'); clearTimeout(advanceSection.t); advanceSection.t = setTimeout(function () { rmCls(nlS, 'smooth'); }, 400);
    if (nx) {
      var l = qsa($('navList'), '[data-sec]'), k;
      secToTop(nx.key);
    }
  }

  function renderAll() { renderNav(); }
  /* ================= automatic HIPÓTESE DIAGNÓSTICA block ================= */
  var HYP_HEAD = /^\s*(hip[óo]tese|conclus[ãa]o|impress[ãa]o)/i;
  /* leaf lines (execCommand may nest line <div>s) */
  function editorLines() {
    var a = [], l = qsa(editor, 'div,p'), i;
    for (i = 0; i < l.length; i++) { if (!l[i].querySelector('div,p')) { a.push(l[i]); } }
    return a;
  }
  function isHypEl(n) { return closest(n, function (x) { return hasCls(x, 'hypl') || hasCls(x, 'hyph') || hasCls(x, 'hyps'); }, editor); }
  function hypLineExists(hyp) {
    var l = editorLines(), i;
    for (i = 0; i < l.length; i++) { if ((isHypEl(l[i]) || l[i].getAttribute('data-hyp') === null) && trim(lineText(l[i])) === hyp) { return true; } }
    return false;
  }
  /* new line after `ref` (or at the end), via execCommand so Ctrl+Z keeps working */
  function execLineAfter(ref, html) {
    var r = document.createRange();
    if (ref) { r.selectNodeContents(ref); } else { r.selectNodeContents(editor); }
    r.collapse(false); setRange(r);
    exec('insertParagraph');
    var line = lineOf(window.getSelection().getRangeAt(0).startContainer);
    if (line) { line.removeAttribute('data-hyp'); line.removeAttribute('class'); line.removeAttribute('data-h'); var r2 = document.createRange(); r2.selectNodeContents(line); setRange(r2); }
    exec('insertHTML', html);
  }
  function cgIdx(lines) {
    var i; for (i = 0; i < lines.length; i++) { if (/^\s*consideracoes gerais/.test(UltraParser.fold(lineText(lines[i])).toLowerCase())) { return i; } }
    return -1;
  }
  function addHypothesis(hyp) {
    if (hypLineExists(hyp)) { return; }
    var lines = editorLines(), i, head = null, after, keep = S.savedRange ? S.savedRange.cloneRange() : null;
    var w = $('editorWrap'), top = w.scrollTop;
    for (i = 0; i < lines.length; i++) { if ((isHypEl(lines[i]) || lines[i].getAttribute('data-hyp') === null) && HYP_HEAD.test(lineText(lines[i]))) { head = lines[i]; } }
    var hl = '<div class="hypl" data-h="' + esc(hyp) + '">' + esc(hyp) + '</div>';
    if (!canExecHtml) {
      var tmp = document.createElement('div'); tmp.innerHTML = head ? hl : '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl;
      while (tmp.firstChild) { editor.appendChild(tmp.firstChild); }
    } else if (head) {
      after = head;
      while (after.nextSibling && after.nextSibling.nodeType === 1 && trim(lineText(after.nextSibling)) !== '' && !HYP_HEAD.test(lineText(after.nextSibling))) { after = after.nextSibling; }
      execLineAfter(after, hl);
    } else if (cgIdx(lines) >= 0) {
      /* new block goes right above "Considerações gerais" */
      var ci = cgIdx(lines), prev = ci > 0 ? lines[ci - 1] : null, prevBlank = prev && trim(lineText(prev)) === '';
      var blk = '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl + '<div class="hyps"><br></div>';
      if (prev) { execLineAfter(prev, (prevBlank ? '' : '<div class="hyps"><br></div>') + blk); }
      else { var r0 = document.createRange(); r0.setStartBefore(lines[ci]); r0.collapse(true); setRange(r0); exec('insertHTML', blk); }
    } else {
      var last = lines[lines.length - 1];
      execLineAfter(last, (last && trim(lineText(last)) !== '' ? '<div class="hyps"><br></div>' : '') + '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl);
    }
    if (keep && editor.contains(keep.startContainer)) { setRange(keep); saveRange(); }
    w.scrollTop = top;
    afterChange(true);
  }
  /* drop automatic hypothesis lines whose phrase is no longer in the report */
  function syncHypotheses() {
    var l = qsa(editor, '.hypl'), i, j, used = {}, src = qsa(editor, '[data-hyp]');
    for (j = 0; j < src.length; j++) { if (!src[j].querySelector('div,p') && !isHypEl(src[j]) && trim(lineText(src[j])) !== '') { used[src[j].getAttribute('data-hyp')] = 1; } }
    for (i = 0; i < l.length; i++) {
      var h = l[i].getAttribute('data-h');
      if (!used[h] && trim(lineText(l[i])) === h && l[i].parentNode && !l[i].querySelector('div,p')) { l[i].parentNode.removeChild(l[i]); }
    }
    if (qsa(editor, '.hypl').length) { return; }
    var hd = qsa(editor, '.hyph'), k, rm = [];
    for (k = 0; k < hd.length; k++) { if (trim(lineText(hd[k])) === 'Hipótese/Impressão diagnóstica:') { rm.push(hd[k]); } }
    if (!rm.length) { return; }
    hd = qsa(editor, '.hyps');
    for (k = 0; k < hd.length; k++) { if (trim(lineText(hd[k])) === '') { rm.push(hd[k]); } }
    for (k = 0; k < rm.length; k++) { if (rm[k].parentNode) { rm[k].parentNode.removeChild(rm[k]); } }
  }

  /* ================= model actions ================= */
  function useModel(m, noConfirm) {
    if (!m) { return; }
    var tp = modelTemplate(m);
    function doLoad() {
      S.activeModelId = m.id; S.activeExam = m.exam; S.navExam = m.exam; S.level = 3; S.selCard = null;
      S.usage[m.id] = (S.usage[m.id] || 0) + 1; UStore.set('usage', S.usage);
      loadIntoEditor(renderLines(tp.body, tp.fields, tp.critical));
      var na = insertAlways(m.exam);
      renderAll();
      if ($('repSearch').value) { repSearch(false); }
      toast('Modelo carregado: ' + m.name + (na ? ' (+ ' + na + ' frase(s) @@SEMPRE)' : ''));
    }
    doLoad();   /* never ask before replacing: Ctrl+Z undoes the load */
  }
  function examOptions(sel) {
    var a = examNames(), h = '', i;
    if (!a.length) { a = ['Meus modelos']; }
    for (i = 0; i < a.length; i++) { h += '<option' + (a[i] === sel ? ' selected' : '') + '>' + esc(a[i]) + '</option>'; }
    return h;
  }
  function modelDialog(m) {
    var isNew = !m;
    var body = '<label>Nome do modelo<input type="text" id="mdName" value="' + esc(m ? m.name : '') + '" placeholder="Nome do modelo"></label>' +
      '<label>Exame<select id="mdExam">' + examOptions(m ? m.exam : (S.navExam || S.activeExam)) + '</select></label>' +
      '<label>Conteúdo do modelo (a 1ª linha é o título)<textarea id="mdText" placeholder="Conteúdo do modelo">' + esc(m ? modelRaw(m) : '') + '</textarea></label>' +
      (m && m.bank ? '<p class="muted">Modelo do banco: a alteração fica salva só neste computador; o arquivo .txt não é alterado.</p>' : '');
    var btns = [];
    if (!isNew) {
      btns.push({ label: 'Excluir', cls: 'btn-danger', click: function (b) {
        return armDelete(b, function () {
          if (m.user) { S.userModels = S.userModels.filter(function (u) { return u.id !== m.id; }); UStore.set('userModels', S.userModels); }
          else { S.hidden[m.id] = 1; UStore.set('hidden', S.hidden); }
          if (S.activeModelId === m.id) { S.activeModelId = null; }
          buildModels(); renderAll(); toast('Modelo excluído.');
        });
      } });
    }
    btns.push({ label: 'Cancelar' });
    btns.push({ label: 'Salvar', cls: 'btn-primary', click: function () {
      var name = trim($('mdName').value), ex = $('mdExam').value, text = $('mdText').value, i;
      if (!name) { $('mdName').focus(); return false; }
      if (isNew) { var id = 'u:' + now(); S.userModels.push({ id: id, name: name, exam: ex, text: text }); S.selModel = id; UStore.set('userModels', S.userModels); }
      else if (m.user) {
        for (i = 0; i < S.userModels.length; i++) { if (S.userModels[i].id === m.id) { S.userModels[i].name = name; S.userModels[i].exam = ex; S.userModels[i].text = text; } }
        UStore.set('userModels', S.userModels);
      } else { S.overrides[m.id] = { name: name, text: text }; UStore.set('overrides', S.overrides); }
      buildModels(); renderAll(); toast('Modelo salvo.');
      return true;
    } });
    modal(isNew ? 'Adicionar Modelo' : 'Editar Modelo', body, btns);
  }
  function cloneModel() {
    var m = getModel(S.selModel || S.activeModelId);
    if (!m) { toast('Selecione um modelo primeiro.'); return; }
    var id = 'u:' + now();
    S.userModels.push({ id: id, name: m.name + ' (cópia)', exam: m.exam, text: modelRaw(m) });
    UStore.set('userModels', S.userModels);
    S.selModel = id; buildModels(); renderAll(); toast('Modelo clonado: ' + m.name + ' (cópia)');
  }

  /* ================= phrase actions ================= */
  function sectionOptions(sel) {
    var secs = S.navExam ? examSections(S.navExam) : [], h = '', i, has = false;
    for (i = 0; i < secs.length; i++) { if (secs[i].name === 'MINHAS FRASES') { has = true; } h += '<option' + (secs[i].name === sel ? ' selected' : '') + '>' + esc(secs[i].name) + '</option>'; }
    if (!has) { h += '<option' + (sel === 'MINHAS FRASES' ? ' selected' : '') + '>MINHAS FRASES</option>'; }
    return h;
  }
  function phraseDialog(card) {
    if (!S.navExam) { toast('Escolha um exame primeiro.'); return; }
    var isNew = !card;
    var body = '<label>Seção<select id="pdSec">' + sectionOptions(card ? card.section : null) + '</select></label>' +
      '<label>Título — pode ter (ajuda) e [Hipótese diagnóstica]<input type="text" id="pdTitle" placeholder="Título (opcional)" value="' +
      esc(card ? card.titleLine.replace(/:\s*$/, '') : '') + '"></label>' +
      '<label>Texto da frase — campos: * número, *,* decimal, ** texto, ?[opção1|opção2]<textarea id="pdBody" placeholder="Texto da frase (cole textos grandes — não serão divididos)">' +
      esc(card ? card.rawBody : '') + '</textarea></label>' +
      (card && card.bank ? '<p class="muted">Frase do banco: a alteração fica salva só neste computador; o arquivo .txt não é alterado.</p>' : '');
    var btns = [];
    if (!isNew) {
      btns.push({ label: 'Excluir', cls: 'btn-danger', click: function (b) {
        return armDelete(b, function () {
          if (card.user) { S.userPhrases = S.userPhrases.filter(function (u) { return u.id !== card.id; }); UStore.set('userPhrases', S.userPhrases); }
          else { S.hidden[card.id] = 1; UStore.set('hidden', S.hidden); }
          S.selCard = null; renderNav(); toast('Frase excluída.');
        });
      } });
    }
    btns.push({ label: 'Cancelar' });
    btns.push({ label: 'Salvar', cls: 'btn-primary', click: function () {
      var t = trim($('pdTitle').value), b = $('pdBody').value, sec = $('pdSec').value, i;
      if (!trim(b)) { $('pdBody').focus(); return false; }
      if (!t) { t = trim(b.split('\n')[0]).substring(0, 40); }
      if (isNew) { S.userPhrases.push({ id: 'up:' + now(), exam: S.navExam, section: sec, titleLine: t + ':', body: b }); UStore.set('userPhrases', S.userPhrases); }
      else if (card.user) {
        for (i = 0; i < S.userPhrases.length; i++) { if (S.userPhrases[i].id === card.id) { S.userPhrases[i].titleLine = t + ':'; S.userPhrases[i].body = b; S.userPhrases[i].section = sec; } }
        UStore.set('userPhrases', S.userPhrases);
      } else { S.overrides[card.id] = { titleLine: t + ':', body: b }; UStore.set('overrides', S.overrides); }
      renderNav(); toast('Frase salva.');
      return true;
    } });
    modal(isNew ? 'Adicionar Frase' : 'Editar Frase', body, btns);
  }
  function simpleImport(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n'), out = [], cur = null, i, L, t;
    function flush() { if (cur) { cur.body = cur.lines.join('\n').replace(/^(\s*\n)+|(\n\s*)+$/g, ''); if (trim(cur.body)) { out.push(cur); } } cur = null; }
    for (i = 0; i < lines.length; i++) {
      L = lines[i]; t = trim(L);
      if (t && /:$/.test(t) && t.length <= 200) { flush(); cur = { titleLine: t, lines: [] }; continue; }
      if (!cur) { if (!t) { continue; } cur = { titleLine: t.substring(0, 40) + ':', lines: [] }; }
      cur.lines.push(L);
    }
    flush();
    return out;
  }
  function importItems(text) {
    if (/^\s*(@@EXAME|##SECTION)/m.test(text)) {
      var r = UltraParser.parse(text), out = [], e, s, p;
      for (e = 0; e < r.exams.length; e++) {
        for (s = 0; s < r.exams[e].sections.length; s++) {
          var sec = r.exams[e].sections[s];
          for (p = 0; p < sec.phrases.length; p++) {
            out.push({ exam: findExam(r.exams[e].name) ? r.exams[e].name : null, section: sec.name, titleLine: sec.phrases[p].rawTitle, body: sec.phrases[p].rawBody });
          }
        }
      }
      return { full: true, items: out };
    }
    return { full: false, items: simpleImport(text) };
  }
  function importDialog() {
    if (!S.navExam) { toast('Escolha um exame primeiro.'); return; }
    var body = '<p class="muted">Cole o texto. Cada linha terminada em ":" é o título da frase seguinte. ' +
      'Também aceita o formato completo do banco (@@EXAME / ##SECTION).</p>' +
      '<label>Seção de destino (formato simples)<select id="imSec">' + sectionOptions('MINHAS FRASES') + '</select></label>' +
      '<textarea id="imText" placeholder="Título da frase:&#10;Texto da frase aqui...&#10;&#10;Outro título:&#10;Outro texto..."></textarea>' +
      '<button type="button" class="btn" id="imPrev">Pré-visualizar</button><div id="imOut" class="preview" hidden></div>';
    modal('Importar Frases', body, [
      { label: 'Cancelar' },
      { label: 'Importar', cls: 'btn-primary', click: function () {
        var res = importItems($('imText').value), sec = $('imSec').value, i, it;
        if (!res.items.length) { toast('Nenhuma frase reconhecida.'); return false; }
        for (i = 0; i < res.items.length; i++) {
          it = res.items[i];
          S.userPhrases.push({ id: 'up:' + now() + '-' + i, exam: res.full ? (it.exam || S.navExam) : S.navExam,
            section: res.full ? it.section : sec, titleLine: it.titleLine, body: it.body });
        }
        UStore.set('userPhrases', S.userPhrases); renderNav();
        toast(res.items.length + ' frase(s) importada(s).');
        return true;
      } }
    ]);
    on($('imPrev'), 'click', function () {
      var res = importItems($('imText').value), h = '<p><b>' + res.items.length + ' frase(s)</b>' + (res.full ? ' (formato completo do banco)' : '') + '</p>', i;
      for (i = 0; i < res.items.length && i < 200; i++) {
        h += '<div><span class="t">' + esc(res.items[i].titleLine) + '</span>' + (res.full ? ' <span class="muted">[' + esc(res.items[i].section) + ']</span>' : '') +
          '<div class="muted">' + esc(res.items[i].body.substring(0, 160)) + '</div></div>';
      }
      $('imOut').innerHTML = h; $('imOut').hidden = false;
    });
  }

  /* ================= settings ================= */
  var SET_IDS = ['paperDark', 'hypUnderline', 'blockCopy', 'dragInReport', 'autoNextSec', 'dragReorder', 'sortByUsage', 'showUsage', 'normPunct', 'normSymbols', 'ascii', 'warnFields'];
  function readSettingsForm() {
    var st = S.settings, k, r;
    for (k = 0; k < SET_IDS.length; k++) { st[SET_IDS[k]] = $('st_' + SET_IDS[k]).checked; }
    r = document.getElementsByName('st_eol'); for (k = 0; k < r.length; k++) { if (r[k].checked) { st.eol = r[k].value; } }
    r = document.getElementsByName('st_theme'); for (k = 0; k < r.length; k++) { if (r[k].checked) { st.theme = r[k].value; } }
    applyTheme(); saveSettings(); renderAll();
  }
  function settingsDialog() {
    var st = S.settings;
    function cb(id, label) { return '<label class="chk"><input type="checkbox" id="st_' + id + '"' + (st[id] ? ' checked' : '') + '> ' + label + '</label>'; }
    function th(val, label) { return '<label class="chk"><input type="radio" name="st_theme" value="' + val + '"' + ((st.theme || 'light') === val ? ' checked' : '') + '> ' + label + '</label>'; }
    function rd(val, label) { return '<label class="chk"><input type="radio" name="st_eol" value="' + val + '"' + (st.eol === val ? ' checked' : '') + '> ' + label + '</label>'; }
    var allI = allIssues(), n = allI.length, bySev = {}, ii;
    for (ii = 0; ii < n; ii++) { bySev[allI[ii].severity] = (bySev[allI[ii].severity] || 0) + 1; }
    var body = '<fieldset><legend>Modelos</legend>' +
      cb('dragReorder', 'Reordenar modelos arrastando') +
      cb('sortByUsage', 'Ordenar por frequência de uso') +
      cb('showUsage', 'Exibir contador de uso (n)') + '</fieldset>' +
      '<fieldset><legend>Navegação</legend>' + cb('autoNextSec', 'Ao inserir frase, fechar a seção e abrir a próxima') + '</fieldset>' +
      '<fieldset><legend>Copiar / Gerar (sempre texto simples)</legend>' +
      cb('normPunct', 'Trocar aspas curvas, travessões e marcadores (•) por caracteres simples') +
      cb('normSymbols', 'Trocar símbolos (³ ² ≥ ≤ ± ×) por texto') +
      cb('ascii', 'Modo ASCII: remover acentos (só para sistemas antigos)') +
      cb('warnFields', 'Avisar quando houver campos não preenchidos') +
      '<div>Quebras de linha:</div>' + rd('crlf', 'Windows (padrão)') + rd('lf', 'Unix') + rd('single', 'Tudo em uma linha') + '</fieldset>' +
      '<fieldset><legend>Laudo</legend>' + cb('hypUnderline', 'Sublinhar o título "Hipótese/Impressão diagnóstica:"') +
      cb('blockCopy', 'Bloquear copiar/recortar/arrastar para fora do laudo (só o botão Copiar copia)') +
      cb('dragInReport', 'Permitir arrastar texto selecionado dentro do laudo') + '</fieldset>' +
      '<fieldset><legend>Aparência</legend><div class="chk-row">Tema: ' + th('light', 'Claro') + th('dark', 'Escuro') + th('system', 'Seguir o sistema') + '</div>' +
      cb('paperDark', 'Laudo escuro também (a folha do laudo fica escura no tema escuro; impressão e cópia não mudam)') + '</fieldset>' +
      '<fieldset><legend>Banco de frases</legend><p>' + (S.bank ? esc(S.bankName || 'banco') + ': ' + S.bank.stats.exams + ' exames, ' + S.bank.stats.templates +
        ' modelos, ' + S.bank.stats.phrases + ' frases. ' + n + ' item(ns) no relatório' + (function (b) { return n ? ' (' + (b.erro || 0) + ' erro(s), ' + (b.aviso || 0) + ' aviso(s), ' + (b.info || 0) + ' informativo(s))' : ''; })(bySev) + '.' : 'Nenhum banco carregado.') + '</p>' +
      '<div class="btnrow"><label class="btn btn-file">' + (S.bank ? 'Trocar arquivo' : 'Escolher arquivo') + '<input type="file" id="bankFile1" accept=".txt,text/plain"></label>' +
      (S.bank ? '<button type="button" class="btn" id="stIssues">Ver relatório de inconsistências</button>' : '') + '</div>' +
      '<p class="muted">Armazenamento: ' + (UStore.persistent() ? 'navegador (localStorage)' : 'somente memória — será perdido ao fechar') + '.</p></fieldset>';
    modal('Configurações', body, [{ label: 'Fechar', cls: 'btn-primary', focus: true, click: function () { readSettingsForm(); } }]);
    if ($('stIssues')) { on($('stIssues'), 'click', function () { readSettingsForm(); issuesDialog(); }); }
    var thr = document.getElementsByName('st_theme'), tq;
    for (tq = 0; tq < thr.length; tq++) { on(thr[tq], 'change', function () { S.settings.theme = this.value; applyTheme(); saveSettings(); }); }
    on($('st_paperDark'), 'change', function () { S.settings.paperDark = this.checked; applyTheme(); saveSettings(); });
    on($('bankFile1'), 'change', function () { var f = this.files && this.files[0]; if (f) { readSettingsForm(); closeModal(); loadBankFile(f); } });
  }
  /* ---- Relatório de inconsistências ---- */
  /* plain-Portuguese explanation of each type + whether he needs to act (c = corrigir, r = revisar, n = nada) */
  var ISSUE_HELP = {
    DIRECTIVE_UNKNOWN: ['c', 'Linha começa com @@ ou ## mas não é uma diretiva conhecida. Ela não faz nada e aparece como texto.'],
    DIRECTIVE_TYPO: ['c', 'Nome da diretiva digitado errado (ex.: @@SUBTITUI). Não funciona: corrija o nome.'],
    DIRECTIVE_NO_NAME: ['c', 'Diretiva sem o nome depois dela (ex.: "@@EXAME" sozinho).'],
    DIRECTIVE_EMPTY_TARGET: ['c', '@@SUBSTITUI ou @@ABAIXO_DE sem dizer qual linha. A frase vai para o lugar padrão.'],
    DIRECTIVE_MISPLACED: ['r', 'Diretiva num lugar onde não tem efeito, ou depois do texto de uma frase (então vale para essa frase, não para a próxima).'],
    DIRECTIVE_DUPLICATE: ['r', 'Duas diretivas de posição para a mesma frase ou seção. Só a última vale.'],
    ALWAYS_DUPLICATE: ['r', '@@SEMPRE escrito duas vezes na mesma frase. Basta uma.'],
    DIRECTIVE_TARGET_MISSING: ['r', 'Nenhuma linha do template começa com o texto indicado na diretiva. A frase é inserida no fim da seção/laudo. Corrija o texto-alvo, ou ignore se o template realmente não tem essa linha.'],
    DIRECTIVE_SEPARATOR: ['n', 'Diretiva escrita com ":" ou "=" (ex.: "@@EXAME: X"). Funciona igual.'],
    EXAM_FULL_WITHOUT_EXAM: ['c', '@@EXAME_FULL antes de qualquer @@EXAME.'],
    EXAM_FULL_DUPLICATE: ['r', 'Dois @@EXAME_FULL no mesmo exame. Vale o último.'],
    EXAM_NO_FULL: ['r', 'Exame sem @@EXAME_FULL (título completo).'],
    EXAM_DUPLICATE: ['r', 'Dois exames com o mesmo nome.'],
    OUTSIDE_EXAM: ['c', 'Texto antes do primeiro @@EXAME. É ignorado.'],
    ORPHAN_TEXT: ['r', 'Texto solto fora de template, seção ou nota. É ignorado.'],
    TEMPLATE_EMPTY: ['c', 'Template sem texto.'],
    TEMPLATE_BRACKET_NAME: ['r', 'Nome de template com [ ]. Hipótese diagnóstica não se aplica a template.'],
    TEMPLATE_TITLE_DIFFERS: ['n', 'A 1ª linha do template não é igual ao @@EXAME_FULL. Normal em variações (ex.: "com Doppler").'],
    SECTION_DUPLICATE: ['n', 'Seção com frases declarada mais de uma vez no mesmo exame. As frases são unidas.'],
    SECTION_RESERVED: ['n', 'Seção vazia, sem frases em lugar nenhum. Fica reservada para frases futuras.'],
    TEXT_BEFORE_FIRST_PHRASE: ['c', 'Texto dentro da seção antes do primeiro título de frase (linha terminada em ":"). Não pertence a nenhuma frase.'],
    PHRASE_EMPTY: ['c', 'Título de frase sem texto embaixo.'],
    PHRASE_DUPLICATE_TITLE: ['r', 'Dois títulos de frase iguais na mesma seção. Difícil distinguir na lista.'],
    TITLE_MULTI_BRACKET: ['r', 'Título com mais de um [ ]. Só o primeiro vira hipótese.'],
    TITLE_UNBALANCED: ['c', 'Título com ( ) ou [ ] sem fechar.'],
    HYPOTHESIS_PIPE: ['r', 'Hipótese [ ] com "|".'],
    TITLE_LIKE_IN_BODY: ['r', 'Linha terminada em ":" colada ao texto (sem linha em branco antes). Fica como texto da frase anterior, não vira frase nova. Se era para ser título de outra frase, ponha uma linha em branco antes.'],
    CRITICAL_LINE: ['n', 'Linha com *** no início: o app pede revisão antes de copiar. Só informativo.'],
    EXAMPLE_BLOCK_SKIPPED: ['n', 'Bloco de exemplo/instruções do início do arquivo, ignorado de propósito.'],
    DIRECTIVE_IN_NOTE: ['n', 'Diretiva dentro das notas globais, tratada como texto da nota.'],
    STAR_RUN: ['r', '3 ou mais asteriscos no meio da linha.'],
    STAR_ADJACENT: ['r', 'Asterisco colado a uma letra (ex.: *OU*): pode virar campo sem querer.'],
    LEGACY_BULLET: ['n', 'Marcador • do formato antigo. Aparece como texto normal.'],
    LEGACY_PIPE: ['r', '"|" fora de ?[ ]: parece opção do formato antigo e não vira lista de escolha.'],
    LEGACY_SLASH: ['n', '"a / b" fora de ?[ ]: talvez fosse uma escolha. Aparece como texto.'],
    DROPDOWN_UNCLOSED: ['c', '?[ sem o ] de fechamento.'],
    DROPDOWN_MULTILINE: ['r', '?[ ] que ocupa mais de uma linha.'],
    DROPDOWN_NESTED: ['n', '?[ ] dentro de outro ?[ ]. O app aceita: depois de escolher a opção, o ?[ ] de dentro vira um novo campo.'],
    DROPDOWN_EMPTY_OPTION: ['r', 'Opção vazia em ?[ ] (ex.: "a||b").'],
    DROPDOWN_SINGLE: ['r', '?[ ] com uma única opção.'],
    STRAY_BRACKET: ['n', '[ ou ] solto no texto. Aparece como texto.']
  };
  var ISSUE_NOISE = { SECTION_RESERVED: 1, LEGACY_BULLET: 1, CRITICAL_LINE: 1, TEMPLATE_TITLE_DIFFERS: 1, STRAY_BRACKET: 1, LEGACY_SLASH: 1, DIRECTIVE_SEPARATOR: 1, EXAMPLE_BLOCK_SKIPPED: 1 };
  var ACT_LABEL = { c: 'corrigir', r: 'revisar', n: 'nenhuma ação' };
  var issueView = { erro: true, aviso: true, info: false, noise: false };
  /* @@SUBSTITUI / @@ABAIXO_DE whose target line is not in the exam's templates (rendered off-screen, same matching as the app) */
  function directiveTargetIssues() {
    var out = [], ex = examNames(), e, i, j, k, byKey = {}, order = [];
    var tdef = UltraParser.ISSUE_TYPES.DIRECTIVE_TARGET_MISSING;
    for (e = 0; e < ex.length; e++) {
      if (ex[e] === UltraParser.GLOBAL_EXAM) { continue; }
      var ms = sortedModels().filter(function (m) { return m.exam === ex[e] && !m.user; });
      if (!ms.length) { continue; }
      var secs = examSections(ex[e]), tl = [];
      for (k = 0; k < ms.length; k++) {
        var tp = modelTemplate(ms[k]), box = document.createElement('div');
        box.innerHTML = renderLines(tp.body, tp.fields, tp.critical);
        var ls = qsa(box, 'div,p'), lines = [];
        for (i = 0; i < ls.length; i++) { if (!ls[i].querySelector('div,p')) { lines.push(ls[i]); } }
        tl.push({ name: ms[k].name, lines: lines });
      }
      for (i = 0; i < secs.length; i++) {
        for (j = 0; j < secs[i].cards.length; j++) {
          var c = secs[i].cards[j];
          if (c.user) { continue; }
          var ps = [[c.secPlace, ''], [c.ph && c.ph.place, c.ph ? c.ph.title : '']], q;
          for (q = 0; q < ps.length; q++) {
            var pd = ps[q][0], rule = pd && directiveRule(pd); if (!rule) { continue; }
            var key = pd.line + '|' + secs[i].name + '|' + (q ? ps[q][1] : '');
            var agg = byKey[key];
            if (!agg) { agg = byKey[key] = { pd: pd, sec: secs[i].name, ph: q ? ps[q][1] : '', hit: 0, all: [], some: [], seen: {} }; order.push(key); }
            if (agg.seen[ex[e]]) { continue; }
            agg.seen[ex[e]] = 1;
            var miss = [];
            for (k = 0; k < tl.length; k++) {
              var found = false, z;
              for (z = 0; z < tl[k].lines.length && !found; z++) { found = anchorHits(rule.anchor, tl[k].lines[z]); }
              if (found) { agg.hit++; } else { miss.push(tl[k].name); }
            }
            if (miss.length === tl.length) { agg.all.push(ex[e]); } else if (miss.length) { agg.some.push(ex[e] + ': ' + miss.join(', ')); }
          }
        }
      }
    }
    function item(g, sev, msg, miss) {
      out.push({ type: 'DIRECTIVE_TARGET_MISSING', severity: sev, line: g.pd.line, message: msg, miss: miss,
        text: (g.pd.mode === 'replaceLine' ? '@@SUBSTITUI = ' : '@@ABAIXO_DE = ') + g.pd.text,
        exam: '', tpl: '', sec: g.sec, ph: g.ph || '(diretiva da seção)', where: '' });
    }
    for (i = 0; i < order.length; i++) {
      var g = byKey[order[i]];
      if (g.all.length) { item(g, tdef[0], tdef[1], 'nenhum template destes exames tem essa linha: ' + g.all.join(', ')); }
      if (g.some.length) { item(g, 'info', 'Alvo da diretiva ausente só em alguns templates do exame (normal em variações, ex.: histerectomia)', 'sem o alvo em: ' + g.some.join('; ')); }
    }
    return out;
  }
  function allIssues() {
    if (!S.bank) { return []; }
    if (!S.bank._dirIssues) { try { S.bank._dirIssues = directiveTargetIssues(); } catch (e) { S.bank._dirIssues = []; } }
    return S.bank.issues.concat(S.bank._dirIssues);
  }
  function issuePath(it) {
    var p = it.type === 'DIRECTIVE_TARGET_MISSING' ? [] : [it.exam || '(sem exame)'];
    if (it.tpl) { p.push(it.tpl); }
    if (it.sec) { p.push(it.sec); }
    if (it.ph) { p.push(it.ph); }
    if (!it.tpl && !it.sec && it.where) { p.push(it.where); }
    return p.join(' \u203A ');
  }
  function groupIssues(list) {   /* -> [{sev, types:[{type, items}]}] in severity order */
    var sevs = ['erro', 'aviso', 'info'], out = [], i, j;
    for (i = 0; i < sevs.length; i++) {
      var types = {}, order = [];
      for (j = 0; j < list.length; j++) {
        var it = list[j]; if (it.severity !== sevs[i]) { continue; }
        var tk = it.type === 'DIRECTIVE_TARGET_MISSING' ? it.type + ':' + it.severity : it.type;
        if (!types[tk]) { types[tk] = []; order.push(tk); }
        types[tk].push(it);
      }
      order.sort(function (a, b) { return types[b].length - types[a].length; });
      var g = { sev: sevs[i], types: [] };
      for (j = 0; j < order.length; j++) { types[order[j]].sort(function (a, b) { return a.line - b.line; }); g.types.push({ type: order[j].split(':')[0], items: types[order[j]] }); }
      out.push(g);
    }
    return out;
  }
  var SEV_LABEL = { erro: 'Erros', aviso: 'Avisos', info: 'Informativos' };
  function issueVisible(it) {
    if (!issueView[it.severity]) { return false; }
    return !(it.severity === 'info' && ISSUE_NOISE[it.type] && !issueView.noise);
  }
  function typeTitle(t, items) { var d = UltraParser.ISSUE_TYPES[t]; return (items[0] && items[0].message && t === 'DIRECTIVE_TARGET_MISSING') ? items[0].message : (d ? d[1] : t); }
  function issuesText(list) {
    var g = groupIssues(list), t = 'Relatório de inconsistências - ' + (S.bankName || 'banco') + '\r\n', i, j, k;
    for (i = 0; i < g.length; i++) {
      if (!g[i].types.length) { continue; }
      var n = 0; for (j = 0; j < g[i].types.length; j++) { n += g[i].types[j].items.length; }
      t += '\r\n== ' + SEV_LABEL[g[i].sev].toUpperCase() + ' (' + n + ') ==\r\n';
      for (j = 0; j < g[i].types.length; j++) {
        var ty = g[i].types[j], h = ISSUE_HELP[ty.type];
        t += '\r\n' + ty.type + ' (' + ty.items.length + '): ' + typeTitle(ty.type, ty.items) + '\r\n';
        if (h) { t += '  ' + h[1] + ' [Ação: ' + ACT_LABEL[h[0]] + ']\r\n'; }
        for (k = 0; k < ty.items.length; k++) {
          var it = ty.items[k];
          t += '  - linha ' + it.line + ': ' + issuePath(it) + '\r\n      ' + trim(String(it.text || '')).substring(0, 160) + '\r\n';
          if (it.miss) { t += '      (' + it.miss + ')\r\n'; }
          if (it.message && it.message !== typeTitle(ty.type, ty.items) && ty.type !== 'DIRECTIVE_TARGET_MISSING') { t += '      (' + it.message + ')\r\n'; }
        }
      }
    }
    return t;
  }
  function issuesDialog() {
    var all = allIssues(), cnt = { erro: 0, aviso: 0, info: 0 }, noiseN = 0, i;
    for (i = 0; i < all.length; i++) { cnt[all[i].severity] = (cnt[all[i].severity] || 0) + 1; if (all[i].severity === 'info' && ISSUE_NOISE[all[i].type]) { noiseN++; } }
    function chk(id, k, label) { return '<label class="chk"><input type="checkbox" id="' + id + '"' + (issueView[k] ? ' checked' : '') + '> ' + label + '</label>'; }
    var head = '<div class="iss-bar">' + chk('isErr', 'erro', 'Erros (' + cnt.erro + ')') + chk('isWarn', 'aviso', 'Avisos (' + cnt.aviso + ')') +
      chk('isInfo', 'info', 'Informativos (' + cnt.info + ')') +
      '<span id="isNoiseW">' + chk('isNoise', 'noise', 'incluir os ' + noiseN + ' informativos de rotina') + '</span>' +
      '<button type="button" class="btn" id="isCopy">Copiar como texto</button></div>' +
      '<p class="muted iss-legend">Linha = número da linha no .txt. Caminho: exame \u203A template \u203A seção \u203A frase.</p><div id="isList"></div>';
    modal('Relatório de inconsistências do banco', head, [{ label: 'Fechar', cls: 'btn-primary', focus: true }]);
    function render() {
      var vis = all.filter(issueVisible), g = groupIssues(vis), h = '', j, k, q;
      $('isNoiseW').style.display = issueView.info ? '' : 'none';
      for (j = 0; j < g.length; j++) {
        if (!g[j].types.length) { continue; }
        var n = 0; for (k = 0; k < g[j].types.length; k++) { n += g[j].types[k].items.length; }
        h += '<h3 class="iss-sev">' + SEV_LABEL[g[j].sev] + ' (' + n + ')</h3>';
        for (k = 0; k < g[j].types.length; k++) {
          var ty = g[j].types[k], hp = ISSUE_HELP[ty.type];
          h += '<div class="iss-type"><div class="iss-th"><b>' + esc(typeTitle(ty.type, ty.items)) + '</b> <span class="muted">(' + ty.items.length + ') ' + esc(ty.type) + '</span>' +
            (hp ? '<span class="iss-act iss-' + hp[0] + '">' + ACT_LABEL[hp[0]] + '</span>' : '') + '</div>' +
            (hp ? '<div class="iss-help">' + esc(hp[1]) + '</div>' : '') + '<ul class="iss-items">';
          for (q = 0; q < ty.items.length; q++) {
            var it = ty.items[q];
            h += '<li><span class="iss-ln">linha ' + it.line + '</span> ' + esc(issuePath(it)) +
              '<div class="iss-txt">' + esc(trim(String(it.text || '')).substring(0, 220)) + '</div>' +
              (it.miss ? '<div class="iss-msg">' + esc(it.miss) + '</div>' : '') +
              (it.message && it.message !== typeTitle(ty.type, ty.items) && ty.type !== 'DIRECTIVE_TARGET_MISSING' ? '<div class="iss-msg">' + esc(it.message) + '</div>' : '') + '</li>';
          }
          h += '</ul></div>';
        }
      }
      if (!h) { h = '<p>Nada a mostrar com os filtros escolhidos' + (cnt.erro + cnt.aviso === 0 ? ': nenhum erro e nenhum aviso.' : '.') + '</p>'; }
      $('isList').innerHTML = h;
      $('modal').scrollTop = 0;
    }
    function bind(id, k) { on($(id), 'change', function () { issueView[k] = this.checked; render(); }); }
    bind('isErr', 'erro'); bind('isWarn', 'aviso'); bind('isInfo', 'info'); bind('isNoise', 'noise');
    on($('isCopy'), 'click', function () {
      copyPlain(issuesText(all.filter(issueVisible)), function (ok) { toast(ok ? 'Relatório copiado (itens visíveis).' : 'Não foi possível copiar.'); });
    });
    render();
    setTimeout(function () { $('modal').scrollTop = 0; }, 0);
    setTimeout(function () { $('modal').scrollTop = 0; }, 30);
  }
  /* theme: 'light' | 'dark' | 'system' (prefers-color-scheme, followed live). Class-based; IE11 (no CSS
     variables) simply stays light. The report paper stays white unless paperDark. */
  var darkMQ = null;
  try { darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch (eMq) { darkMQ = null; }
  S.darkMQ = darkMQ;   /* keep a reference: an unreferenced MediaQueryList can be garbage-collected with its listener */
  if (darkMQ) { var mqf = function () { if (S.settings.theme === 'system') { applyTheme(); } };
    if (darkMQ.addEventListener) { darkMQ.addEventListener('change', mqf); } else if (darkMQ.addListener) { darkMQ.addListener(mqf); } }
  /* a background tab may miss the change event: re-check when the tab comes back */
  if (window.addEventListener) {
    window.addEventListener('focus', function () { if (S.settings.theme === 'system') { applyTheme(); } }, false);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.settings.theme === 'system') { applyTheme(); } }, false);
  }
  function isDark() { var t = S.settings.theme, m = false; if (t === 'system') { try { m = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { m = false; } } return t === 'dark' || m; }
  function applyTheme() {
    var d = isDark();
    document.body.className = (d ? 'theme-dark' : 'theme-light') + (d && S.settings.paperDark ? ' paper-dark' : '') + (S.settings.hypUnderline ? ' hyp-ul' : '');
  }

  /* ================= layout: column widths, right panel ================= */
  function applyLayout() {
    var st = S.settings, maxL = Math.max(200, Math.floor(window.innerWidth * 0.45));
    st.leftW = Math.max(200, Math.min(maxL, st.leftW || 260));
    st.rightW = Math.max(280, Math.min(480, st.rightW || 340));
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
    });
  }
  on($('bankFile0'), 'change', function () { var f = this.files && this.files[0]; if (f) { loadBankFile(f); } this.value = ''; });
  on($('btnSettings'), 'click', settingsDialog);


  /* navigator events */
  var navList = $('navList');
  function navCard(t) { return closest(t, function (n) { return hasCls(n, 'card'); }, navList); }
  on($('navBack'), 'click', navBack);
  on($('crumb'), 'click', function (e) { var a = closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-go') !== null; }); if (a) { goLevel(parseInt(a.getAttribute('data-go'), 10)); } });
  /* exam double-click, detected manually: the 1st click re-renders the list (level 2),
     so the 2nd click / dblclick lands on a different element */
  var lastExamClick = null, examDblAt = 0, DBL_MS = 600;
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
  on(navList, 'click', function (e) {
    var c = navCard(e.target);
    if (inExamDbl()) { e.preventDefault(); examDouble(); return; }
    if (!c) { return; }
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
  window.UFTest = { S: S, removeGroup: removeGroup, critGroups: critGroups, critState: critState, examNames: examNames, examSections: examSections, sortedModels: sortedModels, useModel: useModel,
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
  var phTip = document.createElement('div'); phTip.id = 'phTip'; phTip.className = 'phtip'; phTip.style.display = 'none'; document.body.appendChild(phTip);
  var tipFor = null;
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
  /* current template crumb: single click reloads; the 2nd click of a double click is ignored (no double reload) */
  var crumbAt = 0;
  on($('crumb'), 'click', function (e) {
    var a = closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-cur') !== null; });
    if (!a) { return; }
    if ((e.detail || 1) > 1 && now() - crumbAt < 800) { return; }
    crumbAt = now(); useModel(getModel(a.getAttribute('data-cur')), true);
  });
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
    if (k === 8 && !this.value) { e.preventDefault(); navBack(); }
  });
  on($('navSearch'), 'input', function () { S.navSearch[S.level - 1] = this.value; saveSearch(); renderNav(); });
  function clearNavSearch() { var si = $('navSearch'); si.value = ''; S.navSearch[S.level - 1] = ''; saveSearch(); renderNav(); si.focus(); }
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
    else if (id === 'tPIns') { if (S.selCard) { insertCard(S.selCard); } else { toast('Selecione uma frase.'); } }
  });
  var dragId = null;
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
    if (!$('popup').hidden && !closest(e.target, function (n) { return n.id === 'popup'; })) { closePopup(); }
  });

  /* editor */
  on(editor, 'keyup', function (e) { var k = e.keyCode; if ((k >= 33 && k <= 40) || k === 13 || k === 8 || k === 46 || k > 47) { S.userCaret = true; } saveRange(); afterChange(false); });
  on(editor, 'mouseup', function () { S.userCaret = true; saveRange(); });
  on(editor, 'input', function () { afterChange(false); });
  on(editor, 'blur', saveRange);
  on(document, 'selectionchange', function () { if (document.activeElement === editor) { saveRange(); } });
  on(editor, 'click', function (e) {
    var chip = closest(e.target, function (n) { return hasCls(n, 'fld') && n.getAttribute('data-t') === 's'; }, editor);
    if (chip) { var r = document.createRange(); r.selectNode(chip); setRange(r); saveRange(); openSelect(chip); }
  });
  on(editor, 'input', function () { S.lastChoice = null; S.lastRemoval = null; });
  on(editor, 'keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.keyCode === 90 && (S.lastChoice || S.lastRemoval)) {
      if (!S.lastChoice) { e.preventDefault(); undoRemoval(); return; }
      var lc = S.lastChoice; S.lastChoice = null;
      if (editor.contains(lc.el)) { e.preventDefault(); replaceNodeWithHtml(lc.el, lc.html); afterChange(false); return; }
    }
    if (e.keyCode === 9) { if (nextField(e.shiftKey)) { e.preventDefault(); } return; }
    if (e.keyCode === 13) {
      /* Enter on an empty field just moves on (never replaces the field with a line break) */
      var sel = window.getSelection(), r = sel.rangeCount ? sel.getRangeAt(0) : null;
      var chip = r ? closest(r.startContainer, function (n) { return hasCls(n, 'fld'); }, editor) : null;
      if (chip) {   /* Enter confirms the field and jumps to the next unfilled one */
        e.preventDefault();
        if (!nextField(false, true)) { caretAfterChip(chip); }
        afterChange(false); return;
      }
    }
    if (S.repMarks.length) { clearRepMarks(); }
  });
  /* caret as plain text right after a chip: typing must not merge into the field value */
  var chipExit = null;
  function caretAfterChip(chip) {
    var n = chip.nextSibling;
    if (!n || n.nodeType !== 3) { n = document.createTextNode(''); chip.parentNode.insertBefore(n, chip.nextSibling); }
    var ra = document.createRange(); ra.setStart(n, 0); ra.collapse(true); setRange(ra); saveRange();
    chipExit = chip;
  }
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
  on(editor, 'paste', function (e) {
    var t = null;
    if (e.clipboardData && e.clipboardData.getData) { t = e.clipboardData.getData('text/plain'); }
    else if (window.clipboardData) { t = window.clipboardData.getData('Text'); }
    if (t === null || t === undefined) { return; }
    e.preventDefault();
    if (!exec('insertText', t)) {
      var sel = window.getSelection(); if (!sel.rangeCount) { return; }
      var r = sel.getRangeAt(0); r.deleteContents(); var tn = document.createTextNode(t); r.insertNode(tn);
      r.setStartAfter(tn); r.collapse(true); setRange(r);
    }
    afterChange(false);
  });
  function selectionPlain() {
    var sel = window.getSelection(); if (!sel.rangeCount) { return ''; }
    var div = document.createElement('div'); div.appendChild(sel.getRangeAt(0).cloneContents());
    var lines = textLines(div, '___'), i; for (i = 0; i < lines.length; i++) { lines[i] = normalize(lines[i]); }
    return lines.join(S.settings.eol === 'lf' ? '\n' : '\r\n');
  }
  /* copy/cut out of the report is blocked (critical-line review must not be bypassed): only the Copiar button copies */
  var COPY_MSG = 'Para copiar o laudo use o botão Copiar.';
  function selInEditor() {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || !sel.rangeCount) { return false; }
    var r = sel.getRangeAt(0);
    return editor.contains(r.startContainer) || editor.contains(r.endContainer) || r.commonAncestorContainer === editor;
  }
  function blockCopy(e) {
    if (!S.settings.blockCopy) { return; }
    if (e.target !== editor && !editor.contains(e.target) && !selInEditor()) { return; }
    if (e.preventDefault) { e.preventDefault(); } e.returnValue = false;
    if (e.clipboardData && e.clipboardData.setData) { try { e.clipboardData.setData('text/plain', ''); } catch (x) {} }
    toast(COPY_MSG);
    return false;
  }
  on(document, 'copy', blockCopy);
  on(document, 'cut', blockCopy);
  /* drag: never carries text out of the report. With dragInReport on, a drag inside the report moves the
     selection (done by the app itself: the drag payload is emptied, so a drop elsewhere receives nothing). */
  var dragSrc = null;
  function stopEv(e) { if (e.preventDefault) { e.preventDefault(); } e.returnValue = false; return false; }
  function caretAt(x, y) {
    if (document.caretRangeFromPoint) { return document.caretRangeFromPoint(x, y); }
    if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y); if (!cp) { return null; } var r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); return r; }
    return null;
  }
  var nativeDrag = false;
  on(editor, 'dragstart', function (e) {
    var sel = window.getSelection();
    nativeDrag = false;
    if (!S.settings.blockCopy) { dragSrc = null; nativeDrag = true; return; }   /* blocking off: normal browser drag (in and out) */
    if (!S.settings.dragInReport || !(document.caretRangeFromPoint || document.caretPositionFromPoint) || !sel.rangeCount || sel.getRangeAt(0).collapsed) { dragSrc = null; return stopEv(e); }
    dragSrc = sel.getRangeAt(0).cloneRange();
    var dt = e.dataTransfer;
    try { dt.clearData(); } catch (x1) {}
    try { dt.setData('text/x-uf-move', '1'); } catch (x2) { try { dt.setData('Text', ''); } catch (x3) {} }
    try { dt.effectAllowed = 'move'; } catch (x4) {}
  });
  on(document, 'dragend', function () { dragSrc = null; nativeDrag = false; });
  /* blocking off + internal drag off: a drag that started in the report may not be dropped back into it */
  function nativeGuard(e) { if (nativeDrag && !S.settings.dragInReport && (editor.contains(e.target) || e.target === editor)) { try { e.dataTransfer.dropEffect = 'none'; } catch (x) {} return stopEv(e); } }
  on(editor, 'dragover', nativeGuard); on(editor, 'drop', nativeGuard);
  function dragOver(e) {
    if (!dragSrc) { return; }
    var inside = editor.contains(e.target) || e.target === editor;
    try { e.dataTransfer.dropEffect = inside ? 'move' : 'none'; } catch (x) {}
    if (inside) { stopEv(e); }   /* the report accepts our own (empty-payload) move */
  }
  on(document, 'dragover', dragOver, true);
  on(document, 'dragenter', dragOver, true);
  on(document, 'drop', function (e) {
    if (!dragSrc) { return; }
    var src = dragSrc; dragSrc = null;
    stopEv(e);
    if (!editor.contains(e.target) && e.target !== editor) { return; }
    var dr = caretAt(e.clientX, e.clientY);
    if (!dr || !editor.contains(dr.startContainer)) { return; }
    if (src.compareBoundaryPoints(Range.START_TO_START, dr) <= 0 && src.compareBoundaryPoints(Range.END_TO_END, dr) >= 0) { return; }   /* dropped onto itself */
    var html = (function () { var d = document.createElement('div'); d.appendChild(src.cloneContents()); return d.innerHTML; })();
    var mk = document.createElement('span'); mk.id = 'ufDropMk'; dr.insertNode(mk);
    focusEditor(); setRange(src); exec('delete');
    mk = $('ufDropMk'); if (!mk) { afterChange(false); return; }
    var r = document.createRange(); r.setStartBefore(mk); r.collapse(true); mk.parentNode.removeChild(mk); setRange(r);
    if (!exec('insertHTML', html)) { var tmp = document.createElement('div'), f = document.createDocumentFragment(); tmp.innerHTML = html; while (tmp.firstChild) { f.appendChild(tmp.firstChild); } r.insertNode(f); }
    saveRange(); afterChange(false);
  }, true);
  on(editor, 'keydown', function (e) {
    var k = e.keyCode, c = e.ctrlKey || e.metaKey;
    if (!S.settings.blockCopy) { return; }
    if ((c && !e.shiftKey && !e.altKey && (k === 67 || k === 88)) || (c && k === 45) || (e.shiftKey && !c && k === 46)) {
      e.preventDefault(); toast(COPY_MSG);
    }
  });
  var tbs = qsa($('editorToolbar'), '.tb'), ti;
  for (ti = 0; ti < tbs.length; ti++) {
    on(tbs[ti], 'mousedown', function (e) { e.preventDefault(); });
    on(tbs[ti], 'click', function () { restoreRange(); exec(this.getAttribute('data-cmd')); saveRange(); afterChange(false); });
  }
  on($('btnCritCount'), 'click', jumpNextCrit);
  on($('btnFieldCount'), 'click', function () { editor.focus(); nextField(false); });
  on($('btnClear'), 'click', function () {
    confirmModal('Limpar laudo', 'Apagar todo o texto do laudo? (Ctrl+Z desfaz)', 'Limpar', function () {
      clearRepMarks(); editor.focus(); exec('selectAll'); exec('delete');
      if (trim(lineText(editor)) !== '') { editor.innerHTML = ''; }
      ensureNotEmpty(); S.activeModelId = null; renderNav(); afterChange(true);
    }, true);
  });

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
  var heldPrint = false;
  if (window.addEventListener) {
    window.addEventListener('beforeprint', function () { updatePrintHold(); heldPrint = hasCls(document.documentElement, 'print-hold'); }, false);
    window.addEventListener('afterprint', function () {
      S.printAllowed = false; updatePrintHold();
      if (heldPrint) { heldPrint = false; setTimeout(function () { toast('Impressão bloqueada: revise as linhas críticas / campos.'); output('print'); }, 0); }
    }, false);
  }


  /* splitters: mouse drag or keyboard arrows */
  var dragSplit = null;
  function startSplit(which, e) { e.preventDefault(); dragSplit = which; addCls($(which === 'L' ? 'splitL' : 'splitR'), 'drag'); }
  on($('splitL'), 'mousedown', function (e) { startSplit('L', e); });
  on($('splitR'), 'mousedown', function (e) { startSplit('R', e); });
  on(document, 'mousemove', function (e) {
    if (!dragSplit) { return; }
    if (dragSplit === 'L') { S.settings.leftW = e.clientX - $('left').getBoundingClientRect().left; }
    else { S.settings.rightW = $('right').getBoundingClientRect().right - e.clientX; }
    applyLayout();
  });
  on(document, 'mouseup', function () { if (dragSplit) { rmCls($('split' + dragSplit), 'drag'); dragSplit = null; saveSettings(); } });
  function splitKey(which) {
    return function (e) {
      var k = e.keyCode, st = S.settings, d = e.shiftKey ? 40 : 10;
      if (k !== 37 && k !== 39) { return; }
      e.preventDefault();
      if (which === 'L') { st.leftW += k === 39 ? d : -d; } else { st.rightW += k === 37 ? d : -d; }
      applyLayout(); saveSettings();
    };
  }
  on($('splitL'), 'keydown', splitKey('L'));
  on($('splitR'), 'keydown', splitKey('R'));
  on($('splitL'), 'dblclick', function () { S.settings.leftW = 260; applyLayout(); saveSettings(); });
  on($('splitR'), 'dblclick', function () { S.settings.rightW = 340; applyLayout(); saveSettings(); });
  on($('rightToggle'), 'click', function () { S.settings.rightCollapsed = !S.settings.rightCollapsed; applyLayout(); saveSettings(); });
  on(window, 'resize', applyLayout);

  /* modal: X, click outside, Esc */
  on($('modalX'), 'click', closeModal);
  on($('modalBack'), 'mousedown', function (e) { if (e.target === this) { closeModal(); } });

  /* global keys: dropdown popup + modal */
  on(document, 'keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.keyCode === 80) {   /* Ctrl+P = the app's Imprimir (with review) */
      e.preventDefault(); e.stopPropagation();
      if ($('modalBack').hidden) { output('print'); }
      return;
    }
    if (!$('popup').hidden) {
      var n = qsa($('popup'), '.opt').length;
      if (e.keyCode === 40) { e.preventDefault(); popupIdx = Math.min(n - 1, popupIdx + 1); popupKbd(); return; }
      if (e.keyCode === 38) { e.preventDefault(); popupIdx = Math.max(0, popupIdx - 1); popupKbd(); return; }
      if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); chooseOption(popupIdx); return; }
      if (e.keyCode === 9) { e.preventDefault(); e.stopPropagation(); var pf = popupFor; closePopup(); if (pf) { var rr = document.createRange(); rr.selectNode(pf); rr.collapse(e.shiftKey); editor.focus(); setRange(rr); } nextField(e.shiftKey); return; }
      if (e.keyCode === 27) { e.preventDefault(); closePopup(); editor.focus(); return; }
      if (e.keyCode >= 49 && e.keyCode <= 57 && e.keyCode - 49 < n) { e.preventDefault(); chooseOption(e.keyCode - 49); return; }
      /* while the option list is open, typing must not overwrite the dropdown */
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.keyCode === 8 || e.keyCode === 46 || e.keyCode === 32 || e.keyCode >= 48)) {
        e.preventDefault(); toast('Escolha uma opção (setas + Enter, ou o número). Esc fecha a lista.'); return;
      }
    }
    if (!$('modalBack').hidden && e.keyCode === 27) { e.preventDefault(); e.stopPropagation(); closeModal(); }
  }, true);
  window.onbeforeunload = function () { saveDraft(); markAlive(false); };
  /* another tab changed shared data: take it over live so this tab never writes back stale copies */
  function onStorage(e) {
    var k = e && e.key; if (!k || k.indexOf('uf.') !== 0) { return; }
    k = k.slice(3);
    if (k === 'settings') {
      var st = UStore.get('settings', {}), q;
      for (q in DEFAULT_SETTINGS) { if (DEFAULT_SETTINGS.hasOwnProperty(q)) { S.settings[q] = st.hasOwnProperty(q) ? st[q] : DEFAULT_SETTINGS[q]; } }
      applyTheme(); applyLayout(); afterChange(true);
    } else if (k === 'bank') {
      var bk = UStore.get('bank', null);
      if (bk && bk.text) { setBank(bk.text, bk.name, true); buildModels(); renderNav(); toast('Banco de frases atualizado (carregado em outra aba).'); }
    } else if (k === 'userModels' || k === 'userPhrases' || k === 'order' || k === 'overrides' || k === 'usage' || k === 'hidden') {
      S[k] = UStore.get(k, S[k]); buildModels(); renderNav();
    }
  }
  if (window.addEventListener) { window.addEventListener('storage', onStorage, false);
    window.addEventListener('pagehide', function () { saveDraft(); markAlive(false); }, false); }

  /* ================= start ================= */
  applyTheme(); applyLayout();
  var saved = UStore.get('bank', null);
  if (saved && saved.text) { setBank(saved.text, saved.name, true); }
  pickTab(); setInterval(function () { markAlive(true); }, 5000);
  var d = UStore.get('draft.' + TAB, null);
  try {
    if (d && d.html) { editor.innerHTML = d.html; S.activeModelId = d.model || null; if (d.exam) { S.activeExam = d.exam; }
      if (d.nav && d.nav.exam) { S.navExam = d.nav.exam; S.level = d.nav.level || 2; } }
    ensureNotEmpty();
    buildModels(); renderNav(); afterChange(true);
  } catch (initErr) {   /* a stale draft/state from an older version must never block the app */
    UStore.remove('draft.' + TAB); editor.innerHTML = '<div><br></div>'; S.activeModelId = null; S.level = 1;
    buildModels(); renderNav(); afterChange(true);
    toast('Rascunho anterior incompatível foi descartado.');
  }
  $('repSearch').value = S.repQuery || ''; sxShow($('repSearch'));
  if (S.repQuery) { try { repSearch(false); } catch (eRs) {} }

  /* hook for automated tests (no effect on normal use) */
  window.UFApp = { state: S, reportText: reportText };
})();
