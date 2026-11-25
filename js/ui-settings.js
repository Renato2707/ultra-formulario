/*
 * ui-settings.js - configurações.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-settings', function (UI, R) {
  'use strict';
  var SET_IDS, setSnap, barAction, HIDDEN_ISSUES;   /* deste arquivo */
  var $, on, esc, hasCls, addCls, rmCls, qsa, trim, toast, S, loadSettings, saveSettings, modal, closeModal,
      setBank, examNames, buildModels, modelTemplate, sortedModels, examSections, renderLines, afterChange,
      saveDraft, renderNav, anchorHits, placeChain, directiveRule, renderAll, bankEditor, issuesDialog,
      applyTheme, applyLayout, loadBankFile;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.TAB, UI.setSaved, UI.ISSUE_HELP, UI.ISSUE_NOISE, UI.ACT_LABEL,
     UI.issueView, UI.SEV_LABEL */
  UI.settingsDialog = settingsDialog; UI.showBar = showBar; UI.hideBar = hideBar;
  UI.folderStatus = folderStatus; UI.allIssues = allIssues; UI.issuePath = issuePath;
  UI.groupIssues = groupIssues; UI.issueVisible = issueVisible; UI.typeTitle = typeTitle;
  UI.issuesText = issuesText;   /* usadas por outros arquivos */

  /* ================= settings ================= */
  R(function () {
    SET_IDS = ['paperDark', 'hypUnderline', 'blockCopy', 'dragInReport', 'autoNextSec', 'dragReorder', 'sortByUsage', 'showUsage', 'normPunct', 'normSymbols', 'ascii', 'warnFields'];
    /* D2: settings are saved only by "Salvar alterações" (or by an action button inside the dialog, which saves
       first). Closing with X, Esc or a click outside discards the changes; the theme is only previewed meanwhile. */
    setSnap = null, UI.setSaved = false;
  });
  function readSettingsForm() {
    UI.setSaved = true;
    var was = setSnap ? JSON.parse(setSnap) : {}, form = {}, k, r;
    for (k = 0; k < SET_IDS.length; k++) { form[SET_IDS[k]] = $('st_' + SET_IDS[k]).checked; }
    r = document.getElementsByName('st_eol'); for (k = 0; k < r.length; k++) { if (r[k].checked) { form.eol = r[k].value; } }
    r = document.getElementsByName('st_theme'); for (k = 0; k < r.length; k++) { if (r[k].checked) { form.theme = r[k].value; } }
    loadSettings();   /* another tab may have saved meanwhile: keep its changes, write only what changed here */
    for (k in form) { if (form.hasOwnProperty(k) && form[k] !== was[k]) { S.settings[k] = form[k]; } }
    setSnap = JSON.stringify(S.settings);
    if ($('stDirty')) { $('stDirty').hidden = true; } if ($('stSave')) { rmCls($('stSave'), 'dirty'); }
    applyTheme(); saveSettings(); renderAll();
  }
  function settingsDialog() {
    var st = S.settings;
    function cb(id, label) { return '<label class="chk"><input type="checkbox" id="st_' + id + '"' + (st[id] ? ' checked' : '') + '> ' + label + '</label>'; }
    function th(val, label) { return '<label class="chk"><input type="radio" name="st_theme" value="' + val + '"' + ((st.theme || 'light') === val ? ' checked' : '') + '> ' + label + '</label>'; }
    function rd(val, label) { return '<label class="chk"><input type="radio" name="st_eol" value="' + val + '"' + (st.eol === val ? ' checked' : '') + '> ' + label + '</label>'; }
    var allI = allIssues(), n = allI.length, bySev = {}, ii;
    for (ii = 0; ii < n; ii++) { bySev[allI[ii].severity] = (bySev[allI[ii].severity] || 0) + 1; }
    var body = '<fieldset><legend>Modelos</legend>' +
      cb('dragReorder', 'Reordenar modelos arrastando') +
      cb('sortByUsage', 'Ordenar por frequência de uso') +
      cb('showUsage', 'Exibir contador de uso (n)') + '</fieldset>' +
      '<fieldset><legend>Navegação</legend>' + cb('autoNextSec', 'Ao inserir frase, fechar a seção e abrir a próxima') + '</fieldset>' +
      '<fieldset><legend>Copiar / Gerar (sempre texto simples)</legend>' +
      cb('normPunct', 'Trocar aspas curvas, travessões e marcadores (•) por caracteres simples') +
      cb('normSymbols', 'Trocar símbolos (³ ² ≥ ≤ ± ×) por texto') +
      cb('ascii', 'Modo ASCII: remover acentos (só para sistemas antigos)') +
      cb('warnFields', 'Avisar quando houver campos não preenchidos') +
      '<div>Quebras de linha:</div>' + rd('crlf', 'Windows (padrão)') + rd('lf', 'Unix') + rd('single', 'Tudo em uma linha') + '</fieldset>' +
      '<fieldset><legend>Laudo</legend>' + cb('hypUnderline', 'Sublinhar o título "Hipótese/Impressão diagnóstica:"') +
      cb('blockCopy', 'Bloquear copiar/recortar/arrastar para fora do laudo (só o botão Copiar copia)') +
      cb('dragInReport', 'Permitir arrastar texto selecionado dentro do laudo') + '</fieldset>' +
      '<fieldset><legend>Aparência</legend><div class="chk-row">Tema: ' + th('light', 'Claro') + th('dark', 'Escuro') + th('system', 'Seguir o sistema') + '</div>' +
      cb('paperDark', 'Laudo escuro também (a folha do laudo fica escura no tema escuro; impressão e cópia não mudam)') + '</fieldset>' +
      '<fieldset><legend>Banco de frases</legend><p>' + (S.bank ? esc(S.bankName || 'banco') + ': ' + S.bank.stats.exams + ' exames, ' + S.bank.stats.templates +
        ' modelos, ' + S.bank.stats.phrases + ' frases. ' + n + ' item(ns) no relatório' + (function (b) { return n ? ' (' + (b.erro || 0) + ' erro(s), ' + (b.aviso || 0) + ' aviso(s), ' + (b.info || 0) + ' informativo(s))' : ''; })(bySev) + '.' : 'Nenhum banco carregado.') + '</p>' +
      '<div class="btnrow"><label class="btn btn-file">' + (S.bank ? 'Trocar arquivo' : 'Escolher arquivo') + '<input type="file" id="bankFile1" accept=".txt,text/plain"></label>' +
      (S.bank ? '<button type="button" class="btn" id="stBankEdit" title="Editar o texto do banco aqui no app">Editar banco</button><button type="button" class="btn" id="stIssues">Ver relatório de inconsistências</button>' : '') + '</div>' +
      '</fieldset>' + storageFieldset();
    setSnap = JSON.stringify(S.settings); UI.setSaved = false;
    modal('Configurações', body, [{ label: 'Cancelar', id: 'stCancel' },
      { label: 'Salvar alterações', cls: 'btn-primary', id: 'stSave', focus: true, click: function () { readSettingsForm(); toast('Configurações salvas.'); } }],
      function () {
        if (UI.setSaved || !setSnap) { return; }
        var changed = JSON.stringify(S.settings) !== setSnap || hasCls($('stSave'), 'dirty');
        loadSettings();   /* discard = back to the saved settings (not to an old snapshot: another tab may have saved) */
        applyTheme();
        if (changed) { toast('Alterações não salvas foram descartadas.'); }
      });
    var dirtyEl = document.createElement('span'); dirtyEl.id = 'stDirty'; dirtyEl.className = 'muted'; dirtyEl.hidden = true; dirtyEl.innerHTML = 'Alterações não salvas';
    $('modalFoot').insertBefore(dirtyEl, $('modalFoot').firstChild);
    on($('modalBody'), 'change', function (e) {
      var t = e.target; if (!t || !t.id && !t.name || !/^st_/.test(t.id || t.name)) { return; }
      UI.setSaved = false; dirtyEl.hidden = false; addCls($('stSave'), 'dirty');
    });
    if ($('stIssues')) { on($('stIssues'), 'click', function () { readSettingsForm(); issuesDialog(); }); }
    if ($('stBankEdit')) { on($('stBankEdit'), 'click', function () { readSettingsForm(); bankEditor(0, false); }); }
    var thr = document.getElementsByName('st_theme'), tq;
    for (tq = 0; tq < thr.length; tq++) { on(thr[tq], 'change', function () { S.settings.theme = this.value; applyTheme(); }); }   /* preview; saved by Salvar */
    on($('st_paperDark'), 'change', function () { S.settings.paperDark = this.checked; applyTheme(); });
    on($('bankFile1'), 'change', function () { var f = this.files && this.files[0]; if (f) { readSettingsForm(); closeModal(); loadBankFile(f); } });
    storageWire();
  }
  /* ---- Armazenamento (Etapa D): pasta de dados / navegador, exportar / importar ---- */
  function storageText() {
    var st = UFolder.status(), nm = esc(UFolder.folderName() || 'pasta');
    if (!UStore.persistent()) { return 'Somente memória — os dados serão perdidos ao fechar.'; }
    if (st === 'folder') { return 'Pasta de dados: <b>' + nm + '</b> (conectada). Banco, configurações e rascunhos são gravados nela.'; }
    if (st === 'loading') { return 'Pasta de dados: <b>' + nm + '</b> — lendo a pasta (pendrive lento?). O app usa a cópia do navegador e atualiza a tela quando terminar.'; }
    if (st === 'needperm') { return 'Pasta de dados: <b>' + nm + '</b> — desconectada (o navegador pede permissão de novo). Clique em Reconectar.'; }
    if (st === 'error') { return 'Pasta de dados: <b>' + nm + '</b> — não foi possível gravar (pendrive removido?). O app tenta de novo sozinho; ou clique em Reconectar.' + (UFolder.lastError() ? ' <small class="fbar-err">(' + esc(UFolder.lastError()) + ')</small>' : ''); }
    if (st === 'unavailable') { return 'Só o navegador deste computador. Este navegador não grava em pasta (use Chrome ou Edge); para levar os dados use Exportar / Importar.'; }
    return 'Só o navegador deste computador. Para guardar no pendrive: Escolher pasta (ou Exportar / Importar).';
  }
  function storageFieldset() {
    var st = UFolder.status(), b = '';
    if (UFolder.available) { b += '<button type="button" class="btn" id="stPick">' + (st === 'browser' ? 'Escolher pasta' : 'Trocar pasta') + '</button>'; }
    if (st === 'needperm' || st === 'error') { b += '<button type="button" class="btn btn-primary" id="stRecon">Reconectar</button>'; }
    if (st !== 'browser' && st !== 'unavailable') { b += '<button type="button" class="btn" id="stBrowser">Usar só o navegador</button>'; }
    b += '<button type="button" class="btn" id="stExport">Exportar</button><label class="btn btn-file">Importar<input type="file" id="stImport" accept=".json,application/json"></label>' +
      '<button type="button" class="btn" id="stDrafts" title="Apaga os rascunhos guardados de outras abas (o laudo aberto nesta aba fica)">Apagar rascunhos</button>';
    return '<fieldset><legend>Armazenamento</legend><p id="stMode">' + storageText() + '</p><div class="btnrow">' + b + '</div></fieldset>';
  }
  function reopenSettings() { if (!$('modalBack').hidden) { readSettingsForm(); closeModal(); } settingsDialog(); }
  function pickFolder() {
    saveDraft();
    UFolder.choose(function (err, how) {
      if (err) { if (!/abort/i.test(String(err.name || err))) { toast('Não foi possível usar a pasta (' + (err.message || err.name || err) + ').'); } return; }
      afterConnect(how);
    });
  }
  function afterConnect(how) {
    hideBar();
    if (how === 'imported') { saveDraft(); toast('Dados carregados da pasta.'); setTimeout(function () { window.location.reload(); }, 300); return; }
    toast('Pasta de dados pronta: dados gravados em "' + UFolder.folderName() + '".');
    if (!$('modalBack').hidden) { reopenSettings(); }
  }
  function reconnectFolder() { saveDraft(); UFolder.reconnect(function (err, how) { if (err) { toast('Não foi possível reconectar (' + (err.message || err) + ').'); return; } afterConnect(how); }); }
  function exportData() {
    saveDraft(); if (!$('modalBack').hidden && $('st_showUsage')) { readSettingsForm(); }
    var o = { formato: 'ultra-formulario-dados', versao: 1, exportadoEm: new Date().toISOString(), banco: UStore.get('bank', null),
      configuracoes: UStore.get('settings', {}), dados: {} }, ks = ['userModels', 'userPhrases', 'overrides', 'hidden', 'order', 'usage', 'usageLast', 'search', 'searchHist'], i;
    for (i = 0; i < ks.length; i++) { o.dados[ks[i]] = UStore.get(ks[i], null); }
    var d = new Date(), nm = 'ultra-formulario-dados_' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + '.json',
      blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
    if (window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, nm); return; }
    var a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = nm; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(u); }, 1000);
    toast('Dados exportados (' + nm + '). Rascunhos não são incluídos.');
  }
  function importData(f) {
    var fr = new FileReader();
    fr.onload = function () {
      var o, i, ks = ['userModels', 'userPhrases', 'overrides', 'hidden', 'order', 'usage', 'usageLast', 'search', 'searchHist'];
      try { o = JSON.parse(fr.result); } catch (e) { o = null; }
      if (!o || o.formato !== 'ultra-formulario-dados') { toast('Arquivo inválido: escolha um arquivo exportado pelo app (.json).'); return; }
      saveDraft();
      if (o.configuracoes) { UStore.set('settings', o.configuracoes); }
      for (i = 0; i < ks.length; i++) { if (o.dados && o.dados[ks[i]] !== null && o.dados[ks[i]] !== undefined) { UStore.set(ks[i], o.dados[ks[i]]); } }
      toast('Dados importados.');
      function go() { setTimeout(function () { window.location.reload(); }, 400); }
      function fl() { var p = UFolder.status() === 'folder' ? UFolder.flush() : null; if (p && p.then) { p.then(go, go); } else { go(); } }
      if (o.banco && o.banco.text) {
        UStore.set('bank', o.banco);
        if (UFolder.status() === 'folder') { UFolder.saveBank(o.banco.text, fl); return; }   /* wait for the bank file: the reload reads the folder */
      }
      fl();
    };
    fr.readAsText(f, 'UTF-8');
  }
  function storageWire() {
    if ($('stPick')) { on($('stPick'), 'click', function () { readSettingsForm(); pickFolder(); }); }
    if ($('stRecon')) { on($('stRecon'), 'click', function () { readSettingsForm(); reconnectFolder(); }); }
    if ($('stBrowser')) { on($('stBrowser'), 'click', function () { UFolder.useBrowser(function () { toast('Usando só o navegador. Os arquivos da pasta não foram apagados.'); reopenSettings(); }); hideBar(); }); }
    on($('stExport'), 'click', exportData);
    on($('stImport'), 'change', function () { var f = this.files && this.files[0]; if (f) { importData(f); } this.value = ''; });
    on($('stDrafts'), 'click', function () { readSettingsForm(); S.noDraft = false; saveDraft(); var n = UFolder.clearDrafts(UI.TAB); toast(n ? n + ' rascunho(s) apagado(s).' : 'Nenhum outro rascunho guardado.'); });
  }
  /* small bar: folder disconnected / bank edited outside the app (no dialogs) */
  R(function () {
    barAction = null;
  });
  function showBar(msg, label, fn, detail) {
    var b = $('fbar'); $('fbarMsg').innerHTML = esc(msg) + (detail ? ' <small class="fbar-err">(' + esc(detail) + ')</small>' : ''); $('fbarBtn').innerHTML = esc(label); barAction = fn; b.hidden = false;
  }
  function hideBar() { $('fbar').hidden = true; barAction = null; }
  R(function () {
    on($('fbarBtn'), 'click', function () { if (barAction) { barAction(); } });
    on($('fbarX'), 'click', hideBar);
  });
  function refreshFromStore() {   /* data folder read finished after the app had started (slow pendrive) */
    loadSettings(); applyTheme(); applyLayout();
    var ks = ['usage', 'usageLast', 'order', 'userModels', 'userPhrases', 'overrides', 'hidden'], i;
    for (i = 0; i < ks.length; i++) { S[ks[i]] = UStore.get(ks[i], S[ks[i]]); }
    var bk = UStore.get('bank', null);
    if (bk && bk.text && (!S.bank || S.srcLines.join('\n') !== String(bk.text).split(/\r?\n/).join('\n'))) { setBank(bk.text, bk.name, true); }
    buildModels(); renderNav(); afterChange(true);
    toast('Dados da pasta carregados.');
  }
  R(function () {
    UFolder.onLate(refreshFromStore);
  });
  function folderStatus(st) {
    if (st === 'needperm') { showBar('Pasta de dados desconectada.', 'Reconectar', reconnectFolder, UFolder.lastError()); }
    else if (st === 'error') { showBar('Não foi possível gravar na pasta de dados (pendrive removido?). Tentando de novo sozinho.', 'Reconectar', reconnectFolder, UFolder.lastError()); }
    else if (st === 'folder' && barAction === reconnectFolder) { hideBar(); }
    if (!$('modalBack').hidden && $('stMode')) { $('stMode').innerHTML = storageText(); }
  }
  R(function () {
    UFolder.onStatus(folderStatus);
  });
  function checkBankFile() {
    UFolder.checkBank(function (f) {
      showBar('Banco de frases alterado fora do app.', 'Recarregar', function () {
        UFolder.acceptBank(f, function (txt) { hideBar(); setBank(txt, 'banco-de-frases.txt', true); UStore.set('bank', { name: 'banco-de-frases.txt', text: txt }); toast('Banco de frases recarregado.'); });
      });
    });
  }
  R(function () {
    on(window, 'focus', checkBankFile);
    on(document, 'visibilitychange', function () { if (!document.hidden) { checkBankFile(); } });

    /* ---- Relatório de inconsistências ---- */
    /* plain-Portuguese explanation of each type + whether he needs to act (c = corrigir, r = revisar, n = nada) */
    UI.ISSUE_HELP = {
      DIRECTIVE_UNKNOWN: ['c', 'Linha começa com @@ ou ## mas não é uma diretiva conhecida. Ela não faz nada e aparece como texto.'],
      DIRECTIVE_TYPO: ['c', 'Nome da diretiva digitado errado (ex.: @@SUBTITUI). Não funciona: corrija o nome.'],
      DIRECTIVE_NO_NAME: ['c', 'Diretiva sem o nome depois dela (ex.: "@@EXAME" sozinho).'],
      DIRECTIVE_EMPTY_TARGET: ['c', '@@SUBSTITUI ou @@ABAIXO_DE sem dizer qual linha. A frase vai para o lugar padrão.'],
      DIRECTIVE_MISPLACED: ['r', 'Diretiva num lugar onde não tem efeito, ou depois do texto de uma frase (então vale para essa frase, não para a próxima).'],
      DIRECTIVE_DUPLICATE: ['c', 'Mais de uma diretiva de posição para a mesma frase ou seção. Vale a primeira (de cima para baixo) cujo alvo existe no modelo; as seguintes são alternativas.'],
      ALWAYS_DUPLICATE: ['r', '@@SEMPRE escrito duas vezes na mesma frase. Basta uma.'],
      DIRECTIVE_TARGET_MISSING: ['r', 'Nenhuma linha do template começa com o texto indicado na diretiva. A frase é inserida no fim da seção/laudo. Corrija o texto-alvo, ou ignore se o template realmente não tem essa linha.'],
      DIRECTIVE_SEPARATOR: ['n', 'Diretiva escrita com ":" ou "=" (ex.: "@@EXAME: X"). Funciona igual.'],
      EXAM_FULL_WITHOUT_EXAM: ['c', '@@EXAME_FULL antes de qualquer @@EXAME.'],
      EXAM_FULL_DUPLICATE: ['r', 'Dois @@EXAME_FULL no mesmo exame. Vale o último.'],
      EXAM_NO_FULL: ['r', 'Exame sem @@EXAME_FULL (título completo).'],
      EXAM_DUPLICATE: ['r', 'Dois exames com o mesmo nome.'],
      OUTSIDE_EXAM: ['c', 'Texto antes do primeiro @@EXAME. É ignorado.'],
      ORPHAN_TEXT: ['r', 'Texto solto fora de template, seção ou nota. É ignorado.'],
      TEMPLATE_EMPTY: ['c', 'Template sem texto.'],
      TEMPLATE_BRACKET_NAME: ['r', 'Nome de template com [ ]. Hipótese diagnóstica não se aplica a template.'],
      TEMPLATE_TITLE_DIFFERS: ['n', 'A 1ª linha do template não é igual ao @@EXAME_FULL. Normal em variações (ex.: "com Doppler").'],
      SECTION_DUPLICATE: ['n', 'Seção com frases declarada mais de uma vez no mesmo exame. As frases são unidas.'],
      SECTION_RESERVED: ['n', 'Seção vazia, sem frases em lugar nenhum. Fica reservada para frases futuras.'],
      TEXT_BEFORE_FIRST_PHRASE: ['c', 'Texto dentro da seção antes do primeiro título de frase (linha terminada em ":"). Não pertence a nenhuma frase.'],
      PHRASE_EMPTY: ['c', 'Título de frase sem texto embaixo.'],
      PHRASE_DUPLICATE_TITLE: ['r', 'Dois títulos de frase iguais na mesma seção. Difícil distinguir na lista.'],
      TITLE_MULTI_BRACKET: ['r', 'Título com mais de um [ ]. Só o primeiro vira hipótese.'],
      TITLE_UNBALANCED: ['c', 'Título com ( ) ou [ ] sem fechar.'],
      HYPOTHESIS_PIPE: ['r', 'Hipótese [ ] com "|".'],
      TITLE_LIKE_IN_BODY: ['r', 'Linha terminada em ":" colada ao texto (sem linha em branco antes). Fica como texto da frase anterior, não vira frase nova. Se era para ser título de outra frase, ponha uma linha em branco antes.'],
      CRITICAL_LINE: ['n', 'Linha com *** no início: o app pede revisão antes de copiar. Só informativo.'],
      EXAMPLE_BLOCK_SKIPPED: ['n', 'Bloco de exemplo/instruções do início do arquivo, ignorado de propósito.'],
      DIRECTIVE_IN_NOTE: ['n', 'Diretiva dentro das notas globais, tratada como texto da nota.'],
      STAR_RUN: ['r', '3 ou mais asteriscos no meio da linha.'],
      STAR_ADJACENT: ['r', 'Asterisco colado a uma letra (ex.: *OU*): pode virar campo sem querer.'],
      LEGACY_BULLET: ['n', 'Marcador • do formato antigo. Aparece como texto normal.'],
      LEGACY_PIPE: ['r', '"|" fora de ?[ ]: parece opção do formato antigo e não vira lista de escolha.'],
      LEGACY_SLASH: ['n', '"a / b" fora de ?[ ]: talvez fosse uma escolha. Aparece como texto.'],
      DROPDOWN_UNCLOSED: ['c', '?[ sem o ] de fechamento.'],
      DROPDOWN_MULTILINE: ['r', '?[ ] que ocupa mais de uma linha.'],
      DROPDOWN_NESTED: ['n', '?[ ] dentro de outro ?[ ]. O app aceita: depois de escolher a opção, o ?[ ] de dentro vira um novo campo.'],
      DROPDOWN_EMPTY_OPTION: ['r', 'Opção vazia em ?[ ] (ex.: "a||b").'],
      DROPDOWN_SINGLE: ['r', '?[ ] com uma única opção.'],
      MULTI_NESTED: ['r', '?+[ ] (escolha múltipla) com campos ou listas dentro das opções: esse conteúdo entra como texto, não vira campo.'],
      STRAY_BRACKET: ['n', '[ ou ] solto no texto. Aparece como texto.']
    };
    UI.ISSUE_NOISE = { SECTION_RESERVED: 1, LEGACY_BULLET: 1, CRITICAL_LINE: 1, TEMPLATE_TITLE_DIFFERS: 1, STRAY_BRACKET: 1, LEGACY_SLASH: 1, DIRECTIVE_SEPARATOR: 1, EXAMPLE_BLOCK_SKIPPED: 1 };
    UI.ACT_LABEL = { c: 'corrigir', r: 'revisar', n: 'nenhuma ação' };
    UI.issueView = { erro: true, aviso: true, info: false, noise: false };
  });
  /* @@SUBSTITUI / @@ABAIXO_DE whose target line is not in the exam's templates (rendered off-screen, same matching as the app) */
  function directiveTargetIssues() {
    var out = [], ex = examNames(), e, i, j, k, byKey = {}, order = [];
    var tdef = UltraParser.ISSUE_TYPES.DIRECTIVE_TARGET_MISSING;
    for (e = 0; e < ex.length; e++) {
      if (ex[e] === UltraParser.GLOBAL_EXAM) { continue; }
      var ms = sortedModels().filter(function (m) { return m.exam === ex[e] && !m.user; });
      if (!ms.length) { continue; }
      var secs = examSections(ex[e]), tl = [];
      for (k = 0; k < ms.length; k++) {
        var tp = modelTemplate(ms[k]), box = document.createElement('div');
        box.innerHTML = renderLines(tp.body, tp.fields, tp.critical);
        var ls = qsa(box, 'div,p'), lines = [];
        for (i = 0; i < ls.length; i++) { if (!ls[i].querySelector('div,p')) { lines.push(ls[i]); } }
        tl.push({ name: ms[k].name, lines: lines });
      }
      for (i = 0; i < secs.length; i++) {
        for (j = 0; j < secs[i].cards.length; j++) {
          var c = secs[i].cards[j];
          if (c.user) { continue; }
          var ps = [[c.secPlace, ''], [c.ph && c.ph.place, c.ph ? c.ph.title : '']], q;
          for (q = 0; q < ps.length; q++) {
            var pd = ps[q][0], rule = pd && directiveRule(pd); if (!rule) { continue; }
            var chain = placeChain(pd).map(directiveRule).filter(function (x) { return !!x; });
            var key = pd.line + '|' + secs[i].name + '|' + (q ? ps[q][1] : '');
            var agg = byKey[key];
            if (!agg) { agg = byKey[key] = { pd: pd, sec: secs[i].name, ph: q ? ps[q][1] : '', hit: 0, all: [], some: [], seen: {} }; order.push(key); }
            if (agg.seen[ex[e]]) { continue; }
            agg.seen[ex[e]] = 1;
            var miss = [];
            for (k = 0; k < tl.length; k++) {
              var found = false, z;
              for (z = 0; z < tl[k].lines.length && !found; z++) { for (var y = 0; y < chain.length && !found; y++) { found = !!chain[y].top || anchorHits(chain[y].anchor, tl[k].lines[z]); } }
              if (found) { agg.hit++; } else { miss.push(tl[k].name); }
            }
            if (miss.length === tl.length) { agg.all.push(ex[e]); } else if (miss.length) { agg.some.push(ex[e] + ': ' + miss.join(', ')); }
          }
        }
      }
    }
    function item(g, sev, msg, miss) {
      out.push({ type: 'DIRECTIVE_TARGET_MISSING', severity: sev, line: g.pd.line, message: msg, miss: miss,
        text: (g.pd.mode === 'replaceLine' ? '@@SUBSTITUI = ' : '@@ABAIXO_DE = ') + g.pd.text,
        exam: '', tpl: '', sec: g.sec, ph: g.ph || '(diretiva da seção)', where: '' });
    }
    for (i = 0; i < order.length; i++) {
      var g = byKey[order[i]];
      if (g.all.length) { item(g, tdef[0], tdef[1], 'nenhum template destes exames tem essa linha: ' + g.all.join(', ')); }
      if (g.some.length) { item(g, 'info', 'Alvo da diretiva ausente só em alguns templates do exame (normal em variações, ex.: histerectomia)', 'sem o alvo em: ' + g.some.join('; ')); }
    }
    return out;
  }
  R(function () {
    HIDDEN_ISSUES = ['TITLE_LIKE_IN_BODY'];
  });
  function allIssues() {
    if (!S.bank) { return []; }
    if (!S.bank._dirIssues) { try { S.bank._dirIssues = directiveTargetIssues(); } catch (e) { S.bank._dirIssues = []; } }
    /* hidden by request (D2): a line ending in ':' inside a phrase body is intended text; the parser still
       reports it internally, it is just not listed nor counted */
    return S.bank.issues.filter(function (it) { return HIDDEN_ISSUES.indexOf(it.type) < 0; }).concat(S.bank._dirIssues);
  }
  function issuePath(it) {
    var p = it.type === 'DIRECTIVE_TARGET_MISSING' ? [] : [it.exam || '(sem exame)'];
    if (it.tpl) { p.push(it.tpl); }
    if (it.sec) { p.push(it.sec); }
    if (it.ph) { p.push(it.ph); }
    if (!it.tpl && !it.sec && it.where) { p.push(it.where); }
    return p.join(' \u203A ');
  }
  function groupIssues(list) {   /* -> [{sev, types:[{type, items}]}] in severity order */
    var sevs = ['erro', 'aviso', 'info'], out = [], i, j;
    for (i = 0; i < sevs.length; i++) {
      var types = {}, order = [];
      for (j = 0; j < list.length; j++) {
        var it = list[j]; if (it.severity !== sevs[i]) { continue; }
        var tk = it.type === 'DIRECTIVE_TARGET_MISSING' ? it.type + ':' + it.severity : it.type;
        if (!types[tk]) { types[tk] = []; order.push(tk); }
        types[tk].push(it);
      }
      order.sort(function (a, b) { return types[b].length - types[a].length; });
      var g = { sev: sevs[i], types: [] };
      for (j = 0; j < order.length; j++) { types[order[j]].sort(function (a, b) { return a.line - b.line; }); g.types.push({ type: order[j].split(':')[0], items: types[order[j]] }); }
      out.push(g);
    }
    return out;
  }
  R(function () {
    UI.SEV_LABEL = { erro: 'Erros', aviso: 'Avisos', info: 'Informativos' };
  });
  function issueVisible(it) {
    if (!UI.issueView[it.severity]) { return false; }
    return !(it.severity === 'info' && UI.ISSUE_NOISE[it.type] && !UI.issueView.noise);
  }
  function typeTitle(t, items) { var d = UltraParser.ISSUE_TYPES[t]; return (items[0] && items[0].message && t === 'DIRECTIVE_TARGET_MISSING') ? items[0].message : (d ? d[1] : t); }
  function issuesText(list) {
    var g = groupIssues(list), t = 'Relatório de inconsistências - ' + (S.bankName || 'banco') + '\r\n', i, j, k;
    for (i = 0; i < g.length; i++) {
      if (!g[i].types.length) { continue; }
      var n = 0; for (j = 0; j < g[i].types.length; j++) { n += g[i].types[j].items.length; }
      t += '\r\n== ' + UI.SEV_LABEL[g[i].sev].toUpperCase() + ' (' + n + ') ==\r\n';
      for (j = 0; j < g[i].types.length; j++) {
        var ty = g[i].types[j], h = UI.ISSUE_HELP[ty.type];
        t += '\r\n' + ty.type + ' (' + ty.items.length + '): ' + typeTitle(ty.type, ty.items) + '\r\n';
        if (h) { t += '  ' + h[1] + ' [Ação: ' + UI.ACT_LABEL[h[0]] + ']\r\n'; }
        for (k = 0; k < ty.items.length; k++) {
          var it = ty.items[k];
          t += '  - linha ' + it.line + ': ' + issuePath(it) + '\r\n      ' + trim(String(it.text || '')).substring(0, 160) + '\r\n';
          if (it.miss) { t += '      (' + it.miss + ')\r\n'; }
          if (it.message && it.message !== typeTitle(ty.type, ty.items) && ty.type !== 'DIRECTIVE_TARGET_MISSING') { t += '      (' + it.message + ')\r\n'; }
        }
      }
    }
    return t;
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; hasCls = UI.hasCls; addCls = UI.addCls; rmCls = UI.rmCls; qsa = UI.qsa;
    trim = UI.trim; toast = UI.toast; S = UI.S; loadSettings = UI.loadSettings; saveSettings = UI.saveSettings;
    modal = UI.modal; closeModal = UI.closeModal; setBank = UI.setBank; examNames = UI.examNames;
    buildModels = UI.buildModels; modelTemplate = UI.modelTemplate; sortedModels = UI.sortedModels;
    examSections = UI.examSections; renderLines = UI.renderLines; afterChange = UI.afterChange;
    saveDraft = UI.saveDraft; renderNav = UI.renderNav; anchorHits = UI.anchorHits; placeChain = UI.placeChain;
    directiveRule = UI.directiveRule; renderAll = UI.renderAll; bankEditor = UI.bankEditor;
    issuesDialog = UI.issuesDialog; applyTheme = UI.applyTheme; applyLayout = UI.applyLayout;
    loadBankFile = UI.loadBankFile;
  };
});
