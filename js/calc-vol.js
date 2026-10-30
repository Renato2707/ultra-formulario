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
    for (i = 0; i < tr.f.length; i++) { vals.push(fldVal(tr.f[i])); }
    var miss = false; for (i = 0; i < vals.length; i++) { if (vals[i] === null) { miss = true; } }
    if (miss) {
      /* faltou medida: volta ao campo vazio só se o valor atual foi calculado por nós */
      if (auto !== null && cur === auto) { v.textContent = v.getAttribute('data-ph') || '___'; }
      v.removeAttribute('data-auto'); v.removeAttribute('data-src');
      return auto !== null && cur === auto;
    }
    key = tr.unit + ':' + vals.join('|');
    /* edição manual: respeitar até as medidas mudarem */
    if (auto !== null && cur !== auto && v.getAttribute('data-src') === key) { return false; }
    if (auto === null && fldVal(v) !== null && v.getAttribute('data-man') === key) { return false; }
    if (kind === 'sum') {   /* C6d: tireoide = soma dos volumes dos lobos (cada um L x AP x T x 0,523); istmo não entra */
      var tot = 0; for (i = 0; i + 2 < vals.length; i += 3) { tot += vals[i] * vals[i + 1] * vals[i + 2] * 0.523 / 1000; }
      res = Math.round(tot);
    } else if (kind === 'vol') {
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
    var L = lines(), pairs = [], li, si, ss, prevLast, toks, i, v, after, before, tr, kind, cand = [], lobes = [], candF = [];
    for (li = 0; li < L.length; li++) {
      ss = sentences(L[li]);
      for (si = 0; si < ss.length; si++) {
        toks = ss[si];
        /* C6d: frase de medida de lobo da tireoide ("O lobo direito mede cerca de # x # x # mm") */
        var lt = textOf(toks, 0, toks.length), lm = /^\s*(o\s+)?lobo\s+(direito|esquerdo)\s+(mede|medindo)\b/i.exec(lt), ltr = null;
        if (lm) { var nf = 0, cut = toks.length, z; for (z = 0; z < toks.length; z++) { if (toks[z].f) { nf++; if (nf === 4) { cut = z; break; } } } ltr = triple(toks, 0, cut); }
        if (ltr && ltr.unit === 'mm') { lobes.push({ side: lm[2].toLowerCase(), tr: ltr }); }
        for (i = 0; i < toks.length; i++) {
          if (!toks[i].f || !isNumFld(toks[i].f)) { continue; }
          after = nextText(toks, i);
          if (!/^\s*cm(³|3)/.test(after)) { continue; }
          v = toks[i].f; before = textOf(toks, 0, i);
          kind = /índice\s+esplênico|indice\s+esplenico/i.test(before) ? 'ie' : 'vol';
          if (kind === 'vol' && !/volume|~/i.test(before)) { continue; }
          cand.push(kind); if (kind === 'vol') { candF.push({ v: toks[i].f, line: textOf(L[li], 0, L[li].length) }); }
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
    /* C6d: campo de volume total da tireoide (sem par próprio) = soma dos lobos; dois "lobo direito" (ou esquerdo) = ambíguo */
    var sides = {}, okL = lobes.length > 0, k, q, used;
    for (k = 0; k < lobes.length; k++) { if (sides[lobes[k].side]) { okL = false; } sides[lobes[k].side] = 1; }
    for (k = 0; okL && k < candF.length; k++) {
      used = false; for (q = 0; q < pairs.length; q++) { if (pairs[q].v === candF[k].v) { used = true; } }
      if (used || !/volume\s+glandular|gl[âa]ndula\s+tireoide/i.test(candF[k].line)) { continue; }
      var all = []; for (q = 0; q < lobes.length; q++) { all = all.concat(lobes[q].tr.f); }
      pairs.push({ v: candF[k].v, tr: { f: all, unit: 'mm', lobes: lobes.length }, kind: 'sum' });
    }
    pairs.cand = cand; pairs.lobes = lobes.length; for (k = 0; k < pairs.length; k++) { if (pairs[k].kind === 'sum') { pairs.sum = true; } }
    return pairs;
  }

  function run() {
    if (busy || !editor) { return; }
    if (!enabled) { clearAll(); return; }
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
  /* C6e: desligado = os valores que NÓS escrevemos saem do laudo (valor digitado à mão fica) */
  function clearAll() {
    busy = true;
    try {
      var p = scan(), i, v, ch = false;
      for (i = 0; i < p.length; i++) { v = p[i].v; if (v.getAttribute('data-auto') !== null) { if (v.textContent === v.getAttribute('data-auto')) { v.textContent = v.getAttribute('data-ph') || '___'; ch = true; } v.removeAttribute('data-auto'); v.removeAttribute('data-src'); } }
      if (ch) { var ev; try { ev = new Event('input', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); } editor.dispatchEvent(ev); }
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
          var vs = [], z; for (z = 0; z < p[i].tr.f.length; z++) { vs.push(fldVal(p[i].tr.f[z])); }
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

  var toggles = [];
  /* C6e: linhas liga/desliga de todos os cálculos no laudo, cada uma no cartão do seu assunto (card).
     Sem texto de estado: só um ponto (verde = pronto, cinza = falta linha ou medida), explicado no tooltip.
     status() -> { ready: true|false, tip: '...' } */
  function addToggle(id, label, checked, fn, info, status, extra, card) {
    var t = { id: id, label: label, checked: checked, fn: fn, info: info || '', status: status || null, extra: extra || null, card: card || 'auto' };
    toggles.push(t); refresh();
  }
  var secBody = null;
  function drawToggle(t, body) {
    var row = document.createElement('div'), lab = document.createElement('label'), cb = document.createElement('input'), dot = document.createElement('span');
    row.className = 'uc-row'; row.setAttribute('data-row', t.id); cb.type = 'checkbox'; cb.checked = !!t.checked; cb.id = t.id;
    cb.onchange = function () { t.checked = cb.checked; t.fn(cb.checked); refresh(); };
    lab.className = 'uc-chk'; if (t.info) { lab.title = t.info; }
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + t.label));
    dot.className = 'uc-dot'; dot.id = t.id + 'Dot';
    row.appendChild(lab); row.appendChild(dot);
    if (t.extra) { t.extra(row); }
    t.row = row; t.dot = dot; t.cb = cb;
    body.appendChild(row);
  }
  var cardState = {};
  function refresh() {
    var i, t, r, body, per = {}, k;
    for (i = 0; i < toggles.length; i++) {
      t = toggles[i];
      if (!t.dot) { body = window.UFCalc && UFCalc.cardBody ? UFCalc.cardBody(t.card) : null; if (!body) { continue; } drawToggle(t, body); }
      r = t.cb.checked && t.status && editor ? t.status() : null;
      var ready = !!(r && r.ready);
      t.dot.className = 'uc-dot ' + (ready ? 'on' : 'off');
      t.dot.title = !t.cb.checked ? 'Desligado' : (r && r.tip ? r.tip : '');
      t.row.setAttribute('data-ready', ready ? '1' : '0');
      if (!per[t.card]) { per[t.card] = { ready: false, tips: [] }; }
      if (ready) { per[t.card].ready = true; per[t.card].tips.push(t.label); }
    }
    for (k in per) { if (per.hasOwnProperty(k) && window.UFCalc && UFCalc.setReady) {
      UFCalc.setReady(k, per[k].ready, per[k].ready ? 'Pronto: ' + per[k].tips.join(', ') : 'Nada a calcular neste laudo (falta a linha ou as medidas)');
    } }
  }
  function volStatus() {
    var p = scan(), i, any = false, ready = false, q, full;
    for (i = 0; i < p.length; i++) {
      any = true; full = true;
      for (q = 0; q < p[i].tr.f.length; q++) { if (fldVal(p[i].tr.f[q]) === null) { full = false; } }
      if (full) { ready = true; }
    }
    if (ready) { return { ready: true, tip: p.sum ? 'Pronto (tireoide: soma dos lobos, sem o istmo)' : 'Pronto' }; }
    if (any) { return { ready: false, tip: 'Faltam medidas' + (p.sum ? ' (tireoide: soma dos lobos, sem o istmo)' : '') }; }
    if (p.lobes) { return { ready: false, tip: 'Há medidas dos lobos, mas não há linha de volume total no laudo' }; }
    if (p.cand.length) { return { ready: false, tip: 'Há campo de volume, mas sem as 3 medidas' }; }
    return { ready: false, tip: 'Sem linha de volume no laudo' };
  }
  var api = { run: run, scan: scan, init: init, addToggle: addToggle, refresh: refresh,
    _h: { lines: lines, isNumFld: isNumFld, fldVal: fldVal, nextText: nextText, hasCls: hasCls }, setEnabled: function (on) { enabled = !!on; run(); }, isEnabled: function () { return enabled; } };
  window.UFCalcVol = api;
  if (window.UFCalc) {
    UFCalc.register({ id: 'auto', title: 'Volume', build: function (b) {
      secBody = b;
      toggles.unshift({ id: 'ucAuto', label: 'Volume e índice esplênico', checked: true, fn: function (v) { api.setEnabled(v); }, card: 'auto',
        info: 'Volume = L × AP × T × 0,523 (mm → cm³); tireoide = soma dos lobos, sem o istmo. Índice esplênico = C × L × E (cm).', status: volStatus });
      setTimeout(refresh, 0);
      if (UFCalc.onEditorChange) { UFCalc.onEditorChange(refresh); }
      if (UFCalc.onIgChange) { UFCalc.onIgChange(function () { setTimeout(refresh, 0); }); }
    } });
  }
})();
