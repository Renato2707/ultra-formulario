/* UFTirads (etapa C6): ACR TI-RADS (Tessler et al., J Am Coll Radiol 2017;14:587-595).
   Pontos, níveis e cortes do artigo; texto de saída do protótipo do Dr. Renato. Um painel por nódulo,
   só nesta janela (nada é gravado). ES5 estrito. */
(function () {
  'use strict';
  var CAT = [
    { id: 'comp', t: 'Composição', one: true, o: [['cist', 'Cístico ou quase completamente cístico', 0], ['esp', 'Espongiforme', 0], ['mist', 'Misto cístico e sólido', 1], ['sol', 'Sólido ou quase completamente sólido', 2], ['ind', 'Indeterminável (calcificação/sombra)', 2]] },
    { id: 'eco', t: 'Ecogenicidade', one: true, o: [['anec', 'Anecoico', 0], ['hiper', 'Hiperecogênico ou isoecogênico', 1], ['hipo', 'Hipoecogênico', 2], ['muito', 'Muito hipoecogênico', 3], ['ind', 'Indeterminável', 1]] },
    { id: 'forma', t: 'Forma', one: true, o: [['larg', 'Mais largo que alto', 0], ['alto', 'Mais alto que largo', 3]] },
    { id: 'marg', t: 'Margem', one: true, o: [['lisa', 'Lisa', 0], ['mal', 'Mal definida', 0], ['lob', 'Lobulada ou irregular', 2], ['ete', 'Extensão extratireoidiana', 3], ['ind', 'Indeterminável', 0]] },
    { id: 'focos', t: 'Focos ecogênicos (todos que se aplicam)', one: false, o: [['nenhum', 'Nenhum ou artefato em cauda de cometa grande', 0], ['macro', 'Macrocalcificações', 1], ['perif', 'Calcificações periféricas (em aro)', 2], ['punct', 'Focos ecogênicos puntiformes', 3]] }
  ];
  /* nível: texto do protótipo; cortes do artigo em mm (PAAF, seguimento) */
  var LV = {
    TR1: ['Benigno', '≤2%', 'Nenhuma', 'Nenhuma', null, null],
    TR2: ['Não suspeito', '≤2%', 'Nenhuma', 'Nenhuma', null, null],
    TR3: ['Levemente suspeito', '~5%', 'se ≥2,5 cm', 'se ≥1,5 cm, US após 1, 3 e 5 anos.', 25, 15],
    TR4: ['Moderadamente suspeito', '5-20%', 'se ≥1,5 cm', 'se ≥1,0 cm, US após 1, 2, 3 e 5 anos.', 15, 10],
    TR5: ['Altamente suspeito', '≥20%', 'se ≥1,0 cm', 'se ≥0,5 cm, US anual por até 5 anos.', 10, 5]
  };
  function pts(cat, key) { var c, i, j; for (i = 0; i < CAT.length; i++) { if (CAT[i].id === cat) { c = CAT[i]; for (j = 0; j < c.o.length; j++) { if (c.o[j][0] === key) { return c.o[j][2]; } } } } return null; }
  /* st = {comp, eco, forma, marg, focos: [..]} -> {total, per: {...}, complete, notes} */
  function score(st) {
    var per = { comp: null, eco: null, forma: null, marg: null, focos: null }, i, f = st.focos || [], notes = [];
    if (st.comp === 'esp') {   /* artigo: espongiforme = não somar pontos nas demais categorias */
      return { total: 0, per: { comp: 0, eco: 0, forma: 0, marg: 0, focos: 0 }, complete: true, esp: true, notes: ['Espongiforme: as demais categorias não somam pontos (ACR TI-RADS).'] };
    }
    if (st.comp) { per.comp = pts('comp', st.comp); }
    if (st.comp === 'ind') { per.eco = 1; notes.push('Composição indeterminável por calcificação: assumir sólido (2) e ecogenicidade 1 ponto (ACR TI-RADS).'); }
    else if (st.eco) { per.eco = pts('eco', st.eco); }
    if (st.forma) { per.forma = pts('forma', st.forma); }
    if (st.marg) { per.marg = pts('marg', st.marg); }
    if (f.length) { per.focos = 0; for (i = 0; i < f.length; i++) { per.focos += pts('focos', f[i]); } }
    var complete = per.comp !== null && per.eco !== null && per.forma !== null && per.marg !== null && per.focos !== null;
    var total = (per.comp || 0) + (per.eco || 0) + (per.forma || 0) + (per.marg || 0) + (per.focos || 0);
    return { total: total, per: per, complete: complete, esp: false, notes: notes };
  }
  function level(t) { return t <= 1 ? 'TR1' : (t === 2 ? 'TR2' : (t === 3 ? 'TR3' : (t <= 6 ? 'TR4' : 'TR5'))); }
  function lines(t) {
    var L = level(t), v = LV[L];
    return ['Pontuação: ' + t, 'Categoria TIRADS: ' + L, 'Nível de Risco: ' + v[0], 'Risco de Malignidade: ' + v[1], 'Recomendação de PAAF: ' + v[2], 'Sugestão de Acompanhamento: ' + v[3]];
  }
  function parseMm(s) { s = String(s || '').replace(/^\s+|\s+$/g, ''); if (!/^\d+([.,]\d+)?$/.test(s)) { return null; } var v = parseFloat(s.replace(',', '.')); return v > 0 ? v : null; }
  function fmtMm(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function header(n) {
    var p = [], s = 'Nódulo';
    if (n.lado === 'istmo') { s += ' do istmo'; } else if (n.lado) { s += ' do lobo ' + n.lado; }
    p.push(s); if (n.terco) { p.push('terço ' + n.terco); }
    var mm = parseMm(n.mm); if (mm !== null) { p.push('medindo ' + fmtMm(mm) + ' mm'); }
    return p.join(', ') + ' (ACR TI-RADS):';
  }
  function sizeNote(t, mmS) {   /* só no painel */
    var mm = parseMm(mmS), v = LV[level(t)];
    if (mm === null) { return ''; }
    if (v[4] === null) { return 'Pelo tamanho: sem PAAF nem seguimento para ' + level(t) + '.'; }
    if (mm >= v[4]) { return 'Pelo tamanho (' + fmtMm(mm) + ' mm): atinge o corte de PAAF (≥' + fmtMm(v[4]) + ' mm).'; }
    if (mm >= v[5]) { return 'Pelo tamanho (' + fmtMm(mm) + ' mm): atinge o corte de seguimento (≥' + fmtMm(v[5]) + ' mm), não o de PAAF.'; }
    return 'Pelo tamanho (' + fmtMm(mm) + ' mm): abaixo dos cortes de PAAF e de seguimento.';
  }

  /* ---------- C6c: TI-RADS a partir das opções escolhidas no próprio texto do laudo ----------
     Frase do banco: "Observa-se nódulo ?[composição], ?[ecogenicidade], ?[forma], margens ?[margem], ?[focos]. ... TI-RADS *."
     Cada opção do texto é ligada a uma opção ACR já implementada acima (mesmos pontos); nada novo. */
  var TXT = {
    comp: [[/^c[íi]stic/i, 'cist'], [/^espongiform/i, 'esp'], [/^mist/i, 'mist'], [/^s[óo]lid/i, 'sol'], [/^indetermin/i, 'ind']],
    eco: [[/^anecoic/i, 'anec'], [/^hiperecog/i, 'hiper'], [/^isoecog/i, 'hiper'], [/^hipoecog/i, 'hipo'], [/^muito hipoecog/i, 'muito'], [/^indetermin/i, 'ind']],
    forma: [[/^mais largo/i, 'larg'], [/^mais alto/i, 'alto']],
    marg: [[/^lisa/i, 'lisa'], [/^mal definid/i, 'mal'], [/^lobulad/i, 'lob'], [/^irregular/i, 'lob'], [/extratireoid/i, 'ete'], [/^indetermin/i, 'ind']],
    focos: [[/^sem focos/i, 'nenhum'], [/cauda de cometa/i, 'nenhum'], [/macrocalcifica/i, 'macro'], [/perif[ée]ric/i, 'perif'], [/puntiform/i, 'punct']]
  };
  var ORDER = ['comp', 'eco', 'forma', 'marg', 'focos'], txtOn = true, ed = null, busyT = false;
  function mapTxt(cat, t) { var l = TXT[cat], i; t = String(t || '').replace(/^\s+|\s+$/g, ''); for (i = 0; i < l.length; i++) { if (l[i][0].test(t)) { return l[i][1]; } } return null; }
  function blockOf(n) { while (n && n !== ed && !(n.nodeType === 1 && /^(DIV|P|LI)$/.test(n.nodeName))) { n = n.parentNode; } return n; }
  /* frases de nódulo no laudo: {chips:[5 escolhas], out: campo "TI-RADS ___"} */
  function textNodules() {
    var out = [], fs, i, f, j, ln, seen = [];
    if (!ed) { return out; }
    fs = ed.querySelectorAll('.fld');
    for (i = 0; i < fs.length; i++) {
      f = fs[i]; if (f.getAttribute('data-t') === 's') { continue; }
      var prev = f.previousSibling, pt = prev && prev.nodeType === 3 ? prev.nodeValue : '';
      if (!/TI-RADS\s*$/i.test(pt)) { continue; }
      ln = blockOf(f); if (!ln || seen.indexOf(ln) >= 0) { continue; }
      var all = ln.querySelectorAll('.fld'), k = -1, chips = [], txt;
      for (j = 0; j < all.length; j++) { if (all[j] === f) { k = j; break; } }
      /* a frase do nódulo: do "nódulo" até o campo do TI-RADS */
      txt = ln.textContent || '';
      if (!/n[óo]dulo/i.test(txt)) { continue; }
      for (j = 0; j < k; j++) { if (all[j].getAttribute('data-t') === 's') { chips.push(all[j]); } }
      if (chips.length < 5) { continue; }
      var nums = [], last = -1;
      for (j = 0; j < k; j++) { if (all[j] === chips[4]) { last = j; } }
      for (j = last + 1; j < k; j++) { var tt = all[j].getAttribute('data-t'); if (tt === 'n' || tt === 'd') { nums.push(all[j]); } }
      seen.push(ln); out.push({ chips: chips.slice(0, 5), out: f, nums: nums, line: ln });
    }
    return out;
  }
  function readTxt(n) {
    var st = { focos: [] }, i, c, v, miss = 0;
    for (i = 0; i < 5; i++) {
      c = n.chips[i]; v = c.getAttribute('data-v') !== null ? mapTxt(ORDER[i], c.textContent) : null;
      if (v === null) { miss++; continue; }
      if (ORDER[i] === 'focos') { st.focos = [v]; } else { st[ORDER[i]] = v; }
    }
    return { st: st, miss: miss };
  }
  function putT(f, val) {   /* mesmo comportamento dos outros campos calculados: valor manual respeitado */
    var cur = String(f.textContent || ''), auto = f.getAttribute('data-auto');
    if (val === null) { if (auto !== null) { if (cur === auto) { f.textContent = f.getAttribute('data-ph') || '___'; } f.removeAttribute('data-auto'); return cur === auto; } return false; }
    if (auto === null && cur !== '' && cur !== f.getAttribute('data-ph')) { return false; }   /* digitado à mão */
    if (auto !== null && cur !== auto) { return false; }
    if (cur === val) { return false; }
    f.textContent = val; f.setAttribute('data-auto', val); return true;
  }
  function num(f) { var t = String(f.textContent || '').replace(/^\s+|\s+$/g, ''); return /^\d+([.,]\d+)?$/.test(t) ? parseFloat(t.replace(',', '.')) : null; }
  function maxMm(n) { var i, v, m = null; for (i = 0; i < n.nums.length; i++) { v = num(n.nums[i]); if (v !== null && (m === null || v > m)) { m = v; } } return m; }
  /* C6e: as 6 linhas do protótipo; com tamanho informado, o veredito pelos cortes ACR 2017 vai entre parênteses */
  function recLines(t, mm) {
    var L = lines(t), v = LV[level(t)], fm;
    if (mm !== null && v[4] !== null) {
      fm = fmtMm(mm) + ' mm';
      L[4] += mm >= v[4] ? ' (indicada: ' + fm + ')' : ' (não indicada: ' + fm + ')';
      L[5] += mm >= v[5] ? ' (indicado: ' + fm + ')' : ' (não indicado: ' + fm + ')';
    }
    return L;
  }
  function isRec(n) { return n && n.nodeType === 1 && (' ' + n.className + ' ').indexOf(' uc-trl ') >= 0; }
  /* bloco de 6 linhas logo depois da linha do nódulo (não editável; some se o nódulo ficar incompleto) */
  function setRec(ln, L) {
    var cur = [], n = ln.nextSibling, i, d, ch = false, LB = /^(Pontua\u00e7\u00e3o|Categoria TIRADS|N\u00edvel de Risco|Risco de Malignidade|Recomenda\u00e7\u00e3o de PAAF|Sugest\u00e3o de Acompanhamento):/, nx;
    /* um laudo colado/importado já traz as 6 linhas como texto: elas passam a ser as linhas calculadas (sem duplicar) */
    while (L && n && n.nodeType === 1 && !isRec(n) && !n.querySelector('.fld') && LB.test(n.textContent || '')) { nx = n.nextSibling; n.parentNode.removeChild(n); ch = true; n = nx; }
    n = ln.nextSibling;
    while (n && (n.nodeType === 3 && !/\S/.test(n.nodeValue) ? true : isRec(n))) { if (isRec(n)) { cur.push(n); } n = n.nextSibling; }
    if (!L) { for (i = 0; i < cur.length; i++) { cur[i].parentNode.removeChild(cur[i]); ch = true; } return ch; }
    for (i = 0; i < L.length; i++) {
      if (cur[i]) { if (cur[i].textContent !== L[i]) { cur[i].textContent = L[i]; ch = true; } cur[i].ucGen = gen; continue; }
      d = document.createElement('div'); d.className = 'uc-trl'; d.setAttribute('contenteditable', 'false'); d.textContent = L[i]; d.ucGen = gen;
      var ref = i ? cur[i - 1] : ln; ref.parentNode.insertBefore(d, ref.nextSibling); cur[i] = d; ch = true;
    }
    for (i = L.length; i < cur.length; i++) { cur[i].parentNode.removeChild(cur[i]); ch = true; }
    return ch;
  }
  var gen = 0;
  function runTxt() {
    if (busyT || !ed) { return; }
    busyT = true; gen++;
    try {
      var NL = textNodules(), i, r, sc, ch = false, ok, q, old;
      for (i = 0; i < NL.length; i++) {
        r = readTxt(NL[i]); sc = r.miss ? null : score(r.st); ok = txtOn && sc && sc.complete;
        if (putT(NL[i].out, ok ? level(sc.total).substring(2) : null)) { ch = true; }
        if (setRec(NL[i].line, ok ? recLines(sc.total, maxMm(NL[i])) : null)) { ch = true; }
      }
      old = ed.querySelectorAll('.uc-trl');
      for (q = old.length - 1; q >= 0; q--) { if (old[q].ucGen !== gen) { old[q].parentNode.removeChild(old[q]); ch = true; } }
      if (ch) { var ev; try { ev = new Event('input', { bubbles: true }); } catch (x) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); } ed.dispatchEvent(ev); }
    } finally { busyT = false; }
  }
  function txtStatus() {
    var NL = textNodules(), i, r, sc, done = [];
    if (!NL.length) { return { ready: false, tip: 'Sem a frase "Observa-se nódulo ... TI-RADS ___" no laudo' }; }
    for (i = 0; i < NL.length; i++) { r = readTxt(NL[i]); sc = r.miss ? null : score(r.st); if (sc) { done.push(level(sc.total) + ' (' + sc.total + ' pts)'); } }
    return done.length ? { ready: true, tip: 'Pronto: ' + done.join(', ') } : { ready: false, tip: 'Escolha as 5 características do nódulo no texto' };
  }

  /* ---------- C6e: cartão TI-RADS: formulário único que escreve a frase do banco no laudo ---------- */
  var F = null;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.appendChild(document.createTextNode(txt)); } return e; }
  function on(e, ev, fn) { if (e.addEventListener) { e.addEventListener(ev, fn, false); } else { e.attachEvent('on' + ev, fn); } }
  function setTxt(e, t) { e.innerHTML = ''; e.appendChild(document.createTextNode(t)); }
  function ptsLab(p) { return p + (p === 1 ? ' pt' : ' pts'); }
  function formState() {
    var st = { focos: [] }, i;
    for (i = 0; i < 4; i++) { st[CAT[i].id] = F.sel[CAT[i].id].value || null; }
    for (i = 0; i < F.foc.length; i++) { if (F.foc[i].checked) { st.focos.push(F.foc[i].value); } }
    return st;
  }
  function updForm() {
    var st = formState(), r = score(st), i;
    F.sel.eco.disabled = st.comp === 'esp' || st.comp === 'ind'; F.sel.forma.disabled = F.sel.marg.disabled = st.comp === 'esp';
    for (i = 0; i < F.foc.length; i++) { F.foc[i].disabled = st.comp === 'esp'; }
    setTxt(F.res, r.complete ? level(r.total) + ' · ' + ptsLab(r.total) : '');
    F.res.title = r.complete ? LV[level(r.total)][0] : '';
    F.ins.disabled = !r.complete;
  }
  function choiceHtml(opts, i) {
    var o = JSON.stringify(opts).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    if (i < 0) { return '<span class="fld f-sel" contenteditable="false" data-t="s" data-o="' + o + '">escolher</span>'; }
    return '<span class="fld f-sel f-ok" contenteditable="false" data-t="s" data-v="' + i + '" data-o="' + o + '" title="Clique para trocar">' + esc(opts[i]) + '</span>';
  }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /* a frase do nódulo vem do banco carregado (nunca uma cópia no código) */
  function bankSentence() {
    var S = window.UFTest && UFTest.S, B = S && S.bank, i, j, k, x, bodies = [];
    if (!B || !window.UltraParser) { return null; }
    for (i = 0; i < B.exams.length; i++) {
      for (j = 0; j < B.exams[i].templates.length; j++) { bodies.push(B.exams[i].templates[j].body); }
      for (j = 0; j < (B.exams[i].sections || []).length; j++) { for (k = 0; k < B.exams[i].sections[j].phrases.length; k++) { bodies.push(B.exams[i].sections[j].phrases[k].body); } }
    }
    for (i = 0; i < bodies.length; i++) {
      var fs = UltraParser.fieldsOf(bodies[i]);
      for (j = 0; j < fs.length; j++) {
        if (fs[j].type !== 'select') { continue; }
        for (k = 0; k < fs[j].options.length; k++) { x = fs[j].options[k]; if (/^\s*Observa-se n[óo]dulo\s*\?\[/i.test(x) && /TI-RADS\s*\*/i.test(x)) { return { opt: x, raw: fs[j].raw }; } }
        if (/^\s*Observa-se n[óo]dulo\s*$/i.test(bodies[i].substring(0, fs[j].offset).split('\n').pop()) && /TI-RADS\s*\*/.test(bodies[i])) { return { opt: bodies[i].split('\n')[0], raw: null }; }
      }
    }
    return null;
  }
  function pickIdx(opts, cat, key) { for (var i = 0; i < opts.length; i++) { if (mapTxt(cat, opts[i]) === key) { return i; } } return -1; }
  function sentenceHtml(opt, st, f) {
    var fs = UltraParser.fieldsOf(opt), out = '', pos = 0, i, si = 0, ni = 0, x, idx, foc = null, best = -1, k, mm = [f.l, f.ap, f.t];
    for (k = 0; k < st.focos.length; k++) { x = pts('focos', st.focos[k]); if (x > best) { best = x; foc = st.focos[k]; } }   /* a frase aceita 1 foco: o de maior pontuação */
    for (i = 0; i < fs.length; i++) {
      out += esc(opt.substring(pos, fs[i].offset)); pos = fs[i].offset + fs[i].raw.length;
      if (fs[i].type === 'select') {
        idx = -1;
        if (si < 5) { idx = pickIdx(fs[i].options, ORDER[si], ORDER[si] === 'focos' ? foc : st[ORDER[si]]); }
        else if (si === 5 && f.terco) { idx = fs[i].options.indexOf(f.terco); }
        else if (si === 6 && f.lado && f.lado !== 'istmo') { idx = fs[i].options.indexOf(f.lado); }
        out += choiceHtml(fs[i].options, idx); si++;
      } else {
        var t = fs[i].type === 'text' ? 't' : (fs[i].decimal ? 'd' : 'n'), ph = t === 't' ? 'texto' : (t === 'd' ? '__,_' : '___'), v = ni < 3 ? mm[ni] : '';
        out += v ? '<span class="fld f-ok" data-t="' + t + '" data-ph="' + ph + '">' + esc(v) + '</span>' : '<span class="fld" data-t="' + t + '" data-ph="' + ph + '">' + ph + '</span>';
        ni++;
      }
    }
    return out + esc(opt.substring(pos));
  }
  function insertForm() {
    var st = formState(), r = score(st), bs, f = { lado: F.lado.value, terco: F.terco.value, l: clean(F.mm[0].value), ap: clean(F.mm[1].value), t: clean(F.mm[2].value) }, how;
    if (!r.complete) { return; }
    bs = bankSentence();
    if (bs && window.UFInsertHtml) { how = window.UFInsertHtml(sentenceHtml(bs.opt, st, f), bs.opt, runTxt); }
    else if (window.UFInsertLines) {   /* banco sem a frase: o bloco da C6 */
      var mx = null, k; for (k = 0; k < 3; k++) { var v = parseMm(F.mm[k].value); if (v !== null && (mx === null || v > mx)) { mx = v; } }
      how = window.UFInsertLines([header({ lado: f.lado, terco: f.terco, mm: mx === null ? '' : String(mx) })].concat(lines(r.total)));
    }
    F.ins.title = how === 'end' ? 'Inserido no fim do laudo (não havia cursor no laudo)' : '';
    setTimeout(runTxt, 0);
  }
  function clean(v) { v = String(v || '').replace(/^\s+|\s+$/g, ''); return /^\d+([.,]\d+)?$/.test(v) ? v : ''; }
  function build(b) {
    F = { sel: {}, foc: [] };
    var g = el('div', 'tr-form'), i, j, c, s;
    for (i = 0; i < 4; i++) {
      c = CAT[i]; s = el('select', 'tr-sel'); s.setAttribute('data-cat', c.id); s.setAttribute('aria-label', c.t);
      var o0 = el('option', null, c.t); o0.value = ''; s.appendChild(o0);
      for (j = 0; j < c.o.length; j++) { var o = el('option', null, c.o[j][1] + ' · ' + c.o[j][2]); o.value = c.o[j][0]; s.appendChild(o); }
      on(s, 'change', updForm); F.sel[c.id] = s; g.appendChild(s);
    }
    var fw = el('div', 'tr-foc'); fw.setAttribute('role', 'group'); fw.setAttribute('aria-label', 'Focos ecogênicos');
    var SH = { nenhum: 'Sem focos / cometa grande', macro: 'Macrocalcificações', perif: 'Periféricas', punct: 'Puntiformes' };
    for (j = 0; j < CAT[4].o.length; j++) {
      var lb = el('label', 'tr-chip'), cb = el('input'); cb.type = 'checkbox'; cb.value = CAT[4].o[j][0]; cb.checked = cb.value === 'nenhum'; cb.setAttribute('data-cat', 'focos');
      lb.title = CAT[4].o[j][1]; lb.appendChild(cb); lb.appendChild(document.createTextNode(' ' + SH[cb.value] + ' · ' + CAT[4].o[j][2]));
      (function (box) { on(box, 'click', function () {
        var k; if (box.checked) { for (k = 0; k < F.foc.length; k++) { if ((box.value === 'nenhum') !== (F.foc[k].value === 'nenhum')) { F.foc[k].checked = false; } } }
        updForm(); }); })(cb);
      F.foc.push(cb); fw.appendChild(lb);
    }
    g.appendChild(fw);
    var loc = el('div', 'tr-loc');
    F.terco = el('select', 'tr-sel tr-half'); F.terco.setAttribute('aria-label', 'Terço');
    var T = [['', 'Terço'], ['superior', 'superior'], ['médio', 'médio'], ['inferior', 'inferior']], L2 = [['', 'Lobo'], ['direito', 'direito'], ['esquerdo', 'esquerdo'], ['istmo', 'istmo']];
    for (j = 0; j < T.length; j++) { var ot = el('option', null, T[j][1]); ot.value = T[j][0]; F.terco.appendChild(ot); }
    F.lado = el('select', 'tr-sel tr-half'); F.lado.setAttribute('aria-label', 'Lobo');
    for (j = 0; j < L2.length; j++) { var ol = el('option', null, L2[j][1]); ol.value = L2[j][0]; F.lado.appendChild(ol); }
    loc.appendChild(F.terco); loc.appendChild(F.lado); g.appendChild(loc);
    var mmr = el('div', 'tr-mmr'); F.mm = [];
    var ML = ['L', 'AP', 'T'];
    for (j = 0; j < 3; j++) { var mi = el('input', 'uc-num tr-mm'); mi.type = 'text'; mi.setAttribute('inputmode', 'decimal'); mi.placeholder = ML[j]; mi.setAttribute('aria-label', ML[j] + ' em mm'); F.mm.push(mi); mmr.appendChild(mi); if (j < 2) { mmr.appendChild(el('span', 'uc-u', '×')); } }
    mmr.appendChild(el('span', 'uc-u', 'mm')); g.appendChild(mmr);
    var foot = el('div', 'tr-foot'); F.res = el('span', 'tr-res'); F.ins = el('button', 'btn btn-sm btn-primary tr-ins', 'Inserir nódulo'); F.ins.type = 'button'; F.ins.id = 'trIns';
    foot.appendChild(F.res); foot.appendChild(F.ins); g.appendChild(foot);
    on(F.ins, 'click', insertForm);
    b.appendChild(g); updForm();
  }
  function initTxt() {
    ed = document.getElementById('editor'); if (!ed) { return; }
    if (window.UFCalc && UFCalc.onEditorChange) { UFCalc.onEditorChange(runTxt); }
    if (ed.addEventListener) { ed.addEventListener('input', function () { setTimeout(runTxt, 0); }, false); }
    runTxt();
  }
  window.UFTirads = { score: score, level: level, lines: lines, recLines: recLines, header: header, sizeNote: sizeNote, CAT: CAT, LV: LV, initTxt: initTxt, runTxt: runTxt, textNodules: textNodules, mapTxt: mapTxt, bankSentence: bankSentence };
  if (window.UFCalc) { UFCalc.register({ id: 'tirads', title: 'TI-RADS (ACR 2017)', build: build }); }
  if (window.UFCalcVol) {
    UFCalcVol.addToggle('ucTrTxt', 'Calcular pelo texto do laudo', true, function (v) { txtOn = !!v; runTxt(); },
      'Lê as 5 características da frase "Observa-se nódulo ..." e escreve o número em "TI-RADS ___" e as 6 linhas de recomendação logo abaixo. "Tipo cauda de cometa" = 0 ponto; "irregulares" = 2, como "lobuladas".', txtStatus, null, 'tirads');
  }
})();
