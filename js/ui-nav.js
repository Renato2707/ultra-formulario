/*
 * ui-nav.js - navegador (coluna da esquerda): exames, modelos, frases.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-nav', function (UI, R) {
  'use strict';
  var PLACE, GENERIC, STOP;   /* deste arquivo */
  var $, esc, hasCls, addCls, rmCls, qsa, trim, foldKeep, highlight, S, sxShow, editor, findExam, examNames,
      getModel, modelTemplate, sortedModels, examSections, renderLines, textLines, lineText, insertCard,
      secToTop, editorLines, isHypEl, cgIdx, useModel, defaultModelOf;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.HYP_HEAD */
  UI.navItems = navItems; UI.loadedModel = loadedModel; UI.renderNav = renderNav; UI.modelHref = modelHref;
  UI.sentenceCase = sentenceCase; UI.rawHtml = rawHtml; UI.navKeyOf = navKeyOf; UI.goLevel = goLevel;
  UI.navBack = navBack; UI.activateNav = activateNav; UI.selectCard = selectCard; UI.cleanWords = cleanWords;
  UI.prefixEq = prefixEq; UI.otherSecVariants = otherSecVariants; UI.mentionsOther = mentionsOther;
  UI.tplOrigSet = tplOrigSet; UI.isBlankLine = isBlankLine; UI.findSectionTarget = findSectionTarget;
  UI.endTarget = endTarget; UI.caretInEditor = caretInEditor;   /* usadas por outros arquivos */

  /* ================= navigator (left column) ================= */
  /* Level 1 = exams, Level 2 = Modelos tab, Level 3 = Frases tab */
  function navItems() { return qsa($('navList'), '.card'); }
  function examCount(nm) {
    var ex = findExam(nm), nt = 0, np = 0, i;
    for (i = 0; i < S.models.length; i++) { if (S.models[i].exam === nm) { nt++; } }
    if (ex) { for (i = 0; i < ex.sections.length; i++) { np += ex.sections[i].phrases.length; } }
    return nt + (nt === 1 ? ' modelo' : ' modelos') + (np ? ' · ' + np + ' frases' : '');
  }
  function toolsHtml() {
    function b(id, label, t) { return '<button type="button" class="btn btn-sm" id="' + id + '" title="' + t + '">' + label + '</button>'; }
    if (S.level === 2) { return b('tMAdd', '+ Novo modelo', 'Adicionar modelo') + b('tMEdit', 'Editar', 'Editar modelo selecionado') + b('tMClone', 'Clonar', 'Clonar modelo selecionado'); }
    if (S.level === 3) { return b('tPAdd', '+ Nova frase', 'Adicionar frase') + b('tPImp', '&#8681; Importar', 'Importar frases') + b('tPEdit', '&#9998; Editar', 'Editar frase selecionada'); }
    return '';
  }
  function loadedModel() { return S.activeModelId ? getModel(S.activeModelId) : null; }
  function syncExamChrome() {
    var inExam = S.level > 1 && !!S.navExam, lab, modelos, m, nameEl, here;
    m = loadedModel();
    if ($('btnClear')) { $('btnClear').title = m ? ('Voltar ao modelo do zero: ' + m.name) : 'Apagar todo o laudo'; }
    $('examBox').hidden = !inExam;
    $('listHead').hidden = inExam;
    $('navFoot').hidden = !inExam;
    $('navBack').disabled = !inExam;
    if (!inExam) { return; }
    lab = S.navExam === UltraParser.GLOBAL_EXAM ? 'TODOS (comuns a todos)' : S.navExam;
    nameEl = $('examName');
    here = m && m.exam === S.navExam;
    nameEl.textContent = here ? m.name : lab;
    if (here) {
      nameEl.setAttribute('href', modelHref(m.id));
      nameEl.title = m.name + ' — Recarregar o modelo do zero';
    } else {
      nameEl.removeAttribute('href');
      nameEl.title = lab;
    }
    modelos = S.level === 2;
    $('tabModelos').setAttribute('aria-selected', modelos ? 'true' : 'false');
    $('tabFrases').setAttribute('aria-selected', modelos ? 'false' : 'true');
    if (modelos) { addCls($('tabModelos'), 'on'); rmCls($('tabFrases'), 'on'); }
    else { addCls($('tabFrases'), 'on'); rmCls($('tabModelos'), 'on'); }
  }
  R(function () {
    PLACE = ['', 'Pesquisar exame...', 'Pesquisar modelo...', 'Pesquisar frases...'];
  });
  function renderNav(keepFocus) {
    var noBank = !S.bank && !S.userModels.length;
    $('noBank').hidden = !noBank;
    $('navHead').style.display = noBank ? 'none' : '';
    $('navList').style.display = noBank ? 'none' : '';
    if (noBank) { return; }
    if (S.level > 1 && !S.navExam) { S.level = 1; }
    syncExamChrome();
    $('navTools').innerHTML = toolsHtml();
    var si = $('navSearch');
    si.setAttribute('placeholder', PLACE[S.level]);
    if (si.value !== S.navSearch[S.level - 1]) { si.value = S.navSearch[S.level - 1]; }
    sxShow(si);
    var q = foldKeep(trim(si.value)), html = '', i;
    $('navCount').innerHTML = '';
    if (S.level === 1) {
      var names = examNames(), n = 0;
      for (i = 0; i < names.length; i++) {
        var nm = names[i], label = nm === UltraParser.GLOBAL_EXAM ? 'TODOS (comuns a todos)' : nm;
        if (q && foldKeep(label).indexOf(q) < 0) { continue; }
        n++;
        html += examCard(nm, label);
      }
      if (!n) { html = '<div class="empty">Nenhum exame encontrado</div>'; }
    } else if (S.level === 2) {
      html = renderModelsLevel(q);
    } else {
      html = renderPhrasesLevel(trim(si.value));
    }
    $('navList').innerHTML = html;
    if (keepFocus) { restoreNavFocus(); }
  }
  function isPad(t) { return String(t || '').indexOf('(padr\u00e3o)') >= 0; }   /* C6o: "(padrão)" cards stand out */
  /* C8: hash relativo. Nova guia carrega o arquivo e aplica o modelo; o clique simples não navega. */
  function modelHref(id) { return '#ufmodel=' + encodeURIComponent(id); }
  /* C8: cartão do exame aponta para o mesmo modelo que o duplo clique carrega aqui
     (defaultModelOf: nome com "padrão"/"padrao", senão o primeiro da lista). Sem modelo, continua botão. */
  function examCard(nm, label) {
    var dm = defaultModelOf(nm), open = '';
    if (dm) { open = ' href="' + esc(modelHref(dm.id)) + '" draggable="false"'; }
    return '<' + (dm ? 'a' : 'button type="button"') + open + ' class="card' + (nm === S.activeExam ? ' sel' : '') + '" data-exam="' + esc(nm) + '"><div class="ct">' +
      esc(label) + '</div><div class="cm">' + esc(examCount(nm)) + '</div></' + (dm ? 'a' : 'button') + '>';
  }
  function modelCard(m) {
    var loaded = m.id === S.activeModelId;
    return '<a href="' + esc(modelHref(m.id)) + '" class="card' + (isPad(m.name) ? ' pad' : '') + (m.id === (S.selModel || S.activeModelId) ? ' sel' : '') + (loaded ? ' loaded' : '') + '" data-model="' + esc(m.id) + '"' +
      (loaded ? ' title="' + esc(m.name) + ' — clique para recarregar do zero (Ctrl+Z desfaz)"' : '') +
      (S.settings.dragReorder ? ' draggable="true"' : ' draggable="false"') + '>' +
      (S.settings.showUsage ? '<span class="n">(' + (S.usage[m.id] || 0) + ')</span>' : '') +
      '<div class="ct">' + (S.settings.dragReorder ? '<span class="grip">&#8942;</span>' : '') + esc(m.name) + '</div>' +
      (m.user ? '<div class="cm">meu modelo</div>' : (m.override ? '<div class="cm">editado neste computador</div>' : '')) + '</a>';
  }
  function renderModelsLevel(q) {
    var arr = sortedModels(), html = '', glob = '', i, m, n = 0;
    for (i = 0; i < arr.length; i++) {
      m = arr[i];
      if (q && foldKeep(m.name).indexOf(q) < 0) { continue; }
      if (m.exam === S.navExam) { html += modelCard(m); n++; }
      else if (m.exam === UltraParser.GLOBAL_EXAM && S.navExam !== UltraParser.GLOBAL_EXAM) { glob += modelCard(m); n++; }
    }
    if (glob) { html += '<div class="glabel">Comuns a todos os exames</div>' + glob; }
    if (!n && q) { html = '<div class="empty">Nenhum modelo encontrado</div>'; }
    else if (!n) { html = '<div class="empty">Este exame não tem modelos.</div>'; }
    return html;
  }
  /* display only: first letter upper, the rest lower, text inside parentheses kept as written */
  function sentenceCase(name) {
    var s = String(name || ''), out = '', i, ch, depth = 0, capped = false;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (ch === '(') { depth++; out += ch; continue; }
      if (ch === ')' && depth) { depth--; out += ch; continue; }
      if (depth) { out += ch; continue; }
      if (!capped && /[A-Za-z\u00C0-\u00FF]/.test(ch)) { out += ch.toUpperCase(); capped = true; }
      else { out += ch.toLowerCase(); }
    }
    return out;
  }
  /* verbatim txt lines; first (title) line in bold */
  function rawHtml(src, q) {
    var ls = String(src).split('\n'), out = [], i;
    for (i = 0; i < ls.length; i++) {
      if (i === 0) { out.push('<b>' + highlight(ls[i], q) + '</b>'); }
      else if (UltraParser.parsePlacement(ls[i])) { out.push('<span class="dirl">' + highlight(ls[i], q) + '</span>'); }   /* @@SUBSTITUI / @@ABAIXO_DE: verbatim, light gray */
      else { out.push(highlight(ls[i], q)); }
    }
    return out.join('\n');
  }
  /* with a search query: sections of the current exam first, then every other exam of the txt
     (each phrase once; origin shown discreetly only for other exams) */
  function phraseScope(q) {
    var secs = examSections(S.navExam), i, j, all = [], seen = {}, ex = examNames(), cur = S.navExam;
    for (i = 0; i < secs.length; i++) { secs[i].org = ''; all.push(secs[i]); }
    if (!q) { return all; }
    for (i = 0; i < all.length; i++) { for (j = 0; j < all[i].cards.length; j++) { seen[all[i].cards[j].id] = 1; } }
    for (i = 0; i < ex.length; i++) {
      if (ex[i] === cur) { continue; }
      var os = examSections(ex[i]), k;
      for (j = 0; j < os.length; j++) {
        var cs = [];
        for (k = 0; k < os[j].cards.length; k++) { if (!seen[os[j].cards[k].id]) { seen[os[j].cards[k].id] = 1; cs.push(os[j].cards[k]); } }
        if (cs.length) { all.push({ name: os[j].name, key: os[j].key + '|' + ex[i], src: os[j].src, reserved: false, cards: cs, org: ex[i] }); }
      }
    }
    return all;
  }
  function renderPhrasesLevel(q) {
    var secs = phraseScope(q), html = '', i, j, c, ph, fq = foldKeep(q), matches = [];
    S.phraseIndex = {};
    for (i = 0; i < secs.length; i++) {
      var s = secs[i], inner = '', shown = 0;
      for (j = 0; j < s.cards.length; j++) {
        c = s.cards[j]; ph = c.ph;
        if (q && foldKeep(c.src + ' ' + ph.body).indexOf(fq) < 0) { if (!S.phraseIndex[c.id]) { S.phraseIndex[c.id] = c; c.dispSec = s.name; } continue; }
        S.phraseIndex[c.id] = c; c.dispSec = s.name;
        shown++; if (q) { matches.push(c.id); }
        var meta = (ph.help ? '(' + ph.help + ')' : '') + (ph.help && ph.hypothesis ? ' · ' : '') + (ph.hypothesis ? ph.hypothesis : '');
        inner += '<button type="button" class="card pcard' + (isPad(ph.title + (ph.help ? ' (' + ph.help + ')' : '')) ? ' pad' : '') + (c.user ? ' user' : '') + (c.id === S.selCard ? ' sel' : '') + '" data-ph="' + esc(c.id) +
          '">' +
          '<div class="ph1"><b>' + highlight(ph.title, q) + '</b>' + (meta ? '<span class="meta">' + highlight(meta, q) + '</span>' : '') +
          ((ph.critical && ph.critical.length) ? '<span class="wf" title="Contém linha crítica">&#9888;</span>' : '') + '</div>' +
          '<div class="pb">' + highlight(ph.body, q) + '</div><div class="raw">' + rawHtml(c.src, q) + '</div>' +
          '<span class="pins" data-insbtn="1" title="Inserir no laudo">&#8594;</span></button>';
      }
      if (!shown) { continue; }   /* C8: sem frases (seção vazia no banco, ou nada passou no filtro) não aparece; recolhida com frases continua */
      var open = q ? true : !!S.openSecs[s.key];
      html += '<div class="sec' + (open ? ' open' : '') + (open && S.animSec === s.key ? ' sec-anim' : '') + '"><button type="button" class="card" data-sec="' + esc(s.key) + '" aria-expanded="' + open + '" title="' + esc(s.name) + '">' +
        '<span class="arr">' + (open ? '&#9662;' : '&#9656;') + '</span><span class="ct">' + esc(sentenceCase(s.name)) + (s.org ? '<span class="org"> \u00b7 ' + esc(s.org) + '</span>' : '') + '</span><span class="n">' +
        (s.cards.length ? (q ? shown + '/' : '') + s.cards.length : '') + '</span></button>';
      if (open) {
        html += '<div class="sec-body">' +
          (s.cards.length ? inner : '<div class="empty">Sem frases ainda</div>') + '</div>';
      }
      html += '</div>';
    }
    S.phMatches = matches;
    if (q) { $('navCount').innerHTML = matches.length + (matches.length === 1 ? ' frase' : ' frases'); }
    return html || '<div class="empty">' + (q ? 'Nenhuma frase encontrada' : 'Este exame não tem seções.') + '</div>';
  }
  function navKeyOf(el) {
    if (!el) { return null; }
    var a = ['data-exam', 'data-model', 'data-sec', 'data-ph', 'data-go'], i;
    for (i = 0; i < a.length; i++) { if (el.getAttribute(a[i]) !== null) { return a[i] + '=' + el.getAttribute(a[i]); } }
    return null;
  }
  function restoreNavFocus() {
    var l = navItems(), i;
    for (i = 0; i < l.length; i++) { if (navKeyOf(l[i]) === S.navFocus) { l[i].focus(); return; } }
  }
  function goLevel(lv, exam) {
    if (exam !== undefined) { S.navExam = exam; }
    S.level = lv; S.navFocus = null;
    renderNav();
    var l = navItems(), i, want = null;
    for (i = 0; i < l.length; i++) {
      if ((lv === 1 && l[i].getAttribute('data-exam') === S.navExam) || (lv === 2 && hasCls(l[i], 'sel'))) { want = l[i]; break; }
    }
    (want || l[0] || $('navSearch')).focus();
    if (want && want.scrollIntoView) { want.scrollIntoView(false); }
  }
  function navBack() { if (S.level > 1) { goLevel(1); } }
  function activateNav(el) {
    var v;
    if ((v = el.getAttribute('data-go')) !== null) {
      v = parseInt(v, 10);
      if (v === 3) { S.activeExam = S.navExam; }
      goLevel(v); return;
    }
    if ((v = el.getAttribute('data-exam')) !== null) { S.selModel = null; goLevel(2, v); return; }
    if ((v = el.getAttribute('data-model')) !== null) { S.selModel = v; useModel(getModel(v)); return; }
    if ((v = el.getAttribute('data-sec')) !== null) {
      S.openSecs[v] = !S.openSecs[v]; S.navFocus = navKeyOf(el); renderNav(true); if (S.openSecs[v]) { secToTop(v); } return;
    }
    if ((v = el.getAttribute('data-ph')) !== null) { selectCard(v); insertCard(v); }
  }
  function selectCard(id) {
    S.selCard = id;
    var l = qsa($('navList'), '.pcard'), i;
    for (i = 0; i < l.length; i++) { if (l[i].getAttribute('data-ph') === id) { addCls(l[i], 'sel'); } else { rmCls(l[i], 'sel'); } }
  }
  /* ---------- auto-placement: find the phrase's section in the report ---------- */
  R(function () {
    GENERIC = { GERAL: 1, GERAIS: 1, OUTROS: 1, OUTRAS: 1, OUTRO: 1, OUTRA: 1, OBS: 1, OBSERVACAO: 1, OBSERVACOES: 1, ABD: 1, ADICIONAL: 1, ADICIONAIS: 1 };
    STOP = { DE: 1, DA: 1, DO: 1, DAS: 1, DOS: 1, E: 1, A: 1, O: 1 };
  });
  function cleanWords(t) {
    var w = UltraParser.words(String(t).replace(/[^A-Za-z\u00C0-\u00FF0-9\s\/]/g, ' ')), out = [], i;
    for (i = 0; i < w.length; i++) { if (w[i]) { out.push(w[i]); } }
    return out;
  }
  function sigWords(ws) {
    var out = [], i; for (i = 0; i < ws.length; i++) { if (!GENERIC[ws[i]]) { out.push(ws[i]); } }
    return out;
  }
  function eqWord(a, b) {
    if (a === b || UltraParser.wordsEqualPlural([a], [b])) { return true; }
    function m(x) { return x.replace(/NS$/, 'M').replace(/IS$/, 'L'); }   /* RINS->RIM, RENAIS->RENAL-ish */
    return m(a) === b || m(b) === a || m(a) === m(b);
  }
  function prefixEq(lw, v) {
    if (lw.length < v.length) { return false; }
    for (var i = 0; i < v.length; i++) { if (!eqWord(lw[i], v[i])) { return false; } }
    return true;
  }
  /* full-name variants (exact, sides stripped, '/' parts, generic words removed) */
  function secNameVariants(name) {
    var P = UltraParser, out = [], seen = {}, parts = String(name).split('/'), i, w;
    function add(ws) { if (ws.length && ws[0] && !seen[ws.join(' ')]) { seen[ws.join(' ')] = 1; out.push(ws); } }
    function addAll(t) { w = cleanWords(t); add(w); add(P.stripSides(w)); add(sigWords(w)); add(sigWords(P.stripSides(w))); }
    addAll(String(name).replace(/\//g, ' '));
    if (parts.length > 1) { for (i = 0; i < parts.length; i++) { addAll(parts[i]); } }
    return out;
  }
  /* first significant word of each variant (e.g. AORTA ABDOMINAL GERAL -> AORTA) */
  function secFirstWords(name) {
    var v = secNameVariants(name), out = [], seen = {}, i, k, w;
    for (i = 0; i < v.length; i++) {
      for (k = 0; k < v[i].length; k++) { w = v[i][k]; if (!STOP[w] && w.length >= 3) { break; } w = null; }
      if (w && !seen[w]) { seen[w] = 1; out.push([w]); }
    }
    return out;
  }
  /* does the line start with the section name? 'head' (line is just the name) or 'para' */
  function matchSecLine(text, variants) {
    var lw = cleanWords(text), v, k;
    for (k = 0; k < variants.length; k++) {
      v = variants[k];
      if (!prefixEq(lw, v)) { continue; }
      var sideless = UltraParser.stripSides(lw), colon = /:\s*$/.test(trim(text));
      if (lw.length === v.length || sigWords(sideless).length <= v.length || (colon && lw.length <= v.length + 2)) { return colon || lw.length <= v.length + 1 ? 'head' : 'para'; }
      return 'para';
    }
    return null;
  }
  /* the full name appears among the first words of the line (not as its 1st word) */
  function nearStart(text, vars) {
    var lw = cleanWords(text), i, k, seen = 0;
    for (i = 0; i < lw.length && seen < 4; i++) {
      if (STOP[lw[i]]) { continue; }
      seen++;
      if (i === 0) { continue; }
      for (k = 0; k < vars.length; k++) { if (prefixEq(lw.slice(i), vars[k])) { return true; } }
    }
    return false;
  }
  function otherSecVariants(own) {
    var secs = examSections(S.activeExam || S.navExam), out = [], i, v, k, fo = UltraParser.fold(own);
    for (i = 0; i < secs.length; i++) {
      if (UltraParser.fold(secs[i].name) === fo) { continue; }
      v = secNameVariants(secs[i].name); for (k = 0; k < v.length; k++) { if (v[k].length > 1) { out.push(' ' + v[k].join(' ') + ' '); } }
    }
    return out;
  }
  function mentionsOther(text, others) {
    var t = ' ' + cleanWords(text).join(' ') + ' ', i;
    for (i = 0; i < others.length; i++) { if (t.indexOf(others[i]) >= 0) { return true; } }
    return false;
  }
  function tplOrigSet() {
    var m = getModel(S.activeModelId), set = {}, d, l, i;
    if (!m) { return set; }
    var tp = modelTemplate(m); d = document.createElement('div'); d.innerHTML = renderLines(tp.body, tp.fields, tp.critical);
    l = textLines(d, '___'); for (i = 0; i < l.length; i++) { set[trim(l[i])] = 1; }
    return set;
  }
  function isBlankLine(el) { return trim(lineText(el)) === ''; }
  /* -> { range, replace } or null */
  function findSectionTarget(secNames) {
    var L = editorLines(), i, n, pass, kind = null, start = -1, secName = null, from = 0;
    /* never touch the report title / technique: search below 'Relatório ...' (or below the 1st line) */
    for (i = 0; i < L.length; i++) { if (/^\s*relat[óo]rio/i.test(lineText(L[i]))) { from = i + 1; break; } }
    if (!from) { for (i = 0; i < L.length; i++) { if (!isBlankLine(L[i])) { from = i + 1; break; } } }
    /* pass 0: line starts with the name; 1: starts with its first significant word;
       2: paragraph opening that names it within its first words ('Glândula tireoide...', 'Tendão subescapular:') */
    for (pass = 0; pass < 3 && start < 0; pass++) {
      for (n = 0; n < secNames.length && start < 0; n++) {
        if (!secNames[n]) { continue; }
        var vars = secNameVariants(secNames[n]);
        if (pass === 1) { continue; }   /* (first-word-only matching dropped: 'Nervo ulnar' must not hit 'Nervo mediano') */
        for (i = from; i < L.length; i++) {
          if (isHypEl(L[i]) || isBlankLine(L[i]) || cgIdx([L[i]]) === 0) { continue; }
          if (pass === 2) { kind = (i === 0 || isBlankLine(L[i - 1])) && nearStart(lineText(L[i]), vars) ? 'para' : null; }
          else { kind = matchSecLine(lineText(L[i]), vars); }
          if (kind) { start = i; secName = secNames[n]; break; }
        }
      }
    }
    if (start < 0) { return null; }
    var first = kind === 'head' ? start + 1 : start, last = first - 1;
    var others = otherSecVariants(secName);
    for (i = first; i < L.length && !isBlankLine(L[i]) && !isHypEl(L[i]); i++) {
      if (i > start && kind === 'para' && mentionsOther(lineText(L[i]), others)) { break; }   /* e.g. 'Tronco da veia porta' inside the Fígado paragraph */
      last = i;
    }
    var r = document.createRange();
    if (last < first) {   /* heading only: insert right below it */
      r.selectNodeContents(L[start]); r.collapse(false); return { range: r, replace: false, how: 'heading' };
    }
    S.lastPlacementLine = lineText(L[start]); S.lastAnchor = lineText(L[first <= last ? first : start]); S.lastSpan = last - first + 1;
    var orig = tplOrigSet(), isDefault = true;
    /* side-specific section (OVÁRIO DIREITO) on a shared paragraph ('Ovários ...'): never replace */
    var sw = cleanWords(secName), lt = ' ' + cleanWords(lineText(L[start])).join(' ') + ' ', q;
    for (q = 0; q < sw.length; q++) { if (/^(DIREIT[OA]|ESQUERD[OA])$/.test(sw[q]) && lt.indexOf(' ' + sw[q] + ' ') < 0) { isDefault = false; } }
    for (i = first; i <= last; i++) { if (!orig[trim(lineText(L[i]))] || hasCls(L[i], 'chg')) { isDefault = false; break; } }
    if (isDefault) { r.setStart(L[first], 0); r.setEnd(L[last], L[last].childNodes.length); return { range: r, replace: true, how: 'replace' }; }
    r.selectNodeContents(L[last]); r.collapse(false); return { range: r, replace: false, how: 'below' };
  }
  /* end of report, but above the HIPÓTESE block / 'Considerações gerais' */
  function endTarget() {
    var L = editorLines(), i, stop = L.length, last = -1;
    for (i = 0; i < L.length; i++) { if (hasCls(L[i], 'hyph') || hasCls(L[i], 'hyps') && L[i + 1] && hasCls(L[i + 1], 'hyph') || cgIdx([L[i]]) === 0 || (UI.HYP_HEAD.test(lineText(L[i])) && !isHypEl(L[i]) && L[i].getAttribute('data-hyp') === null)) { stop = i; break; } }
    for (i = stop - 1; i >= 0; i--) { if (!isBlankLine(L[i])) { last = i; break; } }
    var r = document.createRange();
    if (last < 0) { r.selectNodeContents(editor); r.collapse(false); return r; }
    r.selectNodeContents(L[last]); r.collapse(false); return r;
  }
  function caretInEditor() {
    var r = S.savedRange;
    return S.userCaret && r && editor.contains(r.commonAncestorContainer) ? r : null;
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls; qsa = UI.qsa;
    trim = UI.trim; foldKeep = UI.foldKeep; highlight = UI.highlight; S = UI.S; sxShow = UI.sxShow;
    editor = UI.editor; findExam = UI.findExam; examNames = UI.examNames; getModel = UI.getModel;
    modelTemplate = UI.modelTemplate; sortedModels = UI.sortedModels; examSections = UI.examSections;
    renderLines = UI.renderLines; textLines = UI.textLines; lineText = UI.lineText; insertCard = UI.insertCard;
    secToTop = UI.secToTop; editorLines = UI.editorLines; isHypEl = UI.isHypEl; cgIdx = UI.cgIdx;
    useModel = UI.useModel; defaultModelOf = UI.defaultModelOf;
  };
});
