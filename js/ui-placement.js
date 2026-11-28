/*
 * ui-placement.js - regras de posicionamento (@@SUBSTITUI / @@ABAIXO_DE) e bloco HIPÓTESE DIAGNÓSTICA.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-placement', function (UI, R) {
  'use strict';
  var $, esc, hasCls, addCls, rmCls, closest, qsa, trim, now, toast, S, editor, examSections, renderLines,
      fieldFilled, textLines, lineText, saveRange, setRange, focusEditor, exec, lineOf, ensureNotEmpty,
      insertBlock, afterChange, focusField, clearRepMarks, renderNav, cleanWords, prefixEq, otherSecVariants,
      mentionsOther, tplOrigSet, isBlankLine, findSectionTarget, endTarget, caretInEditor;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.canExecHtml, UI.HYP_HEAD */
  UI.anchorHits = anchorHits; UI.placeChain = placeChain; UI.directiveRule = directiveRule;
  UI.insertAlways = insertAlways; UI.edText = edText; UI.edHtml = edHtml; UI.undoInsert = undoInsert;
  UI.insertCard = insertCard; UI.secToTop = secToTop; UI.renderAll = renderAll; UI.editorLines = editorLines;
  UI.isHypEl = isHypEl; UI.cgIdx = cgIdx; UI.syncHypotheses = syncHypotheses;   /* usadas por outros arquivos */

  /* ================= PLACEMENT RULES (special cases) =================
     There are NO built-in rules: every special placement comes from the bank txt
     (@@SUBSTITUI / @@ABAIXO_DE). Rule objects built from those directives:
       sec    : regexp on the section name (folded: upper case, no accents, words joined by single spaces)
       mode   : 'appendAfter' -> insert after the END of the anchor paragraph(s) (consecutive paragraphs whose
                                 first line matches `anchor`), after phrases already placed by this rule;
                                 never replaces the default text
                'replaceLine' -> the first LINE matching `anchor`: replaced if it still equals the template
                                 default, otherwise the phrase goes right below it (after earlier ones)
       anchor : regexp on the folded line text (^ = line start)
     If the anchor is not in the report, the generic section-name matching / fallback applies. */
  function foldedLine(el) { return cleanWords(lineText(el)).join(' '); }
  /* directive matching also sees the options of an UNFILLED choice list ?[a|b]: the line is tried once per
     option (all unfilled lists take option k), so "@@SUBSTITUI = Embrião" matches "?[Embrião|Feto] identificado...".
     A filled list counts as its chosen text (as before). */
  function lineVariants(el) {
    var ch = qsa(el, '.f-sel'), un = [], i, k, n = 0, out = [foldedLine(el)];
    for (i = 0; i < ch.length; i++) { if (!fieldFilled(ch[i])) { un.push(i); } }
    if (!un.length) { return out; }
    var opts = [];
    for (i = 0; i < un.length; i++) { try { opts.push(JSON.parse(ch[un[i]].getAttribute('data-o')) || []); } catch (e) { opts.push([]); } n = Math.max(n, opts[i].length); }
    for (k = 0; k < Math.min(n, 12); k++) {
      var cl = el.cloneNode(true), cc = qsa(cl, '.f-sel'), u;
      for (u = 0; u < un.length; u++) {
        var o = opts[u], t = o.length ? o[Math.min(k, o.length - 1)] : '';
        cc[un[u]].parentNode.replaceChild(document.createTextNode(t), cc[un[u]]);
      }
      out.push(cleanWords(lineText(cl)).join(' '));
    }
    return out;
  }
  function anchorHits(anchor, el) { var v = lineVariants(el), i; for (i = 0; i < v.length; i++) { if (anchor.test(v[i])) { return true; } } return false; }
  /* a directive and its alternatives, in the order written in the txt (D2: the first one with a target wins) */
  function placeChain(pd) { return pd ? [pd].concat(pd.alts || []) : []; }
  /* reserved targets (documented in LEIA-ME-frases.txt): "TOPO" = right below the first line (title) of the
     report; "Relatório" = the line starting with "Relatório" (e.g. "Relatório ...:") and, when the
     template has no such line, the same as TOPO */
  function topTarget(pd) { var f = cleanWords(pd.text).join(' '); return f === 'TOPO' || f === 'RELATORIO' ? f : ''; }
  /* rule built from a user directive (@@SUBSTITUI / @@ABAIXO_DE) */
  function directiveRule(pd) {
    var w = cleanWords(pd.text).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!w) { return null; }
    if (topTarget(pd)) {
      var tw = cleanWords(pd.text), tt = topTarget(pd);
      return { id: 'u:' + tt, mode: 'appendAfter', anyLine: false, user: true, top: tt,
               anchor: { test: function (folded) { return tt === 'RELATORIO' && prefixEq(String(folded).split(' '), tw); } } };
    }
    var aw = cleanWords(pd.text);
    /* anchor = the line STARTS with these words (singular/plural tolerant: 'Rim' also matches 'Rins') */
    return { id: 'u:' + w.replace(/[^A-Z0-9]+/g, '_').substring(0, 40), mode: pd.mode, anyLine: true, user: true,
             anchor: { test: function (folded) { return prefixEq(String(folded).split(' '), aw); } } };
  }
  /* anchors of all directives of the current exam (a SUBSTITUI block stops before another directive's line) */
  function examAnchors(exceptId) {
    var secs = examSections(S.activeExam || S.navExam), out = [], seen = {}, i, j, d, c;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) {
        c = secs[i].cards[j];
        var ps = placeChain(c.secPlace).concat(placeChain(c.ph && c.ph.place)), k;
        for (k = 0; k < ps.length; k++) { if (ps[k] && (d = directiveRule(ps[k])) && d.id !== exceptId && !seen[d.id]) { seen[d.id] = 1; out.push(d.anchor); } }
      }
    }
    return out;
  }
  /* lote: a list line of the template ("- ..." / "• ...") with its fields filled in (e.g. "- Índice de pulsatilidade (IP): 0,96") */
  function fieldDataLine(el, orig) {
    if (!el.querySelector('.fld') || !/^\s*[\u2022\-\u2013]/.test(lineText(el))) { return false; }
    var cl = el.cloneNode(true), fs = qsa(cl, '.fld'), i;
    for (i = 0; i < fs.length; i++) { fs[i].parentNode.replaceChild(document.createTextNode('___'), fs[i]); }
    return !!orig[trim(lineText(cl))];
  }
  /* -> { range, replace, blank } or null when the anchor is missing */
  function ruleTarget(rule) {
    var L = editorLines(), i, r = document.createRange();
    if (rule.top) {   /* reserved target: "Relatório" line if present, otherwise below the title (first line) */
      var tr = rule.top === 'RELATORIO' ? ruleTarget({ id: rule.id, mode: 'appendAfter', anyLine: false, anchor: rule.anchor }) : null;
      if (tr) { return tr; }
      var t0 = -1, t1;
      for (i = 0; i < L.length; i++) { if (L[i].getAttribute('data-rule') === rule.id) { t0 = i; } }   /* after phrases already placed on top */
      if (t0 < 0) { for (i = 0; i < L.length; i++) { if (!isBlankLine(L[i])) { t0 = i; break; } } }
      if (t0 < 0) { return null; }
      t1 = t0; S.lastAnchor = lineText(L[t0]);
      r.selectNodeContents(L[t1]); r.collapse(false); return { range: r, replace: false, blank: false };
    }
    if (rule.mode === 'replaceLine') {
      var at = -1;
      for (i = 0; i < L.length; i++) { if (!isHypEl(L[i]) && anchorHits(rule.anchor, L[i])) { at = i; break; } }
      if (at < 0) {   /* the anchor line was already replaced: go below the phrases this rule placed there */
        for (i = 0; i < L.length; i++) { if (L[i].getAttribute('data-rule') === rule.id) { at = i; break; } }
        if (at < 0) { return null; }
      }
      var last = at, placed = L[at].getAttribute('data-rule') === rule.id;
      S.lastAnchor = lineText(L[at]);
      if (!placed) {
        /* block = the anchor line + following lines of the same paragraph, stopping before a blank line,
           an edited/inserted line, or the line of ANOTHER directive (e.g. 'Tronco da veia porta') */
        var stops = examAnchors(rule.id), others = rule.secName ? otherSecVariants(rule.secName) : [], orig = tplOrigSet(), allDef = !hasCls(L[at], 'chg') && !!orig[trim(lineText(L[at]))], q, stop;
        while (L[last + 1] && !isBlankLine(L[last + 1]) && !isHypEl(L[last + 1]) && !hasCls(L[last + 1], 'chg') && L[last + 1].getAttribute('data-rule') === null) {
          if (fieldDataLine(L[last + 1], orig)) { break; }   /* lote: "- Índice ... (IP): 0,96" = measurements of the template, not part of the text replaced */
          stop = false; for (q = 0; q < stops.length; q++) { if (anchorHits(stops[q], L[last + 1])) { stop = true; break; } }
          if (stop || mentionsOther(lineText(L[last + 1]), others)) { break; }   /* also stop at a line naming another section */
          last++; if (!orig[trim(lineText(L[last]))]) { allDef = false; }
        }
        S.lastSpan = last - at + 1;
        if (allDef) { r.setStart(L[at], 0); r.setEnd(L[last], L[last].childNodes.length); return { range: r, replace: true, blank: false }; }
      }
      while (L[last + 1] && L[last + 1].getAttribute('data-rule') === rule.id) { last++; }   /* after phrases already placed here */
      r.selectNodeContents(L[last]); r.collapse(false); return { range: r, replace: false, blank: false };
    }
    /* appendAfter: paragraphs = runs of non-blank lines; a paragraph matches when its FIRST line (or, with
       rule.anyLine, ANY line) matches the anchor, or it was placed by this rule; the first run of matching
       paragraphs is the target, the phrase goes after its end */
    var paras = [], cur = null, p, k, end = -1, usesBlank = false, started = false;
    for (i = 0; i < L.length; i++) {
      if (isBlankLine(L[i]) || isHypEl(L[i])) { cur = null; continue; }
      if (!cur) { cur = { s: i, e: i }; paras.push(cur); } else { cur.e = i; }
    }
    for (p = 0; p < paras.length; p++) {
      var hit = L[paras[p].s].getAttribute('data-rule') === rule.id;
      for (k = paras[p].s; !hit && k <= (rule.anyLine ? paras[p].e : paras[p].s); k++) { hit = anchorHits(rule.anchor, L[k]); }
      if (hit) { if (!started) { S.lastAnchor = lineText(L[paras[p].s]); } started = true; end = paras[p].e; }
      else if (started) { break; }
    }
    if (end < 0) { return null; }
    if (!L[end + 1] || isBlankLine(L[end + 1])) { usesBlank = true; }   /* also at the end of the report: keep the blank-line separation */
    r.selectNodeContents(L[end]); r.collapse(false); return { range: r, replace: false, blank: usesBlank };
  }
  function flashBlock(lines) {
    if (!lines.length) { return; }
    var w = $('editorWrap'), wr = w.getBoundingClientRect(), top = 1e9, bot = -1e9, left = 1e9, right = -1e9, i, rc;
    for (i = 0; i < lines.length; i++) {
      rc = lines[i].getBoundingClientRect();
      top = Math.min(top, rc.top); bot = Math.max(bot, rc.bottom); left = Math.min(left, rc.left); right = Math.max(right, rc.right);
    }
    var o = document.createElement('div'); o.className = 'chg-flash';
    o.style.top = (top - wr.top + w.scrollTop - 3) + 'px'; o.style.left = (left - wr.left + w.scrollLeft - 5) + 'px';
    o.style.width = (right - left + 10) + 'px'; o.style.height = (bot - top + 6) + 'px';
    w.appendChild(o);
    setTimeout(function () { addCls(o, 'out'); }, 1600);
    setTimeout(function () { if (o.parentNode) { o.parentNode.removeChild(o); } }, 2300);
  }
  /* @@SEMPRE phrases of this exam (and of TODOS): inserted at their placement after a template is loaded from
     scratch; skipped when their text is already in the report. Caret/scroll are kept as the template left them. */
  function insertAlways(exam) {
    var secs = examSections(exam), i, j, c, n = 0, sel = window.getSelection(), keep = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var w = $('editorWrap'), top = w.scrollTop;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) {
        c = secs[i].cards[j];
        if (!c.ph || !c.ph.always) { continue; }
        var first = cleanWords(trim(String(c.ph.body).split('\n')[0])).join(' ');
        if (first && cleanWords(textLines(editor, '___').join(' ')).join(' ').indexOf(first) >= 0) { continue; }   /* already present */
        c.dispSec = secs[i].name; S.phraseIndex[c.id] = c;
        insertCard(c.id, true); n++;
      }
    }
    if (n) {
      if (keep && editor.contains(keep.startContainer)) { try { setRange(keep); saveRange(); } catch (e) {} }
      w.scrollTop = top;
    }
    return n;
  }
  /* one-step undo of an inserted phrase (D3): snapshot before/after; the native undo needs 2-4 steps */
  R(function () {
    S.insStack = []; S.insRedo = [];
  });
  function edText() { return textLines(editor, '___').join('\n'); }
  function edHtml() { return editor.innerHTML.replace(/<mark class="hl( cur)?">|<\/mark>/g, ''); }
  function undoInsert(redo) {
    var st = redo ? S.insRedo : S.insStack, top = st[st.length - 1];
    if (!top || edText() !== (redo ? top.beforeText : top.afterText)) { S.insStack = []; S.insRedo = []; return false; }
    st.pop(); (redo ? S.insStack : S.insRedo).push(top);
    clearRepMarks(); editor.innerHTML = redo ? top.after : top.before; ensureNotEmpty();
    S.lastChoice = null; S.lastRemoval = null; focusEditor(); afterChange(true);
    return true;
  }
  /* lote: a phrase titled "Hipótese ..." is hypothesis text: a SECTION directive (meant for the findings, e.g.
     "@@SUBSTITUI = Artéria Cerebral Média") must not put it over the findings line; its own directive still counts */
  function hypTitle(c) { return !!(c && c.ph && /^\s*hip[\u00f3o]tese\b/i.test(c.ph.title || '')); }
  function hypBlockEnd() {
    var L = editorLines(), i, h = -1, e, r;
    for (i = 0; i < L.length; i++) { if (/^\s*hip[\u00f3o]tese\b[^:]*:\s*$/i.test(lineText(L[i]))) { h = i; } }
    if (h < 0) { return null; }
    e = h; while (L[e + 1] && !isBlankLine(L[e + 1])) { e++; }
    r = document.createRange(); r.selectNodeContents(L[e]); r.collapse(false); return r;
  }
  function insertCard(id, quiet) {
    var c = S.phraseIndex[id]; if (!c) { return; }
    var undoBefore = quiet ? null : edHtml(), undoBeforeText = quiet ? '' : edText();
    var before = qsa(editor, '.fld'), i, f = null;
    var hyp = trim(c.ph.hypothesis || '');
    var html = renderLines(c.ph.body, c.ph.fields, c.ph.critical);   /* body only: no title/help/hypothesis */
    var tag = 'c' + now();
    html = html.replace(/<div( class="([^"]*)")?>/g, function (t, a, cl) { return '<div class="' + (cl ? cl + ' ' : '') + 'chg" data-ins="' + tag + '">'; });
    if (hyp) { html = html.replace(/<div( class="[^"]*")?/g, function (t, cl) { return '<div' + (cl || '') + ' data-hyp="' + esc(hyp) + '"'; }); }
    /* precedence: phrase directive > section directive (both from the txt) > generic section-name matching */
    var rule = null, kr = null, cand = placeChain(c.ph && c.ph.place).concat(hypTitle(c) ? [] : placeChain(c.secPlace)).map(directiveRule), ci;
    for (ci = 0; ci < cand.length && !kr; ci++) { if (cand[ci]) { rule = cand[ci]; rule.secName = c.dispSec || c.section; kr = ruleTarget(rule); } }
    if (!kr) { rule = null; }
    var hy = !kr && hypTitle(c) ? hypBlockEnd() : null;   /* lote: "Hipótese ..." phrase: end of the report's Hipótese block */
    var tgt = kr || hy ? null : findSectionTarget([c.dispSec, c.section]), msg = 'Inserida: ' + c.ph.title, how;
    if (hy) { tgt = { range: hy, how: 'hyp', replace: false }; }
    if (rule) { html = html.replace(/<div /g, '<div data-rule="' + rule.id + '" '); }
    if (kr) {
      how = 'rule:' + rule.id + (kr.replace ? ':replace' : ''); focusEditor(); setRange(kr.range); saveRange();
      if (kr.blank) { html = '<div><br></div>' + html; }
      S.lastPlacementLine = rule.id; msg += kr.replace ? ' (substituiu o texto padrão)' : ' (regra: ' + rule.id + ')';
    }
    else if (tgt) { how = tgt.how; focusEditor(); setRange(tgt.range); saveRange(); msg += tgt.replace ? ' (substituiu o texto padrão)' : ' (na seção ' + (c.dispSec || c.section) + ')'; }
    else if (!quiet && caretInEditor()) { how = 'caret'; }
    else { how = 'end'; focusEditor(); setRange(endTarget()); saveRange(); html = '<div><br></div>' + html; }
    S.lastPlacement = how; if (!tgt && !kr) { S.lastPlacementLine = ''; }
    insertBlock(html);
    if (!quiet) { S.userCaret = true; }
    var ins = qsa(editor, '[data-ins="' + tag + '"]'), k;
    for (k = 0; k < ins.length; k++) { ins[k].removeAttribute('data-ins'); }
    if (hyp) { addHypothesis(hyp); }
    if (quiet) { S.lastPlacement = how; afterChange(false); return; }
    S.insStack.push({ before: undoBefore, beforeText: undoBeforeText, after: edHtml(), afterText: edText() }); S.insRedo = [];
    if (S.insStack.length > 30) { S.insStack.shift(); }
    S.lastChoice = null; S.lastRemoval = null;
    flashBlock(ins);
    var after = qsa(editor, '.fld');
    for (i = 0; i < after.length; i++) { if (before.indexOf(after[i]) < 0 && !fieldFilled(after[i])) { f = after[i]; break; } }
    if (f) { focusField(f); }
    toast(msg);
    if (S.settings.autoNextSec && S.level === 3 && !trim($('navSearch').value)) { advanceSection(id); }
  }
  /* close the phrase's section in the accordion and open the next one */
  /* opened section: scroll the left list (only the list) so the section header is at its top */
  function secToTop(key) {
    var nl = $('navList'), l = qsa(nl, '[data-sec]'), k;
    for (k = 0; k < l.length; k++) {
      if (l[k].getAttribute('data-sec') === key) {
        var sec = l[k].parentNode || l[k], want = nl.scrollTop + sec.getBoundingClientRect().top - nl.getBoundingClientRect().top;
        var pad = $('navPad'); if (pad) { pad.parentNode.removeChild(pad); }
        /* blank space below the list so even the last section can reach the top */
        pad = document.createElement('div'); pad.id = 'navPad'; pad.style.height = nl.clientHeight + 'px'; nl.appendChild(pad);
        nl.scrollTop = Math.max(0, want);
        return;
      }
    }
  }
  function advanceSection(id) {
    var secs = examSections(S.navExam), i, j;
    for (i = 0; i < secs.length; i++) {
      for (j = 0; j < secs[i].cards.length; j++) { if (secs[i].cards[j].id === id) { break; } }
      if (j < secs[i].cards.length) { break; }
    }
    if (i >= secs.length) { return; }
    S.openSecs[secs[i].key] = false;
    var nx = secs[i + 1];
    if (nx) { S.openSecs[nx.key] = true; }
    var top = $('navList').scrollTop;
    S.animSec = nx ? nx.key : null;
    renderNav(); $('navList').scrollTop = top;
    S.animSec = null;
    var nlS = $('navList'); addCls(nlS, 'smooth'); clearTimeout(advanceSection.t); advanceSection.t = setTimeout(function () { rmCls(nlS, 'smooth'); }, 400);
    if (nx) {
      var l = qsa($('navList'), '[data-sec]'), k;
      secToTop(nx.key);
    }
  }

  function renderAll() { renderNav(); }
  /* ================= automatic HIPÓTESE DIAGNÓSTICA block ================= */
  R(function () {
    UI.HYP_HEAD = /^\s*(hip[óo]tese|conclus[ãa]o|impress[ãa]o)/i;
  });
  /* leaf lines (execCommand may nest line <div>s) */
  function editorLines() {
    var a = [], l = qsa(editor, 'div,p'), i;
    for (i = 0; i < l.length; i++) { if (!l[i].querySelector('div,p')) { a.push(l[i]); } }
    return a;
  }
  function isHypEl(n) { return closest(n, function (x) { return hasCls(x, 'hypl') || hasCls(x, 'hyph') || hasCls(x, 'hyps'); }, editor); }
  function hypLineExists(hyp) {
    var l = editorLines(), i;
    for (i = 0; i < l.length; i++) { if ((isHypEl(l[i]) || l[i].getAttribute('data-hyp') === null) && trim(lineText(l[i])) === hyp) { return true; } }
    return false;
  }
  /* new line after `ref` (or at the end), via execCommand so Ctrl+Z keeps working */
  function execLineAfter(ref, html) {
    var r = document.createRange();
    if (ref) { r.selectNodeContents(ref); } else { r.selectNodeContents(editor); }
    r.collapse(false); setRange(r);
    exec('insertParagraph');
    var line = lineOf(window.getSelection().getRangeAt(0).startContainer);
    if (line) { line.removeAttribute('data-hyp'); line.removeAttribute('class'); line.removeAttribute('data-h'); var r2 = document.createRange(); r2.selectNodeContents(line); setRange(r2); }
    exec('insertHTML', html);
  }
  function cgIdx(lines) {
    var i; for (i = 0; i < lines.length; i++) { if (/^\s*consideracoes gerais/.test(UltraParser.fold(lineText(lines[i])).toLowerCase())) { return i; } }
    return -1;
  }
  function addHypothesis(hyp) {
    if (hypLineExists(hyp)) { return; }
    var lines = editorLines(), i, head = null, after, keep = S.savedRange ? S.savedRange.cloneRange() : null;
    var w = $('editorWrap'), top = w.scrollTop;
    for (i = 0; i < lines.length; i++) { if ((isHypEl(lines[i]) || lines[i].getAttribute('data-hyp') === null) && UI.HYP_HEAD.test(lineText(lines[i]))) { head = lines[i]; } }
    var hl = '<div class="hypl" data-h="' + esc(hyp) + '">' + esc(hyp) + '</div>';
    if (!UI.canExecHtml) {
      var tmp = document.createElement('div'); tmp.innerHTML = head ? hl : '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl;
      while (tmp.firstChild) { editor.appendChild(tmp.firstChild); }
    } else if (head) {
      after = head;
      while (after.nextSibling && after.nextSibling.nodeType === 1 && trim(lineText(after.nextSibling)) !== '' && !UI.HYP_HEAD.test(lineText(after.nextSibling))) { after = after.nextSibling; }
      execLineAfter(after, hl);
    } else if (cgIdx(lines) >= 0) {
      /* new block goes right above "Considerações gerais" */
      var ci = cgIdx(lines), prev = ci > 0 ? lines[ci - 1] : null, prevBlank = prev && trim(lineText(prev)) === '';
      var blk = '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl + '<div class="hyps"><br></div>';
      if (prev) { execLineAfter(prev, (prevBlank ? '' : '<div class="hyps"><br></div>') + blk); }
      else { var r0 = document.createRange(); r0.setStartBefore(lines[ci]); r0.collapse(true); setRange(r0); exec('insertHTML', blk); }
    } else {
      var last = lines[lines.length - 1];
      execLineAfter(last, (last && trim(lineText(last)) !== '' ? '<div class="hyps"><br></div>' : '') + '<div class="hyph">Hipótese/Impressão diagnóstica:</div>' + hl);
    }
    if (keep && editor.contains(keep.startContainer)) { setRange(keep); saveRange(); }
    w.scrollTop = top;
    afterChange(true);
  }
  /* drop automatic hypothesis lines whose phrase is no longer in the report */
  function syncHypotheses() {
    var l = qsa(editor, '.hypl'), i, j, used = {}, src = qsa(editor, '[data-hyp]');
    for (j = 0; j < src.length; j++) { if (!src[j].querySelector('div,p') && !isHypEl(src[j]) && trim(lineText(src[j])) !== '') { used[src[j].getAttribute('data-hyp')] = 1; } }
    for (i = 0; i < l.length; i++) {
      var h = l[i].getAttribute('data-h');
      if (!used[h] && trim(lineText(l[i])) === h && l[i].parentNode && !l[i].querySelector('div,p')) { l[i].parentNode.removeChild(l[i]); }
    }
    if (qsa(editor, '.hypl').length) { return; }
    var hd = qsa(editor, '.hyph'), k, rm = [];
    for (k = 0; k < hd.length; k++) { if (trim(lineText(hd[k])) === 'Hipótese/Impressão diagnóstica:') { rm.push(hd[k]); } }
    if (!rm.length) { return; }
    hd = qsa(editor, '.hyps');
    for (k = 0; k < hd.length; k++) { if (trim(lineText(hd[k])) === '') { rm.push(hd[k]); } }
    for (k = 0; k < rm.length; k++) { if (rm[k].parentNode) { rm[k].parentNode.removeChild(rm[k]); } }
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls; closest = UI.closest;
    qsa = UI.qsa; trim = UI.trim; now = UI.now; toast = UI.toast; S = UI.S; editor = UI.editor;
    examSections = UI.examSections; renderLines = UI.renderLines; fieldFilled = UI.fieldFilled;
    textLines = UI.textLines; lineText = UI.lineText; saveRange = UI.saveRange; setRange = UI.setRange;
    focusEditor = UI.focusEditor; exec = UI.exec; lineOf = UI.lineOf; ensureNotEmpty = UI.ensureNotEmpty;
    insertBlock = UI.insertBlock; afterChange = UI.afterChange; focusField = UI.focusField;
    clearRepMarks = UI.clearRepMarks; renderNav = UI.renderNav; cleanWords = UI.cleanWords;
    prefixEq = UI.prefixEq; otherSecVariants = UI.otherSecVariants; mentionsOther = UI.mentionsOther;
    tplOrigSet = UI.tplOrigSet; isBlankLine = UI.isBlankLine; findSectionTarget = UI.findSectionTarget;
    endTarget = UI.endTarget; caretInEditor = UI.caretInEditor;
  };
});
