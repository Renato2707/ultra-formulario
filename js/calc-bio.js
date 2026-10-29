/* UFCalcBio (etapa C3): biometria fetal calculada em tempo real no laudo.
   Fórmulas definidas pelo médico responsável (não alterar):
   - PFE, Hadlock 1985 (4 parâmetros, cm): log10(PFE g) = 1,3596 − 0,00386·CA·CF + 0,0064·CC + 0,00061·DBP·CA + 0,0424·CA + 0,174·CF
   - IG composta, Hadlock 1984 (cm): IG sem = 10,85 + 0,060·(CC·CF) + 0,670·DBP + 0,168·CA
   - IG pelo PFE (opcional): inverso de Hadlock 1991, ln(PFE) = 0,578 + 0,332·IG − 0,00354·IG², raiz menor; 14–42 sem.
   Campos do banco em mm; cm só dentro do cálculo. Só preenche campos que já existem. ES5 estrito. */
(function () {
  'use strict';
  var H = null, editor = null, busy = false;
  var on = { pfe: true, ig: true, igp: false };
  var LAB = [
    ['bpd', /(^|\()\s*(diâmetro biparietal|dbp)\b/i],
    ['hc', /(^|\()\s*(circunferência cefálica|perímetro cefálico|cc)\b/i],
    ['ac', /(^|\()\s*(circunferência abdominal|ca)\b/i],
    ['fl', /(^|\()\s*(comprimento do fêmur|comprimento femoral|cf)\b/i]
  ];

  /* ---------- fórmulas (puras; expostas para teste) ---------- */
  function pfe(m) {   /* m em mm */
    var b = m.bpd / 10, h = m.hc / 10, a = m.ac / 10, f = m.fl / 10;
    return Math.pow(10, 1.3596 - 0.00386 * a * f + 0.0064 * h + 0.00061 * b * a + 0.0424 * a + 0.174 * f);
  }
  function igComp(m) {
    var b = m.bpd / 10, h = m.hc / 10, a = m.ac / 10, f = m.fl / 10;
    return 10.85 + 0.060 * (h * f) + 0.670 * b + 0.168 * a;
  }
  function igPeso(g) {
    var A = 0.00354, B = -0.332, C = Math.log(g) - 0.578, disc = B * B - 4 * A * C, ig;
    if (!(g > 0) || disc < 0) { return null; }
    ig = (-B - Math.sqrt(disc)) / (2 * A);
    return (ig >= 14 && ig <= 42) ? ig : null;
  }
  function semDias(ig) {   /* arredonda ao dia mais próximo */
    var d = Math.round(ig * 7), w = Math.floor(d / 7), r = d - w * 7;
    return { w: w, d: r, txt: w + ' semanas e ' + r + (r <= 1 ? ' dia' : ' dias') };
  }

  /* ---------- leitura do laudo em blocos de biometria ---------- */
  function lineText(t) { var s = '', i; for (i = 0; i < t.length; i++) { s += t[i].s != null ? t[i].s : '#'; } return s; }
  function flds(t) { var o = [], i; for (i = 0; i < t.length; i++) { if (t[i].f) { o.push(i); } } return o; }
  function scan() {
    var L = H.lines(), blocks = [], cur = null, fetus = null, outs = [], li, t, s, clean, fi, k, m, lab;
    function newBlock(label) { cur = { label: label, m: {}, pfe: null }; blocks.push(cur); }
    for (li = 0; li < L.length; li++) {
      t = L[li]; s = lineText(t); clean = s.replace(/^[\s•\-–·*]+/, ''); fi = flds(t);
      if ((m = /^\s*feto\s+([A-Z0-9])\b/i.exec(clean)) && !/equivalente/i.test(clean)) { fetus = m[1].toUpperCase(); }
      if (!fi.length && /^biometria fetal\b/i.test(clean)) {
        m = /^biometria fetal\s+([A-Z0-9])\s*:?\s*$/i.exec(clean);
        newBlock(m ? m[1].toUpperCase() : fetus); continue;
      }
      if (fi.length === 1 && H.isNumFld(t[fi[0]].f)) {
        var after = H.nextText(t, fi[0]);
        lab = null;
        if (/^\s*mm\b/i.test(after) && !/\//.test(s.split('#')[0])) { for (k = 0; k < LAB.length; k++) { if (LAB[k][1].test(clean)) { lab = LAB[k][0]; break; } } }
        if (lab) {
          if (!cur || cur.m[lab]) { newBlock(fetus); }
          cur.m[lab] = t[fi[0]].f; continue;
        }
        if (/peso fetal estimado/i.test(clean) && /^\s*gramas\b/i.test(after)) {
          if (cur && !cur.pfe) { cur.pfe = t[fi[0]].f; } continue;
        }
        if (/^\s*semanas\b/i.test(after)) {
          var kind = /composta/i.test(clean) && /equivalente/i.test(clean) ? 'ig' : (/pelo (peso|pfe)/i.test(clean) ? 'igp' : null);
          if (kind) { m = /feto\s+([A-Z0-9])\b/i.exec(clean); outs.push({ kind: kind, f: t[fi[0]].f, label: m ? m[1].toUpperCase() : null, tok: t, idx: fi[0] }); }
        }
      }
    }
    var full = [], i, j;
    for (i = 0; i < blocks.length; i++) { if (blocks[i].m.bpd || blocks[i].m.hc || blocks[i].m.ac || blocks[i].m.fl) { full.push(blocks[i]); } }
    for (i = 0; i < outs.length; i++) {   /* liga cada linha de IG ao bloco certo */
      var o = outs[i], hit = [];
      for (j = 0; j < full.length; j++) { if (o.label ? full[j].label === o.label : true) { hit.push(full[j]); } }
      o.block = hit.length === 1 ? hit[0] : null;
    }
    return { blocks: full, outs: outs };
  }
  function vals(b) {
    var r = {}, k, v;
    for (k = 0; k < LAB.length; k++) { if (!b.m[LAB[k][0]]) { return null; } v = H.fldVal(b.m[LAB[k][0]]); if (v === null || !(v > 0)) { return null; } r[LAB[k][0]] = v; }
    return r;
  }

  /* ---------- escrita (mesmo comportamento da C2 para edição manual) ---------- */
  function sufOf(f) { var n = f.nextSibling, x = n && n.nodeType === 3 ? n.nextSibling : null; return x && H.hasCls(x, 'uc-suf') ? x : null; }
  function setSuf(f, txt) {   /* " e N dia(s)" logo depois da palavra "semanas" que segue o campo */
    var s = sufOf(f), n = f.nextSibling, m;
    if (txt === null) { if (s) { var p = s.parentNode, prev = s.previousSibling; p.removeChild(s); if (prev && prev.nextSibling && prev.nextSibling.nodeType === 3) { prev.nodeValue += prev.nextSibling.nodeValue; p.removeChild(prev.nextSibling); } } return; }
    if (s) { if (s.textContent !== txt) { s.textContent = txt; } return; }
    if (!n || n.nodeType !== 3 || !(m = /^\s*semanas/i.exec(n.nodeValue))) { return; }
    var rest = n.splitText(m[0].length), sp = document.createElement('span');
    sp.className = 'uc-suf'; sp.setAttribute('contenteditable', 'false'); sp.textContent = txt;
    rest.parentNode.insertBefore(sp, rest);
  }
  function put(f, val, key, suf) {
    var cur = String(f.textContent || ''), auto = f.getAttribute('data-auto'), changed = false;
    if (val === null) {
      if (auto !== null && cur === auto) { f.textContent = f.getAttribute('data-ph') || '___'; changed = true; }
      if (auto !== null) { f.removeAttribute('data-auto'); f.removeAttribute('data-src'); }
      if (sufOf(f)) { setSuf(f, null); changed = true; }
      return changed;
    }
    if (auto !== null && cur !== auto && f.getAttribute('data-src') === key) { if (sufOf(f)) { setSuf(f, null); return true; } return false; }
    if (auto === null && H.fldVal(f) !== null && f.getAttribute('data-man') === key) { return false; }
    if (cur !== val) { f.textContent = val; changed = true; }
    f.setAttribute('data-auto', val); f.setAttribute('data-src', key);
    if (suf !== undefined) { var before = sufOf(f) ? sufOf(f).textContent : null; setSuf(f, suf); if (before !== suf) { changed = true; } }
    return changed;
  }
  function compute(b) {
    var m = vals(b), r = { key: m ? [m.bpd, m.hc, m.ac, m.fl].join('|') : null, pfe: null, ig: null, igp: null }, g, ig;
    if (!m) { return r; }
    g = pfe(m); if (isFinite(g) && g > 0 && g <= 10000) { r.pfe = Math.round(g); }
    ig = igComp(m); if (isFinite(ig) && ig >= 10 && ig <= 45) { r.ig = ig; }
    if (r.pfe !== null) { r.igp = igPeso(r.pfe); }   /* usa o PFE arredondado exibido no laudo */
    return r;
  }
  function run() {
    if (busy || !editor) { return; }
    busy = true;
    var changed = false, sc, i, b, r, o, sd;
    try {
      sc = scan();
      for (i = 0; i < sc.blocks.length; i++) {
        b = sc.blocks[i]; b.r = compute(b);
        if (b.pfe) { if (put(b.pfe, on.pfe && b.r.pfe !== null ? String(b.r.pfe) : null, b.r.key)) { changed = true; } }
      }
      for (i = 0; i < sc.outs.length; i++) {
        o = sc.outs[i]; r = o.block ? o.block.r : null;
        var v = r ? (o.kind === 'ig' ? (on.ig ? r.ig : null) : (on.igp ? r.igp : null)) : null;
        sd = v !== null ? semDias(v) : null;
        if (put(o.f, sd ? String(sd.w) : null, r ? o.kind + ':' + r.key : '', sd ? ' e ' + sd.d + (sd.d <= 1 ? ' dia' : ' dias') : null)) { changed = true; }
      }
      if (changed) {
        var ev;
        try { ev = new Event('input', { bubbles: true }); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); }
        editor.dispatchEvent(ev);
      }
    } finally { busy = false; }
  }
  function onInput() {
    if (busy) { return; }
    var sel = window.getSelection ? window.getSelection() : null, n = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null, f = null, sc, i;
    while (n && n !== editor) { if (H.hasCls(n, 'fld')) { f = n; break; } n = n.parentNode; }
    if (f) {
      sc = scan();
      for (i = 0; i < sc.blocks.length; i++) { if (sc.blocks[i].pfe === f) { mark(f, compute(sc.blocks[i]).key); } }
      for (i = 0; i < sc.outs.length; i++) { if (sc.outs[i].f === f && sc.outs[i].block) { mark(f, sc.outs[i].kind + ':' + compute(sc.outs[i].block).key); } }
    }
    run();
  }
  function mark(f, key) { f.setAttribute('data-man', key); if (f.getAttribute('data-auto') !== null && f.textContent !== f.getAttribute('data-auto')) { f.setAttribute('data-src', key); } }
  function init() {
    editor = document.getElementById('editor'); H = window.UFCalcVol && UFCalcVol._h;
    if (!editor || !H) { return; }
    if (editor.addEventListener) { editor.addEventListener('input', onInput, false); } else { editor.attachEvent('oninput', onInput); }
    run();
  }
  function setter(k) { return function (v) { on[k] = !!v; run(); }; }
  window.UFCalcBio = { init: init, run: run, scan: scan, pfe: pfe, igComp: igComp, igPeso: igPeso, semDias: semDias,
    set: function (k, v) { setter(k)(v); }, get: function (k) { return on[k]; } };
  if (window.UFCalcVol) {
    UFCalcVol.addToggle('ucPfe', 'Peso fetal estimado (PFE)', true, setter('pfe'));
    UFCalcVol.addToggle('ucIgc', 'IG pela biometria composta', true, setter('ig'));
    UFCalcVol.addToggle('ucIgp', 'IG pelo PFE', false, setter('igp'));
  }
})();
