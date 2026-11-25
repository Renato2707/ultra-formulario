/*
 * ui-sessions.js - C6n: título da aba e sessões de abas.
 * Parte do UFMain (ver js/ui.js). Strict ES5, sem dependências, sem módulos.
 */
UFUI.part('ui-sessions', function (UI, R) {
  'use strict';
  var TAB_PING_MS, pendingSessRecs, pendingSessOpen, sessMenu;   /* deste arquivo */
  var $, on, esc, closest, trim, now, toast, S, editor, modal, closeModal, confirmModal, getModel, lineText,
      tabsMap, stayMap, enqueueSessOpen, saveDraft, useModel;   /* de outros arquivos ui-*.js (ligados abaixo) */
  /* estado compartilhado entre arquivos: UI.TAB, UI.TAB_ALIVE_MS, UI.TAB_STAY_MAX, UI.BASE_TITLE, UI.TAB_ORD */
  UI.updTitle = updTitle; UI.findModelByName = findModelByName; UI.replyTabPing = replyTabPing;   /* usadas por outros arquivos */

  /* ================= C6n: título da aba = modelo aberto; sessões de abas ================= */
  function updTitle() {
    var m = S.activeModelId ? getModel(S.activeModelId) : null, t = m ? m.name : UI.BASE_TITLE;
    if (document.title !== t) { document.title = t; }
  }
  function findModelByName(nm) {
    var i, n = trim(String(nm || ''));
    for (i = 0; i < S.models.length; i++) { if (trim(S.models[i].name) === n) { return S.models[i]; } }
    return null;
  }
  function sessList() { var a = UStore.get('tabSessions', []); return (a && a.length !== undefined) ? a : []; }
  /* abas abertas agora, na ordem em que foram abertas; cada uma com o nome e o id do modelo.
     C10: inclui abas de fundo mesmo se o heartbeat de 15 s tiver vencido (tabStay). */
  function openTabsRecords() {
    saveDraft();
    var m = tabsMap(), stay = stayMap(), od = {}, t = now(), ids = [], seen = {}, k, out = [], i, d, md, dr = {};
    function addId(id) { if (id && !seen[id]) { seen[id] = true; ids.push(id); } }
    addId(UI.TAB);
    for (k in m) { if (m.hasOwnProperty(k) && (k === UI.TAB || t - m[k] < UI.TAB_ALIVE_MS || stay[k])) { addId(k); } }
    for (k in stay) { if (stay.hasOwnProperty(k) && stay[k] && t - stay[k] <= UI.TAB_STAY_MAX) { addId(k); } }
    for (i = 0; i < ids.length; i++) { dr[ids[i]] = UStore.get('draft.' + ids[i], null); od[ids[i]] = ids[i] === UI.TAB ? UI.TAB_ORD : (dr[ids[i]] && dr[ids[i]].ord) || 0; }
    ids.sort(function (a, b) { return (od[a] || t) - (od[b] || t) || (a < b ? -1 : 1); });
    for (i = 0; i < ids.length; i++) {
      d = ids[i] === UI.TAB ? { model: S.activeModelId } : dr[ids[i]];
      md = d && d.model ? getModel(d.model) : null;
      if (md) { out.push({ name: md.name, id: md.id }); }
    }
    return dedupeTabRecords(out);
  }
  /* C10b: o mesmo modelo entra uma vez só, na ordem em que as abas foram abertas. */
  function dedupeTabRecords(recs) {
    var out = [], seen = {}, i, n;
    for (i = 0; i < recs.length; i++) {
      n = recs[i] && recs[i].name;
      if (!n || seen[n]) { continue; }
      seen[n] = true;
      out.push({ name: recs[i].name, id: recs[i].id });
    }
    return out;
  }
  R(function () {
    TAB_PING_MS = 650;
    pendingSessRecs = null;
  });
  /* Abas de fundo (mesmo com timer atrasado) respondem na hora: o evento storage
     não espera o intervalo de 15 s. A aba que perguntou inclui a si mesma. */
  function replyTabPing() {
    var ping, md, rec;
    try { ping = UStore.get('tabPing', null); } catch (eP) { return; }
    if (!ping || !ping.token || ping.from === UI.TAB) { return; }
    md = S.activeModelId ? getModel(S.activeModelId) : null;
    rec = { token: ping.token, tab: UI.TAB, id: md ? md.id : null, name: md ? md.name : '', ord: UI.TAB_ORD || 0, t: now() };
    try { UStore.set('tabPong.' + UI.TAB, rec); } catch (eS) {}
  }
  function collectPingRecords(token) {
    var recs = [], ks, i, k, p, md, live = {}, nPong = 0;
    live[UI.TAB] = true;
    md = S.activeModelId ? getModel(S.activeModelId) : null;
    if (md) { recs.push({ name: md.name, id: md.id, tab: UI.TAB, ord: UI.TAB_ORD || 0 }); }
    try { ks = UStore.keys(); } catch (eK) { ks = []; }
    for (i = 0; i < ks.length; i++) {
      k = ks[i];
      if (String(k).indexOf('tabPong.') !== 0) { continue; }
      p = UStore.get(k, null);
      if (!p || p.token !== token || p.tab === UI.TAB) { continue; }
      nPong += 1;
      if (p.tab) { live[p.tab] = true; }
      md = (p.id && getModel(p.id)) || findModelByName(p.name);
      if (md) { recs.push({ name: md.name, id: md.id, tab: p.tab, ord: p.ord || 0 }); }
    }
    recs.sort(function (a, b) { return (a.ord || 0) - (b.ord || 0) || ((a.tab || '') < (b.tab || '') ? -1 : 1); });
    return { recs: dedupeTabRecords(recs), nPong: nPong, live: live };
  }
  function sweepDeadTabs(live) {
    var m = tabsMap(), s = stayMap(), k;
    for (k in m) { if (m.hasOwnProperty(k) && !live[k]) { delete m[k]; } }
    for (k in s) { if (s.hasOwnProperty(k) && !live[k]) { delete s[k]; } }
    UStore.set('tabs', m);
    UStore.set('tabStay', s);
  }
  /* Pergunta quais abas estão realmente abertas. Se alguma responder, só essas
     (e esta) entram; entradas velhas de tabStay/tabs são apagadas. Se ninguém
     responder (evento storage ausente em algum file://), cai no tabStay + nomes sem repetir. */
  function probeLiveTabs(done) {
    var token = 'p' + now() + '-' + Math.floor(Math.random() * 1000000000);
    try { UStore.set('tabPing', { token: token, t: now(), from: UI.TAB }); } catch (e1) {}
    setTimeout(function () {
      var got = collectPingRecords(token), out;
      if (got.nPong > 0) { sweepDeadTabs(got.live); out = got.recs; }
      else { out = openTabsRecords(); }
      if (typeof done === 'function') { done(out); }
    }, TAB_PING_MS);
  }
  function openTabsModels() {
    var a = openTabsRecords(), i, out = [];
    for (i = 0; i < a.length; i++) { out.push(a[i].name); }
    return out;
  }
  function tabUrl(nm, ord, mid) {
    var u = String(window.location.href).replace(/#.*$/, ''), h;
    h = '#ufopen=' + encodeURIComponent(nm) + '&uford=' + ord;
    if (mid) { h += '&ufmodel=' + encodeURIComponent(mid); }
    return u + h;
  }
  function resolveSessModel(id, nm) {
    var m = id ? getModel(id) : null;
    return m || findModelByName(nm);
  }
  function isNewWin(w) {
    if (!w) { return false; }
    if (w === window) { return false; }
    try { if (w.closed) { return false; } } catch (eC) { return false; }
    return true;
  }
  /* abre uma aba no clique (gesto do usuário). Se o navegador bloquear, tira o item da fila
     para uma aba nova depois não "engolir" o modelo. */
  function tryOpenTab(name, mid, ord) {
    var qk = null, w = null;
    try { qk = enqueueSessOpen({ id: mid, name: name, ord: ord }); } catch (eQ) { qk = null; }
    try { w = window.open(tabUrl(name, ord, mid), '_blank'); } catch (eW) { w = null; }
    if (!isNewWin(w) && qk) { try { UStore.remove(qk); } catch (eR) {} }
    return w;
  }
  function sessMsg(title, bodyHtml) {
    modal(title, bodyHtml, [{ label: 'OK', cls: 'btn-primary', focus: true }]);
  }
  R(function () {
    pendingSessOpen = null;
  });
  function showSessOpenRemainder(pending, opened, loadedHere) {
    var i, html = '', box, note;
    if (loadedHere) { html += '<p>O modelo <b>' + esc(loadedHere) + '</b> foi aberto nesta aba.</p>'; }
    if (opened) { html += '<p>' + opened + ' aba(s) foram abertas. O navegador impediu as outras.</p>'; }
    else { html += '<p>O navegador impediu a abertura das abas.</p>'; }
    html += '<p>Clique em cada botão abaixo para abrir o modelo. Para abrir todas de uma vez da próxima vez, permita pop-ups para este arquivo.</p>';
    html += '<div class="sess-open-list">';
    for (i = 0; i < pending.length; i++) {
      html += '<button type="button" class="btn btn-primary sess-open-one" data-so="' + i + '">Abrir ' + esc(pending[i].name) + '</button>';
    }
    html += '</div><p id="sessOpenNote" class="sess-open-note" hidden></p>';
    pendingSessOpen = pending;
    modal('Abrir sessão', html, [{ label: 'Fechar' }]);
    box = document.querySelector('#modal .sess-open-list');
    if (!box) { return; }
    on(box, 'click', function (e) {
      var b = closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-so') !== null; });
      var i2, item, w2;
      if (!b || b.disabled) { return; }
      i2 = +b.getAttribute('data-so');
      item = pendingSessOpen && pendingSessOpen[i2];
      if (!item) { return; }
      w2 = tryOpenTab(item.name, item.id, item.ord || now());
      note = $('sessOpenNote');
      if (isNewWin(w2)) {
        b.disabled = true;
        b.innerHTML = 'Aberto: ' + esc(item.name);
        if (note) { note.hidden = true; note.innerHTML = ''; }
      } else if (note) {
        note.hidden = false;
        note.innerHTML = 'Esta aba ainda não abriu. Clique de novo no botão, ou permita pop-ups para este arquivo.';
      }
    });
  }
  function openSession(se) {
    try { openSessionInner(se); }
    catch (eS) {
      sessMsg('Não foi possível abrir a sessão', '<p>Algo falhou ao abrir as abas. Tente de novo. Se o navegador pedir, permita pop-ups para este arquivo.</p>');
    }
  }
  function openSessionInner(se) {
    var names = (se && se.models) || [], ids = (se && se.ids) || [], list = [], listIds = [], i, md, n, seen = {};
    var hereName = '', cur, empty = false, base, start, pending, w, opened, ord, loadedHere;
    if (!names || names.length === undefined) { names = []; }
    if (!ids || ids.length === undefined) { ids = []; }
    n = names.length > ids.length ? names.length : ids.length;
    for (i = 0; i < n; i++) {
      md = resolveSessModel(ids[i], names[i]);
      if (!md || seen[md.name]) { continue; }
      seen[md.name] = true;
      list.push(md.name); listIds.push(md.id);
    }
    if (!list.length) {
      sessMsg('Não foi possível abrir a sessão', '<p>Nenhum modelo desta sessão existe no banco atual.</p>');
      return;
    }
    cur = S.activeModelId ? getModel(S.activeModelId) : null;
    if (cur) { hereName = cur.name; }
    try { empty = trim(lineText(editor)) === ''; } catch (eE) { empty = false; }
    /* sessão antiga com um só modelo, que já é o desta aba: antes não aparecia nada */
    if (!empty && list.length === 1 && hereName && list[0] === hereName) {
      sessMsg('Sessão já aberta', '<p>Essa sessão só tem este modelo, que já está nesta aba: <b>' + esc(list[0]) + '</b>.</p>');
      return;
    }
    base = now();
    start = 0;
    loadedHere = null;
    if (empty) {
      UI.TAB_ORD = base;
      useModel(resolveSessModel(listIds[0], list[0]), true);
      loadedHere = list[0];
      start = 1;
    } else if (hereName && list[0] === hereName) {
      start = 1;   /* já está nesta aba com conteúdo: não abre cópia; abre o resto */
    }
    if (start >= list.length) {
      sessMsg('Sessão aberta', '<p>O modelo <b>' + esc(list[0]) + '</b> foi aberto nesta aba.</p>');
      return;
    }
    pending = []; opened = 0;
    for (i = start; i < list.length; i++) {
      ord = base + i;
      w = tryOpenTab(list[i], listIds[i], ord);
      if (isNewWin(w)) { opened += 1; }
      else { pending.push({ name: list[i], id: listIds[i], ord: ord }); }
    }
    if (pending.length) { showSessOpenRemainder(pending, opened, loadedHere); }
    else if (loadedHere && !opened) {
      sessMsg('Sessão aberta', '<p>O modelo <b>' + esc(loadedHere) + '</b> foi aberto nesta aba.</p>');
    }
  }
  function saveSessionDialog() {
    modal('Salvar sessão de abas', '<p id="sessWait">Detectando abas abertas&#8230;</p>', [
      { label: 'Cancelar' }
    ]);
    probeLiveTabs(function (recs) {
      var li = '', i, body;
      if ($('modalBack').hidden || !$('sessWait')) { return; }
      if (!recs.length) { closeModal(); toast('Nenhuma aba com modelo aberto.'); return; }
      pendingSessRecs = recs;
      for (i = 0; i < recs.length; i++) {
        li += '<li><label class="chk"><input type="checkbox" id="sessCb' + i + '" checked> ' + esc(recs[i].name) + '</label></li>';
      }
      body = '<label>Nome da sessão<input type="text" id="sessName" autocomplete="off"></label><ol class="sess-ol">' + li + '</ol>';
      modal('Salvar sessão de abas', body, [
        { label: 'Cancelar' },
        { label: 'Salvar', cls: 'btn-primary', id: 'sessSave', click: function () {
          var nm = trim($('sessName').value); if (!nm) { $('sessName').focus(); return false; }
          var recs2 = pendingSessRecs || [], names2 = [], ids2 = [], r, cb;
          for (r = 0; r < recs2.length; r++) {
            cb = $('sessCb' + r);
            if (cb && !cb.checked) { continue; }
            names2.push(recs2[r].name); ids2.push(recs2[r].id);
          }
          if (!names2.length) { toast('Marque pelo menos um modelo.'); return false; }
          var a = sessList().slice(0), j, put = false;
          for (j = 0; j < a.length; j++) { if (a[j] && a[j].name === nm) { a[j] = { name: nm, models: names2, ids: ids2 }; put = true; } }
          if (!put) { a.push({ name: nm, models: names2, ids: ids2 }); }
          UStore.set('tabSessions', a); toast('Sessão salva: ' + nm);
        } }
      ]);
      on($('sessName'), 'keydown', function (e) { if (e.keyCode === 13) { e.preventDefault(); $('sessSave').click(); } });
    });
  }
  R(function () {
    sessMenu = null;
  });
  function closeSessMenu() { if (sessMenu && sessMenu.parentNode) { sessMenu.parentNode.removeChild(sessMenu); } sessMenu = null; }
  function showSessMenu() {
    if (sessMenu) { closeSessMenu(); return; }
    var a = sessList(), h = '', i, b = $('btnSess'), r = b.getBoundingClientRect();
    for (i = 0; i < a.length; i++) {
      if (!a[i] || !a[i].name) { continue; }
      h += '<div class="sm-i" data-si="' + i + '" title="' + esc((a[i].models || []).join('\n')) + '"><span class="sm-n">' + esc(a[i].name) + '</span>' +
        '<button type="button" class="sm-x" data-sx="' + i + '" title="Excluir sessão" aria-label="Excluir sessão">&#215;</button></div>';
    }
    if (h) { h += '<div class="sm-sep"></div>'; }
    h += '<div class="sm-i" data-ssave="1"><span class="sm-n">Salvar abas abertas&#8230;</span></div>';
    sessMenu = document.createElement('div'); sessMenu.className = 'sess-menu'; sessMenu.id = 'sessMenu'; sessMenu.innerHTML = h;
    document.body.appendChild(sessMenu);
    sessMenu.style.top = Math.round(r.bottom + 2) + 'px';
    sessMenu.style.left = Math.round(Math.max(4, Math.min(r.left, (window.innerWidth || 800) - sessMenu.offsetWidth - 4))) + 'px';
    on(sessMenu, 'click', function (e) {
      var x = closest(e.target, function (n) { return n.getAttribute && n.getAttribute('data-sx') !== null; }),
        it = closest(e.target, function (n) { return n.getAttribute && (n.getAttribute('data-si') !== null || n.getAttribute('data-ssave') !== null); });
      var all = sessList();
      if (x) { var k = +x.getAttribute('data-sx'), se = all[k]; closeSessMenu(); if (!se) { return; }
        confirmModal('Excluir sessão', 'Excluir a sessão "' + se.name + '"?', 'Excluir', function () {
          var c = sessList().slice(0), q; for (q = 0; q < c.length; q++) { if (c[q] && c[q].name === se.name) { c.splice(q, 1); break; } }
          UStore.set('tabSessions', c); }, true); return; }
      if (!it) { return; }
      if (it.getAttribute('data-ssave') !== null) { closeSessMenu(); saveSessionDialog(); return; }
      var s2 = all[+it.getAttribute('data-si')];
      /* abre a 1ª aba ainda neste clique (gesto); só então fecha o menu — se fechar antes,
         o Edge/Chrome podem anular o window.open e não mostrar nem o ícone de pop-up */
      if (s2) { openSession(s2); }
      else { sessMsg('Não foi possível abrir a sessão', '<p>Essa sessão não foi encontrada.</p>'); }
      closeSessMenu();
    });
  }
  R(function () {
    on($('btnSess'), 'click', function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } showSessMenu(); });
    /* fecha o menu no clique fora (não no mousedown: remover o item antes do click cancela o clique) */
    on(document, 'click', function (e) { if (sessMenu && !closest(e.target, function (n) { return n === sessMenu || n.id === 'btnSess'; })) { closeSessMenu(); } });
    on(document, 'keydown', function (e) { if (sessMenu && e.keyCode === 27) { closeSessMenu(); } });
    setInterval(updTitle, 1000);
    window.UFSess = { list: sessList, open: openSession, openTabsModels: openTabsModels, openTabsRecords: openTabsRecords, probeLiveTabs: probeLiveTabs, findModelByName: findModelByName, updTitle: updTitle, enqueueSessOpen: enqueueSessOpen, tabUrl: tabUrl };
  });

  return function () {   /* liga os nomes de outros arquivos (antes de rodar qualquer parte) */
    $ = UI.$; on = UI.on; esc = UI.esc; closest = UI.closest; trim = UI.trim; now = UI.now; toast = UI.toast;
    S = UI.S; editor = UI.editor; modal = UI.modal; closeModal = UI.closeModal; confirmModal = UI.confirmModal;
    getModel = UI.getModel; lineText = UI.lineText; tabsMap = UI.tabsMap; stayMap = UI.stayMap;
    enqueueSessOpen = UI.enqueueSessOpen; saveDraft = UI.saveDraft; useModel = UI.useModel;
  };
});
