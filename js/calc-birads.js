/* UFBirads (etapa C7b): BI-RADS de ultrassom de mama (ACR BI-RADS v2025, léxico de US; termos do CBR).
   Sem pontuação: a categoria é do médico. Sugestão só onde o manual tem regra escrita (página no title);
   nos demais casos "requer julgamento". 4 exige 4A/4B/4C. Categoria final do exame pela hierarquia
   5 > 4 > 0 > 6 > 3 > 2 > 1 (empate: o primeiro do laudo). Nada é gravado (só nesta janela). ES5 estrito. */
(function () {
  'use strict';
  var CATS = ['0', '1', '2', '3', '4A', '4B', '4C', '5', '6'];
  var CATL = { '0': 'incompleta', '1': 'negativa', '2': 'benigna', '3': 'provavelmente benigna', '4A': 'baixa suspeita', '4B': 'suspeita moderada', '4C': 'alta suspeita', '5': 'altamente sugestiva de malignidade', '6': 'malignidade comprovada por biópsia' };
  var HIER = ['5', '4', '0', '6', '3', '2', '1'];
  function rank(c) { return HIER.indexOf(String(c).charAt(0)); }
  function normCat(s) {
    s = String(s == null ? '' : s).replace(/[\s*_.:;,\-]/g, '').toUpperCase();
    return /^([0-35-6]|4[ABC])$/.test(s) ? s : null;
  }
  /* categoria final: a primeira de maior posição na hierarquia; null se nenhuma */
  function finalCat(list) {
    var i, b = null, c;
    for (i = 0; i < list.length; i++) { c = normCat(list[i]); if (c && (b === null || rank(c) < rank(b))) { b = c; } }
    return b;
  }
  /* léxico v2025: [chave, rótulo no cartão, opção do banco (regex)] */
  var G = {
    forma: [['oval', 'oval', /^oval/i], ['lob', 'lobulada', /^lobulad/i], ['red', 'redonda', /^redond/i], ['irr', 'irregular', /^irregular/i]],
    orient: [['par', 'paralela', /^paralel/i], ['nao', 'não paralela', /^n[ãa]o paralel/i]],
    marg: [['circ', 'circunscrita', /^circunscrit/i], ['ind', 'não circunscrita: indistinta', /indistint/i], ['ang', 'não circunscrita: angular', /angular/i], ['mic', 'não circunscrita: microlobulada', /microlobulad/i], ['esp', 'não circunscrita: espiculada', /espiculad/i]],
    eco: [['anec', 'anecoico', /^anecoic/i], ['hiper', 'hiperecogênico', /^hiperecog/i], ['iso', 'isoecogênico', /^isoecog/i], ['hipo', 'hipoecogênico', /^hipoecog/i], ['het', 'heterogêneo', /^heterog/i], ['misto', 'misto sólido e cístico', /^misto/i]],
    post: [['aus', 'ausentes', /^sem caracter[íi]sticas ac[úu]stic/i], ['ref', 'reforço', /refor[çc]o/i], ['som', 'sombra', /sombra/i]],
    calc: [['sem', 'sem calcificações', /^sem calcifica/i], ['macro', 'macrocalcificações', /macrocalcifica/i], ['micro', 'microcalcificações', /microcalcifica/i], ['intra', 'intraductais', /intraduct/i]],
    assoc: [['sem', 'sem características associadas', /^sem caracter[íi]sticas associad/i], ['pseudo', 'pseudocápsula ecogênica', /pseudoc[áa]psula/i], ['halo', 'halo ecogênico espesso', /halo/i], ['dist', 'distorção arquitetural', /distor[çc][ãa]o/i], ['duct', 'alterações ductais', /altera[çc][õo]es ductais/i], ['espc', 'espessamento cutâneo', /espessamento cut/i], ['retr', 'retração cutânea', /retra[çc][ãa]o cut/i], ['edema', 'edema', /edema/i],
      ['avasc', 'avascular', /^avascular/i], ['vint', 'vascularização interna', /vasculariza[çc][ãa]o interna/i], ['vper', 'hipervascularização periférica', /hipervasculariza/i], ['emole', 'mole', /consist[êe]ncia mole/i], ['einter', 'intermediária', /consist[êe]ncia intermedi/i], ['edura', 'dura', /consist[êe]ncia dura/i]],
    lado: [['direita', 'direita', /^direit/i], ['esquerda', 'esquerda', /^esquerd/i]],
    quad: [['QSL', 'QSL', /^QSL$/], ['QSM', 'QSM', /^QSM$/], ['QIL', 'QIL', /^QIL$/], ['QIM', 'QIM', /^QIM$/], ['UQS', 'UQS', /^UQS$/], ['UQI', 'UQI', /^UQI$/], ['UQL', 'UQL', /^UQL$/], ['UQM', 'UQM', /^UQM$/], ['retro', 'retroareolar', /^retroareolar/i]],
    dist: [['reg', 'regional', /^regional/i], ['foc', 'focal', /^focal/i], ['lin', 'linear', /^linear/i], ['seg', 'segmentar', /^segmentar/i]],
    ctg: [['min', 'mínimo', /^m[íi]nimo/i], ['leve', 'leve', /^leve/i], ['mod', 'moderado', /^moderado/i], ['acen', 'acentuado', /^acentuado/i]]
  };
  var ASSOC = ['pseudo', 'halo', 'dist', 'duct', 'espc', 'retr', 'edema'];
  var TIPOS = [['nod', 'nódulo'], ['simples', 'cisto simples'], ['compl', 'cisto complicado'], ['micro', 'microcistos agrupados'], ['linfo', 'linfonodo intramamário'], ['lnn', 'lesão não nodular'], ['absc', 'abscesso'], ['ben', 'achado benigno conhecido (coleção pós-cirúrgica, implante, nódulo benigno)']];
  var TSUM = { nod: 'Nódulo', simples: 'Cisto simples', compl: 'Cisto complicado', micro: 'Microcistos', linfo: 'Linfonodo', lnn: 'Lesão não nodular', absc: 'Abscesso', ben: 'Achado benigno' };
  var DESC = { nod: 1, absc: 1, ben: 1 };   /* tipos que usam os descritores de nódulo */
  /* frase do banco por tipo (sempre do banco carregado, nunca uma cópia no código) */
  var PH = {
    nod: /^\s*Observa-se n[óo]dulo de forma/i, simples: /sugestiv[ao] de cisto simples/i, compl: /sugestiv[ao] de cisto complicado/i,
    micro: /microcistos agrupados/i, linfo: /sugestiv[ao] de linfonodo intramam/i, lnn: /les[ãa]o n[ãa]o nodular/i
  };
  var MARK = /BI-RADS(?:-US)?\s*$/i;

  /* ---------- regras escritas do manual (proposta C7, item 2) ---------- */
  function has(a, k) { return !!a && a.indexOf(k) >= 0; }
  function suggest(v) {
    var t = v.tipo;
    if (!t) { return null; }
    if (v.bx) { return { c: '6', r: 'Malignidade comprovada por biópsia', p: 'p.472' }; }
    if (t === 'simples') { return v.cs && v.cs.length === 4 ? { c: '2', r: 'Cisto simples (circunscrito, oval ou redondo, anecoico, parede fina)', p: 'p.418; p.474; p.486' } : { c: null }; }
    if (t === 'compl') { return v.mult ? { c: '2', r: 'Cistos benignos múltiplos (simples e/ou complicados)', p: 'p.474; p.479' } : { c: '3', r: 'Cisto complicado isolado', p: 'p.475' }; }
    if (t === 'micro') {
      if (v.mic === 'fino') { return { c: '2', r: 'Microcistos agrupados (septos <0,5 mm, sem componente sólido)', p: 'p.420' }; }
      if (v.mic === 'susp') { return { c: '4', r: 'Microcistos agrupados com margem indistinta ou componente sólido discreto', p: 'p.420' }; }
      return { c: null };
    }
    if (t === 'linfo') { return v.tip ? { c: '2', r: 'Linfonodo intramamário tipicamente benigno', p: 'p.223; p.474' } : { c: null }; }
    if (t === 'ben') { return { c: '2', r: 'Achado benigno citado na categoria 2', p: 'p.474' }; }
    if (t === 'absc') {
      if (v.abs === 'comp') { return { c: '2', r: 'Abscesso compatível', p: 'p.485-486' }; }
      if (v.abs === 'prov') { return { c: '3', r: 'Provável abscesso, com US de controle', p: 'p.485-486' }; }
      return { c: null };
    }
    if (t === 'lnn') { return { c: '4', r: 'Lesão não nodular verdadeira (VPP >2%: biópsia)', p: 'p.351' }; }
    if (t === 'nod') {
      if (v.marg === 'circ' && v.mbil) { return { c: '2', r: 'Múltiplos nódulos sólidos circunscritos bilaterais, semelhantes, de aspecto tipicamente benigno', p: 'p.223' }; }
      if (v.forma === 'oval' && v.orient === 'par' && v.marg === 'circ' && v.eco === 'hipo' && v.post === 'aus' && !(v.calc && v.calc.length) && !(v.assoc && v.assoc.length) && !v.vasc && !v.elas) {
        return { c: '3', r: 'Nódulo sólido oval, circunscrito, paralelo, hipoecogênico, sem outra característica', p: 'p.475; p.486' };
      }
    }
    return { c: null };
  }
  function sugText(s) { return !s ? '' : (s.c ? 'sugestão ' + s.c : 'requer julgamento'); }
  function sugTip(s) {
    if (!s) { return ''; }
    if (!s.c) { return 'Sem regra escrita no manual para esta combinação: a categoria é julgamento do médico (4A/4B/4C/5 ou outra).'; }
    return s.r + ' (ACR BI-RADS v2025, ' + s.p + ')' + (s.c === '4' ? '. Escolha 4A, 4B ou 4C.' : '') + (s.c === '3' ? ' Categoria 3 não deve ser usada no rastreamento puro (p.475).' : '');
  }

  /* ---------- utilidades ---------- */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.appendChild(document.createTextNode(txt)); } return e; }
  function on(e, ev, fn) { if (e.addEventListener) { e.addEventListener(ev, fn, false); } else { e.attachEvent('on' + ev, fn); } }
  function setTxt(e, t) { e.innerHTML = ''; e.appendChild(document.createTextNode(t)); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function cleanNum(v) { v = String(v == null ? '' : v).replace(/[\s*_]/g, '').replace(/mm$/i, ''); return /^\d+([.,]\d+)?$/.test(v) ? v : ''; }
  function cleanHora(v) {
    v = String(v == null ? '' : v).replace(/[\s*_]/g, '').replace(/h(oras?|s)?$/i, '');
    if (/^\d{1,2}(:\d{2})?$/.test(v)) { var h = parseInt(v, 10); return h >= 1 && h <= 12 ? v : ''; }
    return '';
  }
  function keyOf(g, opt) { var l = G[g], i; opt = trim(opt); for (i = 0; i < l.length; i++) { if (l[i][2].test(opt)) { return l[i][0]; } } return null; }
  function groupOf(opts) {   /* qual campo do léxico é esta lista de escolha do banco */
    var best = null, bn = 0, g, i, n;
    for (g in G) { if (G.hasOwnProperty(g)) { n = 0; for (i = 0; i < opts.length; i++) { if (keyOf(g, opts[i]) !== null) { n++; } } if (n > bn) { bn = n; best = g; } } }
    return bn >= Math.min(2, opts.length) ? best : null;
  }

  /* ---------- frase do banco ---------- */
  function bankBodies() {
    var S = window.UFTest && UFTest.S, B = S && S.bank, i, j, k, out = [];
    if (!B || !B.exams) { return out; }
    for (i = 0; i < B.exams.length; i++) {
      for (j = 0; j < (B.exams[i].sections || []).length; j++) { for (k = 0; k < B.exams[i].sections[j].phrases.length; k++) { out.push(B.exams[i].sections[j].phrases[k].body); } }
      for (j = 0; j < (B.exams[i].templates || []).length; j++) { out = out.concat(String(B.exams[i].templates[j].body).split('\n')); }
    }
    return out;
  }
  function markCount(t) { var m = String(t).match(/BI-RADS(?:-US)?\s*\*(?!\*)/gi); return m ? m.length : 0; }
  function bankPhrase(tipo) {
    var re = PH[DESC[tipo] ? 'nod' : tipo], L = bankBodies(), i, t;
    if (!re) { return null; }
    for (i = 0; i < L.length; i++) {
      t = String(L[i] || '').replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
      if (t && re.test(t) && markCount(t) === 1 && !/\n/.test(t)) { return t; }
    }
    return null;
  }
  function choiceHtml(opts, i) {
    var o = esc(JSON.stringify(opts));
    if (i < 0) { return '<span class="fld f-sel" contenteditable="false" data-t="s" data-o="' + o + '">escolher</span>'; }
    return '<span class="fld f-sel f-ok" contenteditable="false" data-t="s" data-v="' + i + '" data-o="' + o + '" title="Clique para trocar">' + esc(opts[i]) + '</span>';
  }
  function multiHtml(opts, mv) {
    var o = esc(JSON.stringify(opts)), t = [], i;
    if (!mv.length) { return '<span class="fld f-sel f-multi" contenteditable="false" data-t="s" data-m="1" data-o="' + o + '">escolher</span>'; }
    for (i = 0; i < mv.length; i++) { t.push(opts[mv[i]]); }
    return '<span class="fld f-sel f-multi f-ok" contenteditable="false" data-t="s" data-m="1" data-v="' + mv.join(',') + '" data-o="' + o + '" title="Clique para trocar (várias opções)">' + esc(UltraParser.joinMulti(t)) + '</span>';
  }
  function idxOf(opts, g, k) { var i; if (k == null) { return -1; } for (i = 0; i < opts.length; i++) { if (keyOf(g, opts[i]) === k) { return i; } } return -1; }
  /* frase do banco com os valores do cartão nos marcadores */
  function sentenceHtml(ph, v) {
    var fs = UltraParser.fieldsOf(ph), out = '', pos = 0, i, f, g, before, after, mi = 0, val, k, mv, a;
    var MM = [v.l, v.ap, v.t];
    for (i = 0; i < fs.length; i++) {
      f = fs[i]; if (f.offset < pos) { continue; }
      before = ph.substring(0, f.offset); after = ph.substring(f.offset + f.raw.length, i + 1 < fs.length ? fs[i + 1].offset : ph.length);
      out += esc(ph.substring(pos, f.offset)); pos = f.offset + f.raw.length;
      if (f.type === 'select') {
        g = groupOf(f.options);
        if (f.multi && (g === 'calc' || g === 'assoc')) {
          a = g === 'calc' ? (v.calc || []) : (v.assoc || []).concat(v.vasc ? [v.vasc] : []).concat(v.elas ? [v.elas] : []);
          mv = [];
          if (!a.length) { k = idxOf(f.options, g, 'sem'); if (k >= 0 && v.descOk) { mv.push(k); } }
          for (k = 0; k < a.length; k++) { var q = idxOf(f.options, g, a[k]); if (q >= 0 && mv.indexOf(q) < 0) { mv.push(q); } }
          mv.sort(function (x, y) { return x - y; });
          out += multiHtml(f.options, mv); continue;
        }
        if (f.multi) { out += multiHtml(f.options, []); continue; }
        out += choiceHtml(f.options, g ? idxOf(f.options, g, v[g]) : -1); continue;
      }
      val = '';
      if (MARK.test(before)) { val = v.cat || ''; }
      else if (/^\s*(h|hs|horas?)\b/i.test(after)) { val = v.hora; }
      else if (/^\s*mm da papila/i.test(after)) { val = v.pap; }
      else if (/^\s*mm da pele/i.test(after)) { val = v.pele; }
      else if (mi < 3 && (/^\s*[x\u00d7]\s*$/i.test(after) || /[x\u00d7]\s*$/i.test(before))) { val = MM[mi]; mi++; }
      var t = f.type === 'text' ? 't' : (f.decimal ? 'd' : 'n'), phd = t === 't' ? 'texto' : (t === 'd' ? '__,_' : '___');
      out += val ? '<span class="fld f-ok" data-t="' + t + '" data-ph="' + phd + '">' + esc(val) + '</span>' : '<span class="fld" data-t="' + t + '" data-ph="' + phd + '">' + phd + '</span>';
    }
    return out + esc(ph.substring(pos));
  }

  /* ---------- laudo: categoria de cada achado, categoria final e legenda ---------- */
  var ed = null, busy = false, txtOn = true, kept = null;
  function blockOf(n) { while (n && n !== ed && !(n.nodeType === 1 && /^(DIV|P|LI)$/.test(n.nodeName))) { n = n.parentNode; } return n; }
  function isMarkFld(f) {
    if (!f || f.getAttribute('data-t') === 's') { return false; }
    var p = f.previousSibling; return !!p && p.nodeType === 3 && MARK.test(p.nodeValue || '');
  }
  function filledVal(f) { var t = trim(f.textContent); return t === '' || t === f.getAttribute('data-ph') || /^_+$/.test(t) ? '' : t; }
  /* {nod: [{f, cat}], fin: [f]} */
  function scan() {
    var out = { nod: [], fin: [] }, fs, i, b;
    if (!ed) { return out; }
    fs = ed.querySelectorAll('.fld');
    for (i = 0; i < fs.length; i++) {
      if (!isMarkFld(fs[i])) { continue; }
      b = blockOf(fs[i]);
      if (b && b !== ed && b.querySelectorAll('.fld').length > 1) { out.nod.push({ f: fs[i], cat: normCat(filledVal(fs[i])) }); }
      else { out.fin.push(fs[i]); }
    }
    return out;
  }
  function putF(f, val) {   /* valor digitado à mão é respeitado */
    var cur = String(f.textContent || ''), auto = f.getAttribute('data-auto');
    if (val === null) { if (auto !== null) { if (cur === auto) { f.textContent = f.getAttribute('data-ph') || '___'; } f.removeAttribute('data-auto'); return cur === auto; } return false; }
    if (auto === null && filledVal(f) !== '') { return false; }
    if (auto !== null && cur !== auto) { return false; }
    if (cur === val) { return false; }
    f.textContent = val; f.setAttribute('data-auto', val); return true;
  }
  var LEG = /^\s*Categoria\s+(0|1|2|3|4\s*[ABCabc]?|5|6)(?![0-9A-Za-z])/i;
  function legCode(n) { var m = LEG.exec(n.textContent || ''); return m ? m[1].replace(/\s+/g, '').toUpperCase() : null; }
  function isBrl(n) { return n && n.nodeType === 1 && (' ' + n.className + ' ').indexOf(' uc-brl ') >= 0; }
  function keptOk() { return kept && kept.par && ed.contains(kept.par) && (!kept.ref || kept.ref.parentNode === kept.par); }
  function restore() {
    var ch = false, i, b = ed.querySelectorAll('.uc-brl');
    for (i = b.length - 1; i >= 0; i--) { if (b[i].getAttribute('data-auto') === b[i].textContent) { b[i].parentNode.removeChild(b[i]); ch = true; } }
    if (keptOk()) { for (i = kept.nodes.length - 1; i >= 0; i--) { kept.par.insertBefore(kept.nodes[i], kept.ref ? kept.ref.nextSibling : kept.par.firstChild); } ch = true; }
    kept = null; return ch;
  }
  /* com categoria final: só a linha da legenda dessa categoria fica (a conduta é uma só); sem: a legenda volta */
  function legend(F) {
    var ch = false, i, c, ls = [], all, want = null, cur;
    if (kept && !keptOk()) { kept = null; }
    if (!F) { return kept || ed.querySelector('.uc-brl') ? restore() : false; }
    if (!kept) {
      all = ed.querySelectorAll('div,p');
      for (i = 0; i < all.length; i++) { c = all[i]; if (!isBrl(c) && !c.querySelector('div,p,.fld') && legCode(c)) { ls.push(c); } }
      if (ls.length < 1) { return false; }
      for (i = 1; i < ls.length; i++) { if (ls[i].parentNode !== ls[0].parentNode) { ls = ls.slice(0, i); break; } }
      kept = { par: ls[0].parentNode, ref: ls[0].previousSibling, nodes: ls };
      for (i = 0; i < ls.length; i++) { ls[i].parentNode.removeChild(ls[i]); } ch = true;
    }
    for (i = 0; i < kept.nodes.length; i++) { if (legCode(kept.nodes[i]) === F) { want = kept.nodes[i].textContent; break; } }
    if (want === null) { return restore() || ch; }
    cur = kept.ref ? kept.ref.nextSibling : kept.par.firstChild;
    while (cur && cur.nodeType === 3 && !/\S/.test(cur.nodeValue)) { cur = cur.nextSibling; }
    if (isBrl(cur)) {
      if (cur.getAttribute('data-auto') === cur.textContent && cur.textContent !== want) { cur.textContent = want; cur.setAttribute('data-auto', want); ch = true; }
      return ch;
    }
    var d = el('div', 'uc-brl', want); d.setAttribute('data-auto', want);
    kept.par.insertBefore(d, kept.ref ? kept.ref.nextSibling : kept.par.firstChild);
    return true;
  }
  /* C7a: linha em branco posta antes de um achado inserido: sai se o achado saiu (sem linhas em branco sobrando) */
  function blankLn(n) { return !n || n.nodeType === 1 && !n.querySelector('.fld') && trim(n.textContent || '') === ''; }
  function tidySep() {
    var l = ed.querySelectorAll('[data-brsep]'), i, d, ch = false;
    for (i = l.length - 1; i >= 0; i--) {
      d = l[i];
      if (trim(d.textContent || '') !== '' || d.querySelector('.fld')) { d.removeAttribute('data-brsep'); continue; }
      if (blankLn(d.nextSibling) || blankLn(d.previousSibling)) { d.parentNode.removeChild(d); ch = true; }
    }
    return ch;
  }
  function runTxt() {
    if (busy || !ed) { return; }
    busy = true;
    try {
      var s = scan(), i, cs = [], F, ch = false;
      if (tidySep()) { ch = true; }
      for (i = 0; i < s.nod.length; i++) { cs.push(s.nod[i].cat); }
      F = txtOn ? finalCat(cs) : null;
      for (i = 0; i < s.fin.length; i++) { if (putF(s.fin[i], F)) { ch = true; } }
      if (legend(F)) { ch = true; }
      if (ch) { var ev; try { ev = new Event('input', { bubbles: true }); } catch (x) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); } ed.dispatchEvent(ev); }
    } finally { busy = false; }
  }
  function txtStatus() {
    var s = scan(), cs = [], i, F;
    for (i = 0; i < s.nod.length; i++) { cs.push(s.nod[i].cat); }
    F = finalCat(cs);
    if (F) { return { ready: true, tip: 'Pronto: categoria final ' + F }; }
    return { ready: false, tip: s.nod.length ? 'Falta a categoria do achado no laudo (0, 1, 2, 3, 4A, 4B, 4C, 5 ou 6)' : 'Sem frase com "BI-RADS-US" no laudo' };
  }

  /* ---------- cartões "adicionar nódulo" ---------- */
  var root = null, list = null, cards = [], seq = 0;
  function mkSel(cls, label, opts, id) {
    var s = el('select', 'tr-sel ' + (cls || '')), o = el('option', null, label), i;
    o.value = ''; s.appendChild(o); s.setAttribute('aria-label', label); if (id) { s.setAttribute('data-f', id); }
    for (i = 0; i < opts.length; i++) { var x = el('option', null, opts[i][1]); x.value = opts[i][0]; s.appendChild(x); }
    return s;
  }
  function mkChip(val, label, tip) {
    var lb = el('label', 'tr-chip'), cb = el('input'); cb.type = 'checkbox'; cb.value = val;
    if (tip) { lb.title = tip; } lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + label)); return { lb: lb, cb: cb };
  }
  function mkNum(ph, label, w) { var i = el('input', 'uc-num tr-mm' + (w ? ' ' + w : '')); i.type = 'text'; i.setAttribute('inputmode', 'decimal'); i.setAttribute('autocomplete', 'off'); i.placeholder = ph; i.setAttribute('aria-label', label); return i; }
  function grp(cls) { return el('div', cls); }
  function show(e, v) { e.style.display = v ? '' : 'none'; }
  function vals(C) {
    var v = { tipo: C.tipo.value || null }, k, i;
    for (k in C.sel) { if (C.sel.hasOwnProperty(k)) { v[k] = C.sel[k].value || null; } }
    if (v.tipo === 'lnn') { v.eco = C.lnnEco.value || null; v.post = C.lnnPost.value || null; }
    v.calc = []; for (i = 0; i < C.calc.length; i++) { if (C.calc[i].checked) { v.calc.push(C.calc[i].value); } }
    v.assoc = []; for (i = 0; i < C.assoc.length; i++) { if (C.assoc[i].checked) { v.assoc.push(C.assoc[i].value); } }
    v.cs = []; for (i = 0; i < C.cs.length; i++) { if (C.cs[i].checked) { v.cs.push(C.cs[i].value); } }
    v.mult = C.mult.checked; v.tip = C.tip.checked; v.mbil = C.mbil.checked; v.bx = C.bx.checked;
    v.mic = C.mic.value || null; v.abs = C.abs.value || null;
    v.hora = cleanHora(C.hora.value); v.pap = cleanNum(C.pap.value); v.pele = cleanNum(C.pele.value);
    v.l = cleanNum(C.mm[0].value); v.ap = cleanNum(C.mm[1].value); v.t = cleanNum(C.mm[2].value);
    v.cat = C.cat.value || null;
    if (v.tipo !== 'nod' && v.tipo !== 'absc' && v.tipo !== 'ben') { v.forma = v.orient = v.marg = null; if (v.tipo !== 'lnn') { v.eco = v.post = null; } }
    if (v.tipo !== 'lnn') { v.dist = null; }
    v.descOk = !!(v.tipo === 'lnn' ? (v.dist && v.eco && v.post) : (v.forma && v.orient && v.marg && v.eco && v.post));
    return v;
  }
  function complete(v) {
    if (!v.tipo || !v.lado || !normCat(v.cat)) { return false; }
    if (v.tipo === 'nod' || v.tipo === 'lnn') { return v.descOk; }
    return true;
  }
  function maxMm(v) { var a = [v.l, v.ap, v.t], m = null, i, x; for (i = 0; i < 3; i++) { if (a[i]) { x = parseFloat(a[i].replace(',', '.')); if (m === null || x > m) { m = x; } } } return m; }
  function summary(C, v) {
    var p = [TSUM[v.tipo] || 'Nódulo'], loc = '', m = maxMm(v);
    p[0] += ' ' + C.n;
    if (v.lado) { loc = v.lado === 'direita' ? 'MD' : 'ME'; }
    if (v.hora) { loc += (loc ? ' ' : '') + v.hora + 'h'; } else if (v.quad) { loc += (loc ? ' ' : '') + (v.quad === 'retro' ? 'retroareolar' : v.quad); }
    if (loc) { p.push(loc); }
    if (m !== null) { p.push(String(m).replace('.', ',') + ' mm'); }
    if (normCat(v.cat)) { p.push('BI-RADS ' + v.cat); }
    return p.join(' – ');
  }
  function upd(C) {
    var v = vals(C), t = v.tipo, s, i;
    show(C.gDesc, !!DESC[t]); show(C.gLnn, t === 'lnn'); show(C.gCalc, !!DESC[t] || t === 'lnn');
    show(C.gCs, t === 'simples'); show(C.gMult, t === 'simples' || t === 'compl'); show(C.gTip, t === 'linfo'); show(C.gMbil, t === 'nod');
    show(C.mic, t === 'micro'); show(C.abs, t === 'absc'); show(C.gMoreB, !!DESC[t] || t === 'lnn'); if (!(DESC[t] || t === 'lnn')) { show(C.more, false); }
    s = suggest(v); C.sug = s;
    /* sugestão exata (2, 3, 6) preenche a categoria até o médico escolher outra; 4 pede a subcategoria */
    if (C.cat.getAttribute('data-man') === null) {
      var want = s && s.c && s.c !== '4' ? s.c : '';
      if (C.cat.value !== want) { C.cat.value = want; }
    }
    v.cat = C.cat.value || null;
    setTxt(C.res, sugText(s)); C.res.title = sugTip(s);
    C.cat.title = s && s.c === '4' ? 'Escolha 4A, 4B ou 4C' : '';
    var ok = complete(v);
    C.ins.disabled = !ok || !bankPhrase(t);
    C.ins.title = ok && !bankPhrase(t) ? 'O banco não tem a frase com "BI-RADS-US *" para este achado' : '';
    setTxt(C.sum, summary(C, v)); C.dot.className = 'uc-dot ' + (ok ? 'on' : 'off'); C.dot.title = ok ? 'Pronto' : 'Incompleto';
    C.v = v;
    for (i = 0; i < cards.length; i++) { cards[i].h.setAttribute('data-n', String(i + 1)); }
  }
  function setCardOpen(C, o) {
    C.box.className = 'br-card' + (o ? ' open' : ''); show(C.body, o); C.chev.innerHTML = o ? '\u25be' : '\u25b8'; C.h.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  function chain(C) {
    var all = C.body.querySelectorAll('select,input'), out = [], i;
    for (i = 0; i < all.length; i++) { if (!all[i].disabled && all[i].offsetParent !== null) { out.push(all[i]); } }
    return out;
  }
  function insert(C) {
    upd(C);
    var v = C.v, ph, how, at = null, i, b, s, f, line;
    if (!complete(v)) { return; }
    ph = bankPhrase(v.tipo); if (!ph || !window.UFInsertHtml || !ed) { return; }
    /* onde: a mesma frase ainda em branco no laudo (modelo) > logo depois do último achado BI-RADS > cursor/fim */
    var nf = UltraParser.fieldsOf(ph).length, lead = trim(ph.split(/[?*]/)[0]);
    var ds = ed.querySelectorAll('div,p');
    for (i = 0; i < ds.length && !at; i++) {
      b = ds[i]; if (b.querySelector('div,p')) { continue; }
      f = b.querySelectorAll('.fld');
      if (f.length !== nf || trim(b.textContent).indexOf(lead) !== 0) { continue; }
      var blank = true; for (var k = 0; k < f.length; k++) { if (f[k].getAttribute('data-v') !== null || filledVal(f[k]) !== '' && f[k].getAttribute('data-t') !== 's') { blank = false; } }
      if (blank) { at = { el: b, mode: 'replace' }; }
    }
    if (!at) { s = scan(); if (s.nod.length) { line = blockOf(s.nod[s.nod.length - 1].f); if (line && line !== ed) { at = { el: line, mode: 'after' }; } } }
    v.cat = normCat(v.cat);
    how = window.UFInsertHtml(sentenceHtml(ph, v), null, function () { ctg(v); runTxt(); }, at);
    C.done = true; setCardOpen(C, false);
    if (window.UFCalcVol && UFCalcVol.refresh) { UFCalcVol.refresh(); }
    return how;
  }
  function ctg(v) {   /* componente de tecido glandular (bloco "mais"): escolhe a lista do modelo se ainda estiver em branco */
    if (!v.ctg || !ed) { return; }
    var cs = ed.querySelectorAll('.fld[data-t="s"]'), i, o;
    for (i = 0; i < cs.length; i++) {
      if (cs[i].getAttribute('data-v') !== null) { continue; }
      try { o = JSON.parse(cs[i].getAttribute('data-o')) || []; } catch (e) { o = []; }
      if (groupOf(o) === 'ctg' && o.length >= 3) { var k = idxOf(o, 'ctg', v.ctg); if (k >= 0) { var w = document.createElement('span'); w.innerHTML = choiceHtml(o, k); cs[i].parentNode.replaceChild(w.firstChild, cs[i]); } return; }
    }
  }
  function addCard(open) {
    var C = { n: ++seq, sel: {}, calc: [], assoc: [], cs: [] }, i, j, x;
    for (i = 0; i < cards.length; i++) { setCardOpen(cards[i], false); }
    C.box = el('div', 'br-card'); C.h = el('button', 'br-h'); C.h.type = 'button'; C.chev = el('span', 'uc-chev'); C.sum = el('span', 'br-sum'); C.dot = el('span', 'uc-dot off');
    C.h.appendChild(C.chev); C.h.appendChild(C.sum); C.h.appendChild(C.dot);
    C.body = el('div', 'tr-form br-b');
    C.tipo = mkSel('', 'Tipo de achado', TIPOS, 'tipo'); C.body.appendChild(C.tipo);
    C.gDesc = grp('br-g');
    var D = [['forma', 'Forma'], ['orient', 'Orientação'], ['marg', 'Margem'], ['eco', 'Padrão ecogênico'], ['post', 'Características acústicas posteriores']];
    for (j = 0; j < D.length; j++) { C.sel[D[j][0]] = mkSel('', D[j][1], G[D[j][0]], D[j][0]); C.gDesc.appendChild(C.sel[D[j][0]]); }
    C.body.appendChild(C.gDesc);
    C.gLnn = grp('br-g'); C.sel.dist = mkSel('', 'Distribuição', G.dist, 'dist');
    C.lnnEco = mkSel('', 'Padrão ecogênico', [['hiper', 'hiperecogênica'], ['het', 'heterogênea'], ['hipo', 'hipoecogênica']], 'lnneco');
    C.lnnPost = mkSel('', 'Características acústicas posteriores', G.post, 'lnnpost');
    C.gLnn.appendChild(C.sel.dist); C.gLnn.appendChild(C.lnnEco); C.gLnn.appendChild(C.lnnPost); C.body.appendChild(C.gLnn);
    C.gCalc = grp('tr-foc'); C.gCalc.title = 'Calcificações';
    for (j = 1; j < G.calc.length; j++) { x = mkChip(G.calc[j][0], G.calc[j][1]); C.calc.push(x.cb); C.gCalc.appendChild(x.lb); }
    C.body.appendChild(C.gCalc);
    C.gCs = grp('tr-foc'); var CS = [['circ', 'circunscrito'], ['ovred', 'oval ou redondo'], ['anec', 'anecoico'], ['fina', 'parede fina']];
    for (j = 0; j < CS.length; j++) { x = mkChip(CS[j][0], CS[j][1]); C.cs.push(x.cb); C.gCs.appendChild(x.lb); }
    C.body.appendChild(C.gCs);
    x = mkChip('mult', 'múltiplos', 'Cistos benignos múltiplos (simples e/ou complicados)'); C.mult = x.cb; C.gMult = grp('tr-foc'); C.gMult.appendChild(x.lb); C.body.appendChild(C.gMult);
    x = mkChip('tip', 'aspecto tipicamente benigno'); C.tip = x.cb; C.gTip = grp('tr-foc'); C.gTip.appendChild(x.lb); C.body.appendChild(C.gTip);
    x = mkChip('mbil', 'múltiplos bilaterais semelhantes', 'Múltiplos nódulos sólidos circunscritos bilaterais, semelhantes, de aspecto tipicamente benigno'); C.mbil = x.cb; C.gMbil = grp('tr-foc'); C.gMbil.appendChild(x.lb); C.body.appendChild(C.gMbil);
    C.mic = mkSel('', 'Aspecto', [['fino', 'septos finos (<0,5 mm), sem componente sólido'], ['susp', 'margem indistinta ou componente sólido discreto']], 'mic'); C.body.appendChild(C.mic);
    C.abs = mkSel('', 'Abscesso', [['comp', 'compatível'], ['prov', 'provável (US de controle)']], 'abs'); C.body.appendChild(C.abs);
    var gbx = grp('tr-foc'); x = mkChip('bx', 'malignidade comprovada por biópsia'); C.bx = x.cb; gbx.appendChild(x.lb); C.body.appendChild(gbx);
    /* bloco "mais" (recolhido): características associadas, vascularização, elastografia, CTG */
    C.gMoreB = grp('br-moreb'); C.moreBtn = el('button', 'btn btn-sm br-mbtn', 'mais'); C.moreBtn.type = 'button'; C.moreBtn.title = 'Características associadas, vascularização, elastografia, componente de tecido glandular';
    C.gMoreB.appendChild(C.moreBtn); C.body.appendChild(C.gMoreB);
    C.more = grp('br-more');
    var ga = grp('tr-foc'); for (j = 0; j < ASSOC.length; j++) { for (i = 0; i < G.assoc.length; i++) { if (G.assoc[i][0] === ASSOC[j]) { x = mkChip(ASSOC[j], G.assoc[i][1]); C.assoc.push(x.cb); ga.appendChild(x.lb); } } }
    C.more.appendChild(ga);
    C.sel.vasc = mkSel('', 'Vascularização', [['avasc', 'avascular'], ['vint', 'vascularização interna'], ['vper', 'hipervascularização periférica']], 'vasc');
    C.sel.elas = mkSel('', 'Elastografia', [['emole', 'mole'], ['einter', 'intermediária'], ['edura', 'dura']], 'elas');
    C.sel.ctg = mkSel('', 'Componente de tecido glandular', [['min', 'mínimo (<25%)'], ['leve', 'leve (25–49%)'], ['mod', 'moderado (50–74%)'], ['acen', 'acentuado (≥75%)']], 'ctg');
    C.more.appendChild(C.sel.vasc); C.more.appendChild(C.sel.elas); C.more.appendChild(C.sel.ctg); show(C.more, false); C.body.appendChild(C.more);
    var loc = grp('tr-loc'); C.sel.lado = mkSel('tr-half', 'Mama', [['direita', 'mama direita'], ['esquerda', 'mama esquerda']], 'lado');
    C.sel.quad = mkSel('tr-half', 'Quadrante', (function () { var a = [], q; for (q = 0; q < G.quad.length; q++) { a.push([G.quad[q][0], G.quad[q][1]]); } return a; })(), 'quad');
    loc.appendChild(C.sel.lado); loc.appendChild(C.sel.quad); C.body.appendChild(loc);
    var r1 = grp('tr-mmr'); C.hora = mkNum('h', 'Horário (1 a 12)', 'br-h1'); C.pap = mkNum('papila', 'Distância da papila em mm'); C.pele = mkNum('pele', 'Distância da pele em mm');
    r1.appendChild(C.hora); r1.appendChild(el('span', 'uc-u', 'h')); r1.appendChild(C.pap); r1.appendChild(el('span', 'uc-u', 'mm')); r1.appendChild(C.pele); r1.appendChild(el('span', 'uc-u', 'mm'));
    r1.title = 'Horário; distância da papila (da base da papila ao centro do achado); distância da pele'; C.body.appendChild(r1);
    var mmr = grp('tr-mmr'), ML = ['L', 'AP', 'T']; C.mm = [];
    for (j = 0; j < 3; j++) { x = mkNum(ML[j], ML[j] + ' em mm'); C.mm.push(x); mmr.appendChild(x); if (j < 2) { mmr.appendChild(el('span', 'uc-u', '×')); } }
    mmr.appendChild(el('span', 'uc-u', 'mm')); C.body.appendChild(mmr);
    var foot = grp('tr-foot'); C.res = el('span', 'tr-res br-res'); C.cat = el('select', 'tr-sel br-cat'); C.cat.setAttribute('aria-label', 'Categoria BI-RADS');
    var o0 = el('option', null, 'BI-RADS'); o0.value = ''; C.cat.appendChild(o0);
    for (j = 0; j < CATS.length; j++) { var oc = el('option', null, CATS[j]); oc.value = CATS[j]; oc.title = CATL[CATS[j]]; C.cat.appendChild(oc); }
    C.ins = el('button', 'btn btn-sm btn-primary tr-ins', 'Inserir'); C.ins.type = 'button';
    foot.appendChild(C.res); foot.appendChild(C.cat); foot.appendChild(C.ins); C.body.appendChild(foot);
    C.box.appendChild(C.h); C.box.appendChild(C.body); list.appendChild(C.box);
    /* eventos */
    var u = function () { upd(C); };
    var ins = C.body.querySelectorAll('select,input'); for (j = 0; j < ins.length; j++) { if (ins[j] === C.cat) { continue; } on(ins[j], 'change', u); if (ins[j].type === 'text') { on(ins[j], 'input', u); } }
    on(C.cat, 'change', function () { if (C.cat.value) { C.cat.setAttribute('data-man', '1'); } else { C.cat.removeAttribute('data-man'); } upd(C); });
    on(C.moreBtn, 'click', function () { show(C.more, C.more.style.display === 'none'); });
    on(C.h, 'mousedown', function (e) { if (e.preventDefault) { e.preventDefault(); } });
    on(C.h, 'click', function () { setCardOpen(C, !/(^|\s)open(\s|$)/.test(C.box.className)); });
    on(C.ins, 'click', function () { insert(C); });
    on(C.body, 'keydown', function (e) {
      if ((e.keyCode || e.which) !== 13 || e.ctrlKey || e.altKey || e.metaKey) { return; }
      var t = e.target || e.srcElement, L, k;
      if (!t || !/^(SELECT|INPUT)$/.test(t.nodeName)) { return; }
      if (e.preventDefault) { e.preventDefault(); } if (e.stopPropagation) { e.stopPropagation(); }
      upd(C); L = chain(C); k = L.indexOf(t);
      if (k >= 0 && k + 1 < L.length) { L[k + 1].focus(); if (L[k + 1].type === 'text' && L[k + 1].select) { L[k + 1].select(); } }
      else if (!C.ins.disabled) { insert(C); }
    });
    cards.push(C); setCardOpen(C, open !== false); upd(C);
    return C;
  }
  function build(b) {
    root = el('div', 'br-root'); list = el('div', 'br-list'); root.appendChild(list);
    var add = el('button', 'btn btn-sm br-add', '+ adicionar nódulo'); add.type = 'button'; add.id = 'brAdd';
    on(add, 'mousedown', function (e) { if (e.preventDefault) { e.preventDefault(); } });
    on(add, 'click', function () { var C = addCard(true); C.tipo.focus(); });
    root.appendChild(add); b.appendChild(root);
    addCard(true);
  }
  function reset() {
    if (!list) { return; }
    list.innerHTML = ''; cards = []; seq = 0; addCard(true);
  }
  function initTxt() {
    ed = document.getElementById('editor'); if (!ed) { return; }
    if (window.UFCalc && UFCalc.onEditorChange) { UFCalc.onEditorChange(runTxt); }
    if (ed.addEventListener) { ed.addEventListener('input', function () { setTimeout(runTxt, 0); }, false); }
    runTxt();
  }
  window.UFBirads = { suggest: suggest, finalCat: finalCat, normCat: normCat, rank: rank, runTxt: runTxt, initTxt: initTxt, scan: scan, bankPhrase: bankPhrase, sentenceHtml: sentenceHtml,
    isMarkFld: isMarkFld, cards: function () { return cards; }, addCard: addCard, G: G, CATS: CATS };
  if (window.UFCalc) { UFCalc.register({ id: 'birads', title: 'BI-RADS US (ACR v2025)', build: build, reset: reset }); }
  if (window.UFCalcVol) {
    UFCalcVol.addToggle('ucBrTxt', 'Categoria final pelo laudo', true, function (v) { txtOn = !!v; runTxt(); },
      'Lê a categoria de cada achado ("BI-RADS-US ...") e escreve a final (hierarquia 5 > 4 > 0 > 6 > 3 > 2 > 1) em "Classificação: BI-RADS-US", deixando só a linha da legenda dessa categoria.', txtStatus, null, 'birads');
  }
})();
