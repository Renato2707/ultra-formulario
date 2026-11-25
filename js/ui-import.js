/*
 * ui-import.js - C6e: reconhecer laudo colado / importado.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-import', function (UI, R) {
  'use strict';
  var RG, RG_UNIT, COPY_MSG, dragSrc, nativeDrag, tbs, ti;   /* deste arquivo */
  var $, on, esc, qsa, trim, toast, S, editor, confirmModal, chipHtml, textLines, lineText, saveRange,
      setRange, focusEditor, restoreRange, exec, ensureNotEmpty, insertBlock, undoRemoval, afterChange,
      jumpNextCrit, nextField, multiChipHtml, normalize, clearRepMarks, loadedModel, renderNav, edText, edHtml,
      undoInsert, useModel, wholeField, fieldInner;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.PH */
  UI.interText = interText; UI.recognizeText = recognizeText;   /* usadas por outros arquivos */

  /* ================= C6e: recognizing a pasted / imported finished report =================
     Each bank line (models and phrases) that has fields becomes a pattern; a pasted line that matches it is rebuilt
     with the same field chips, already filled with the pasted values (so the calculators read them). Lines that
     match nothing stay plain text. Nothing is guessed: a value is only taken where the bank has a field. */
  R(function () {
    RG = { bank: null, pats: [], loose: [] };
    RG_UNIT = /^(mm|cm|cm\u00b3|cm3|ml|bpm|g|%|semanas?|dias?)([.,;:)]?)$/i;
  });
  function rgLit(t, loose) {   /* C6p loose: a unit word may be missing or repeated */
    var out = '', i, c, w;
    if (loose) {
      w = String(t).split(/(\s+)/); out = '';
      for (i = 0; i < w.length; i++) {
        c = RG_UNIT.exec(w[i]);
        if (c) { out += '(?:' + rgLit(c[1]) + '\\s*)*' + rgLit(c[2]); }
        else { out += rgLit(w[i]); }
      }
      return out;
    }
    for (i = 0; i < t.length; i++) {
      c = t.charAt(i);
      if (/\s/.test(c)) { if (!/\\s\*$/.test(out)) { out += '\\s*'; } }
      else if (c === 'x' || c === 'X' || c === '\u00d7') { out += '[xX\u00d7]'; }
      else if (c === '\u00b3' || c === '3') { out += '[3\u00b3]'; }
      else if (c === '\u00b2' || c === '2') { out += '[2\u00b2]'; }
      else { out += c.replace(/[\\^$.*+?()[\]{}|\/]/g, '\\$&'); }
    }
    return out;
  }
  /* compile(text): segments [{lit} | {f: field}], src = regex source; capture=true wraps every segment in a group */
  function rgCompile(text, capture, depth, loose) {
    var fs = UltraParser.fieldsOf(text), seg = [], pos = 0, i, src = '', k, f, alts;
    function add(s2) { src += capture ? '(' + s2 + ')' : '(?:' + s2 + ')'; }
    for (i = 0; i < fs.length; i++) {
      f = fs[i]; if (f.offset < pos) { continue; }
      if (f.offset > pos) { seg.push({ lit: text.substring(pos, f.offset) }); add(rgLit(text.substring(pos, f.offset), loose)); }
      if (loose) { add(f.type === 'select' ? '.*?' : '.*?'); seg.push({ f: f, loose: 1 }); pos = f.offset + f.raw.length; continue; }
      if (f.type === 'select') {
        alts = [];
        for (k = 0; k < f.options.length; k++) { alts.push(depth < 3 ? rgCompile(f.options[k], false, depth + 1).src : rgLit(f.options[k])); }
        alts.sort(function (a, b) { return b.length - a.length; });
        if (f.multi) {   /* C6h: "a", "a e b", "a, b e c" */
          /* C6i: later items may be just the end of an option ("... tipo a, b e c"); the exact split is checked in rgMulti */
          var one = '(?:' + alts.join('|') + ')', tails = [], tw, ti;
          for (k = 0; k < f.options.length; k++) { tw = String(f.options[k]).split(/\s+/); for (ti = 1; ti < tw.length; ti++) { tails.push(rgLit(tw.slice(ti).join(' '))); } }
          tails.sort(function (a, b) { return b.length - a.length; });
          var any = '(?:' + alts.concat(tails).join('|') + ')';
          add(one + '(?:(?:,\\s*|\\s+e\\s+)' + any + ')*|escolher|_+|\\*|' + rgListSrc(f));
        } else {
          alts.push('escolher'); alts.push('_+'); alts.push('\\*');   /* an unchosen choice is printed as ___ */
          alts.unshift(rgListSrc(f));   /* C6o: intermediate template, all options still listed "a / b / c" */
          add(alts.join('|'));
        }
      } else if (f.type === 'text') { add('.+?'); }
      else if (/BI-RADS(?:-US)?\s*$/i.test(text.substring(0, f.offset))) { add('(?:\\*\\s*)?(?:4\\s*[ABCabc]|\\d+(?:[.,]\\d+)?)(?:\\s*\\*)?\\s*|_+(?:,_+)?|\\*(?:,\\*)?'); }   /* C7: BI-RADS 4A/4B/4C */
      else { add('(?:\\*\\s*)?\\d+(?:[.,]\\d+)?(?:\\s*\\*)?|_+(?:,_+)?|\\*(?:,\\*)?'); }   /* C6p: "*" = blank; a "*" left beside the number is ignored */
      seg.push({ f: f }); pos = f.offset + f.raw.length;
    }
    if (pos < text.length) { seg.push({ lit: text.substring(pos) }); add(rgLit(text.substring(pos), loose)); }
    return { seg: seg, src: src };
  }
  /* C6o/C6p: plain-text "intermediate" form of a bank text (for other systems): any field -> *, ?[a|b] -> "a / b", no other markup */
  function interText(t) {
    var fs = UltraParser.fieldsOf(t), out = '', pos = 0, i, k, f, o;
    for (i = 0; i < fs.length; i++) {
      f = fs[i]; if (f.offset < pos) { continue; }
      out += t.substring(pos, f.offset);
      if (f.type === 'select') { o = []; for (k = 0; k < f.options.length; k++) { o.push(interText(f.options[k])); } out += o.join(' / '); }
      else { out += '*'; }
      pos = f.offset + f.raw.length;
    }
    return out + t.substring(pos);
  }
  function rgListSrc(f) {
    var o = [], k;
    for (k = 0; k < f.options.length; k++) { o.push(rgLit(interText(f.options[k])).replace(/\\\*/g, '(?:\\*|_+(?:,_+)?)'));   /* C6p "*", C6o "___" */ }
    return o.join('\\s*\\/\\s*');
  }
  function rgPats() {
    if (!S.bank) { return []; }
    if (RG.bank === S.bank) { return RG.pats; }
    var bodies = [], i, j, k, ex, ls, l, c, lit;
    for (i = 0; i < S.bank.exams.length; i++) {
      ex = S.bank.exams[i];
      for (j = 0; j < ex.templates.length; j++) { bodies.push(ex.templates[j].body); }
      for (j = 0; j < (ex.sections || []).length; j++) { for (k = 0; k < ex.sections[j].phrases.length; k++) { bodies.push(ex.sections[j].phrases[k].body); } }
    }
    RG.pats = []; RG.loose = []; RG.bank = S.bank; var seen = {};
    for (i = 0; i < bodies.length; i++) {
      ls = String(bodies[i] || '').split('\n');
      for (j = 0; j < ls.length; j++) {
        l = ls[j].replace(/\r$/, '').replace(/^\s*[\u2022\-\u2013]\s*/, '').replace(/^\s+|\s+$/g, '');
        if (!l || seen[l] || l.indexOf('?[') < 0 && l.indexOf('?+[') < 0 && l.indexOf('*') < 0) { continue; }
        lit = l.replace(/\?\+?\[[^\]]*\]|\*/g, '').replace(/[^A-Za-z\u00c0-\u00ff]/g, '');
        if (lit.length < 4) { continue; }   /* too little fixed text to be sure */
        try { c = rgCompile(l, true, 0); if (!c.seg.length) { continue; } c.re = new RegExp('^' + c.src + '$', 'i'); c.lit = lit.length; } catch (e) { continue; }
        seen[l] = 1; RG.pats.push(c);
        /* C6p: tolerant copy (any text where a field is, unit missing/repeated), tried only when no exact line matches */
        if (lit.length >= 8) { try { var c2 = rgCompile(l, true, 0, true); c2.re = new RegExp('^' + c2.src + '$', 'i'); c2.lit = 0; for (k = 0; k < c2.seg.length; k++) { if (c2.seg[k].lit !== undefined) { c2.lit += c2.seg[k].lit.replace(/[^A-Za-z\u00c0-\u00ff]/g, '').length; } } if (c2.lit >= 8) { RG.loose.push(c2); } } catch (e2) { /* skip */ } }
      }
    }
    RG.pats.sort(function (a, b) { return b.lit - a.lit; });
    RG.loose.sort(function (a, b) { return b.lit - a.lit; });
    return RG.pats;
  }
  /* C6h: split "a, b e c" into option indices; longest option first, with backtracking (options may contain commas) */
  function rgMulti(opts, v) {   /* C6i: new joined text first ("... tipo a e b", bank order), then the C6h text (every option whole) */
    var nv = rgNorm(v), n = opts.length, best = null, m, i, sel, t;
    if (n <= 12) {
      for (m = 1; m < (1 << n) && !best; m++) {
        sel = []; t = []; for (i = 0; i < n; i++) { if (m & (1 << i)) { sel.push(i); t.push(opts[i]); } }
        if (sel.length > 1 && rgNorm(UltraParser.joinMulti(t)) === nv) { best = sel; }
      }
      if (best) { return best; }
    }
    return rgMultiOld(opts, v);
  }
  function rgNorm(t) { return String(t).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '').replace(/[\u00d7X]/g, 'x').replace(/\u00b3/g, '3').replace(/\u00b2/g, '2').toLowerCase(); }
  function rgMultiOld(opts, v) {
    var ord = [], i;
    for (i = 0; i < opts.length; i++) { ord.push(i); }
    ord.sort(function (a, b) { return opts[b].length - opts[a].length; });
    function go(pos, acc) {
      var k, o, re, m, rest;
      for (k = 0; k < ord.length; k++) {
        o = opts[ord[k]]; if (acc.indexOf(ord[k]) >= 0) { continue; }
        re = new RegExp('^' + rgLit(o), 'i'); m = re.exec(v.substring(pos));
        if (!m) { continue; }
        rest = v.substring(pos + m[0].length);
        if (!rest) { return acc.concat([ord[k]]); }
        var sep = /^(,\s*|\s+e\s+)/.exec(rest);
        if (sep) { var r2 = go(pos + m[0].length + sep[0].length, acc.concat([ord[k]])); if (r2) { return r2; } }
      }
      return null;
    }
    return go(0, []);
  }
  function rgFieldHtml(f, v, loose) {
    var k, c, m;
    v = String(v).replace(/^\s+|\s+$/g, '');
    if (loose) { return rgLooseHtml(f, v); }
    if (f.type === 'select') {
      if (/^(escolher|_+)$/i.test(v) || new RegExp('^(?:' + rgListSrc(f) + ')$', 'i').test(v)) { return chipHtml(f); }
      if (f.multi) { var mi = rgMulti(f.options, v); return mi ? multiChipHtml(JSON.stringify(f.options), mi, f.options, true) : esc(v); }
      for (k = 0; k < f.options.length; k++) {
        if (UltraParser.fieldsOf(f.options[k]).length) {
          c = rgCompile(f.options[k], true, 1); m = new RegExp('^' + c.src + '$', 'i').exec(v);
          if (m) { return rgHtml(c, m); }
        } else if (new RegExp('^' + rgLit(f.options[k]) + '$', 'i').test(v)) {
          return '<span class="fld f-sel f-ok" data-t="s" data-v="' + k + '" data-o="' + esc(JSON.stringify(f.options)) + '" title="Clique para trocar">' + esc(f.options[k]) + '</span>';
        }
      }
      return esc(v);
    }
    var t = f.type === 'text' ? 't' : (f.decimal ? 'd' : 'n');
    if (t !== 't') { v = v.replace(/^\*\s*|\s*\*$/g, ''); }
    if (/^_+(,_+)?$/.test(v) || /^\*+(,\*+)?$/.test(v) || !v || v === UI.PH.t) { return chipHtml(f); }
    return '<span class="fld f-ok" data-t="' + t + '" data-ph="' + UI.PH[t] + '">' + esc(v) + '</span>';
  }
  function rgHtml(c, m) {
    var out = '', i;
    for (i = 0; i < c.seg.length; i++) { out += c.seg[i].lit !== undefined ? esc(m[i + 1]) : rgFieldHtml(c.seg[i].f, m[i + 1], c.seg[i].loose); }
    return out;
  }
  /* C6p: value from a tolerant match: what is clear becomes the field; anything doubtful = blank / not chosen */
  function rgLooseHtml(f, v) {
    var k, n, h;
    if (f.type === 'select') {
      try { h = rgFieldHtml(f, v); } catch (e) { h = ''; }
      if (/class="fld/.test(h)) { return h; }
      /* blank, or only some of the options left ("a / b"): not chosen; any other text is kept as typed */
      var ps = v.split(/\s*\/\s*/), ok = true, j;
      for (k = 0; k < ps.length && ok; k++) {
        if (/^[*_\s]*$|^escolher$/i.test(ps[k])) { continue; }
        ok = false; for (j = 0; j < f.options.length; j++) { if (rgNorm(interText(f.options[j])).replace(/\*/g, '') === rgNorm(ps[k]).replace(/[*_]/g, '')) { ok = true; } }
      }
      return ok ? chipHtml(f) : esc(v);
    }
    if (f.type === 'text') { v = v.replace(/^[*_\s]+|[*_\s]+$/g, ''); return v ? rgFieldHtml(f, v) : chipHtml(f); }
    n = v.match(/\d+(?:[.,]\d+)?/g);
    k = v.replace(/\d+(?:[.,]\d+)?/g, '').replace(/[*_\s]|mm|cm|ml|bpm|[3\u00b3%]/gi, '');
    if (n && n.length === 1 && !k) { return rgFieldHtml(f, n[0]); }
    return /[A-Za-z\u00c0-\u00ff]/.test(k) ? esc(v) : chipHtml(f);   /* words are never thrown away */
  }
  /* text -> html of line divs, or null when no line was recognized */
  function recognizeText(text) {
    var pats = rgPats(), ls = String(text).replace(/\r\n?/g, '\n').split('\n'), out = [], hit = 0, i, j, l, b, m, core;
    if (!pats.length || ls.length < 1) { return null; }
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; b = /^\s*[\u2022\-\u2013]\s*/.exec(l); core = l.replace(/^\s*[\u2022\-\u2013]\s*/, '').replace(/\s+$/, '');
      m = null;
      var pz = pats;
      if (core.length > 3) { for (j = 0; j < pats.length; j++) { m = pats[j].re.exec(core); if (m) { break; } } }
      if (!m && core.length > 3) { pz = RG.loose; for (j = 0; j < pz.length; j++) { try { m = pz[j].re.exec(core); } catch (e) { m = null; } if (m) { break; } } }
      if (m) { hit++; out.push('<div>' + (b ? esc(b[0]) : '') + rgHtml(pz[j], m) + '</div>'); }
      else { out.push('<div>' + (l ? esc(l) : '<br>') + '</div>'); }
    }
    return hit ? { html: out.join(''), hits: hit, lines: ls.length } : null;
  }
  R(function () {
    on(editor, 'paste', function (e) {
      var t = null;
      if (e.clipboardData && e.clipboardData.getData) { t = e.clipboardData.getData('text/plain'); }
      else if (window.clipboardData) { t = window.clipboardData.getData('Text'); }
      if (t === null || t === undefined) { return; }
      e.preventDefault();
      var pw = window.getSelection().rangeCount ? wholeField(window.getSelection().getRangeAt(0)) : null; if (pw && !pw.one) { fieldInner(pw.f); }
      /* C6e: a pasted report (2+ lines, outside a field) whose lines match the bank comes back with its fields */
      var rg = !pw && /\n/.test(t) ? recognizeText(t) : null;
      if (rg) {
        var ub = edHtml(), ubt = edText(); saveRange();
        insertBlock(rg.html);
        if (window.UFTirads && UFTirads.runTxt) { UFTirads.runTxt(); }
        S.insStack.push({ before: ub, beforeText: ubt, after: edHtml(), afterText: edText() }); S.insRedo = [];
        afterChange(true); return;
      }
      if (!exec('insertText', t)) {
        var sel = window.getSelection(); if (!sel.rangeCount) { return; }
        var r = sel.getRangeAt(0); r.deleteContents(); var tn = document.createTextNode(t); r.insertNode(tn);
        r.setStartAfter(tn); r.collapse(true); setRange(r);
      }
      afterChange(false);
    });
  });
  function selectionPlain() {
    var sel = window.getSelection(); if (!sel.rangeCount) { return ''; }
    var div = document.createElement('div'); div.appendChild(sel.getRangeAt(0).cloneContents());
    var lines = textLines(div, '___'), i; for (i = 0; i < lines.length; i++) { lines[i] = normalize(lines[i]); }
    return lines.join(S.settings.eol === 'lf' ? '\n' : '\r\n');
  }
  /* copy/cut out of the report is blocked (critical-line review must not be bypassed): only the Copiar button copies */
  R(function () {
    COPY_MSG = 'Para copiar o laudo use o botão Copiar.';
  });
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
  R(function () {
    on(document, 'copy', blockCopy);
    on(document, 'cut', blockCopy);
    /* drag: never carries text out of the report. With dragInReport on, a drag inside the report moves the
       selection (done by the app itself: the drag payload is emptied, so a drop elsewhere receives nothing). */
    dragSrc = null;
  });
  function stopEv(e) { if (e.preventDefault) { e.preventDefault(); } e.returnValue = false; return false; }
  function caretAt(x, y) {
    if (document.caretRangeFromPoint) { return document.caretRangeFromPoint(x, y); }
    if (document.caretPositionFromPoint) { var cp = document.caretPositionFromPoint(x, y); if (!cp) { return null; } var r = document.createRange(); r.setStart(cp.offsetNode, cp.offset); r.collapse(true); return r; }
    return null;
  }
  R(function () {
    nativeDrag = false;
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
  });
  /* blocking off + internal drag off: a drag that started in the report may not be dropped back into it */
  function nativeGuard(e) { if (nativeDrag && !S.settings.dragInReport && (editor.contains(e.target) || e.target === editor)) { try { e.dataTransfer.dropEffect = 'none'; } catch (x) {} return stopEv(e); } }
  R(function () {
    on(editor, 'dragover', nativeGuard); on(editor, 'drop', nativeGuard);
  });
  function dragOver(e) {
    if (!dragSrc) { return; }
    var inside = editor.contains(e.target) || e.target === editor;
    try { e.dataTransfer.dropEffect = inside ? 'move' : 'none'; } catch (x) {}
    if (inside) { stopEv(e); }   /* the report accepts our own (empty-payload) move */
  }
  R(function () {
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
    tbs = qsa(document, '.tb[data-cmd]');   /* C6e: formatting buttons live above the report */
    for (ti = 0; ti < tbs.length; ti++) {
      on(tbs[ti], 'mousedown', function (e) { e.preventDefault(); });
      on(tbs[ti], 'click', function () {
        var cmd = this.getAttribute('data-cmd');
        if (cmd === 'undo' && !S.lastChoice && !S.lastRemoval && S.insStack.length && undoInsert(false)) { return; }
        if (cmd === 'undo' && S.lastRemoval) { undoRemoval(); return; }
        if (cmd === 'redo' && S.insRedo.length && undoInsert(true)) { return; }
        restoreRange(); exec(cmd); saveRange(); afterChange(false);
      });
    }
    on($('btnCritCount'), 'click', jumpNextCrit);
    on($('btnFieldCount'), 'click', function () { editor.focus(); nextField(false); });
    on($('btnClear'), 'click', function () {
      var m = loadedModel();
      if (m) {
        confirmModal('Limpar laudo', 'Voltar ao modelo "' + m.name + '" do zero? O texto digitado sai. (Ctrl+Z desfaz)', 'Limpar', function () {
          useModel(m, true);
        }, true);
        return;
      }
      confirmModal('Limpar laudo', 'Apagar todo o texto do laudo? (Ctrl+Z desfaz)', 'Limpar', function () {
        clearRepMarks(); editor.focus(); exec('selectAll'); exec('delete');
        if (trim(lineText(editor)) !== '') { editor.innerHTML = ''; }
        ensureNotEmpty(); S.activeModelId = null; renderNav(); afterChange(true);
      }, true);
    });
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; qsa = UI.qsa; trim = UI.trim; toast = UI.toast; S = UI.S;
    editor = UI.editor; confirmModal = UI.confirmModal; chipHtml = UI.chipHtml; textLines = UI.textLines;
    lineText = UI.lineText; saveRange = UI.saveRange; setRange = UI.setRange; focusEditor = UI.focusEditor;
    restoreRange = UI.restoreRange; exec = UI.exec; ensureNotEmpty = UI.ensureNotEmpty;
    insertBlock = UI.insertBlock; undoRemoval = UI.undoRemoval; afterChange = UI.afterChange;
    jumpNextCrit = UI.jumpNextCrit; nextField = UI.nextField; multiChipHtml = UI.multiChipHtml;
    normalize = UI.normalize; clearRepMarks = UI.clearRepMarks; loadedModel = UI.loadedModel;
    renderNav = UI.renderNav; edText = UI.edText; edHtml = UI.edHtml; undoInsert = UI.undoInsert;
    useModel = UI.useModel; wholeField = UI.wholeField; fieldInner = UI.fieldInner;
  };
});
