/* UFCalcVol (etapa C2): cálculo em tempo real dentro do laudo. Só duas fórmulas, ambas
   fornecidas pelo médico responsável:
   - volume (elipsoide): L x AP x T x 0,523 com medidas em mm, / 1000 -> cm³, inteiro;
   - índice esplênico triplanar: C x L x E em cm -> inteiro (V.R. do banco).
   Só preenche campos que JÁ existem no texto; nunca cria campo. ES5 estrito. */
(function () {
  'use strict';
  var editor = null, busy = false, enabled = true;
  var BLOCK = { DIV: 1, P: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, BLOCKQUOTE: 1, PRE: 1, TR: 1, TABLE: 1 };

  function hasCls(n, c) { return n && n.nodeType === 1 && (' ' + n.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function isNumFld(n) { var t = n.getAttribute('data-t'); return hasCls(n, 'fld') && (t === 'n' || t === 'd'); }
  function fldVal(f) {           /* número do campo, ou null se vazio/inválido (aceita vírgula ou ponto) */
    var t = String(f.textContent || '').replace(/^\s+|\s+$/g, '');
    if (t === '' || t === f.getAttribute('data-ph')) { return null; }
    if (!/^\d+([.,]\d+)?$/.test(t)) { return null; }
    return parseFloat(t.replace(',', '.'));
  }

  /* linhas do laudo como sequências de tokens: {s: texto} ou {f: campo} */
  function lines() {
    var out = [], cur = [];
    function flush() { out.push(cur); cur = []; }
    function walk(n) {
      var c = n.firstChild;
      while (c) {
        if (c.nodeType === 3) { cur.push({ s: c.nodeValue.replace(/\u00a0/g, ' ') }); }
        else if (c.nodeType === 1) {
          if (hasCls(c, 'fld')) { cur.push({ f: c }); }
          else if (c.nodeName === 'BR') { flush(); }
          else if (BLOCK[c.nodeName]) { if (cur.length) { flush(); } walk(c); if (cur.length) { flush(); } }
          else { walk(c); }
        }
        c = c.nextSibling;
      }
    }
    walk(editor); if (cur.length) { flush(); }
    return out;
  }
  /* divide uma linha em frases (ponto seguido de espaço ou fim de linha) */
  function sentences(toks) {
    var out = [], cur = [], i, s, m, re;
    for (i = 0; i < toks.length; i++) {
      if (toks[i].f) { cur.push(toks[i]); continue; }
      s = toks[i].s; re = /\.(\s+|$)/g; var last = 0;
      while ((m = re.exec(s)) !== null) {
        if (m.index + m[0].length === s.length && m[1] === '' && i + 1 < toks.length && toks[i + 1].f) { continue; }  /* "." colado num campo seguinte */
        cur.push({ s: s.substring(last, m.index + 1) }); out.push(cur); cur = []; last = m.index + m[0].length;
      }
      if (last < s.length) { cur.push({ s: s.substring(last) }); }
    }
    if (cur.length) { out.push(cur); }
    return out;
  }
  function textOf(toks, a, b) { var t = '', i; for (i = a; i < b; i++) { if (toks[i].s != null) { t += toks[i].s; } else { t += '#'; } } return t; }
  function nextText(toks, i) { var t = '', j; for (j = i + 1; j < toks.length && toks[j].s != null; j++) { t += toks[j].s; } return t; }
  /* "# x # x # mm" -> 3 campos numéricos ligados por "x"; devolve {f:[..], unit} ou null */
  function triple(toks, a, b) {
    var fs = [], idx = [], i, t, u;
    for (i = a; i < b; i++) { if (toks[i].f) { if (isNumFld(toks[i].f)) { fs.push(toks[i].f); idx.push(i); } else { return null; } } }
    if (fs.length !== 3) { return null; }
    for (i = 0; i < 2; i++) { t = textOf(toks, idx[i] + 1, idx[i + 1]); if (!/^\s*[x×]\s*$/i.test(t)) { return null; } }
    u = /^\s*(mm|cm)\b/i.exec(nextText(toks, idx[2]) + ' ');
    if (!u) { return null; }
    return { f: fs, unit: u[1].toLowerCase() };
  }

  function setAuto(v, val, key) {
    var s = String(val);
    if (v.textContent !== s) { v.textContent = s; }
    v.setAttribute('data-auto', s); v.setAttribute('data-src', key);
    return true;
  }
  function apply(v, tr, kind) {
    var vals = [], i, key, res, cur = String(v.textContent || ''), auto = v.getAttribute('data-auto');
    for (i = 0; i < 3; i++) { vals.push(fldVal(tr.f[i])); }
    if (vals[0] === null || vals[1] === null || vals[2] === null) {
      /* faltou medida: volta ao campo vazio só se o valor atual foi calculado por nós */
      if (auto !== null && cur === auto) { v.textContent = v.getAttribute('data-ph') || '___'; }
      v.removeAttribute('data-auto'); v.removeAttribute('data-src');
      return auto !== null && cur === auto;
    }
    key = tr.unit + ':' + vals.join('|');
    /* edição manual: respeitar até as medidas mudarem */
    if (auto !== null && cur !== auto && v.getAttribute('data-src') === key) { return false; }
    if (auto === null && fldVal(v) !== null && v.getAttribute('data-man') === key) { return false; }
    if (kind === 'vol') {
      var mm = tr.unit === 'cm' ? 10 : 1;
      res = Math.round(vals[0] * mm * vals[1] * mm * vals[2] * mm * 0.523 / 1000);
    } else {
      var cm = tr.unit === 'mm' ? 0.1 : 1;
      res = Math.round(vals[0] * cm * vals[1] * cm * vals[2] * cm);
    }
    if (auto !== null && cur === auto && cur === String(res) && v.getAttribute('data-src') === key) { return false; }
    return setAuto(v, res, key);
  }

  /* encontra os pares (campo de resultado, 3 medidas) no laudo atual */
  function scan() {
    var L = lines(), pairs = [], li, si, ss, prevLast, toks, i, v, after, before, tr, kind;
    for (li = 0; li < L.length; li++) {
      ss = sentences(L[li]);
      for (si = 0; si < ss.length; si++) {
        toks = ss[si];
        for (i = 0; i < toks.length; i++) {
          if (!toks[i].f || !isNumFld(toks[i].f)) { continue; }
          after = nextText(toks, i);
          if (!/^\s*cm(³|3)/.test(after)) { continue; }
          v = toks[i].f; before = textOf(toks, 0, i);
          kind = /índice\s+esplênico|indice\s+esplenico/i.test(before) ? 'ie' : 'vol';
          if (kind === 'vol' && !/volume|~/i.test(before)) { continue; }
          tr = triple(toks, 0, i);
          if (!tr && kind === 'vol' && si === 0 && textOf(toks, 0, i).replace(/#/g, '').length === textOf(toks, 0, i).length &&
              /^\s*volume/i.test(before) && li > 0) {
            /* campo de volume no início da linha seguinte: medidas na última frase da linha anterior */
            prevLast = sentences(L[li - 1]); prevLast = prevLast[prevLast.length - 1];
            if (prevLast) { tr = triple(prevLast, 0, prevLast.length); }
            /* várias linhas seguidas de medidas (ex.: dois lobos): ambíguo, não calcular */
            if (tr && li > 1) { var pp = sentences(L[li - 2]), k; for (k = 0; k < pp.length; k++) { if (triple(pp[k], 0, pp[k].length)) { tr = null; break; } } }
            if (tr && prevLast.length && ss.length && sentences(L[li - 1]).length > 0) {
              var ps = sentences(L[li - 1]), q; for (q = 0; q < ps.length - 1; q++) { if (triple(ps[q], 0, ps[q].length)) { tr = null; break; } }
            }
          }
          if (tr && kind === 'vol' && tr.unit !== 'mm') { tr = null; }   /* volume: medidas em mm, como no banco */
          if (tr) { pairs.push({ v: v, tr: tr, kind: kind }); }
        }
      }
    }
    return pairs;
  }

  function run() {
    if (busy || !enabled || !editor) { return; }
    busy = true;
    var changed = false, p, i;
    try {
      p = scan();
      for (i = 0; i < p.length; i++) { if (apply(p[i].v, p[i].tr, p[i].kind)) { changed = true; } }
      if (changed) {   /* avisa o editor (contadores, rascunho) como se fosse digitação */
        var ev;
        try { ev = new Event('input', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
        editor.dispatchEvent(ev);
      }
    } finally { busy = false; }
  }
  /* digitação manual dentro do campo de resultado: lembrar as medidas atuais */
  function onInput(e) {
    if (busy) { return; }
    var sel = window.getSelection ? window.getSelection() : null, n = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null, f = null;
    while (n && n !== editor) { if (hasCls(n, 'fld')) { f = n; break; } n = n.parentNode; }
    if (f) {
      var p = scan(), i;
      for (i = 0; i < p.length; i++) {
        if (p[i].v === f) {
          var vs = [fldVal(p[i].tr.f[0]), fldVal(p[i].tr.f[1]), fldVal(p[i].tr.f[2])];
          f.setAttribute('data-man', p[i].tr.unit + ':' + vs.join('|'));
          if (f.getAttribute('data-auto') !== null && f.textContent !== f.getAttribute('data-auto')) { f.setAttribute('data-src', p[i].tr.unit + ':' + vs.join('|')); }
        }
      }
    }
    run();
  }

  function init() {
    editor = document.getElementById('editor');
    if (!editor) { return; }
    if (editor.addEventListener) { editor.addEventListener('input', onInput, false); } else { editor.attachEvent('oninput', onInput); }
    run();
  }

  var api = { run: run, scan: scan, init: init, setEnabled: function (on) { enabled = !!on; if (enabled) { run(); } }, isEnabled: function () { return enabled; } };
  window.UFCalcVol = api;
  if (window.UFCalc) {
    UFCalc.register({ id: 'auto', title: 'Cálculo no laudo', build: function (b) {
      var lab = document.createElement('label'), cb = document.createElement('input'), p = document.createElement('div');
      cb.type = 'checkbox'; cb.checked = true; cb.id = 'ucAuto';
      cb.onchange = function () { api.setEnabled(cb.checked); };
      lab.className = 'uc-chk'; lab.appendChild(cb); lab.appendChild(document.createTextNode(' Preencher volume e índice esplênico'));
      p.className = 'uc-note'; p.appendChild(document.createTextNode('Volume = L × AP × T × 0,523 (mm → cm³). Índice esplênico = C × L × E (cm). Só onde o texto já tem o campo.'));
      b.appendChild(lab); b.appendChild(p);
    } });
  }
})();
