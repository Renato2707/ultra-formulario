/*
 * parser.js - Ultra Formulario phrase bank parser (ES5, IE11, file://, no deps).
 * Reads the .txt bank and returns structured data + an inconsistency report.
 * It NEVER modifies clinical text: bodies are kept verbatim (only the line
 * terminator \r\n / \r is normalised to \n).
 *
 * Usage: var result = UltraParser.parse(text);
 */
var UltraParser = (function () {
  'use strict';

  var GLOBAL_EXAM = 'TODOS';

  /* Issue catalogue: code -> [severity, Portuguese description] */
  var ISSUE_TYPES = {
    DIRECTIVE_UNKNOWN:        ['erro',  'Diretiva desconhecida (linha inicia com @@ ou ##)'],
    DIRECTIVE_NO_NAME:        ['erro',  'Diretiva sem nome'],
    DIRECTIVE_SEPARATOR:      ['info',  'Separador da diretiva diferente de espaço (":" ou "=")'],
    EXAM_FULL_WITHOUT_EXAM:   ['erro',  '@@EXAME_FULL sem @@EXAME anterior'],
    EXAM_FULL_DUPLICATE:      ['aviso', '@@EXAME_FULL repetido no mesmo exame'],
    EXAM_NO_FULL:             ['aviso', 'Exame sem @@EXAME_FULL'],
    EXAM_DUPLICATE:           ['aviso', 'Nome de exame repetido'],
    OUTSIDE_EXAM:             ['erro',  'Conteúdo antes de qualquer @@EXAME'],
    ORPHAN_TEXT:              ['aviso', 'Texto fora de template/seção/nota (ignorado)'],
    TEMPLATE_EMPTY:           ['erro',  'Template sem conteúdo'],
    TEMPLATE_BRACKET_NAME:    ['aviso', 'Nome de template contém [..] (hipótese não se aplica a template)'],
    TEMPLATE_TITLE_DIFFERS:   ['info',  'Primeira linha do template difere do @@EXAME_FULL'],
    SECTION_DUPLICATE:        ['aviso', 'Seção com frases declarada mais de uma vez no mesmo exame (unidas)'],
    SECTION_RESERVED:         ['info',  'Seção vazia sem correspondente: reservada para frases futuras'],
    TEXT_BEFORE_FIRST_PHRASE: ['erro',  'Texto na seção antes do primeiro título de frase'],
    PHRASE_EMPTY:             ['erro',  'Frase sem corpo'],
    PHRASE_DUPLICATE_TITLE:   ['aviso', 'Título de frase repetido na mesma seção'],
    TITLE_MULTI_BRACKET:      ['aviso', 'Título com mais de um [..]'],
    TITLE_UNBALANCED:         ['erro',  'Título com ( ) ou [ ] desbalanceados'],
    HYPOTHESIS_PIPE:          ['aviso', 'Hipótese contém "|" (alternativas fora de ?[ ])'],
    TITLE_LIKE_IN_BODY:       ['aviso', 'Linha terminada em ":" dentro do corpo (sem linha em branco antes) - mantida como corpo'],
    CRITICAL_LINE:            ['info',  'Linha crítica (*** no início): revisão obrigatória pelo médico'],
    EXAMPLE_BLOCK_SKIPPED:    ['info',  'Bloco de exemplo/instruções do início do arquivo ignorado'],
    DIRECTIVE_IN_NOTE:        ['info',  'Diretiva dentro do bloco de notas global (tratada como texto da nota)'],
    STAR_RUN:                 ['aviso', 'Sequência de 3+ asteriscos fora do início da linha'],
    STAR_ADJACENT:            ['aviso', 'Asterisco colado a letra (ex.: *OU*) - campo ambíguo'],
    LEGACY_BULLET:            ['info',  'Marcador • (legado)'],
    LEGACY_PIPE:              ['aviso', '"|" fora de ?[ ] (opções legadas a|b)'],
    LEGACY_SLASH:             ['info',  'Possíveis opções legadas "a / b" fora de ?[ ]'],
    DROPDOWN_UNCLOSED:        ['erro',  '?[ sem ] de fechamento'],
    DROPDOWN_MULTILINE:       ['aviso', '?[ ] ocupa mais de uma linha'],
    DROPDOWN_NESTED:          ['info',  '?[ ] dentro de outro ?[ ] (aninhado) - o app aceita: ao escolher a opção, o ?[ ] de dentro vira um novo campo'],
    DIRECTIVE_TYPO:           ['erro',  'Diretiva @@ com nome errado (provável erro de digitação) - a linha não funciona e vira texto'],
    DIRECTIVE_EMPTY_TARGET:   ['erro',  '@@SUBSTITUI / @@ABAIXO_DE sem o texto-alvo - diretiva ignorada'],
    DIRECTIVE_MISPLACED:      ['aviso', 'Diretiva em posição onde não tem efeito ou vale para outra frase'],
    DIRECTIVE_DUPLICATE:      ['info', 'Mais de uma diretiva de posição para a mesma frase/seção - vale a primeira (de cima para baixo) cujo alvo existe no modelo'],
    ALWAYS_DUPLICATE:         ['aviso', '@@SEMPRE repetido na mesma frase'],
    DIRECTIVE_TARGET_MISSING: ['aviso', 'Alvo da diretiva não encontrado no(s) template(s) - a frase vai para o fim da seção/laudo'],
    DROPDOWN_EMPTY_OPTION:    ['aviso', 'Opção vazia em ?[ ]'],
    DROPDOWN_SINGLE:          ['aviso', '?[ ] com uma única opção'],
    MULTI_NESTED:             ['aviso', '?+[ ] (escolha múltipla) com campos ou listas dentro das opções - esse conteúdo vai como texto, não vira campo'],
    STRAY_BRACKET:            ['info',  '[ ou ] solto no corpo (não é campo)']
  };

  function trimStr(s) { return s.replace(/^\s+|\s+$/g, ''); }
  function rtrim(s) { return s.replace(/\s+$/, ''); }
  function isBlank(s) { return /^\s*$/.test(s); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function upperKey(s) { return trimStr(s).toUpperCase().replace(/\s+/g, ' '); }

  /* accent/case fold without String.prototype.normalize (IE11) */
  var FOLD_FROM = '\u00C1\u00C0\u00C2\u00C3\u00C4\u00C9\u00C8\u00CA\u00CB\u00CD\u00CC\u00CE\u00CF\u00D3\u00D2\u00D4\u00D5\u00D6\u00DA\u00D9\u00DB\u00DC\u00C7\u00D1';
  var FOLD_TO   = 'AAAAAEEEEIIIIOOOOOUUUUCN';
  function fold(s) {
    var u = String(s).toUpperCase(), out = '', i, c, k;
    for (i = 0; i < u.length; i++) {
      c = u.charAt(i); k = FOLD_FROM.indexOf(c);
      out += k >= 0 ? FOLD_TO.charAt(k) : c;
    }
    return out.replace(/\s+/g, ' ').replace(/^ | $/g, '');
  }
  var SIDE_WORDS = { DIREITO: 1, DIREITA: 1, ESQUERDO: 1, ESQUERDA: 1, D: 1, E: 1, DIR: 1, ESQ: 1 };
  function words(s) { return fold(s).replace(/[().,;:]/g, ' ').replace(/\s+/g, ' ').replace(/^ | $/g, '').split(' '); }
  function stripSides(ws) {
    var out = [], i;
    for (i = 0; i < ws.length; i++) { if (!hasOwn(SIDE_WORDS, ws[i])) { out.push(ws[i]); } }
    return out.length ? out : ws;
  }
  /* singular/plural variants of one folded word */
  function wordForms(w) {
    var f = [w, w + 'S', w + 'ES'];
    if (/ES$/.test(w) && w.length > 4) { f.push(w.substring(0, w.length - 2)); }
    if (/S$/.test(w) && w.length > 3) { f.push(w.substring(0, w.length - 1)); }
    if (/AO$/.test(w)) { f.push(w.substring(0, w.length - 2) + 'OES'); }
    if (/OES$/.test(w)) { f.push(w.substring(0, w.length - 3) + 'AO'); }
    return f;
  }
  function wordsEqualPlural(a, b) {
    if (a.length !== b.length) { return false; }
    var i, fa, j, ok;
    for (i = 0; i < a.length; i++) {
      if (a[i] === b[i]) { continue; }
      fa = wordForms(a[i]); ok = false;
      for (j = 0; j < fa.length; j++) { if (fa[j] === b[i]) { ok = true; break; } }
      if (!ok) { return false; }
    }
    return true;
  }
  function joinW(ws) { return ws.join(' '); }

  /* ---------- directive line ---------- */
  var DIR_RE = /^\s*(@@|##)([A-Za-z_]+)\s*([:=]?)\s*(.*)$/;
  var KNOWN = { '@@EXAME': 1, '@@EXAME_FULL': 1, '@@TEMPLATE': 1, '@@NOTE': 1, '##SECTION': 1 };

  /* user placement directives (inside ##SECTION blocks):
       @@SUBSTITUI = <início da linha do laudo>     @@ABAIXO_DE = <início da linha do laudo>
     Accepts ':' / '=' / nothing, '@@ABAIXO DE', Word curly quotes and non-breaking spaces. */
  var PLACE_RE = /^\s*@@\s*(SUBSTITUI|SUBSTITUIR|ABAIXO[_ ]+DE)\s*[:=]?\s*(.*)$/i;
  /* @@SEMPRE (also "@@SEMPRE:", "@@ sempre", "@@Sempre =") under a phrase title: insert the phrase whenever a template is loaded */
  var ALWAYS_RE = /^\s*@@\s*SEMPRE\s*[:=]?\s*$/i;
  function parsePlacement(line) {
    var t = String(line).replace(/[\u00A0\u2007\u202F\t]/g, ' ');
    if (ALWAYS_RE.test(t)) { return { mode: 'always', text: '' }; }
    var m = PLACE_RE.exec(t);
    if (!m) { return null; }
    var v = m[2].replace(/[\u201C\u201D\u201E\u00AB\u00BB"\u2018\u2019]/g, '').replace(/\s+/g, ' ').replace(/^ | $/g, '');
    return { mode: /^SUBST/i.test(m[1]) ? 'replaceLine' : 'appendAfter', text: v };
  }
  /* nearest known directive name (edit distance <= 2) for typos like @@SUBTITUI */
  var DIR_NAMES = ['@@SUBSTITUI', '@@ABAIXO_DE', '@@SEMPRE', '@@EXAME', '@@EXAME_FULL', '@@TEMPLATE', '@@NOTE', '##SECTION'];
  function editDist(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) { for (j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); } }
    return d[m][n];
  }
  function typoOf(key) {
    var best = '', bd = 99, i, k;
    for (i = 0; i < DIR_NAMES.length; i++) { k = editDist(key, DIR_NAMES[i]); if (k < bd) { bd = k; best = DIR_NAMES[i]; } }
    return bd <= 2 ? best : (/^@@(SUBST|ABAIX|SEMP)/.test(key) ? best : '');
  }
  function parseDirective(line) {
    var m = DIR_RE.exec(line);
    if (!m) { return null; }
    var key = m[1] + m[2].toUpperCase();
    var value = rtrim(m[4]);
    var sep = m[3] || ' ';
    /* "@@NOTE x = Nome" form (header example) */
    if (!m[3] && key === '@@NOTE') {
      var eq = /^(\S+)\s*=\s*(.*)$/.exec(value);
      if (eq) { value = eq[2]; sep = '='; }
    }
    return { key: key, known: hasOwn(KNOWN, key), sep: sep, value: value };
  }

  /* ---------- field tokenizer (works on a whole body string) ---------- */
  function scanFields(body, baseLine, issues, ctx) {
    var fields = [];
    var i = 0, n = body.length, line = baseLine, lineStart = 0;
    function lineText(pos) {
      var s = body.lastIndexOf('\n', pos - 1) + 1, e = body.indexOf('\n', pos);
      return body.substring(s, e < 0 ? n : e);
    }
    function add(type, pos, msg) { issues.push(mk(type, line, lineText(pos), ctx, msg)); }
    while (i < n) {
      var c = body.charAt(i);
      if (c === '\n') { line++; lineStart = i + 1; i++; continue; }
      /* C6h: ?+[a|b|c] = multiple choice (several options can be ticked); same rules as ?[ ] */
      var multi = c === '?' && body.charAt(i + 1) === '+' && body.charAt(i + 2) === '[';
      if (c === '?' && (body.charAt(i + 1) === '[' || multi)) {
        var close = -1, j, nested = false, startLine = line, depth = 1, cuts = [], s0 = i + (multi ? 3 : 2);
        for (j = s0; j < n; j++) {
          var cj = body.charAt(j);
          if (cj === '[') { depth++; nested = true; }
          else if (cj === ']') { depth--; if (depth === 0) { close = j; break; } }
          else if (cj === '|' && depth === 1) { cuts.push(j); }
        }
        if (close < 0) { add('DROPDOWN_UNCLOSED', i); i = s0; continue; }
        var inner = body.substring(s0, close);
        var opts = [], prev = s0, k;
        for (k = 0; k < cuts.length; k++) { opts.push(body.substring(prev, cuts[k])); prev = cuts[k] + 1; }
        opts.push(body.substring(prev, close));
        if (nested) { add(multi ? 'MULTI_NESTED' : 'DROPDOWN_NESTED', i); }
        if (inner.indexOf('\n') >= 0) { add('DROPDOWN_MULTILINE', i); }
        var empty = false, children = null;
        for (k = 0; k < opts.length; k++) { if (isBlank(opts[k])) { empty = true; } }
        if (empty) { add('DROPDOWN_EMPTY_OPTION', i); }
        if (opts.length < 2 && !multi) { add('DROPDOWN_SINGLE', i); }   /* ?+[a] = tick or not: fine */
        if (nested || /\*/.test(inner)) {
          /* fields inside options (tolerated; spec says no nesting) */
          children = [];
          for (k = 0; k < opts.length; k++) { children.push(scanFields(opts[k], line, [], ctx)); }
        }
        fields.push({ type: 'select', multi: multi, options: opts, children: children, raw: body.substring(i, close + 1), offset: i, line: startLine });
        for (k = i; k < close; k++) { if (body.charAt(k) === '\n') { line++; } }
        i = close + 1;
        continue;
      }
      if (c === '*') {
        var r = i;
        while (r < n && body.charAt(r) === '*') { r++; }
        var run = r - i;
        var before = i > 0 ? body.charAt(i - 1) : '';
        var after = r < n ? body.charAt(r) : '';
        if (run >= 3) {
          add('STAR_RUN', i);
          i = r; continue;                       /* not a field */
        }
        if (/[A-Za-z\u00C0-\u024F]/.test(before) || /[A-Za-z\u00C0-\u024F]/.test(after)) {
          add('STAR_ADJACENT', i);
        }
        if (run === 1 && after === ',' && body.charAt(r + 1) === '*' && body.charAt(r + 2) !== '*') {
          fields.push({ type: 'number', decimal: true, raw: '*,*', offset: i, line: line });
          i = r + 2; continue;
        }
        fields.push({ type: run === 2 ? 'text' : 'number', decimal: false, raw: body.substring(i, r), offset: i, line: line });
        i = r; continue;
      }
      i++;
    }
    return fields;
  }

  /* Lines starting with 3+ asterisks = critical (must be reviewed).
     Returns display text (leading asterisks removed; nothing else touched)
     plus the list of critical lines with offsets into the display text. */
  function extractCritical(rawLines, firstLine) {
    var out = [], crit = [], i, off = 0, m, blk = null;
    for (i = 0; i < rawLines.length; i++) {
      var L = rawLines[i];
      if (/^\s*\*{3,}\s*$/.test(L)) {
        /* a line made only of asterisks opens/closes a critical block */
        L = '';
        if (!blk) {
          blk = { kind: 'block', line: firstLine + i, endLine: null, bodyLine: i, stars: rawLines[i].replace(/[^*]/g, '').length,
                  start: off, end: off, text: '', rawText: rawLines[i] };
        } else {
          blk.endLine = firstLine + i; blk.end = off; crit.push(blk); blk = null;
        }
        out.push(L); off += 1; continue;
      }
      m = /^(\s*)(\*{3,})/.exec(L);
      if (m) {
        L = m[1] + L.substring(m[0].length);
        crit.push({ kind: 'line', line: firstLine + i, endLine: firstLine + i, bodyLine: i, stars: m[2].length,
                    start: off, end: off + L.length, text: L, rawText: rawLines[i] });
      } else if (blk && !blk.text && !isBlank(L)) { blk.text = L; }
      out.push(L);
      off += L.length + 1;
    }
    if (blk) { blk.endLine = firstLine + rawLines.length - 1; blk.end = off; blk.unclosed = true; crit.push(blk); }
    return { body: out.join('\n'), critical: crit };
  }

  /* legacy checks on text outside ?[ ] */
  function legacyChecks(body, baseLine, issues, ctx) {
    var lines = body.split('\n'), li, depth;
    for (li = 0; li < lines.length; li++) {
      var L = lines[li], out = '', p, inDrop = 0;
      /* strip ?[..] on this line (multi-line dropdowns handled loosely) */
      for (p = 0; p < L.length; p++) {
        if (L.charAt(p) === '?' && L.charAt(p + 1) === '[') { inDrop = (inDrop || 0) + 1; p++; continue; }
        if (L.charAt(p) === '?' && L.charAt(p + 1) === '+' && L.charAt(p + 2) === '[') { inDrop = (inDrop || 0) + 1; p += 2; continue; }
        if (inDrop && L.charAt(p) === '[') { inDrop++; continue; }
        if (inDrop && L.charAt(p) === ']') { inDrop--; continue; }
        if (!inDrop) { out += L.charAt(p); }
      }
      if (/^\|/.test(L) && li > 0) { continue; }   /* continuation of multi-line dropdown */
      var ln = baseLine + li;
      if (out.indexOf('|') >= 0) { issues.push(mk('LEGACY_PIPE', ln, L, ctx)); }
      if (/[A-Za-z\u00C0-\u024F]\s+\/\s+[A-Za-z\u00C0-\u024F]/.test(out)) { issues.push(mk('LEGACY_SLASH', ln, L, ctx)); }
      if (L.indexOf('\u2022') >= 0) { issues.push(mk('LEGACY_BULLET', ln, L, ctx)); }
      depth = out.replace(/[^\[\]]/g, '');
      if (depth.length) { issues.push(mk('STRAY_BRACKET', ln, L, ctx)); }
    }
  }

  function mk(type, line, text, ctx, msg) {
    var t = ISSUE_TYPES[type] || ['aviso', type];
    return { type: type, severity: t[0], message: msg || t[1], line: line, text: text,
             exam: ctx && ctx.exam || '', where: ctx && ctx.where || '',
             tpl: ctx && ctx.tpl || '', sec: ctx && ctx.sec || '', ph: ctx && ctx.ph || '' };
  }

  /* ---------- phrase title ---------- */
  function parseTitle(raw) {
    var s = trimStr(raw);
    s = s.substring(0, s.length - 1);           /* drop final ':' */
    var res = { title: '', help: [], hypothesis: '', hypotheses: [], balanced: true };
    var out = '', i, c, depthP = 0, depthB = 0, buf = '';
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '[' && depthP === 0) { if (depthB === 0) { buf = ''; } else { buf += c; } depthB++; continue; }
      if (c === ']' && depthP === 0) {
        depthB--; if (depthB < 0) { res.balanced = false; depthB = 0; continue; }
        if (depthB === 0) { res.hypotheses.push(trimStr(buf)); } else { buf += c; }
        continue;
      }
      if (depthB > 0) { buf += c; continue; }
      if (c === '(') { if (depthP === 0) { buf = ''; } else { buf += c; } depthP++; continue; }
      if (c === ')') {
        depthP--; if (depthP < 0) { res.balanced = false; depthP = 0; continue; }
        if (depthP === 0) { res.help.push(trimStr(buf)); } else { buf += c; }
        continue;
      }
      if (depthP > 0) { buf += c; continue; }
      out += c;
    }
    if (depthP || depthB) { res.balanced = false; }
    res.title = trimStr(out.replace(/\s+/g, ' '));
    res.hypothesis = res.hypotheses.join(' ');
    res.helpText = res.help.join('; ');
    return res;
  }

  function isTitleLine(line) {
    var t = rtrim(line);
    if (!/:$/.test(t) || isBlank(t)) { return false; }
    if (t.length > 200) { return false; }
    if (/^\s*[\u2022\-*]/.test(t)) { return false; }
    if (t.indexOf('?[') >= 0 || t.indexOf('?+[') >= 0) { return false; }
    return true;
  }

  /* ---------- main ---------- */
  function parse(text) {
    var result = { exams: [], global: null, issues: [], noteIssues: [], stats: null, sectionIndex: {},
                   globalNote: null, skippedExample: null, critical: [], sectionResolution: [] };
    var issues = result.issues;
    try {
      text = String(text == null ? '' : text);
      if (text.charCodeAt(0) === 0xFEFF) { text = text.substring(1); }
      var lines = text.replace(/\r\n?/g, '\n').split('\n');
      var exam = null, block = null;   /* block: {kind, obj, startLine, lines[]} */
      function addCritical(list, ctx) {
        for (var q = 0; q < list.length; q++) {
          result.critical.push({ exam: ctx.exam, where: ctx.where, kind: list[q].kind, line: list[q].line, endLine: list[q].endLine, text: list[q].text, stars: list[q].stars, unclosed: !!list[q].unclosed });
          issues.push(mk('CRITICAL_LINE', list[q].line, list[q].rawText, ctx));
        }
      }
      /* 2. example/instruction block at top: first directive uses "=" and a
         placeholder value; skip until the first real "@@EXAME <name>" line. */
      var startAt = 1, q0, d0 = null;
      for (q0 = 0; q0 < lines.length; q0++) {
        if (/^\s*(@@|##)/.test(lines[q0])) { d0 = parseDirective(lines[q0]); break; }
      }
      if (d0 && d0.sep === '=' && /nome|exemplo|descri/i.test(d0.value)) {
        for (var q1 = q0 + 1; q1 < lines.length; q1++) {
          var d1 = /^\s*@@/.test(lines[q1]) ? parseDirective(lines[q1]) : null;
          if (d1 && d1.key === '@@EXAME' && d1.sep !== '=') { startAt = q1 + 1; break; }
        }
        if (startAt > 1) {
          result.skippedExample = { from: 1, to: startAt - 1 };
          issues.push(mk('EXAMPLE_BLOCK_SKIPPED', 1, lines[0], { where: 'linhas 1-' + (startAt - 1) }));
        }
      }
      var inGlobalNote = false;
      var examByKey = {};

      function newExam(name, line) {
        var key = upperKey(name);
        var e = { name: name, fullName: '', line: line, isGlobal: key === GLOBAL_EXAM,
                  templates: [], sections: [], notes: [], _secByKey: {} };
        if (hasOwn(examByKey, key)) { issues.push(mk('EXAM_DUPLICATE', line, lines[line - 1], { exam: name })); }
        examByKey[key] = e;
        result.exams.push(e);
        if (e.isGlobal) { result.global = e; }
        return e;
      }

      function closeBlock() {
        if (!block) { return; }
        var b = block; block = null;
        var ctx = { exam: exam ? exam.name : '', where: b.kind + (b.name ? ': ' + b.name : ''),
                    tpl: b.kind === 'template' ? b.name : '', sec: b.kind === 'section' ? b.name : '' };
        if (b.kind === 'template') { finishTemplate(b, ctx); }
        else if (b.kind === 'section') { finishSection(b, ctx); }
        else if (b.kind === 'note') { finishNote(b); }
        else if (b.kind === 'orphan') {
          var k;
          for (k = 0; k < b.lines.length; k++) {
            if (!isBlank(b.lines[k])) {
              issues.push(mk(exam ? 'ORPHAN_TEXT' : 'OUTSIDE_EXAM', b.startLine + k, b.lines[k], ctx));
            }
          }
        }
      }

      function stripBlankEdges(arr, start) {
        var s = 0, e = arr.length;
        while (s < e && isBlank(arr[s])) { s++; }
        while (e > s && isBlank(arr[e - 1])) { e--; }
        return { lines: arr.slice(s, e), firstLine: start + s };
      }

      function finishTemplate(b, ctx) {
        var st = stripBlankEdges(b.lines, b.startLine);
        var t = b.obj;
        if (!st.lines.length) { issues.push(mk('TEMPLATE_EMPTY', b.dirLine, lines[b.dirLine - 1], ctx)); }
        t.title = st.lines.length ? trimStr(st.lines[0]) : '';
        t.rawBody = st.lines.join('\n');        /* verbatim */
        var cx = extractCritical(st.lines, st.firstLine);
        t.body = cx.body;                       /* display text, leading *** removed */
        t.critical = cx.critical;
        addCritical(cx.critical, ctx);
        t.bodyLine = st.firstLine;
        if (exam && exam.fullName && t.title && upperKey(t.title) !== upperKey(exam.fullName)) {
          issues.push(mk('TEMPLATE_TITLE_DIFFERS', st.firstLine, st.lines[0], ctx));
        }
        t.fields = scanFields(t.body, st.firstLine, issues, ctx);
        legacyChecks(t.body, st.firstLine, issues, ctx);
      }

      function finishNote(b) {
        var st = stripBlankEdges(b.lines, b.startLine);
        b.obj.body = st.lines.join('\n');
        b.obj.bodyLine = st.firstLine;
      }

      function finishSection(b, ctx) {
        var sec = b.obj, ls = b.lines, k, cur = null, prevBlank = true, preText = [];
        var titleSeen = {};
        function closePhrase() {
          if (!cur) { return; }
          var st = stripBlankEdges(cur.lines, cur.bodyStart || cur.ph.line + 1);
          var ph = cur.ph;
          ph.rawBody = st.lines.join('\n');
          var cx = extractCritical(st.lines, st.firstLine);
          ph.body = cx.body;
          ph.critical = cx.critical;
          ph.bodyLine = st.firstLine;
          var pctx = { exam: ctx.exam, where: 'seção ' + sec.name + ' > ' + ph.rawTitle, sec: sec.name, ph: ph.title || ph.rawTitle };
          if (!st.lines.length) { issues.push(mk('PHRASE_EMPTY', ph.line, ph.rawTitle, pctx)); }
          addCritical(cx.critical, pctx);
          ph.fields = scanFields(ph.body, st.firstLine, issues, pctx);
          legacyChecks(ph.body, st.firstLine, issues, pctx);
          for (var q = 0; q < cur.titleLike.length; q++) {
            issues.push(mk('TITLE_LIKE_IN_BODY', cur.titleLike[q][0], cur.titleLike[q][1], pctx));
          }
          sec.phrases.push(ph);
          cur = null;
        }
        var dirs = b.dirs || [], di = 0, secPlaced = false;
        function hasBody(c) { for (var z = 0; z < c.lines.length; z++) { if (!isBlank(c.lines[z])) { return true; } } return false; }
        function takeDirs(upTo) {   /* directives seen before line index upTo */
          while (di < dirs.length && dirs[di].at <= upTo) {
            var dd = dirs[di], pd = { mode: dd.mode, text: dd.text, line: dd.line };
            var dctx = { exam: ctx.exam, where: 'seção ' + sec.name + (cur ? ' > ' + cur.ph.rawTitle : ''), sec: sec.name, ph: cur ? cur.ph.title : '' };
            di++;
            if (pd.mode !== 'always' && !pd.text) { issues.push(mk('DIRECTIVE_EMPTY_TARGET', dd.line, dd.raw, dctx)); continue; }
            if (cur && hasBody(cur)) {
              issues.push(mk('DIRECTIVE_MISPLACED', dd.line, dd.raw, dctx, 'Diretiva depois do texto da frase "' + cur.ph.title +
                '": vale para ESSA frase. Se era para a frase seguinte, coloque-a logo abaixo do título dela'));
            }
            if (pd.mode === 'always') {   /* only meaningful under a phrase title */
              if (!cur) { issues.push(mk('DIRECTIVE_MISPLACED', dd.line, dd.raw, dctx, '@@SEMPRE antes do primeiro título de frase da seção: ignorado (coloque abaixo do título da frase)')); }
              else if (cur.ph.always) { issues.push(mk('ALWAYS_DUPLICATE', dd.line, dd.raw, dctx)); }
              else { cur.ph.always = true; }
            } else if (cur) {
              /* several directives: kept in written order; the first whose target exists wins (D2) */
              if (cur.ph.place) { issues.push(mk('DIRECTIVE_DUPLICATE', dd.line, dd.raw, dctx)); (cur.ph.place.alts = cur.ph.place.alts || []).push(pd); }
              else { cur.ph.place = pd; }
            } else {
              if (secPlaced) { issues.push(mk('DIRECTIVE_DUPLICATE', dd.line, dd.raw, dctx)); (sec.place.alts = sec.place.alts || []).push(pd); }
              else { sec.place = pd; secPlaced = true; }
            }
          }
        }
        for (k = 0; k < ls.length; k++) {
          takeDirs(k);
          /* directive lines were dropped from b.lines: add the di directives seen so far so ln is the real txt line */
          var L = ls[k], ln = b.startLine + k + di;
          if (cur && !cur.lines.length) { cur.bodyStart = ln; }
          if (isBlank(L)) { prevBlank = true; if (cur) { cur.lines.push(L); } continue; }
          if (isTitleLine(L) && (prevBlank || !cur)) {
            closePhrase();
            var tp = parseTitle(L);
            var ph = { title: tp.title, help: tp.helpText, helpParts: tp.help, hypothesis: tp.hypothesis,
                       rawTitle: trimStr(L), line: ln, body: '', fields: [] };
            var tctx = { exam: ctx.exam, where: 'seção ' + sec.name, sec: sec.name, ph: tp.title };
            if (!tp.balanced) { issues.push(mk('TITLE_UNBALANCED', ln, L, tctx)); }
            if (tp.hypotheses.length > 1) { issues.push(mk('TITLE_MULTI_BRACKET', ln, L, tctx)); }
            if (tp.hypothesis.indexOf('|') >= 0) { issues.push(mk('HYPOTHESIS_PIPE', ln, L, tctx)); }
            var tk = upperKey(tp.title);
            if (hasOwn(titleSeen, tk)) { issues.push(mk('PHRASE_DUPLICATE_TITLE', ln, L, tctx)); }
            titleSeen[tk] = 1;
            cur = { ph: ph, lines: [], bodyStart: 0, titleLike: [] };
            prevBlank = false;
            continue;
          }
          if (!cur) { preText.push([ln, L]); prevBlank = false; continue; }
          if (isTitleLine(L) && !prevBlank) { cur.titleLike.push([ln, L]); }
          cur.lines.push(L);
          prevBlank = false;
        }
        takeDirs(ls.length);
        closePhrase();
        for (k = 0; k < preText.length; k++) {
          issues.push(mk('TEXT_BEFORE_FIRST_PHRASE', preText[k][0], preText[k][1], ctx));
        }
      }

      var ln, L;
      for (ln = startAt; ln <= lines.length; ln++) {
        L = lines[ln - 1];
        var d = /^\s*(@@|##)/.test(L) ? parseDirective(L) : null;
        /* 1. global note block: absorbs everything until next real @@EXAME */
        if (inGlobalNote) {
          if (d && d.key === '@@EXAME' && trimStr(d.value)) { closeBlock(); inGlobalNote = false; }
          else {
            if (d) { result.noteIssues.push(mk('DIRECTIVE_IN_NOTE', ln, L, { where: 'notas globais' })); }
            block.lines.push(L); continue;
          }
        }
        var pl = /^\s*@@/.test(L) ? parsePlacement(L) : null;
        if (pl) {   /* placement directive: never part of any text, never an inconsistency */
          if (block && block.kind === 'section') {
            if (!block.dirs) { block.dirs = []; }
            block.dirs.push({ at: block.lines.length, mode: pl.mode, text: pl.text, line: ln, raw: L });
          } else {
            issues.push(mk('DIRECTIVE_MISPLACED', ln, L, { exam: exam ? exam.name : '', where: block ? block.kind + ': ' + block.name : '',
              tpl: block && block.kind === 'template' ? block.name : '' },
              'Diretiva fora de uma ##SECTION (' + (block ? (block.kind === 'template' ? 'dentro do template' : 'em ' + block.kind) : 'fora de bloco') + '): ignorada'));
          }
          continue;
        }
        if (!d) {
          if (!block) { block = { kind: 'orphan', startLine: ln, lines: [] }; }
          block.lines.push(L);
          continue;
        }
        var ctx = { exam: exam ? exam.name : '', where: d.key };
        if (!d.known) {
          var sug = typoOf(d.key);
          if (block) { ctx.where = block.kind + ': ' + block.name; if (block.kind === 'section') { ctx.sec = block.name; } if (block.kind === 'template') { ctx.tpl = block.name; } }
          if (sug) { issues.push(mk('DIRECTIVE_TYPO', ln, L, ctx, 'Diretiva "' + d.key + '" não existe - você quis dizer ' + sug + '? A linha não funciona como diretiva' + (block ? ' e aparece como texto' : ''))); }
          else { issues.push(mk('DIRECTIVE_UNKNOWN', ln, L, ctx)); }
          if (block) { block.lines.push(L); } /* keep text verbatim inside current block */
          continue;
        }
        closeBlock();
        var name = trimStr(d.value);
        if (d.sep !== ' ') { (d.key === '@@NOTE' && !name ? result.noteIssues : issues).push(mk('DIRECTIVE_SEPARATOR', ln, L, ctx)); }

        if (d.key === '@@EXAME') {
          if (!name) { issues.push(mk('DIRECTIVE_NO_NAME', ln, L, ctx)); name = '(sem nome, linha ' + ln + ')'; }
          if (exam && !exam.fullName && !exam.isGlobal) {
            issues.push(mk('EXAM_NO_FULL', exam.line, lines[exam.line - 1], { exam: exam.name }));
          }
          exam = newExam(name, ln);
        } else if (d.key === '@@EXAME_FULL') {
          if (!exam) { issues.push(mk('EXAM_FULL_WITHOUT_EXAM', ln, L, ctx)); continue; }
          if (exam.fullName) { issues.push(mk('EXAM_FULL_DUPLICATE', ln, L, ctx)); }
          exam.fullName = name;
        } else {
          if (!exam) { issues.push(mk('OUTSIDE_EXAM', ln, L, ctx)); exam = newExam('(sem exame)', ln); }
          if (d.key === '@@TEMPLATE') {
            var hyp = /\[([^\]]*)\]/.exec(name);
            if (hyp) { issues.push(mk('TEMPLATE_BRACKET_NAME', ln, L, ctx)); }
            var t = { name: name || exam.name, line: ln, title: '', body: '', fields: [] };
            exam.templates.push(t);
            block = { kind: 'template', obj: t, name: t.name, dirLine: ln, startLine: ln + 1, lines: [] };
          } else if (d.key === '@@NOTE' && !name) {
            var gn = { name: 'Notas de referência', line: ln, body: '', isGlobal: true };
            result.globalNote = gn; inGlobalNote = true;
            block = { kind: 'note', obj: gn, name: gn.name, startLine: ln + 1, lines: [] };
          } else if (d.key === '@@NOTE') {
            var nt = { name: name, line: ln, body: '' };
            exam.notes.push(nt);
            block = { kind: 'note', obj: nt, name: name, startLine: ln + 1, lines: [] };
          } else if (d.key === '##SECTION') {
            if (!name) { issues.push(mk('DIRECTIVE_NO_NAME', ln, L, ctx)); name = '(sem nome)'; }
            var sk = upperKey(name), sec;
            if (hasOwn(exam._secByKey, sk)) {
              sec = exam._secByKey[sk];
              sec.extraLines.push(ln);
            } else {
              sec = { name: name, key: sk, line: ln, phrases: [], extraLines: [] };
              exam._secByKey[sk] = sec;
              exam.sections.push(sec);
            }
            block = { kind: 'section', obj: sec, name: name, startLine: ln + 1, lines: [] };
          }
        }
      }
      closeBlock();
      if (exam && !exam.fullName && !exam.isGlobal) {
        issues.push(mk('EXAM_NO_FULL', exam.line, lines[exam.line - 1], { exam: exam.name }));
      }

      /* post-processing: references & duplicates (3) */
      var e, s, idx = result.sectionIndex, defs = [];
      for (e = 0; e < result.exams.length; e++) {
        var ex = result.exams[e];
        for (s = 0; s < ex.sections.length; s++) {
          var S = ex.sections[s];
          if (S.phrases.length) {
            if (!hasOwn(idx, S.key)) { idx[S.key] = { exam: ex.name, section: S }; }
            defs.push({ exam: ex.name, section: S, w: words(S.name) });
          }
        }
      }
      function resolve(S, ownExam) {
        var w = words(S.name), ws = stripSides(w), i, j, D, parts, pw, rules, order;
        /* candidates: own exam first, then file order */
        order = [];
        for (i = 0; i < defs.length; i++) { if (defs[i].exam === ownExam) { order.push(defs[i]); } }
        for (i = 0; i < defs.length; i++) { if (defs[i].exam !== ownExam) { order.push(defs[i]); } }
        rules = [
          ['exato', function (D) { return D.section.key === S.key; }],
          ['acento/caixa', function (D) { return joinW(D.w) === joinW(w); }],
          ['lado (D/E)', function (D) { return joinW(D.w) === joinW(ws); }],
          ['singular/plural', function (D) { return wordsEqualPlural(w, D.w) || wordsEqualPlural(ws, D.w); }],
          ['parte de nome com "/"', function (D) {
            if (D.section.name.indexOf('/') < 0) { return false; }
            parts = D.section.name.split('/');
            for (var pj = 0; pj < parts.length; pj++) {
              pw = words(parts[pj]);
              if (joinW(pw) === joinW(ws) || wordsEqualPlural(ws, pw)) { return true; }
            }
            return false;
          }]
        ];
        for (j = 0; j < rules.length; j++) {
          for (i = 0; i < order.length; i++) {
            D = order[i];
            if (D.section === S) { continue; }
            if (rules[j][1](D)) { return { rule: rules[j][0], exam: D.exam, section: D.section }; }
          }
        }
        return null;
      }
      for (e = 0; e < result.exams.length; e++) {
        var ex2 = result.exams[e];
        for (s = 0; s < ex2.sections.length; s++) {
          var S2 = ex2.sections[s];
          S2.isReference = false; S2.isReserved = false; S2.resolvedFrom = null; S2.resolvedSection = null; S2.resolvedRule = null;
          if (!S2.phrases.length) {
            var R = resolve(S2, ex2.name);
            if (R) {
              S2.isReference = true; S2.resolvedFrom = R.exam; S2.resolvedSection = R.section.name; S2.resolvedRule = R.rule;
            } else {
              S2.isReserved = true;
              issues.push(mk('SECTION_RESERVED', S2.line, lines[S2.line - 1], { exam: ex2.name }));
            }
            result.sectionResolution.push({ exam: ex2.name, section: S2.name, line: S2.line,
              rule: R ? R.rule : null, targetExam: R ? R.exam : null, targetSection: R ? R.section.name : null });
          }
          if (S2.extraLines.length && S2.phrases.length) {
            issues.push(mk('SECTION_DUPLICATE', S2.extraLines[0], lines[S2.extraLines[0] - 1], { exam: ex2.name }));
          }
        }
        delete ex2._secByKey;
      }
    } catch (err) {
      issues.push({ type: 'PARSER_EXCEPTION', severity: 'erro', message: String(err && err.message || err),
                    line: 0, text: '', exam: '', where: '' });
    }
    issues.sort(function (a, b) { return a.line - b.line; });
    result.stats = computeStats(result);
    return result;
  }

  /* Look up phrases for a section name (own exam first, then bank-wide, then TODOS). */
  function getSectionPhrases(result, exam, sectionName) {
    var key = upperKey(sectionName), i, S, j, ex;
    for (i = 0; i < exam.sections.length; i++) {
      S = exam.sections[i];
      if (S.key !== key) { continue; }
      if (S.phrases.length) { return S.phrases; }
      if (S.resolvedSection) {
        for (j = 0; j < result.exams.length; j++) {
          ex = result.exams[j];
          if (ex.name !== S.resolvedFrom) { continue; }
          for (var k = 0; k < ex.sections.length; k++) {
            if (ex.sections[k].name === S.resolvedSection) { return ex.sections[k].phrases; }
          }
        }
      }
      if (S.isReserved) { return []; }
    }
    return hasOwn(result.sectionIndex, key) ? result.sectionIndex[key].section.phrases : [];
  }

  function computeStats(r) {
    var st = { exams: 0, globalExam: !!r.global, templates: 0, sections: 0, sectionsWithPhrases: 0,
               sectionReferences: 0, sectionsReserved: 0, criticalLines: 0, decimalFields: 0, phrases: 0, phrasesWithHypothesis: 0, phrasesWithHelp: 0, notes: 0,
               fields: { number: 0, text: 0, select: 0 }, templateFields: { number: 0, text: 0, select: 0 },
               issuesByType: {}, issuesBySeverity: {} };
    var e, s, p, f, ex;
    function cnt(arr, into) { for (f = 0; f < arr.length; f++) { into[arr[f].type]++; if (arr[f].decimal) { st.decimalFields++; } } }
    for (e = 0; e < r.exams.length; e++) {
      ex = r.exams[e];
      if (!ex.isGlobal) { st.exams++; }
      st.templates += ex.templates.length; st.notes += ex.notes.length;
      for (s = 0; s < ex.templates.length; s++) { cnt(ex.templates[s].fields, st.templateFields); }
      for (s = 0; s < ex.sections.length; s++) {
        st.sections++;
        if (ex.sections[s].phrases.length) { st.sectionsWithPhrases++; } else if (ex.sections[s].isReserved) { st.sectionsReserved++; } else { st.sectionReferences++; }
        for (p = 0; p < ex.sections[s].phrases.length; p++) {
          var ph = ex.sections[s].phrases[p];
          st.phrases++;
          if (ph.hypothesis) { st.phrasesWithHypothesis++; }
          if (ph.help) { st.phrasesWithHelp++; }
          cnt(ph.fields, st.fields);
        }
      }
    }
    st.criticalLines = r.critical.length;
    st.notesIssues = r.noteIssues.length;
    st.globalNoteLines = r.globalNote ? (r.globalNote.body ? r.globalNote.body.split('\n').length : 0) : 0;
    st.skippedExampleLines = r.skippedExample ? r.skippedExample.to : 0;
    for (e = 0; e < r.issues.length; e++) {
      var it = r.issues[e];
      st.issuesByType[it.type] = (st.issuesByType[it.type] || 0) + 1;
      st.issuesBySeverity[it.severity] = (st.issuesBySeverity[it.severity] || 0) + 1;
    }
    return st;
  }

  /* fields of an arbitrary text (used for nested dropdown options) */
  function fieldsOf(text) { return scanFields(String(text || ''), 1, [], null); }

  return { parse: parse, parsePlacement: parsePlacement, parseTitle: parseTitle, fold: fold, words: words, stripSides: stripSides, wordsEqualPlural: wordsEqualPlural, fieldsOf: fieldsOf, getSectionPhrases: getSectionPhrases,
           ISSUE_TYPES: ISSUE_TYPES, GLOBAL_EXAM: GLOBAL_EXAM };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = UltraParser; }
