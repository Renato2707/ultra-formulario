/*
 * ui-output.js - saída do laudo (copiar / gerar) e busca no laudo.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-output', function (UI, R) {
  'use strict';
  var $, on, esc, hasCls, addCls, closest, qsa, trim, foldKeep, stripAccents, toast, S, editor, modal,
      closeModal, getModel, textLines, lineText, keepInView, removeLines, critState, checkFields, printNow,
      afterChange, gotoLine, focusField, closePopup, isBlankLine, editorLines;   /* de outros arquivos ui-*.js (ligados abaixo) */
  UI.normalize = normalize; UI.reportText = reportText; UI.copyPlain = copyPlain; UI.output = output;
  UI.critGroups = critGroups; UI.removeGroup = removeGroup; UI.clearRepMarks = clearRepMarks;
  UI.repSearch = repSearch; UI.repStep = repStep;   /* usadas por outros arquivos */

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
      if (a === 'ok') { for (q = 0; q < grp.length; q++) { addCls(grp[q], 'crit-ok'); grp[q].setAttribute('data-res', 'confirmado'); grp[q].setAttribute('data-conf', lineText(grp[q])); } }
      else if (a === 'rm') { removeGroup(grp); }
      addCls(box, 'done');
      var bs = box.getElementsByTagName('button'), k; for (k = 0; k < bs.length; k++) { bs[k].disabled = true; }
      left--;
      if (left <= 0) {
        var nu = checkFields().length, any = qsa($('modalBody'), '[data-a=anyway]')[0];
        if (!nu) { finish(); return; }                   /* inside the click: clipboard keeps the user gesture */
        if (any) {   /* critical lines done: the empty-field choice is now available here (D3), still explicit */
          any.disabled = false; any.removeAttribute('title');
          var cf = qsa($('modalBody'), '.chk-fields')[0]; if (cf && cf.firstChild && cf.firstChild.nodeType === 3) { cf.firstChild.nodeValue = 'Linhas críticas revisadas. ' + nu + ' campo(s) vazio(s). '; }
          any.focus();
        } else { backToFields(); }
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

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; closest = UI.closest;
    qsa = UI.qsa; trim = UI.trim; foldKeep = UI.foldKeep; stripAccents = UI.stripAccents; toast = UI.toast;
    S = UI.S; editor = UI.editor; modal = UI.modal; closeModal = UI.closeModal; getModel = UI.getModel;
    textLines = UI.textLines; lineText = UI.lineText; keepInView = UI.keepInView; removeLines = UI.removeLines;
    critState = UI.critState; checkFields = UI.checkFields; printNow = UI.printNow;
    afterChange = UI.afterChange; gotoLine = UI.gotoLine; focusField = UI.focusField;
    closePopup = UI.closePopup; isBlankLine = UI.isBlankLine; editorLines = UI.editorLines;
  };
});
