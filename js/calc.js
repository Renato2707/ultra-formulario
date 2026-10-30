/* UFCalc — painel de calculadoras (etapa C1). ES5 estrito, sem dependências.
   Seções são módulos registrados: UFCalc.register({ id, title, build: function (bodyEl, api) {} }).
   Nesta entrega: calculadora livre (4 operações) e "IG relatada". Nenhuma fórmula clínica. */
var UFCalc = (function () {
  'use strict';
  var mods = [], built = false, root = null, igDays = null, igSubs = [];

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el.addEventListener) { el.addEventListener(ev, fn, false); } else { el.attachEvent('on' + ev, fn); } }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (txt != null) { e.appendChild(document.createTextNode(txt)); } return e; }
  function noFocusSteal(e) { if (e.preventDefault) { e.preventDefault(); } else { e.returnValue = false; } }

  /* ---------- formatação numérica ---------- */
  function plain(n) {           /* número -> texto sem notação científica, ponto decimal */
    var s = String(n), m, mant, ex, neg = '', ip, fp, digits, pos;
    m = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(s);
    if (!m) { return s; }
    neg = m[1]; ip = m[2]; fp = m[3] || ''; ex = parseInt(m[4], 10);
    digits = ip + fp; pos = ip.length + ex; mant = '';
    if (pos <= 0) { mant = '0.' + new Array(1 - pos).join('0') + digits; }
    else if (pos >= digits.length) { mant = digits + new Array(pos - digits.length + 1).join('0'); }
    else { mant = digits.slice(0, pos) + '.' + digits.slice(pos); }
    return neg + mant;
  }
  function fmt(n) {
    if (typeof n !== 'number' || !isFinite(n)) { return 'erro'; }
    var r = Number(n.toPrecision(10));
    if (r === 0) { return '0'; }
    var s = plain(r);
    if (s.indexOf('.') >= 0) { s = s.replace(/0+$/, '').replace(/\.$/, ''); }
    return s.replace('.', ',');
  }
  function parseNum(s) {        /* aceita vírgula ou ponto */
    s = String(s == null ? '' : s).replace(/^\s+|\s+$/g, '').replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) { return null; }
    return parseFloat(s);
  }

  /* ---------- calculadora livre (execução da esquerda para a direita) ---------- */
  function Calc() { this.clear(); }
  Calc.prototype.clear = function () { this.acc = null; this.op = null; this.cur = '0'; this.fresh = true; this.err = false; this.expr = ''; };
  Calc.prototype.digit = function (d) {
    if (this.err) { this.clear(); }
    if (this.fresh) { this.cur = '0'; this.fresh = false; }
    if (d === '.') { if (this.cur.indexOf('.') < 0) { this.cur += '.'; } return; }
    if (this.cur.replace(/[^0-9]/g, '').length >= 15) { return; }
    this.cur = this.cur === '0' ? d : (this.cur === '-0' ? '-' + d : this.cur + d);
  };
  Calc.prototype.back = function () {
    if (this.err) { this.clear(); return; }
    if (this.fresh) { return; }
    this.cur = this.cur.length > 1 ? this.cur.slice(0, -1) : '0';
    if (this.cur === '-' || this.cur === '') { this.cur = '0'; }
  };
  function apply(a, op, b) {
    if (op === '+') { return a + b; } if (op === '-') { return a - b; }
    if (op === '*') { return a * b; } if (op === '/') { return b === 0 ? NaN : a / b; }
    return b;
  }
  Calc.prototype.value = function () { return parseFloat(this.cur === '.' ? '0' : this.cur); };
  Calc.prototype.operator = function (op) {
    if (this.err) { this.clear(); }
    if (this.op && this.fresh) { this.op = op; this.expr = fmt(this.acc) + ' ' + SYM[op]; return; }
    var v = this.value();
    this.acc = this.op ? apply(this.acc, this.op, v) : v;
    if (!isFinite(this.acc)) { this.err = true; this.cur = 'erro'; this.op = null; this.expr = ''; this.fresh = true; return; }
    this.acc = Number(this.acc.toPrecision(15));
    this.op = op; this.cur = plain(Number(this.acc.toPrecision(10))); this.fresh = true; this.expr = fmt(this.acc) + ' ' + SYM[op];
  };
  Calc.prototype.equals = function () {
    if (this.err || !this.op) { this.fresh = true; return; }
    var v = this.value(), a = fmt(this.acc), r = apply(this.acc, this.op, v);
    this.expr = a + ' ' + SYM[this.op] + ' ' + fmt(v) + ' =';
    this.op = null; this.acc = null; this.fresh = true;
    if (!isFinite(r)) { this.err = true; this.cur = 'erro'; return; }
    this.cur = plain(Number(r.toPrecision(10)));
  };
  Calc.prototype.display = function () { return this.err ? 'erro' : (this.fresh ? fmt(parseFloat(this.cur)) : this.cur.replace('.', ',')); };
  var SYM = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };

  function buildCalc(body) {
    var c = new Calc(), box = el('div', 'uc-calc'), expr = el('div', 'uc-expr'), disp = el('div', 'uc-disp', '0'), keys = el('div', 'uc-keys'), i, b;
    box.setAttribute('tabindex', '0'); box.setAttribute('title', 'Teclado: 0-9 , . + - * / Enter Backspace Esc');
    disp.setAttribute('aria-live', 'polite'); disp.id = 'ucDisp'; expr.id = 'ucExpr';
    function show() { disp.innerHTML = ''; disp.appendChild(document.createTextNode(c.display())); expr.innerHTML = ''; expr.appendChild(document.createTextNode(c.expr || '\u00a0')); }
    function act(k) {
      if (/^[0-9]$/.test(k) || k === '.') { c.digit(k); }
      else if (SYM[k]) { c.operator(k); } else if (k === '=') { c.equals(); }
      else if (k === 'C') { c.clear(); } else if (k === 'B') { c.back(); }
      show();
    }
    var L = [['C', 'C', 'uc-fn'], ['B', '\u232b', 'uc-fn'], ['/', '\u00f7', 'uc-op'], ['*', '\u00d7', 'uc-op'],
      ['7', '7'], ['8', '8'], ['9', '9'], ['-', '\u2212', 'uc-op'],
      ['4', '4'], ['5', '5'], ['6', '6'], ['+', '+', 'uc-op'],
      ['1', '1'], ['2', '2'], ['3', '3'], ['=', '=', 'uc-eq'],
      ['0', '0', 'uc-zero'], ['.', ',']];
    for (i = 0; i < L.length; i++) {
      b = el('button', 'uc-k' + (L[i][2] ? ' ' + L[i][2] : ''), L[i][1]); b.type = 'button'; b.setAttribute('data-k', L[i][0]); b.setAttribute('tabindex', '-1');
      keys.appendChild(b);
    }
    /* mousedown: não tira o foco/seleção do laudo; foca a calculadora (o laudo guarda o cursor em savedRange) */
    on(keys, 'mousedown', function (e) { var t = e.target || e.srcElement; if (t && t.getAttribute && t.getAttribute('data-k')) { noFocusSteal(e); } });
    on(keys, 'click', function (e) { var t = e.target || e.srcElement; if (t && t.getAttribute && t.getAttribute('data-k')) { act(t.getAttribute('data-k')); } });
    on(box, 'keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) { return; }
      var k = e.key, kc = e.keyCode, m = null;
      if (k && k.length === 1 && /[0-9+\-*\/.,=]/.test(k)) { m = k === ',' ? '.' : k; }
      else if (k === 'Enter' || kc === 13) { m = '='; } else if (k === 'Backspace' || kc === 8) { m = 'B'; }
      else if (k === 'Escape' || k === 'Esc' || kc === 27) { m = 'C'; } else if (k === 'Delete' || k === 'Del' || kc === 46) { m = 'C'; }
      else if (k === 'Add') { m = '+'; } else if (k === 'Subtract') { m = '-'; } else if (k === 'Multiply') { m = '*'; } else if (k === 'Divide') { m = '/'; } else if (k === 'Decimal') { m = '.'; }
      if (m === null) { return; }
      if (e.preventDefault) { e.preventDefault(); } if (e.stopPropagation) { e.stopPropagation(); }
      act(m);
    });
    box.appendChild(expr); box.appendChild(disp); box.appendChild(keys); body.appendChild(box);
    show();
    return { calc: c, box: box, press: act, show: show };
  }

  /* ---------- IG relatada (só nesta janela/documento; nada é gravado) ---------- */
  function readIg(wS, dS) {
    wS = String(wS).replace(/^\s+|\s+$/g, ''); dS = String(dS).replace(/^\s+|\s+$/g, '');
    if (wS === '' && dS === '') { return { days: null, ok: true }; }
    if (!/^\d{1,2}$/.test(wS) || (dS !== '' && !/^\d$/.test(dS))) { return { days: null, ok: false }; }
    var w = parseInt(wS, 10), d = dS === '' ? 0 : parseInt(dS, 10);
    if (w > 45 || d > 6) { return { days: null, ok: false }; }
    return { days: w * 7 + d, ok: true };
  }
  function buildIg(body) {
    var row = el('div', 'uc-igrow'), w = el('input', 'uc-num'), d = el('input', 'uc-num'), msg = el('div', 'uc-msg');
    w.type = 'text'; d.type = 'text'; w.id = 'ucIgW'; d.id = 'ucIgD'; w.maxLength = 2; d.maxLength = 1;
    w.setAttribute('inputmode', 'numeric'); d.setAttribute('inputmode', 'numeric'); w.setAttribute('autocomplete', 'off'); d.setAttribute('autocomplete', 'off');
    w.setAttribute('aria-label', 'IG relatada: semanas (0 a 45)'); d.setAttribute('aria-label', 'IG relatada: dias (0 a 6)');
    msg.id = 'ucIgMsg';
    row.appendChild(w); row.appendChild(el('span', 'uc-u', 'sem')); row.appendChild(d); row.appendChild(el('span', 'uc-u', 'dias'));
    function upd() {
      var r = readIg(w.value, d.value), old = igDays;
      igDays = r.days;
      w.className = d.className = 'uc-num' + (r.ok ? '' : ' uc-bad');
      msg.innerHTML = ''; if (!r.ok) { msg.appendChild(document.createTextNode('Semanas 0 a 45, dias 0 a 6.')); }
      if (old !== igDays) { fireIg(); }
    }
    on(w, 'input', upd); on(d, 'input', upd); on(w, 'keyup', upd); on(d, 'keyup', upd); on(w, 'change', upd); on(d, 'change', upd);
    body.appendChild(row); body.appendChild(msg);
    api._igSet = function (ws, ds) { w.value = ws == null ? '' : String(ws); d.value = ds == null ? '' : String(ds); upd(); };
  }
  function fireIg() {
    var i, v = igDays;
    for (i = 0; i < igSubs.length; i++) { try { igSubs[i](v); } catch (e) { if (window.console) { window.console.error(e); } } }
  }

  /* ---------- painel ---------- */
  /* C6c: cada calculadora é um cartão recolhível (acordeão); o estado aberto/fechado fica neste navegador */
  var FOLD_KEY = 'ufCalcFold', fold = {}, cards = {};
  try { fold = JSON.parse(window.localStorage.getItem(FOLD_KEY) || '{}') || {}; } catch (e) { fold = {}; }
  function saveFold() { try { window.localStorage.setItem(FOLD_KEY, JSON.stringify(fold)); } catch (e) { /* sem armazenamento */ } }
  function setOpen(id, open) {
    var c = cards[id]; if (!c) { return; }
    c.sec.className = 'uc-sec uc-card' + (open ? ' open' : '');
    c.b.style.display = open ? '' : 'none'; c.h.setAttribute('aria-expanded', open ? 'true' : 'false');
    c.chev.innerHTML = open ? '\u25be' : '\u25b8';
  }
  function addSection(m) {
    var sec = el('section', 'uc-sec uc-card'), h = el('button', 'uc-h'), chev = el('span', 'uc-chev'), t = el('span', 'uc-t', m.title), badge = el('span', 'uc-badge'), b = el('div', 'uc-b');
    h.type = 'button'; b.id = 'ucB-' + m.id; h.setAttribute('aria-controls', b.id);
    h.appendChild(chev); h.appendChild(t); h.appendChild(badge);
    sec.setAttribute('data-calc', m.id); sec.appendChild(h); sec.appendChild(b); root.appendChild(sec);
    cards[m.id] = { sec: sec, h: h, b: b, chev: chev, badge: badge };
    on(h, 'mousedown', noFocusSteal);
    on(h, 'click', function () { var o = !/(^|\s)open(\s|$)/.test(sec.className); fold[m.id] = o ? 1 : 0; saveFold(); setOpen(m.id, o); });
    setOpen(m.id, fold[m.id] == null ? m.open !== false : !!fold[m.id]);
    m.build(b, api);
  }
  function setBadge(id, txt, cls) {
    var c = cards[id]; if (!c) { return; }
    c.badge.innerHTML = ''; if (txt) { c.badge.appendChild(document.createTextNode(txt)); }
    c.badge.className = 'uc-badge' + (cls ? ' ' + cls : '');
  }
  /* mudanças no laudo (digitação, escolha de opção, modelo carregado): avisa os módulos, agrupado */
  var edSubs = [], edTimer = null;
  function fireEd() { edTimer = null; for (var i = 0; i < edSubs.length; i++) { try { edSubs[i](); } catch (e) { if (window.console) { window.console.error(e); } } } }
  function edChanged() { if (!edTimer) { edTimer = setTimeout(fireEd, 60); } }
  function watchEditor() {
    var ed = $('editor'); if (!ed) { return; }
    on(ed, 'input', edChanged);
    if (window.MutationObserver) { new window.MutationObserver(edChanged).observe(ed, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-v'] }); }
  }
  function register(m) {
    if (!m || !m.id || typeof m.build !== 'function') { return false; }
    for (var i = 0; i < mods.length; i++) { if (mods[i].id === m.id) { return false; } }
    mods.push(m); if (built) { addSection(m); }
    return true;
  }
  function isOpen() { var r = $('right'); return !!r && !/(^|\s)collapsed(\s|$)/.test(r.className); }
  function toggle(want) { var t = $('rightToggle'); if (t && (want == null || want !== isOpen())) { t.click(); } syncBtn(); }
  function syncBtn() { var b = $('btnCalc'); if (b) { b.className = 'tb' + (isOpen() ? ' on' : ''); b.setAttribute('aria-pressed', isOpen() ? 'true' : 'false'); } }
  function init() {
    if (built) { return; }
    var right = $('right'), body = right && right.querySelector('.rbody'), i, btn, ref;
    if (!body) { return; }
    body.innerHTML = ''; root = el('div', 'uc-root'); body.appendChild(root); built = true;
    for (i = 0; i < mods.length; i++) { addSection(mods[i]); }
    watchEditor();
    /* botão discreto na barra: abre/fecha o mesmo painel lateral (mesma lógica e preferência do botão do painel) */
    ref = $('btnClear');
    if (ref && !$('btnCalc')) {
      btn = el('button', 'tb', '\u00b1'); btn.type = 'button'; btn.id = 'btnCalc';
      btn.title = 'Calculadoras (abrir/fechar painel)'; btn.setAttribute('aria-label', 'Calculadoras');
      on(btn, 'mousedown', noFocusSteal);
      on(btn, 'click', function () { toggle(); });
      ref.parentNode.insertBefore(btn, ref);
    }
    on($('rightToggle'), 'click', function () { setTimeout(syncBtn, 0); });
    on($('rightToggle'), 'mousedown', noFocusSteal);
    syncBtn();
  }

  var api = {
    register: register, init: init, open: function () { toggle(true); }, close: function () { toggle(false); }, toggle: function () { toggle(); }, isOpen: isOpen,
    /* IG relatada: total em dias, ou null se vazio/inválido */
    getIgRelatada: function () { return igDays; },
    onIgChange: function (fn) { if (typeof fn === 'function') { igSubs.push(fn); } return function () { for (var i = 0; i < igSubs.length; i++) { if (igSubs[i] === fn) { igSubs.splice(i, 1); return; } } }; },
    setIgRelatada: function (w, d) { if (api._igSet) { api._igSet(w, d); } },
    setBadge: setBadge, setOpen: setOpen,
    onEditorChange: function (fn) { if (typeof fn === 'function') { edSubs.push(fn); } },
    format: fmt, parseNum: parseNum, _calc: null
  };
  register({ id: 'livre', title: 'Calculadora', build: function (b) { api._calc = buildCalc(b); } });
  register({ id: 'ig', title: 'IG relatada', build: buildIg });
  return api;
})();
window.UFCalc = UFCalc;
