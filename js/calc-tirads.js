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

  /* ---------- UI ---------- */
  var list = null, seq = 0, nods = [];
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.appendChild(document.createTextNode(txt)); } return e; }
  function on(e, ev, fn) { if (e.addEventListener) { e.addEventListener(ev, fn, false); } else { e.attachEvent('on' + ev, fn); } }
  function setTxt(e, t) { e.innerHTML = ''; e.appendChild(document.createTextNode(t)); }
  function addNodule() {
    var id = ++seq, n = { id: id, lado: '', terco: '', mm: '', st: { comp: null, eco: null, forma: null, marg: null, focos: [] } }, box = el('div', 'tr-nod'), head = el('div', 'tr-head'),
      tg = el('button', 'tr-tg', ''), rm = el('button', 'btn btn-sm tr-rm', 'Remover'), body = el('div', 'tr-body'), i, j, c;
    tg.type = 'button'; rm.type = 'button'; tg.setAttribute('aria-expanded', 'true'); box.setAttribute('data-nod', String(id));
    head.appendChild(tg); head.appendChild(rm); box.appendChild(head); box.appendChild(body);
    function sel(lab, opts, key) {
      var w = el('label', 'tr-row'), s = el('select', 'tr-sel'), k; w.appendChild(el('span', 'tr-lab', lab));
      for (k = 0; k < opts.length; k++) { var o = el('option', null, opts[k][1]); o.value = opts[k][0]; s.appendChild(o); }
      s.setAttribute('data-k', key); on(s, 'change', function () { n[key] = s.value; upd(); }); w.appendChild(s); body.appendChild(w); return s;
    }
    sel('Lado', [['', '—'], ['direito', 'Lobo direito'], ['esquerdo', 'Lobo esquerdo'], ['istmo', 'Istmo']], 'lado');
    sel('Localização', [['', '—'], ['superior', 'Terço superior'], ['médio', 'Terço médio'], ['inferior', 'Terço inferior']], 'terco');
    var sw = el('label', 'tr-row'), si = el('input', 'uc-num tr-mm'); si.type = 'text'; si.setAttribute('inputmode', 'decimal'); si.setAttribute('data-k', 'mm'); si.setAttribute('aria-label', 'Maior diâmetro em mm');
    sw.appendChild(el('span', 'tr-lab', 'Maior diâmetro')); sw.appendChild(si); sw.appendChild(el('span', 'uc-u', 'mm')); body.appendChild(sw);
    on(si, 'input', function () { n.mm = si.value; upd(); }); on(si, 'keyup', function () { n.mm = si.value; upd(); });
    var inputs = {}, ptsEl = {};
    for (i = 0; i < CAT.length; i++) {
      c = CAT[i]; var fs = el('fieldset', 'tr-cat'), lg = el('legend', null, c.t + ' '), pe = el('span', 'tr-pts', '');
      lg.appendChild(pe); ptsEl[c.id] = pe; fs.appendChild(lg); fs.setAttribute('data-cat', c.id); inputs[c.id] = [];
      for (j = 0; j < c.o.length; j++) {
        var lb = el('label', 'tr-opt'), inp = el('input');
        inp.type = c.one ? 'radio' : 'checkbox'; inp.name = 'tr' + id + c.id; inp.value = c.o[j][0];
        inp.setAttribute('data-cat', c.id);
        lb.appendChild(inp); lb.appendChild(document.createTextNode(' ' + c.o[j][1] + ' (' + c.o[j][2] + (c.o[j][2] === 1 ? ' pt)' : ' pts)')));
        fs.appendChild(lb); inputs[c.id].push(inp);
        (function (cat, inp2) { on(inp2, 'click', function () { pick(cat, inp2); }); })(c.id, inp);
      }
      body.appendChild(fs);
    }
    var res = el('div', 'tr-res'), note = el('div', 'uc-note tr-note'), size = el('div', 'tr-size'), ins = el('button', 'btn btn-sm btn-primary tr-ins', 'Inserir no laudo'), msg = el('div', 'uc-note tr-msg');
    ins.type = 'button'; body.appendChild(res); body.appendChild(note); body.appendChild(size); body.appendChild(ins); body.appendChild(msg);
    function pick(cat, inp) {
      if (cat === 'focos') {
        var k, a = inputs.focos;
        if (inp.value === 'nenhum' && inp.checked) { for (k = 0; k < a.length; k++) { if (a[k] !== inp) { a[k].checked = false; } } }
        else if (inp.checked) { for (k = 0; k < a.length; k++) { if (a[k].value === 'nenhum') { a[k].checked = false; } } }
        n.st.focos = []; for (k = 0; k < a.length; k++) { if (a[k].checked) { n.st.focos.push(a[k].value); } }
      } else { n.st[cat] = inp.value; }
      upd();
    }
    function upd() {
      var r = score(n.st), k, q, dis;
      for (k = 0; k < CAT.length; k++) {
        q = CAT[k].id; dis = r.esp && q !== 'comp' || (q === 'eco' && n.st.comp === 'ind');
        for (var z = 0; z < inputs[q].length; z++) { inputs[q][z].disabled = dis; }
        setTxt(ptsEl[q], r.per[q] === null ? '' : '— ' + r.per[q] + (r.per[q] === 1 ? ' pt' : ' pts'));
      }
      var L = level(r.total);
      setTxt(res, r.complete ? 'Total: ' + r.total + (r.total === 1 ? ' ponto' : ' pontos') + ' — ' + L + ' (' + LV[L][0] + ')' + (r.total === 1 ? ' [1 ponto: tratado como TR1]' : '') : 'Total parcial: ' + r.total + ' — preencha todas as categorias');
      setTxt(note, r.notes.join(' '));
      setTxt(size, r.complete ? sizeNote(r.total, n.mm) : '');
      ins.disabled = !r.complete;
      setTxt(tg, (body.style.display === 'none' ? '\u25b8 ' : '\u25be ') + 'Nódulo ' + id + (r.complete ? ' — ' + L + ' (' + r.total + ' pts)' : ''));
    }
    on(tg, 'click', function () { var h = body.style.display === 'none'; body.style.display = h ? '' : 'none'; tg.setAttribute('aria-expanded', h ? 'true' : 'false'); upd(); });
    on(rm, 'click', function () { box.parentNode.removeChild(box); for (var k = 0; k < nods.length; k++) { if (nods[k] === n) { nods.splice(k, 1); break; } } });
    on(ins, 'click', function () {
      var r = score(n.st); if (!r.complete || !window.UFInsertLines) { return; }
      var how = window.UFInsertLines([header(n)].concat(lines(r.total)));
      setTxt(msg, how === 'end' ? 'Inserido no fim do laudo (não havia cursor no laudo).' : 'Inserido na posição do cursor.');
    });
    n.box = box; n.upd = upd; n.inputs = inputs; nods.push(n); list.appendChild(box); upd();
    return n;
  }
  function build(b) {
    var add = el('button', 'btn btn-sm', 'Adicionar nódulo'); add.type = 'button'; add.id = 'trAdd';
    list = el('div', 'tr-list'); b.appendChild(add); b.appendChild(list);
    b.appendChild(el('div', 'uc-note', 'ACR TI-RADS (Tessler et al., JACR 2017). Os nódulos ficam só nesta janela.'));
    on(add, 'click', function () { var n = addNodule(); var f = n.box.querySelector('select'); if (f) { f.focus(); } });
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
      seen.push(ln); out.push({ chips: chips.slice(0, 5), out: f });
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
  function runTxt() {
    if (busyT || !ed) { return; }
    busyT = true;
    try {
      var L = textNodules(), i, r, sc, ch = false;
      for (i = 0; i < L.length; i++) {
        r = readTxt(L[i]); sc = r.miss ? null : score(r.st);
        if (putT(L[i].out, txtOn && sc && sc.complete ? level(sc.total).substring(2) : null)) { ch = true; }
        L[i].out.title = sc && sc.complete ? 'ACR TI-RADS: ' + sc.total + (sc.total === 1 ? ' ponto' : ' pontos') + ' (' + level(sc.total) + ')' : '';
      }
      if (ch) { var ev; try { ev = new Event('input', { bubbles: true }); } catch (x) { ev = document.createEvent('Event'); ev.initEvent('input', true, false); } ed.dispatchEvent(ev); }
    } finally { busyT = false; }
  }
  function txtStatus() {
    var L = textNodules(), i, r, sc, parts = [];
    if (!L.length) { return { txt: 'sem frase de nódulo com "TI-RADS ___" no laudo', cls: 'none' }; }
    for (i = 0; i < L.length; i++) { r = readTxt(L[i]); sc = r.miss ? null : score(r.st); parts.push(sc ? level(sc.total) + ' (' + sc.total + ' pts)' : 'faltam ' + r.miss + ' opç' + (r.miss > 1 ? 'ões' : 'ão')); }
    return { txt: 'nódulo no texto: ' + parts.join(' · '), cls: /TR/.test(parts.join('')) ? 'ok' : 'wait' };
  }
  function initTxt() {
    ed = document.getElementById('editor'); if (!ed) { return; }
    if (window.UFCalc && UFCalc.onEditorChange) { UFCalc.onEditorChange(runTxt); }
    if (ed.addEventListener) { ed.addEventListener('input', function () { setTimeout(runTxt, 0); }, false); }
    runTxt();
  }
  if (window.UFCalcVol) {
    UFCalcVol.addToggle('ucTrTxt', 'TI-RADS pelas opções do nódulo no texto', true, function (v) { txtOn = !!v; runTxt(); },
      'ACR TI-RADS 2017 (Tessler et al.). Lê as 5 opções da frase "Observa-se nódulo ..." e preenche o número em "TI-RADS ___" (1 a 5). "Tipo cauda de cometa" conta 0 ponto (artefato grande em cauda de cometa); "irregulares" e "lobuladas" contam 2.', txtStatus);
  }
  window.UFTirads = { score: score, level: level, lines: lines, header: header, sizeNote: sizeNote, CAT: CAT, LV: LV, add: function () { return addNodule(); }, count: function () { return nods.length; }, initTxt: initTxt, runTxt: runTxt, textNodules: textNodules, mapTxt: mapTxt };
  if (window.UFCalc) { UFCalc.register({ id: 'tirads', title: 'TI-RADS (ACR 2017)', build: build }); }
})();
