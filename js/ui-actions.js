/*
 * ui-actions.js - ações de modelo e de frase (usar, editar, clonar, importar).
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-actions', function (UI, R) {
  'use strict';
  var $, on, esc, trim, now, toast, S, modal, armDelete, findExam, examNames, buildModels, getModel, modelRaw,
      modelTemplate, examSections, renderLines, loadIntoEditor, repSearch, renderNav, insertAlways, renderAll;   /* de outros arquivos ui-*.js (ligados abaixo) */
  UI.useModel = useModel; UI.modelDialog = modelDialog; UI.cloneModel = cloneModel;
  UI.phraseDialog = phraseDialog; UI.importDialog = importDialog;   /* usadas por outros arquivos */

  /* ================= model actions ================= */
  function useModel(m, noConfirm) {
    if (!m) { return; }
    var tp = modelTemplate(m);
    function doLoad() {
      S.activeModelId = m.id; S.activeExam = m.exam; S.navExam = m.exam; S.level = 3; S.selCard = null;
      S.usage[m.id] = (S.usage[m.id] || 0) + 1; UStore.set('usage', S.usage);
      S.usageLast[m.id] = now(); UStore.set('usageLast', S.usageLast);
      loadIntoEditor(renderLines(tp.body, tp.fields, tp.critical));
      var na = insertAlways(m.exam);
      renderAll();
      if ($('repSearch').value) { repSearch(false); }
      toast('Modelo carregado: ' + m.name + (na ? ' (+ ' + na + ' frase(s) @@SEMPRE)' : ''));
    }
    doLoad();   /* never ask before replacing: Ctrl+Z undoes the load */
  }
  function examOptions(sel) {
    var a = examNames(), h = '', i;
    if (!a.length) { a = ['Meus modelos']; }
    for (i = 0; i < a.length; i++) { h += '<option' + (a[i] === sel ? ' selected' : '') + '>' + esc(a[i]) + '</option>'; }
    return h;
  }
  function modelDialog(m) {
    var isNew = !m;
    var body = '<label>Nome do modelo<input type="text" id="mdName" value="' + esc(m ? m.name : '') + '" placeholder="Nome do modelo"></label>' +
      '<label>Exame<select id="mdExam">' + examOptions(m ? m.exam : (S.navExam || S.activeExam)) + '</select></label>' +
      '<label>Conteúdo do modelo (a 1ª linha é o título)<textarea id="mdText" placeholder="Conteúdo do modelo">' + esc(m ? modelRaw(m) : '') + '</textarea></label>' +
      (m && m.bank ? '<p class="muted">Modelo do banco: a alteração fica salva só neste computador; o arquivo .txt não é alterado.</p>' : '');
    var btns = [];
    if (!isNew) {
      btns.push({ label: 'Excluir', cls: 'btn-danger', click: function (b) {
        return armDelete(b, function () {
          if (m.user) { S.userModels = S.userModels.filter(function (u) { return u.id !== m.id; }); UStore.set('userModels', S.userModels); }
          else { S.hidden[m.id] = 1; UStore.set('hidden', S.hidden); }
          if (S.activeModelId === m.id) { S.activeModelId = null; }
          buildModels(); renderAll(); toast('Modelo excluído.');
        });
      } });
    }
    btns.push({ label: 'Cancelar' });
    btns.push({ label: 'Salvar', cls: 'btn-primary', click: function () {
      var name = trim($('mdName').value), ex = $('mdExam').value, text = $('mdText').value, i;
      if (!name) { $('mdName').focus(); return false; }
      if (isNew) { var id = 'u:' + now(); S.userModels.push({ id: id, name: name, exam: ex, text: text }); S.selModel = id; UStore.set('userModels', S.userModels); }
      else if (m.user) {
        for (i = 0; i < S.userModels.length; i++) { if (S.userModels[i].id === m.id) { S.userModels[i].name = name; S.userModels[i].exam = ex; S.userModels[i].text = text; } }
        UStore.set('userModels', S.userModels);
      } else { S.overrides[m.id] = { name: name, text: text }; UStore.set('overrides', S.overrides); }
      buildModels(); renderAll(); toast('Modelo salvo.');
      return true;
    } });
    modal(isNew ? 'Adicionar Modelo' : 'Editar Modelo', body, btns);
  }
  function cloneModel() {
    var m = getModel(S.selModel || S.activeModelId);
    if (!m) { toast('Selecione um modelo primeiro.'); return; }
    var id = 'u:' + now();
    S.userModels.push({ id: id, name: m.name + ' (cópia)', exam: m.exam, text: modelRaw(m) });
    UStore.set('userModels', S.userModels);
    S.selModel = id; buildModels(); renderAll(); toast('Modelo clonado: ' + m.name + ' (cópia)');
  }

  /* ================= phrase actions ================= */
  function sectionOptions(sel) {
    var secs = S.navExam ? examSections(S.navExam) : [], h = '', i, has = false;
    for (i = 0; i < secs.length; i++) { if (secs[i].name === 'MINHAS FRASES') { has = true; } h += '<option' + (secs[i].name === sel ? ' selected' : '') + '>' + esc(secs[i].name) + '</option>'; }
    if (!has) { h += '<option' + (sel === 'MINHAS FRASES' ? ' selected' : '') + '>MINHAS FRASES</option>'; }
    return h;
  }
  function phraseDialog(card) {
    if (!S.navExam) { toast('Escolha um exame primeiro.'); return; }
    var isNew = !card;
    var body = '<label>Seção<select id="pdSec">' + sectionOptions(card ? card.section : null) + '</select></label>' +
      '<label>Título — pode ter (ajuda) e [Hipótese diagnóstica]<input type="text" id="pdTitle" placeholder="Título (opcional)" value="' +
      esc(card ? card.titleLine.replace(/:\s*$/, '') : '') + '"></label>' +
      '<label>Texto da frase — campos: * número, *,* decimal, ** texto, ?[opção1|opção2]<textarea id="pdBody" placeholder="Texto da frase (cole textos grandes — não serão divididos)">' +
      esc(card ? card.rawBody : '') + '</textarea></label>' +
      (card && card.bank ? '<p class="muted">Frase do banco: a alteração fica salva só neste computador; o arquivo .txt não é alterado.</p>' : '');
    var btns = [];
    if (!isNew) {
      btns.push({ label: 'Excluir', cls: 'btn-danger', click: function (b) {
        return armDelete(b, function () {
          if (card.user) { S.userPhrases = S.userPhrases.filter(function (u) { return u.id !== card.id; }); UStore.set('userPhrases', S.userPhrases); }
          else { S.hidden[card.id] = 1; UStore.set('hidden', S.hidden); }
          S.selCard = null; renderNav(); toast('Frase excluída.');
        });
      } });
    }
    btns.push({ label: 'Cancelar' });
    btns.push({ label: 'Salvar', cls: 'btn-primary', click: function () {
      var t = trim($('pdTitle').value), b = $('pdBody').value, sec = $('pdSec').value, i;
      if (!trim(b)) { $('pdBody').focus(); return false; }
      if (!t) { t = trim(b.split('\n')[0]).substring(0, 40); }
      if (isNew) { S.userPhrases.push({ id: 'up:' + now(), exam: S.navExam, section: sec, titleLine: t + ':', body: b }); UStore.set('userPhrases', S.userPhrases); }
      else if (card.user) {
        for (i = 0; i < S.userPhrases.length; i++) { if (S.userPhrases[i].id === card.id) { S.userPhrases[i].titleLine = t + ':'; S.userPhrases[i].body = b; S.userPhrases[i].section = sec; } }
        UStore.set('userPhrases', S.userPhrases);
      } else { S.overrides[card.id] = { titleLine: t + ':', body: b }; UStore.set('overrides', S.overrides); }
      renderNav(); toast('Frase salva.');
      return true;
    } });
    modal(isNew ? 'Adicionar Frase' : 'Editar Frase', body, btns);
  }
  function simpleImport(text) {
    var lines = text.replace(/\r\n?/g, '\n').split('\n'), out = [], cur = null, i, L, t;
    function flush() { if (cur) { cur.body = cur.lines.join('\n').replace(/^(\s*\n)+|(\n\s*)+$/g, ''); if (trim(cur.body)) { out.push(cur); } } cur = null; }
    for (i = 0; i < lines.length; i++) {
      L = lines[i]; t = trim(L);
      if (t && /:$/.test(t) && t.length <= 200) { flush(); cur = { titleLine: t, lines: [] }; continue; }
      if (!cur) { if (!t) { continue; } cur = { titleLine: t.substring(0, 40) + ':', lines: [] }; }
      cur.lines.push(L);
    }
    flush();
    return out;
  }
  function importItems(text) {
    if (/^\s*(@@EXAME|##SECTION)/m.test(text)) {
      var r = UltraParser.parse(text), out = [], e, s, p;
      for (e = 0; e < r.exams.length; e++) {
        for (s = 0; s < r.exams[e].sections.length; s++) {
          var sec = r.exams[e].sections[s];
          for (p = 0; p < sec.phrases.length; p++) {
            out.push({ exam: findExam(r.exams[e].name) ? r.exams[e].name : null, section: sec.name, titleLine: sec.phrases[p].rawTitle, body: sec.phrases[p].rawBody });
          }
        }
      }
      return { full: true, items: out };
    }
    return { full: false, items: simpleImport(text) };
  }
  function importDialog() {
    if (!S.navExam) { toast('Escolha um exame primeiro.'); return; }
    var body = '<p class="muted">Cole o texto. Cada linha terminada em ":" é o título da frase seguinte. ' +
      'Também aceita o formato completo do banco (@@EXAME / ##SECTION).</p>' +
      '<label>Seção de destino (formato simples)<select id="imSec">' + sectionOptions('MINHAS FRASES') + '</select></label>' +
      '<textarea id="imText" placeholder="Título da frase:&#10;Texto da frase aqui...&#10;&#10;Outro título:&#10;Outro texto..."></textarea>' +
      '<button type="button" class="btn" id="imPrev">Pré-visualizar</button><div id="imOut" class="preview" hidden></div>';
    modal('Importar Frases', body, [
      { label: 'Cancelar' },
      { label: 'Importar', cls: 'btn-primary', click: function () {
        var res = importItems($('imText').value), sec = $('imSec').value, i, it;
        if (!res.items.length) { toast('Nenhuma frase reconhecida.'); return false; }
        for (i = 0; i < res.items.length; i++) {
          it = res.items[i];
          S.userPhrases.push({ id: 'up:' + now() + '-' + i, exam: res.full ? (it.exam || S.navExam) : S.navExam,
            section: res.full ? it.section : sec, titleLine: it.titleLine, body: it.body });
        }
        UStore.set('userPhrases', S.userPhrases); renderNav();
        toast(res.items.length + ' frase(s) importada(s).');
        return true;
      } }
    ]);
    on($('imPrev'), 'click', function () {
      var res = importItems($('imText').value), h = '<p><b>' + res.items.length + ' frase(s)</b>' + (res.full ? ' (formato completo do banco)' : '') + '</p>', i;
      for (i = 0; i < res.items.length && i < 200; i++) {
        h += '<div><span class="t">' + esc(res.items[i].titleLine) + '</span>' + (res.full ? ' <span class="muted">[' + esc(res.items[i].section) + ']</span>' : '') +
          '<div class="muted">' + esc(res.items[i].body.substring(0, 160)) + '</div></div>';
      }
      $('imOut').innerHTML = h; $('imOut').hidden = false;
    });
  }

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; trim = UI.trim; now = UI.now; toast = UI.toast; S = UI.S;
    modal = UI.modal; armDelete = UI.armDelete; findExam = UI.findExam; examNames = UI.examNames;
    buildModels = UI.buildModels; getModel = UI.getModel; modelRaw = UI.modelRaw;
    modelTemplate = UI.modelTemplate; examSections = UI.examSections; renderLines = UI.renderLines;
    loadIntoEditor = UI.loadIntoEditor; repSearch = UI.repSearch; renderNav = UI.renderNav;
    insertAlways = UI.insertAlways; renderAll = UI.renderAll;
  };
});
