/*
 * ui-editor.js - laudo: banco em HTML no editor, extração de texto, cursor e inserção.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-editor', function (UI, R) {
  'use strict';
  var BLOCK;   /* deste arquivo */
  var $, esc, hasCls, rmCls, closest, trim, S, editor, afterChange, clearRepMarks, isBlankLine;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.PH, UI.canExecHtml */
  UI.chipHtml = chipHtml; UI.renderLines = renderLines; UI.inlineHtml = inlineHtml;
  UI.fieldFilled = fieldFilled; UI.textLines = textLines; UI.lineText = lineText; UI.saveRange = saveRange;
  UI.setRange = setRange; UI.focusEditor = focusEditor; UI.keepInView = keepInView;
  UI.restoreRange = restoreRange; UI.exec = exec; UI.lineOf = lineOf; UI.ensureNotEmpty = ensureNotEmpty;
  UI.insertBlock = insertBlock; UI.replaceNodeWithHtml = replaceNodeWithHtml; UI.removeLines = removeLines;
  UI.undoRemoval = undoRemoval; UI.loadIntoEditor = loadIntoEditor;   /* usadas por outros arquivos */

  /* ================= rendering bank text into editor HTML ================= */
  R(function () {
    UI.PH = { n: '___', d: '__,_', t: 'texto', s: 'escolher' };
  });
  function chipHtml(f) {
    if (f.type === 'select') {
      return '<span class="fld f-sel' + (f.multi ? ' f-multi' : '') + '" contenteditable="false" data-t="s"' + (f.multi ? ' data-m="1"' : '') + ' data-o="' + esc(JSON.stringify(f.options)) + '">' + UI.PH.s + '</span>';
    }
    var t = f.type === 'text' ? 't' : (f.decimal ? 'd' : 'n');
    return '<span class="fld" data-t="' + t + '" data-ph="' + UI.PH[t] + '">' + UI.PH[t] + '</span>';
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
  R(function () {
    BLOCK = { DIV: 1, P: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, PRE: 1, TR: 1, TABLE: 1 };
  });
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
  R(function () {
    UI.canExecHtml = (function () { try { return !!(document.queryCommandSupported && document.queryCommandSupported('insertHTML')); } catch (e) { return false; } })();
  });
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
    /* lote: caret right in the editor box (empty report, or between lines): use the EMPTY line beside it, so the
       inserted text takes that line instead of opening a new one under it (no blank line left before the text) */
    if (!line && r.collapsed && r.startContainer === editor) {
      var bs = [editor.childNodes[r.startOffset - 1], editor.childNodes[r.startOffset]], bi;
      /* whole report deleted (select all): the browser leaves a bare <br>; give it a real empty line */
      if (trim(editor.textContent || '') === '' && !editor.querySelector('div,p,.fld')) { editor.innerHTML = '<div><br></div>'; bs = [editor.firstChild]; }
      for (bi = 0; bi < bs.length && !line; bi++) { if (bs[bi] && bs[bi].nodeType === 1 && BLOCK[bs[bi].nodeName] && trim(lineText(bs[bi])) === '' && !bs[bi].querySelector('.fld')) { line = bs[bi]; } }
      if (line) { r = document.createRange(); r.selectNodeContents(line); r.collapse(true); setRange(r); }
    }
    if (UI.canExecHtml) {
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
    S.lastChoice = null; S.insStack = []; S.insRedo = [];
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
      if (hasCls(u[k].el, 'crit')) { rmCls(u[k].el, 'crit-ok'); u[k].el.removeAttribute('data-res'); u[k].el.removeAttribute('data-conf'); }
    }
    afterChange(true);
    return true;
  }
  function loadIntoEditor(html) {
    clearRepMarks();
    editor.focus();
    if (UI.canExecHtml) {
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

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; esc = UI.esc; hasCls = UI.hasCls; rmCls = UI.rmCls; closest = UI.closest; trim = UI.trim;
    S = UI.S; editor = UI.editor; afterChange = UI.afterChange; clearRepMarks = UI.clearRepMarks;
    isBlankLine = UI.isBlankLine;
  };
});
