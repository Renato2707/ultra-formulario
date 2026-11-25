/*
 * ui-bank-editor.js - editor do banco (D2).
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-bank-editor', function (UI, R) {
  'use strict';
  var darkMQ, mqf;   /* deste arquivo */
  var $, on, esc, addCls, rmCls, qsa, trim, now, toast, S, modal, closeModal, setBank, copyPlain, allIssues,
      issuePath, groupIssues, issueVisible, typeTitle, issuesText;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.ISSUE_HELP, UI.ISSUE_NOISE, UI.ACT_LABEL, UI.issueView,
     UI.SEV_LABEL, UI.BE */
  UI.bankEditor = bankEditor; UI.issuesDialog = issuesDialog; UI.applyTheme = applyTheme;   /* usadas por outros arquivos */

  /* ================= bank editor (D2) =================
     the bank txt edited inside the app: plain textarea (fast with ~2500 lines / 1 MB, works in IE11),
     line numbers in a gutter, "Ir para a linha". Salvar = keeps a backup of the previous bank, stores the new
     text (data folder or browser), reloads and revalidates the bank. Cancelar discards. No confirmations. */
  R(function () {
    UI.BE = { open: false, dirty: false, fromReport: false, n: 0, lh: 18 };
  });
  function beBuild() {
    if ($('beditBack')) { return; }
    var d = document.createElement('div'); d.id = 'beditBack'; d.hidden = true;
    d.innerHTML = '<div id="bedit" role="dialog" aria-label="Editar banco de frases">' +
      '<div class="be-head"><b>Editar banco de frases</b><span class="muted" id="beName"></span><span class="grow"></span>' +
      '<label class="be-go">Ir para a linha <input type="text" id="beGo" size="6" autocomplete="off"></label>' +
      '<span id="beDirty" class="muted" hidden>Alterações não salvas</span>' +
      '<button type="button" class="btn" id="beCancel">Cancelar</button><button type="button" class="btn btn-primary" id="beSave">Salvar</button></div>' +
      '<div class="be-body"><div id="beGut" aria-hidden="true"></div><textarea id="beTxt" wrap="off" spellcheck="false" autocomplete="off"></textarea></div>' +
      '<div class="be-foot muted"><span id="bePos"></span> <span class="grow"></span>Salvar guarda uma cópia do banco anterior (backup) e recarrega o banco.</div></div>';
    document.body.appendChild(d);
    var ta = $('beTxt'), gt = $('beGut'), gutTimer = null;
    on(ta, 'scroll', function () { gt.scrollTop = ta.scrollTop; });
    on(ta, 'input', function () { beDirty(true); clearTimeout(gutTimer); gutTimer = setTimeout(beGutter, 120); });
    on(ta, 'keyup', bePos); on(ta, 'click', bePos);
    on(ta, 'keydown', function (e) {
      if (e.keyCode === 9) { e.preventDefault(); beInsert('\t'); }   /* Tab writes a tab, it does not leave the text */
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 83) { e.preventDefault(); beSave(); }   /* Ctrl+S */
      if ((e.ctrlKey || e.metaKey) && e.keyCode === 71) { e.preventDefault(); $('beGo').focus(); $('beGo').select(); }   /* Ctrl+G */
    });
    on($('beGo'), 'keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); var n = parseInt(this.value, 10); if (n > 0) { beGoto(n); } } });
    on($('beCancel'), 'click', function () { beClose(); });
    on($('beSave'), 'click', function () { beSave(); });
    on(d, 'keydown', function (e) {
      e.stopPropagation();   /* the report shortcuts must not act while the bank editor is open */
      if (e.keyCode === 27 && !UI.BE.dirty) { e.preventDefault(); beClose(); }
    });
  }
  function beInsert(t) {
    var ta = $('beTxt');
    if (typeof ta.selectionStart === 'number') {
      var a = ta.selectionStart, b = ta.selectionEnd, st = ta.scrollTop;
      ta.value = ta.value.substring(0, a) + t + ta.value.substring(b); ta.selectionStart = ta.selectionEnd = a + t.length; ta.scrollTop = st;
    }
    beDirty(true);
  }
  function beDirty(v) { UI.BE.dirty = v; $('beDirty').hidden = !v; if (v) { addCls($('beSave'), 'dirty'); } else { rmCls($('beSave'), 'dirty'); } }
  function beGutter() {
    var v = $('beTxt').value, n = 1, i = -1, out = [], k;
    while ((i = v.indexOf('\n', i + 1)) >= 0) { n++; }
    if (n === UI.BE.n) { return; }
    UI.BE.n = n;
    for (k = 1; k <= n; k++) { out.push(k); }
    $('beGut').innerHTML = out.join('<br>') + '<br><br>';
    $('beGut').scrollTop = $('beTxt').scrollTop;
  }
  function bePos() {
    var ta = $('beTxt'); if (typeof ta.selectionStart !== 'number') { return; }
    var v = ta.value.substring(0, ta.selectionStart), ln = v.split('\n');
    $('bePos').innerHTML = 'Linha ' + ln.length + ', coluna ' + (ln[ln.length - 1].length + 1);
  }
  function beGoto(n) {
    var ta = $('beTxt'), v = ta.value, i = 0, k, e;
    for (k = 1; k < n; k++) { var j = v.indexOf('\n', i); if (j < 0) { break; } i = j + 1; }
    e = v.indexOf('\n', i); if (e < 0) { e = v.length; }
    ta.focus();
    if (ta.setSelectionRange) { ta.setSelectionRange(i, e); }
    var line = v.substring(0, i).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 1) * UI.BE.lh - ta.clientHeight / 3);
    $('beGut').scrollTop = ta.scrollTop; bePos();
  }
  function bankEditor(line, fromReport) {
    if (!S.bank) { toast('Nenhum banco carregado.'); return; }
    var bk = UStore.get('bank', null), txt = bk && bk.text ? bk.text : S.srcLines.join('\n');
    if (!$('modalBack').hidden) { closeModal(); }
    beBuild(); UI.BE.open = true; UI.BE.fromReport = !!fromReport; UI.BE.n = 0;
    $('beName').innerHTML = ' ' + esc(S.bankName || 'banco') + (UFolder.status() === 'folder' ? ' — pasta de dados' : ' — navegador');
    UI.BE.eol = /\r\n/.test(String(txt)) ? '\r\n' : /\n/.test(String(txt)) ? '\n' : /\r/.test(String(txt)) ? '\r' : '\r\n';   /* original line ending (CRLF, LF or CR-only); CRLF when none (Bloco de Notas) */
    $('beTxt').value = String(txt).replace(/\r\n?/g, '\n'); beDirty(false); beGutter();
    $('beditBack').hidden = false;
    setTimeout(function () { beGoto(line > 0 ? line : 1); if (!(line > 0)) { $('beTxt').setSelectionRange && $('beTxt').setSelectionRange(0, 0); $('beTxt').scrollTop = 0; $('beGut').scrollTop = 0; } }, 0);
  }
  function beClose() { $('beditBack').hidden = true; UI.BE.open = false; beDirty(false); $('beTxt').value = ''; UI.BE.n = 0; }
  function beSave() {
    var txt = $('beTxt').value.replace(/\r\n?/g, '\n').replace(/\n/g, UI.BE.eol || '\r\n'), name = S.bankName || 'banco-de-frases.txt', old = UStore.get('bank', null), fromRep = UI.BE.fromReport;
    if (!UI.BE.dirty) { beClose(); toast('Nenhuma alteração para salvar.'); if (fromRep) { issuesDialog(); } return; }
    if (UFolder.status() !== 'folder' && old && old.text && old.text !== txt) {   /* browser mode: keep the previous bank as a backup */
      if (!UStore.set('bankBackup', { t: now(), name: old.name, text: old.text })) { UStore.remove('bankBackup'); }
    }
    setBank(txt, name, true);
    if (!UStore.set('bank', { name: name, text: txt })) {
      UStore.remove('bankBackup');
      if (!UStore.set('bank', { name: name, text: txt })) { toast('Atenção: o banco foi recarregado, mas não coube no navegador (não será lembrado).'); }
    }
    if (UFolder.status() === 'folder') { UFolder.saveBank(txt, function (w) { if (!w) { toast('Atenção: não foi possível gravar o banco na pasta de dados.'); } }); } else { UFolder.saveBank(txt); }
    beClose();
    var n = allIssues().filter(function (it) { return it.severity !== 'info'; }).length;
    toast('Banco salvo e recarregado. ' + (n ? n + ' erro(s)/aviso(s) no relatório.' : 'Nenhum erro ou aviso.'));
    if (fromRep) { issuesDialog(); }
  }
  R(function () {
    window.addEventListener('beforeunload', function (e) { if (UI.BE.open && UI.BE.dirty) { e.preventDefault(); e.returnValue = ''; return ''; } });
  });

  function issuesDialog() {
    var all = allIssues(), cnt = { erro: 0, aviso: 0, info: 0 }, noiseN = 0, i;
    for (i = 0; i < all.length; i++) { cnt[all[i].severity] = (cnt[all[i].severity] || 0) + 1; if (all[i].severity === 'info' && UI.ISSUE_NOISE[all[i].type]) { noiseN++; } }
    function chk(id, k, label) { return '<label class="chk"><input type="checkbox" id="' + id + '"' + (UI.issueView[k] ? ' checked' : '') + '> ' + label + '</label>'; }
    var head = '<div class="iss-bar">' + chk('isErr', 'erro', 'Erros (' + cnt.erro + ')') + chk('isWarn', 'aviso', 'Avisos (' + cnt.aviso + ')') +
      chk('isInfo', 'info', 'Informativos (' + cnt.info + ')') +
      '<span id="isNoiseW">' + chk('isNoise', 'noise', 'incluir os ' + noiseN + ' informativos de rotina') + '</span>' +
      '<button type="button" class="btn" id="isCopy">Copiar como texto</button></div>' +
      '<p class="muted iss-legend">Linha = número da linha no .txt. Caminho: exame \u203A template \u203A seção \u203A frase.</p><div id="isList"></div>';
    modal('Relatório de inconsistências do banco', head, [{ label: 'Fechar', cls: 'btn-primary', focus: true }]);
    function render() {
      var vis = all.filter(issueVisible), g = groupIssues(vis), h = '', j, k, q;
      $('isNoiseW').style.display = UI.issueView.info ? '' : 'none';
      for (j = 0; j < g.length; j++) {
        if (!g[j].types.length) { continue; }
        var n = 0; for (k = 0; k < g[j].types.length; k++) { n += g[j].types[k].items.length; }
        h += '<h3 class="iss-sev">' + UI.SEV_LABEL[g[j].sev] + ' (' + n + ')</h3>';
        for (k = 0; k < g[j].types.length; k++) {
          var ty = g[j].types[k], hp = UI.ISSUE_HELP[ty.type];
          h += '<div class="iss-type"><div class="iss-th"><b>' + esc(typeTitle(ty.type, ty.items)) + '</b> <span class="muted">(' + ty.items.length + ') ' + esc(ty.type) + '</span>' +
            (hp ? '<span class="iss-act iss-' + hp[0] + '">' + UI.ACT_LABEL[hp[0]] + '</span>' : '') + '</div>' +
            (hp ? '<div class="iss-help">' + esc(hp[1]) + '</div>' : '') + '<ul class="iss-items">';
          for (q = 0; q < ty.items.length; q++) {
            var it = ty.items[q];
            h += '<li><span class="iss-ln">linha ' + it.line + '</span> ' + (it.line > 0 ? '<a href="#" class="iss-edit" data-line="' + it.line + '" title="Abrir o editor do banco nesta linha">editar</a> ' : '') + esc(issuePath(it)) +
              '<div class="iss-txt">' + esc(trim(String(it.text || '')).substring(0, 220)) + '</div>' +
              (it.miss ? '<div class="iss-msg">' + esc(it.miss) + '</div>' : '') +
              (it.message && it.message !== typeTitle(ty.type, ty.items) && ty.type !== 'DIRECTIVE_TARGET_MISSING' ? '<div class="iss-msg">' + esc(it.message) + '</div>' : '') + '</li>';
          }
          h += '</ul></div>';
        }
      }
      if (!h) { h = '<p>Nada a mostrar com os filtros escolhidos' + (cnt.erro + cnt.aviso === 0 ? ': nenhum erro e nenhum aviso.' : '.') + '</p>'; }
      $('isList').innerHTML = h;
      var ed = qsa($('isList'), '.iss-edit'), z;
      for (z = 0; z < ed.length; z++) { on(ed[z], 'click', function (e) { e.preventDefault(); bankEditor(parseInt(this.getAttribute('data-line'), 10), true); }); }
      $('modal').scrollTop = 0;
    }
    function bind(id, k) { on($(id), 'change', function () { UI.issueView[k] = this.checked; render(); }); }
    bind('isErr', 'erro'); bind('isWarn', 'aviso'); bind('isInfo', 'info'); bind('isNoise', 'noise');
    on($('isCopy'), 'click', function () {
      copyPlain(issuesText(all.filter(issueVisible)), function (ok) { toast(ok ? 'Relatório copiado (itens visíveis).' : 'Não foi possível copiar.'); });
    });
    render();
    setTimeout(function () { $('modal').scrollTop = 0; }, 0);
    setTimeout(function () { $('modal').scrollTop = 0; }, 30);
  }
  /* theme: 'light' | 'dark' | 'system' (prefers-color-scheme, followed live). Class-based; IE11 (no CSS
     variables) simply stays light. The report paper stays white unless paperDark. */
  R(function () {
    darkMQ = null;
    try { darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch (eMq) { darkMQ = null; }
    S.darkMQ = darkMQ;   /* keep a reference: an unreferenced MediaQueryList can be garbage-collected with its listener */
    if (darkMQ) { mqf = function () { if (S.settings.theme === 'system') { applyTheme(); } };
      if (darkMQ.addEventListener) { darkMQ.addEventListener('change', mqf); } else if (darkMQ.addListener) { darkMQ.addListener(mqf); } }
    /* a background tab may miss the change event: re-check when the tab comes back */
    if (window.addEventListener) {
      window.addEventListener('focus', function () { if (S.settings.theme === 'system') { applyTheme(); } }, false);
      document.addEventListener('visibilitychange', function () { if (!document.hidden && S.settings.theme === 'system') { applyTheme(); } }, false);
    }
  });
  function isDark() { var t = S.settings.theme, m = false; if (t === 'system') { try { m = window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { m = false; } } return t === 'dark' || m; }
  function applyTheme() {
    var d = isDark();
    document.body.className = (d ? 'theme-dark' : 'theme-light') + (d && S.settings.paperDark ? ' paper-dark' : '') + (S.settings.hypUnderline ? ' hyp-ul' : '');
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; addCls = UI.addCls; rmCls = UI.rmCls; qsa = UI.qsa; trim = UI.trim;
    now = UI.now; toast = UI.toast; S = UI.S; modal = UI.modal; closeModal = UI.closeModal;
    setBank = UI.setBank; copyPlain = UI.copyPlain; allIssues = UI.allIssues; issuePath = UI.issuePath;
    groupIssues = UI.groupIssues; issueVisible = UI.issueVisible; typeTitle = UI.typeTitle;
    issuesText = UI.issuesText;
  };
});
