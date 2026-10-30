/* UFCalcDop (etapa C5): Doppler obstétrico no laudo. Só razões dos IP digitados:
   - relação IP umbilical / IP cerebral média (campo existente no banco), 2 casas;
   - RCP = IP cerebral média / IP umbilical, só se o texto tiver a linha; p5 de Ebbing 2007
     (UOG 30:287, Tabela 5, 21-39 semanas), interpolado linearmente por dia entre semanas inteiras.
   Feto único. Só preenche campos que já existem. ES5 estrito. */
(function () {
  'use strict';
  var H = null, editor = null, busy = false, gen = 0, on = { dop: true };
  /* Ebbing 2007, Tabela 5, RCP, percentil 5 (semanas 21..39) */
  var P5 = { 21: 0.90, 22: 0.98, 23: 1.07, 24: 1.16, 25: 1.24, 26: 1.32, 27: 1.40, 28: 1.47, 29: 1.53, 30: 1.58,
    31: 1.62, 32: 1.64, 33: 1.65, 34: 1.63, 35: 1.60, 36: 1.55, 37: 1.48, 38: 1.40, 39: 1.29 };
  function p5(days) {   /* null fora de 21s0d..39s0d */
    if (days === null || days < 147 || days > 273) { return null; }
    var w = Math.floor(days / 7), r = days - w * 7;
    if (r === 0) { return P5[w]; }
    return P5[w] + (P5[w + 1] - P5[w]) * r / 7;
  }
  /* C6c: até 2 casas, sem zeros inúteis à direita (0,50 -> 0,5; 1,00 -> 1) */
  function f2(x) { var c = Math.round(x * 100), d = c % 100, s = String(Math.floor(c / 100)); if (d) { s += ',' + (d < 10 ? '0' : '') + d; s = s.replace(/0$/, ''); } return s; }

  function lineText(t) { var s = '', i; for (i = 0; i < t.length; i++) { s += t[i].s != null ? t[i].s : '#'; } return s; }
  function flds(t) { var o = [], i; for (i = 0; i < t.length; i++) { if (t[i].f && H.isNumFld(t[i].f)) { o.push(t[i].f); } } return o; }
  function scan() {
    var L = H.lines(), v = null, ua = null, acm = null, outs = [], li, t, s, c, fs;
    for (li = 0; li < L.length; li++) {
      t = L[li]; s = lineText(t); c = s.replace(/^[\s•\-–·*]+/, ''); fs = flds(t);
      if (/^\s*$/.test(s)) { v = null; continue; }
      if (/cerebroplacent|\bRCP\b/i.test(c) && fs.length) { outs.push({ k: 'rcp', f: fs[0], w: /p5 para\s*#\s*semanas\s*:\s*#/i.test(s) && fs.length >= 3 ? fs[1] : null, p: fs.length >= 3 ? fs[2] : null }); continue; }
      if (/IP\s+umbilical\s*\/\s*IP\s+cerebral\s+m[ée]dia/i.test(c) && fs.length) { outs.push({ k: 'rel', f: fs[0] }); continue; }
      if (/IP\s+cerebral\s+m[ée]dia\s*\/\s*IP\s+umbilical/i.test(c) && /^rela[çc][ãa]o\s*:/i.test(c) && fs.length) { outs.push({ k: 'inv', f: fs[0] }); continue; }   /* C6c: linha invertida */
      if (!fs.length && /^art[ée]ria\s+umbilical\b/i.test(c)) { v = 'ua'; continue; }
      if (!fs.length && /^art[ée]ria\s+cerebral\s+m[ée]dia\b/i.test(c)) { v = 'acm'; continue; }
      if (!fs.length) { if (/^(art[ée]ria|ducto|veia|fluxo|perfil)/i.test(c)) { v = null; } continue; }
      if (fs.length === 1 && /pulsatilidade|\(IP\)/i.test(c) && !/uterina/i.test(c) && v) {
        if (v === 'ua') { ua = ua ? 'dup' : fs[0]; } else { acm = acm ? 'dup' : fs[0]; }
      }
    }
    if (ua === 'dup') { ua = null; } if (acm === 'dup') { acm = null; }   /* mais de um: ambíguo */
    return { ua: ua, acm: acm, outs: outs };
  }

  /* campo calculado (mesmo comportamento da C2/C3) */
  function put(f, val, key) {
    var cur = String(f.textContent || ''), auto = f.getAttribute('data-auto');
    if (val === null) {
      var ch = false;
      if (auto !== null && cur === auto) { f.textContent = f.getAttribute('data-ph') || '___'; ch = true; }
      if (auto !== null) { f.removeAttribute('data-auto'); f.removeAttribute('data-src'); }
      return ch;
    }
    if (auto !== null && cur !== auto && f.getAttribute('data-src') === key) { return false; }
    if (auto === null && H.fldVal(f) !== null && f.getAttribute('data-man') === key) { return false; }
    var changed = cur !== val;
    if (changed) { f.textContent = val; }
    f.setAttribute('data-auto', val); f.setAttribute('data-src', key);
    return changed;
  }
  function tagOf(f) { var n = f.nextSibling; return n && H.hasCls(n, 'uc-dop') ? n : null; }
  function setTag(f, txt) {   /* " (abaixo do p5)" logo após o campo da RCP */
    var s = tagOf(f);
    if (txt === null) { if (s) { s.parentNode.removeChild(s); return true; } return false; }
    if (s) { s.ucGen = gen; if (s.textContent !== txt) { s.textContent = txt; return true; } return false; }
    var sp = document.createElement('span'); sp.className = 'uc-dop'; sp.setAttribute('contenteditable', 'false'); sp.textContent = txt; sp.ucGen = gen;
    f.parentNode.insertBefore(sp, f.nextSibling); return true;
  }
  function igDays() { return window.UFCalc && UFCalc.getIgRelatada ? UFCalc.getIgRelatada() : null; }
  function run() {
    if (busy || !editor) { return; }
    busy = true; gen++;
    var changed = false, sc, a, m, key, i, o, rcp, lim, d, txt;
    try {
      sc = scan(); a = sc.ua ? H.fldVal(sc.ua) : null; m = sc.acm ? H.fldVal(sc.acm) : null;
      var ok = on.dop && a !== null && m !== null && a > 0 && m > 0;
      key = a + '|' + m; d = igDays();
      for (i = 0; i < sc.outs.length; i++) {
        o = sc.outs[i];
        if (o.k === 'rel') { if (put(o.f, ok ? f2(a / m) : null, 'rel:' + key)) { changed = true; } continue; }
        if (o.k === 'inv') { if (put(o.f, ok ? f2(m / a) : null, 'inv:' + key)) { changed = true; } continue; }
        rcp = ok ? f2(m / a) : null;
        if (put(o.f, rcp, 'rcp:' + key)) { changed = true; }
        lim = ok ? p5(d) : null; txt = null;
        if (o.w && o.p) {
          if (put(o.w, lim !== null ? String(Math.floor(d / 7)) : null, 'w:' + key + '|' + d)) { changed = true; }
          if (put(o.p, lim !== null ? f2(lim) : null, 'p:' + key + '|' + d)) { changed = true; }
        }
        /* classificação só se o valor no campo for o calculado; compara os valores mostrados (2 casas) */
        if (lim !== null && o.f.textContent === rcp && Math.round(m / a * 100) < Math.round(lim * 100)) { txt = ' (abaixo do p5)'; }
        if (setTag(o.f, txt)) { changed = true; }
      }
      var sp = editor.querySelectorAll('.uc-dop'), q;
      for (q = sp.length - 1; q >= 0; q--) { if (sp[q].ucGen !== gen) { sp[q].parentNode.removeChild(sp[q]); changed = true; } }
      if (changed) {
        var ev;
        try { ev = new Event('input', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
        editor.dispatchEvent(ev);
      }
    } finally { busy = false; }
  }
  function onInput() {
    if (busy) { return; }
    var sel = window.getSelection ? window.getSelection() : null, n = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null, f = null, sc, i, a, m, key, d;
    while (n && n !== editor) { if (H.hasCls(n, 'fld')) { f = n; break; } n = n.parentNode; }
    if (f) {
      sc = scan(); a = sc.ua ? H.fldVal(sc.ua) : null; m = sc.acm ? H.fldVal(sc.acm) : null; key = a + '|' + m; d = igDays();
      for (i = 0; i < sc.outs.length; i++) {
        var o = sc.outs[i], k = null;
        if (o.f === f) { k = o.k + ':' + key; } else if (o.w === f) { k = 'w:' + key + '|' + d; } else if (o.p === f) { k = 'p:' + key + '|' + d; }
        if (k) { f.setAttribute('data-man', k); if (f.getAttribute('data-auto') !== null && f.textContent !== f.getAttribute('data-auto')) { f.setAttribute('data-src', k); } }
      }
    }
    run();
  }
  function init() {
    editor = document.getElementById('editor'); H = window.UFCalcVol && UFCalcVol._h;
    if (!editor || !H) { return; }
    if (editor.addEventListener) { editor.addEventListener('input', onInput, false); } else { editor.attachEvent('oninput', onInput); }
    if (window.UFCalc && UFCalc.onIgChange) { UFCalc.onIgChange(function () { run(); }); }
    run();
  }
  /* C6c: trocar a ordem da linha "Relação" no próprio texto (AU/ACM <-> ACM/AU); o V.R. inverte junto (< 1 <-> > 1) */
  var SW = [[/IP umbilical \/ IP cerebral m[ée]dia/, 'IP cerebral média / IP umbilical'], [/IP cerebral m[ée]dia \/ IP umbilical/, 'IP umbilical / IP cerebral média']];
  function lineOf(f) { var n = f; while (n && n !== editor && !(n.nodeType === 1 && /^(DIV|P|LI)$/.test(n.nodeName))) { n = n.parentNode; } return n; }
  function orient(want) {   /* want: 'rel' (AU/ACM) ou 'inv' (ACM/AU) */
    if (!editor) { return 0; }
    var sc = scan(), i, o, ln, w, tn, done = 0;
    for (i = 0; i < sc.outs.length; i++) {
      o = sc.outs[i]; if ((o.k !== 'rel' && o.k !== 'inv') || o.k === want) { continue; }
      ln = lineOf(o.f); if (!ln) { continue; }
      w = document.createTreeWalker ? document.createTreeWalker(ln, 4, null, false) : null; if (!w) { continue; }
      while ((tn = w.nextNode())) {
        if (tn.parentNode && H.hasCls(tn.parentNode, 'fld')) { continue; }
        var v = tn.nodeValue, nv = v.replace(SW[o.k === 'rel' ? 0 : 1][0], SW[o.k === 'rel' ? 0 : 1][1]);
        nv = o.k === 'rel' ? nv.replace(/\(V\.R\.:\s*<\s*1\)/, '(V.R.: > 1)') : nv.replace(/\(V\.R\.:\s*>\s*1\)/, '(V.R.: < 1)');
        if (nv !== v) { tn.nodeValue = nv; }
      }
      o.f.removeAttribute('data-man'); done++;
    }
    run();
    return done;
  }
  function status() {
    if (!H) { return null; }
    var sc = scan(), a = sc.ua ? H.fldVal(sc.ua) : null, m = sc.acm ? H.fldVal(sc.acm) : null, n = sc.outs.length, q, btn = document.getElementById('ucDopOrd');
    if (btn) { var inv = false; for (q = 0; q < sc.outs.length; q++) { if (sc.outs[q].k === 'inv') { inv = true; } } btn.setAttribute('data-ord', inv ? 'inv' : 'rel'); btn.disabled = !n; }
    if (!n) { return { ready: false, tip: 'Sem a linha "Relação" ou da RCP no laudo' }; }
    return a && m ? { ready: true, tip: 'Pronto: AU/ACM ' + f2(a / m) + ', ACM/AU ' + f2(m / a) } : { ready: false, tip: 'Faltam o IP umbilical e o IP da cerebral média' };
  }
  /* botão discreto: inverte a linha "Relação" do laudo (AU/ACM <-> ACM/AU) */
  function extra(row) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'ucDopOrd'; btn.className = 'uc-mini'; btn.title = 'Inverter a relação no laudo (AU/ACM ↔ ACM/AU)'; btn.setAttribute('aria-label', btn.title);
    btn.appendChild(document.createTextNode('\u21c5'));
    btn.onmousedown = function (e) { if (e && e.preventDefault) { e.preventDefault(); } };
    btn.onclick = function () { orient(btn.getAttribute('data-ord') === 'inv' ? 'rel' : 'inv'); if (window.UFCalcVol) { UFCalcVol.refresh(); } };
    row.appendChild(btn);
  }
  window.UFCalcDop = { init: init, run: run, scan: scan, p5: p5, f2: f2, P5: P5, orient: orient, set: function (v) { on.dop = !!v; run(); } };
  if (window.UFCalcVol) { UFCalcVol.addToggle('ucDop', 'Doppler: relação AU/ACM e RCP', true, function (v) { on.dop = !!v; run(); },
    'Relação = IP da artéria umbilical ÷ IP da cerebral média (ou o inverso, se a linha estiver invertida). RCP = IP cerebral média ÷ IP umbilical, com p5 de Ebbing 2007 (interpolado por dia) quando houver IG relatada. Até 2 casas decimais, sem zeros finais.', status, extra, 'obst'); }
})();
