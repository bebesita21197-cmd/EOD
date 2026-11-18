(function () {
  'use strict';

  const R = () => window.EODRender;

  // ---- Fixed settings ----------------------------------------------------
  const DEFAULT_NAME = '';
  const PRESET_PLATFORMS = ['Linking', 'Host', 'Internet', 'Telegram', 'Twitter', 'Facebook', 'YouTube'];
  const DEFAULT_SELECTED = ['Internet'];
  const DEFAULT_ADDITIONAL = '';
  const MAX_XC = 6;   // extra columns ki limit (base 4 + 6 = 10)
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  // Base columns: inka naam fixed hai, par order badal sakte ho. rule = Grand Total auto rule ('max' / 'sum')
  const BASE_COLS = [
    { id: 'b0', name: 'Title Scaned', rule: 'sum' },
    { id: 'b1', name: 'Title Found', rule: 'sum' },
    { id: 'b2', name: 'URL', rule: 'sum' },
    { id: 'b3', name: 'Channel/Domain', rule: 'sum' }
  ];
  const defaultColumns = () => BASE_COLS.map((c) => ({ id: c.id, name: c.name, base: true, rule: c.rule }));

  // Ready colours (Style > Colour me chhote dots)
  const SWATCHES = [
    { h: 209, s: 59, l: 30 }, { h: 174, s: 70, l: 28 }, { h: 145, s: 55, l: 28 }, { h: 84, s: 55, l: 28 },
    { h: 42, s: 85, l: 34 }, { h: 24, s: 80, l: 38 }, { h: 355, s: 65, l: 40 }, { h: 335, s: 65, l: 40 },
    { h: 295, s: 45, l: 38 }, { h: 265, s: 50, l: 40 }, { h: 235, s: 55, l: 38 }, { h: 215, s: 20, l: 32 }
  ];

  const FONT_SECTIONS = [
    ['title', 'Title'], ['header', 'Header'], ['rows', 'Rows'], ['additional', 'Additional'], ['grand', 'Grand Total']
  ];
  const TOGGLES = [
    ['showNo', 'Row number'], ['showBar', 'Row ki rang-patti'], ['showTint', 'Cell ka halka rang'],
    ['showLines', 'Beech ki lines'], ['showAdd', 'Additional Work row'], ['showGrand', 'Grand Total row']
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mapSec = (v) => { const f = {}; FONT_SECTIONS.forEach((x) => { f[x[0]] = v; }); return f; };
  const defaultFonts = () => mapSec('cambria');
  const defaultSizes = () => mapSec(100);
  const defaultBold = () => mapSec(true);
  const defaultStyle = () => Object.assign({}, R().DEFAULT_STYLE);

  // ---- State -------------------------------------------------------------
  const state = {
    platforms: PRESET_PLATFORMS.map((n) => ({ name: n, on: DEFAULT_SELECTED.indexOf(n) !== -1, vals: [] })),
    others: [],
    grand: [],
    columns: defaultColumns(),
    color: null,   // null = example wala default colour, warna {h,s,l}
    fonts: defaultFonts(),
    sizes: defaultSizes(),
    bold: defaultBold(),
    style: null,
    name: DEFAULT_NAME,
    multi: true
  };

  // User ne "Set as default" se jo design save kiya (null = original design)
  let userDesign = null;

  const ncols = () => state.columns.length;
  const colLabel = (c, i) => (c.base ? c.name : (String(c.name || '').trim() || 'Column ' + (i + 1)));
  const cols = () => state.columns.map(colLabel);
  const cleanN = (a, n) => (Array.isArray(a)
    ? Array.from({ length: n }, (_, i) => String(a[i] == null ? '' : a[i]))
    : new Array(n).fill(''));
  const emptyN = () => new Array(ncols()).fill('');
  const perRow = (n) => (n <= 5 ? n : Math.ceil(n / 2));
  function normalizeVals() {
    const n = ncols();
    state.platforms.forEach((p) => { p.vals = cleanN(p.vals, n); });
    state.others.forEach((p) => { p.vals = cleanN(p.vals, n); });
    state.grand = cleanN(state.grand, n);
  }

  // Saved columns ko saaf karo. Purane format (extraCols) ko bhi samajhta hai.
  function colsFromSnap(s) {
    const base = defaultColumns();
    if (s && Array.isArray(s.columns) && s.columns.length) {
      const seen = {};
      let extras = 0;
      const out = [];
      s.columns.forEach((c) => {
        if (!c || typeof c.id !== 'string' || seen[c.id]) return;
        const b = BASE_COLS.find((x) => x.id === c.id);
        if (b) { out.push({ id: b.id, name: b.name, base: true, rule: b.rule }); seen[c.id] = 1; return; }
        if (extras >= MAX_XC) return;
        extras++; seen[c.id] = 1;
        out.push({ id: c.id, name: String(c.name == null ? '' : c.name), base: false, rule: c.rule === 'max' ? 'max' : 'sum' });
      });
      return out.length ? out : base;
    }
    const xc = s && Array.isArray(s.extraCols) ? s.extraCols.slice(0, MAX_XC) : [];
    return base.concat(xc.map((n, j) => ({ id: 'x' + (j + 1), name: String(n == null ? '' : n), base: false, rule: 'sum' })));
  }
  function newColId() {
    let k = 1;
    while (state.columns.some((c) => c.id === 'x' + k)) k++;
    return 'x' + k;
  }

  const $ = (id) => document.getElementById(id);
  const chipsEl = $('chips');
  const cardsEl = $('cards');
  const grandEl = $('grand');
  const canvas = $('out');
  const stage = $('stage');
  const toast = $('toast');
  let toastTimer = null;
  let generated = false;

  function el(tag, attrs, text) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }

  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ---- Date --------------------------------------------------------------
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(iso) {
    const p = String(iso || todayISO()).split('-').map(Number);
    return String(p[2]).padStart(2, '0') + ' ' + MONTHS[p[1] - 1] + ' ' + p[0];
  }

  // ---- Style helpers -----------------------------------------------------
  // Kisi bhi (purane ya naye) saved style ko safe style me badalta hai
  function cleanStyle(raw) {
    const d = defaultStyle();
    const out = Object.assign({}, d);
    if (!raw || typeof raw !== 'object') return out;
    const NUM = { spread: [0, 100], rowH: [28, 60], rowGap: [0, 30], radius: [0, 24], shadow: [0, 150] };
    Object.keys(NUM).forEach((k) => {
      const n = +raw[k];
      if (raw[k] != null && isFinite(n)) out[k] = clamp(n, NUM[k][0], NUM[k][1]);
    });
    Object.keys(d).forEach((k) => { if (typeof d[k] === 'boolean' && typeof raw[k] === 'boolean') out[k] = raw[k]; });
    if (R().HARMONIES.some((h) => h.id === raw.harmony)) out.harmony = raw.harmony;
    if (['white', 'tint', 'grey'].indexOf(raw.bg) !== -1) out.bg = raw.bg;
    if ([1, 2, 3].indexOf(+raw.scale) !== -1) out.scale = +raw.scale;
    if (raw.nameAlign === 'left' || raw.nameAlign === 'center') out.nameAlign = raw.nameAlign;
    return out;
  }
  state.style = defaultStyle();

  const curHSL = () => state.color || R().DEFAULT_HSL;
  // Multi colour ke 8 rang: sirf main colour se bante hain. Multi band = sab ek hi rang.
  function paletteFor(color, style, multi) {
    const c = color || R().DEFAULT_HSL;
    const pal = R().makePalette(c, style.harmony, style.spread);
    if (multi === false) return new Array(8).fill(R().makePalette(c, 'shades', 0)[0]);
    return pal;
  }

  // ---- UI building -------------------------------------------------------
  function activeList() {
    return state.platforms.filter((p) => p.on).concat(state.others);
  }

  function renderChips() {
    chipsEl.textContent = '';
    state.platforms.forEach((p) => {
      const b = el('button', { type: 'button', class: 'chip' + (p.on ? ' on' : '') }, p.name);
      b.addEventListener('click', () => { p.on = !p.on; renderChips(); renderCards(false); });
      chipsEl.appendChild(b);
    });
    const add = el('button', { type: 'button', class: 'chip add' }, '+ Other');
    add.addEventListener('click', () => {
      state.others.push({ name: '', vals: emptyN(), other: true });
      renderCards(true);
    });
    chipsEl.appendChild(add);
    scheduleFit();
  }

  function makeCard(p) {
    const card = el('div', { class: 'card' });
    const head = el('div', { class: 'card-head' });

    if (p.other) {
      const nameIn = el('input', { type: 'text', placeholder: 'Platform ka naam likho', 'data-other-name': '1', 'data-col': '-1' });
      nameIn.value = p.name;
      nameIn.addEventListener('input', () => { p.name = nameIn.value; });
      head.appendChild(nameIn);
      const rm = el('button', { type: 'button', class: 'x', title: 'Hatao' }, '×');
      rm.addEventListener('click', () => {
        state.others.splice(state.others.indexOf(p), 1);
        renderCards(false);
      });
      head.appendChild(rm);
    } else {
      head.appendChild(el('div', { class: 'card-title' }, p.name));
    }
    card.appendChild(head);

    const names = cols();
    const grid = el('div', { class: 'grid4' });
    grid.style.gridTemplateColumns = 'repeat(' + perRow(names.length) + ', minmax(0, 1fr))';
    names.forEach((c, i) => {
      const cell = el('div', { class: 'cell', style: '--cc: var(--m' + (i % 8) + ')' });
      cell.appendChild(el('label', { 'data-ci': String(i), title: c }, c));
      const inp = el('input', { type: 'text', inputmode: 'numeric', 'data-col': String(i) });
      inp.value = p.vals[i];
      inp.addEventListener('input', () => { p.vals[i] = inp.value; updateGrandPlaceholders(); });
      cell.appendChild(inp);
      grid.appendChild(cell);
    });
    card.appendChild(grid);
    return card;
  }

  function renderCards(focusLastOther) {
    cardsEl.textContent = '';
    cardsEl.style.setProperty('--nc', String(ncols()));
    const list = activeList();
    if (!list.length) {
      cardsEl.appendChild(el('div', { class: 'empty-note' }, 'Upar se koi platform chuno ya + Other dabao.'));
    }
    list.forEach((p) => cardsEl.appendChild(makeCard(p)));
    updateGrandPlaceholders();
    scheduleFit();
    if (focusLastOther) {
      const ins = cardsEl.querySelectorAll('[data-other-name]');
      if (ins.length) ins[ins.length - 1].focus();
    }
  }

  function buildGrandInputs() {
    grandEl.textContent = '';
    const names = cols();
    grandEl.style.gridTemplateColumns = 'repeat(' + perRow(names.length) + ', minmax(0, 1fr))';
    names.forEach((c, i) => {
      const cell = el('div', { class: 'cell', style: '--cc: var(--m' + (i % 8) + ')' });
      cell.appendChild(el('label', { 'data-ci': String(i) }, c));
      const inp = el('input', { type: 'text', inputmode: 'numeric', id: 'grand' + i, 'data-col': String(i) });
      inp.value = state.grand[i] || '';
      inp.addEventListener('input', () => { state.grand[i] = inp.value; });
      cell.appendChild(inp);
      grandEl.appendChild(cell);
    });
  }

  // ---- Data --------------------------------------------------------------
  const toNum = (v) => {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  };

  function autoGrand(list, columns) {
    return columns.map((c, i) => {
      const nums = list.map((p) => toNum(p.vals[i]));
      if (!nums.length) return '0';
      const r = c.rule === 'max' ? Math.max.apply(null, nums) : nums.reduce((a, b) => a + b, 0);
      return String(r);
    });
  }

  function updateGrandPlaceholders() {
    const auto = autoGrand(activeList(), state.columns);
    auto.forEach((v, i) => { const inp = $('grand' + i); if (inp) inp.placeholder = v; });
  }

  // s = snapshot jaisa object (live form ka)
  function dataFrom(s) {
    const columns = colsFromSnap(s);
    const names = columns.map(colLabel);
    const nc = names.length;
    const list = (s.platforms || []).filter((p) => p.on).concat(s.others || []).map((p) => ({ name: p.name, vals: cleanN(p.vals, nc) }));
    const rows = list.map((p, i) => ({
      no: String(i + 1),
      name: String(p.name || '').trim() || 'Other',
      values: p.vals.map((v) => v.trim())
    }));
    const auto = autoGrand(list, columns);
    const g = cleanN(s.grand, nc);
    const grandVals = names.map((_, i) => (g[i].trim() ? g[i].trim() : auto[i]));
    const add = String(s.additional || '').trim();
    return {
      titleLines: [String(s.name || '').trim(), 'EOD : ' + fmtDate(s.date)].filter(Boolean),
      extraHeaders: [],
      headers: ['Search Engine/Plaform'].concat(names),
      rows: rows,
      additional: add ? { label: 'Additional Work', value: add } : null,
      grand: { label: 'Grand Total', values: grandVals }
    };
  }

  function renderSnap(cv, s) {
    const c = s.color && isFinite(s.color.h) && isFinite(s.color.s) && isFinite(s.color.l) ? s.color : null;
    const style = cleanStyle(s.style);
    const multi = s.multi !== false;
    const bold = Object.assign(defaultBold(), s.bold || {});
    const sizes = {};
    FONT_SECTIONS.forEach((x) => { sizes[x[0]] = R().sizePct((s.sizes || {})[x[0]]); });
    R().renderTable(cv, dataFrom(s), {
      scale: style.scale, ai: s.ai !== false, multi: multi, style: style,
      theme: R().makeTheme(c), palette: paletteFor(c, style, multi),
      fonts: Object.assign(defaultFonts(), s.fonts || {}),
      sizes: sizes, bold: bold
    });
  }

  // ---- UI theme: poori app ke rang sirf main colour se ---------------------
  function applyUiTheme() {
    const c = curHSL();
    const pal = paletteFor(state.color, state.style, state.multi);
    const root = document.documentElement.style;
    pal.forEach((h, i) => root.setProperty('--m' + i, h));
    const a1 = R().makePalette(c, 'shades', 0)[0];
    const a1d = R().mix(a1, 'black', 0.22);
    const a1l = R().mix(a1, 'white', 0.2);
    root.setProperty('--a1', a1);
    root.setProperty('--a1-d', a1d);
    root.setProperty('--a2', pal[2]);
    root.setProperty('--a3', pal[1]);
    root.setProperty('--grad-accent', 'linear-gradient(145deg,' + a1l + ',' + a1d + ')');
    root.setProperty('--sh-d', R().hslToHex(c.h, 20, 62));
    root.setProperty('--ink', R().hslToHex(c.h, 30, 21));
    root.setProperty('--muted', R().hslToHex(c.h, 14, 44));
    root.setProperty('--bg-lo', R().hslToHex(c.h, 28, 96));
    const pp = $('palPrev');
    if (pp) {
      pp.textContent = '';
      pal.forEach((h) => { const s = el('i'); s.style.background = h; pp.appendChild(s); });
    }
  }

  // ---- Colour plate ------------------------------------------------------
  function paintPlate() {
    const c = curHSL();
    const th = R().makeTheme(state.color);
    $('hue').value = c.h; $('sat').value = c.s; $('lit').value = c.l;
    $('hueV').textContent = Math.round(c.h) + '°'; $('satV').textContent = Math.round(c.s) + '%'; $('litV').textContent = Math.round(c.l) + '%';
    $('colorPrev').style.background = th.main;
    $('colorHex').textContent = '— ' + th.main.toUpperCase() + (state.color ? '' : ' (default)');
    const hex = (h, sv, l) => R().makeTheme({ h: h, s: sv, l: l }).main;
    $('hue').style.background = 'linear-gradient(to right,' +
      [0, 60, 120, 180, 240, 300, 360].map((h) => hex(h, c.s, c.l)).join(',') + ')';
    $('sat').style.background = 'linear-gradient(to right,' + hex(c.h, 0, c.l) + ',' + hex(c.h, 100, c.l) + ')';
    $('lit').style.background = 'linear-gradient(to right,' + hex(c.h, c.s, 10) + ',' + hex(c.h, c.s, 50) + ')';
    document.querySelectorAll('#swatches .sw').forEach((b, i) => {
      const sw = SWATCHES[i];
      b.classList.toggle('on', sw.h === c.h && sw.s === c.s && sw.l === c.l);
    });
    applyUiTheme();
  }

  function setColor(c) {
    state.color = c;
    paintPlate();
    if (generated) generate();
  }
  function onSlide() {
    setColor({ h: +$('hue').value, s: +$('sat').value, l: +$('lit').value });
  }

  function buildSwatches() {
    const box = $('swatches');
    box.textContent = '';
    SWATCHES.forEach((sw) => {
      const b = el('button', { type: 'button', class: 'sw', title: R().makeTheme(sw).main.toUpperCase() });
      b.style.background = R().makeTheme(sw).main;
      b.addEventListener('click', () => setColor({ h: sw.h, s: sw.s, l: sw.l }));
      box.appendChild(b);
    });
  }

  // ---- Drawer controls ------------------------------------------------------
  function buildSeg(id, key, opts) {
    const box = $(id);
    box.textContent = '';
    opts.forEach((o) => {
      const b = el('button', { type: 'button', class: 'sg' + (state.style[key] === o[0] ? ' on' : '') }, o[1]);
      b.addEventListener('click', () => {
        state.style[key] = o[0];
        Array.prototype.forEach.call(box.children, (x) => x.classList.toggle('on', x === b));
        if (key === 'bg') applyUiTheme();
      });
      box.appendChild(b);
    });
  }

  function buildTypo() {
    const box = $('typo');
    box.textContent = '';
    FONT_SECTIONS.forEach((sec) => {
      const key = sec[0];
      const row = el('div', { class: 'trow' });
      row.appendChild(el('span', { class: 'tname' }, sec[1]));

      const sel = el('select', { class: 'sel', 'data-font': key });
      R().FONTS.forEach((f) => {
        const op = el('option', { value: f.id }, f.name);
        op.style.fontFamily = f.css;
        sel.appendChild(op);
      });
      sel.value = state.fonts[key];
      sel.addEventListener('change', () => { state.fonts[key] = sel.value; });
      row.appendChild(sel);

      const step = el('div', { class: 'step' });
      const val = el('span', { class: 'sv', 'data-size': key }, state.sizes[key] + '%');
      const bump = (d) => {
        state.sizes[key] = clamp(state.sizes[key] + d, R().SIZE_MIN, R().SIZE_MAX);
        val.textContent = state.sizes[key] + '%';
      };
      const minus = el('button', { type: 'button', class: 'sb', title: 'Chhota' }, '−');
      const plus = el('button', { type: 'button', class: 'sb', title: 'Bada' }, '+');
      minus.addEventListener('click', () => bump(-R().SIZE_STEP));
      plus.addEventListener('click', () => bump(R().SIZE_STEP));
      step.appendChild(minus); step.appendChild(val); step.appendChild(plus);
      row.appendChild(step);

      const bb = el('button', { type: 'button', class: 'bb' + (state.bold[key] ? ' on' : ''), title: 'Bold' }, 'B');
      bb.addEventListener('click', () => { state.bold[key] = !state.bold[key]; bb.classList.toggle('on', state.bold[key]); });
      row.appendChild(bb);
      box.appendChild(row);
    });
  }

  function buildToggles() {
    const box = $('toggles');
    box.textContent = '';
    TOGGLES.forEach((t) => {
      const lab = el('label', { class: 'chk tg' });
      const inp = el('input', { type: 'checkbox', 'data-tg': t[0] });
      inp.checked = !!state.style[t[0]];
      inp.addEventListener('change', () => { state.style[t[0]] = inp.checked; });
      lab.appendChild(inp);
      lab.appendChild(el('span', {}, t[1]));
      box.appendChild(lab);
    });
  }

  function syncSliders() {
    document.querySelectorAll('input[data-opt]').forEach((inp) => {
      const k = inp.dataset.opt;
      inp.value = state.style[k];
      const out = inp.parentNode.querySelector('output');
      const unit = k === 'shadow' ? '%' : 'px';
      if (out) out.textContent = state.style[k] + unit;
    });
    $('spread').value = state.style.spread;
    $('spreadV').textContent = state.style.spread + '%';
    $('harmony').value = state.style.harmony;
    $('multi').checked = state.multi;
    $('multiOpts').classList.toggle('off', !state.multi);
  }

  // Poora drawer state se dobara banao (design badalne ke baad)
  function syncStyleUI() {
    buildSeg('bgSeg', 'bg', [['white', 'White'], ['tint', 'Tint'], ['grey', 'Grey']]);
    buildSeg('alignSeg', 'nameAlign', [['center', 'Center'], ['left', 'Left']]);
    buildSeg('scaleSeg', 'scale', [[1, '1x'], [2, '2x'], [3, '3x']]);
    buildTypo();
    buildToggles();
    syncSliders();
    paintPlate();
  }

  function wireStyleControls() {
    const hs = $('harmony');
    R().HARMONIES.forEach((h) => hs.appendChild(el('option', { value: h.id }, h.name)));
    hs.addEventListener('change', () => { state.style.harmony = hs.value; applyUiTheme(); });
    $('spread').addEventListener('input', () => {
      state.style.spread = +$('spread').value;
      $('spreadV').textContent = state.style.spread + '%';
      applyUiTheme();
    });
    $('multi').addEventListener('change', () => {
      state.multi = $('multi').checked;
      $('multiOpts').classList.toggle('off', !state.multi);
      applyUiTheme();
    });
    document.querySelectorAll('input[data-opt]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.opt;
        state.style[k] = +inp.value;
        const out = inp.parentNode.querySelector('output');
        if (out) out.textContent = inp.value + (k === 'shadow' ? '%' : 'px');
      });
    });
    ['hue', 'sat', 'lit'].forEach((id) => $(id).addEventListener('input', onSlide));
    $('colorReset').addEventListener('click', () => setColor(userDesign ? validColor(userDesign.color) : null));
    $('setDefault').addEventListener('click', setAsDefault);
    $('styleReset').addEventListener('click', backToDefault);
    $('factoryReset').addEventListener('click', factoryDesign);
    $('tabs').addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.tab');
      if (!b) return;
      document.querySelectorAll('#tabs .tab').forEach((t) => t.classList.toggle('on', t === b));
      document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
      scheduleFit();
    });
  }

  // ---- Columns: order badlo, kahin bhi nayi column jodo ---------------------
  function afterColsChange(focusIdx) {
    buildGrandInputs();
    renderCards(false);
    buildColStrip();
    applyLayout();
    if (focusIdx != null) {
      const inp = $('colNames').querySelector('input[data-xcol="' + focusIdx + '"]');
      if (inp) inp.focus();
    }
  }

  const allVals = () => state.platforms.concat(state.others);

  // pos = jahan nayi column aani chahiye (0 = sabse pehle, ncols = sabse last)
  function insertColumn(pos) {
    if (state.columns.length - BASE_COLS.length >= MAX_XC) { showToast('Zyada se zyada ' + MAX_XC + ' extra columns', true); return; }
    state.columns.splice(pos, 0, { id: newColId(), name: '', base: false, rule: 'sum' });
    allVals().forEach((p) => p.vals.splice(pos, 0, ''));
    state.grand.splice(pos, 0, '');
    afterColsChange(pos);
  }

  function moveColumn(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.columns.length) return;
    const swap = (a) => { const t = a[i]; a[i] = a[j]; a[j] = t; };
    swap(state.columns);
    allVals().forEach((p) => swap(p.vals));
    swap(state.grand);
    afterColsChange();
    const tag = $('colNames').querySelector('[data-tag="' + j + '"] .mv-' + (d < 0 ? 'u' : 'd'));
    if (tag && !tag.disabled) tag.focus();
  }

  function removeColumn(i) {
    if (state.columns[i].base) return;
    state.columns.splice(i, 1);
    allVals().forEach((p) => p.vals.splice(i, 1));
    state.grand.splice(i, 1);
    afterColsChange();
  }

  function refreshColLabels() {
    const names = cols();
    document.querySelectorAll('.cell label[data-ci]').forEach((l) => { l.textContent = names[+l.dataset.ci] || ''; l.title = l.textContent; });
  }

  function buildColStrip() {
    const box = $('colNames');
    box.textContent = '';
    const n = state.columns.length;
    const full = n - BASE_COLS.length >= MAX_XC;
    $('colAddTop').style.display = full ? 'none' : '';
    state.columns.forEach((c, i) => {
      const t = el('div', { class: 'ctag' + (c.base ? '' : ' extra'), 'data-tag': String(i), style: '--cc: var(--m' + (i % 8) + ')' });
      t.appendChild(el('span', { class: 'cno' }, String(i + 1)));
      if (c.base) {
        t.appendChild(el('span', { class: 'cn' }, c.name));
      } else {
        const inp = el('input', { type: 'text', placeholder: 'Column ' + (i + 1), 'data-xcol': String(i) });
        inp.value = c.name;
        inp.addEventListener('input', () => { c.name = inp.value; refreshColLabels(); });
        t.appendChild(inp);
      }
      const u = el('button', { type: 'button', class: 'mv mv-u', title: 'Upar karo' }, '▲');
      u.disabled = i === 0;
      u.addEventListener('click', () => moveColumn(i, -1));
      t.appendChild(u);
      const d = el('button', { type: 'button', class: 'mv mv-d', title: 'Neeche karo' }, '▼');
      d.disabled = i === n - 1;
      d.addEventListener('click', () => moveColumn(i, 1));
      t.appendChild(d);
      const add = el('button', { type: 'button', class: 'mv add', title: 'Iske neeche nayi column jodo' }, '+');
      if (full) add.style.visibility = 'hidden';
      add.addEventListener('click', () => insertColumn(i + 1));
      t.appendChild(add);
      if (!c.base) {
        const rm = el('button', { type: 'button', class: 'mv rm', title: 'Column hatao' }, '×');
        rm.addEventListener('click', () => removeColumn(i));
        t.appendChild(rm);
      }
      box.appendChild(t);
    });
    scheduleFit();
  }

  // Column badhne par sirf Platform data wala section chauda hota hai
  function applyLayout() {
    $('sheet').style.setProperty('--xc', String(Math.max(0, ncols() - 4)));
    scheduleFit();
  }

  // ---- Har section ko screen me fit karna ----------------------------------
  // Content section se bada ho to zoom chhota karte hain (binary search),
  // taaki kahin scroll na karna pade. Bahut hi zyada ho to hi scroll aata hai.
  const MIN_ZOOM = 0.42;
  function fitBox(holder, box) {
    if (!holder || !box) return 1;
    box.style.zoom = '';
    if (window.innerWidth <= 900) return 1;
    const cs = getComputedStyle(holder);
    const avail = holder.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
    if (!(avail > 0)) return 1;
    const hAt = (z) => { box.style.zoom = String(z); return box.getBoundingClientRect().height; };
    if (hAt(1) <= avail) { box.style.zoom = ''; return 1; }
    if (hAt(MIN_ZOOM) > avail) { box.style.zoom = String(MIN_ZOOM); return MIN_ZOOM; }
    let lo = MIN_ZOOM, hi = 1;
    for (let k = 0; k < 10; k++) {
      const mid = (lo + hi) / 2;
      if (hAt(mid) <= avail) lo = mid; else hi = mid;
    }
    box.style.zoom = String(lo);
    return lo;
  }
  function fitAll() {
    fitBox($('colA'), $('fitA'));
    fitBox($('drawerBody'), $('fitD'));
  }
  let fitRaf = 0;
  function scheduleFit() { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitAll); }

  // ---- Excel jaisa keyboard navigation --------------------------------------
  function navRows() {
    const rows = Array.prototype.map.call(cardsEl.querySelectorAll('.card'),
      (c) => Array.prototype.slice.call(c.querySelectorAll('input[data-col]')));
    rows.push(Array.prototype.slice.call(grandEl.querySelectorAll('input[data-col]')));
    return rows.filter((r) => r.length);
  }
  const pickCol = (row, col) => row.find((i) => +i.dataset.col === col) || (col < 0 ? row[0] : row[row.length - 1]);
  function focusInput(i) { if (i) { i.focus(); i.select(); } }

  function onNavKey(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generate(); return; }
    const t = e.target;
    if (!t || !t.matches || !t.matches('input[data-col]') || e.altKey || e.ctrlKey || e.metaKey) return;
    const rows = navRows();
    const r = rows.findIndex((row) => row.indexOf(t) !== -1);
    if (r < 0) return;
    const row = rows[r];
    const c = row.indexOf(t);
    const col = +t.dataset.col;
    let next = null;
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      next = rows[r + 1] && pickCol(rows[r + 1], col);
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      next = rows[r - 1] && pickCol(rows[r - 1], col);
    } else if (e.key === 'ArrowRight' && !e.shiftKey && t.selectionEnd === t.value.length) {
      next = row[c + 1] || (rows[r + 1] && rows[r + 1][0]);
    } else if (e.key === 'ArrowLeft' && !e.shiftKey && t.selectionStart === 0) {
      next = row[c - 1] || (rows[r - 1] && rows[r - 1][rows[r - 1].length - 1]);
    } else {
      return;
    }
    e.preventDefault();
    focusInput(next);
  }

  // ---- Actions -----------------------------------------------------------
  function generate() {
    renderSnap(canvas, snapshot());
    generated = true;
    stage.classList.remove('hidden');
    $('placeholder').classList.add('hidden');
    fit();
  }

  // Image par click = image clipboard me copy
  async function copyImage() {
    if (!generated) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('unsupported');
      // Promise dene se Safari me bhi chalta hai
      const blobP = new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      showToast('Image copy ho gayi ✓  Ab paste karo');
    } catch (err) {
      showToast('Copy nahi hui. Right-click → Copy image use karo', true);
    }
  }
  canvas.title = 'Click karo = image copy';
  canvas.addEventListener('click', copyImage);

  // Live preview: koi bhi badlav hote hi image dobara bante hai
  let renderTimer = null;
  function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(generate, 40); }

  // Image ko bachi hui jagah me fit karta hai taaki scroll na karna pade
  function fit() {
    if (!generated) return;
    const vp = $('viewport');
    const cs = getComputedStyle(vp);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availW = vp.clientWidth - padX - 2;
    const availH = vp.clientHeight - padY - 2;
    if (availW <= 0 || availH <= 0) return;
    const k = Math.min(availW / canvas.width, availH / canvas.height);
    canvas.style.width = Math.max(1, Math.floor(canvas.width * k)) + 'px';
    canvas.style.height = Math.max(1, Math.floor(canvas.height * k)) + 'px';
  }

  // Reset = SIRF data. Colour, font, style, columns, naam, platform chuno: sab wahi rehta hai.
  let resetArm = null;
  function disarmReset() {
    clearTimeout(resetArm); resetArm = null;
    $('reset').textContent = 'Reset data';
    $('reset').classList.remove('armed');
  }
  function resetData() {
    allVals().forEach((p) => { p.vals = emptyN(); });
    state.grand = emptyN();
    $('additional').value = DEFAULT_ADDITIONAL;
    $('date').value = todayISO();
    buildGrandInputs();
    renderCards(false);
    generate();
    syncNow();
    showToast('Data reset ho gaya ✓  Design waisa hi hai');
  }
  // Galti se na ho: pehle click par confirm, 3 second ke andar dobara dabao
  function onResetClick() {
    if (!resetArm) {
      $('reset').textContent = 'Pakka? Dobara dabao';
      $('reset').classList.add('armed');
      resetArm = setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    resetData();
  }

  // ---- Auto-sync ---------------------------------------------------------
  // Data har second apne-aap save hota hai (sirf tab jab kuch badla ho).
  // Dobara kholne par bilkul wahi se shuru hota hai. Saaf sirf "Reset data" se hota hai.
  const STORE_KEY = 'eodState_v1';
  const DESIGN_KEY = 'eodDefaultDesign_v1';
  const SAVE_VER = 2;   // 2 = naye default colours (Shades, Spread 0, Tint)
  const hasChromeStore = () => !!(window.chrome && chrome.storage && chrome.storage.local);

  function storeGet(key, cb) {
    if (hasChromeStore()) {
      chrome.storage.local.get(key, (r) => cb(r && r[key]));
    } else {
      try { cb(JSON.parse(localStorage.getItem(key))); } catch (e) { cb(null); }
    }
  }
  function storeSet(key, value) {
    if (hasChromeStore()) {
      const o = {}; o[key] = value;
      chrome.storage.local.set(o);
    } else {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  }

  const deepCopy = (o) => JSON.parse(JSON.stringify(o));

  function snapshot() {
    return {
      platforms: state.platforms.map((p) => ({ name: p.name, on: p.on, vals: p.vals })),
      others: state.others.map((o) => ({ name: o.name, vals: o.vals })),
      grand: state.grand,
      columns: state.columns,
      additional: $('additional').value,
      ai: $('ai').checked,
      color: state.color,
      fonts: state.fonts,
      sizes: state.sizes,
      bold: state.bold,
      style: state.style,
      name: state.name,
      date: $('date').value,
      multi: state.multi,
      v: SAVE_VER
    };
  }

  // Sirf design (data nahi): "Set as default" yahi save karta hai
  function designSnap() {
    const s = snapshot();
    return deepCopy({
      columns: s.columns, ai: s.ai, color: s.color, fonts: s.fonts,
      sizes: s.sizes, bold: s.bold, style: s.style, multi: s.multi, v: SAVE_VER
    });
  }

  let lastSaved = '';
  function syncNow() {
    const snap = snapshot();
    const str = JSON.stringify(snap);
    if (str === lastSaved) return;
    lastSaved = str;
    storeSet(STORE_KEY, snap);
  }

  // columns pehle set hone chahiye, taaki baaki values sahi length me aayen
  function applyCols(s) {
    state.columns = colsFromSnap(s);
  }

  const validColor = (c) => (c && isFinite(c.h) && isFinite(c.s) && isFinite(c.l) ? { h: +c.h, s: +c.s, l: +c.l } : null);

  function resetDesignFields() {
    state.color = null; state.multi = true;
    state.fonts = defaultFonts(); state.sizes = defaultSizes(); state.bold = defaultBold();
    state.style = defaultStyle();
  }

  // Design wale fields (colour, font, size, bold, style, multi, AI look)
  function applyDesignFields(s) {
    if (!s || typeof s !== 'object') return;
    if (typeof s.ai === 'boolean') $('ai').checked = s.ai;
    const c = validColor(s.color);
    if (c) state.color = c;
    if (s.fonts && typeof s.fonts === 'object') {
      FONT_SECTIONS.forEach((x) => {
        if (R().FONTS.some((f) => f.id === s.fonts[x[0]])) state.fonts[x[0]] = s.fonts[x[0]];
      });
    }
    if (s.sizes && typeof s.sizes === 'object') {
      FONT_SECTIONS.forEach((x) => { if (s.sizes[x[0]] != null) state.sizes[x[0]] = R().sizePct(s.sizes[x[0]]); });
    }
    if (s.bold && typeof s.bold === 'object') {
      FONT_SECTIONS.forEach((x) => { if (typeof s.bold[x[0]] === 'boolean') state.bold[x[0]] = s.bold[x[0]]; });
    }
    if (s.style) state.style = cleanStyle(s.style);
    if (typeof s.multi === 'boolean') state.multi = s.multi;
  }

  // Data wale fields (platforms, numbers, grand, additional, naam, date)
  function applyData(s) {
    if (!s || typeof s !== 'object') return;
    (s.platforms || []).forEach((sp) => {
      const p = state.platforms.find((x) => x.name === sp.name);
      if (p) { p.on = !!sp.on; p.vals = cleanN(sp.vals, ncols()); }
    });
    state.others = (s.others || []).map((o) => ({ name: String(o.name || ''), vals: cleanN(o.vals, ncols()), other: true }));
    state.grand = cleanN(s.grand, ncols());
    if (typeof s.additional === 'string') $('additional').value = s.additional;
    if (typeof s.name === 'string') state.name = s.name;
    if (typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) $('date').value = s.date;
  }

  // Columns badalne par values apni column ke saath hi chalti hain (id se match)
  function remapColumns(next) {
    const oldIdx = {};
    state.columns.forEach((c, i) => { oldIdx[c.id] = i; });
    const map = next.map((c) => oldIdx[c.id]);
    const re = (a) => map.map((j) => (j == null ? '' : String(a[j] == null ? '' : a[j])));
    allVals().forEach((p) => { p.vals = re(p.vals); });
    state.grand = re(state.grand);
    state.columns = next;
  }

  // ---- Set as default: user apna design khud save karta hai --------------------
  function updateDefaultUI() {
    $('factoryReset').classList.toggle('hidden', !userDesign);
    $('styleReset').title = userDesign ? 'Aapka saved default design wapas lagao' : 'Original design wapas lagao';
  }

  // d = saved design, ya null = original design (original me columns ko chhedte nahi)
  function useDesign(d) {
    resetDesignFields();
    if (d) { applyDesignFields(d); remapColumns(colsFromSnap(d)); }
    normalizeVals();
    buildGrandInputs();
    renderCards(false);
    buildColStrip();
    applyLayout();
    syncStyleUI();
    generate();
  }

  function setAsDefault() {
    userDesign = designSnap();
    storeSet(DESIGN_KEY, userDesign);
    updateDefaultUI();
    showToast('Ye design ab aapka default hai ✓');
  }
  function backToDefault() {
    useDesign(userDesign);
    showToast(userDesign ? 'Aapka default design lag gaya' : 'Original design lag gaya');
  }
  function factoryDesign() {
    userDesign = null;
    storeSet(DESIGN_KEY, null);
    updateDefaultUI();
    useDesign(null);
    showToast('Original design lag gaya, saved default hata diya');
  }

  // ---- Sections ko drag karke chhota/bada karna ----------------------------
  const LAYOUT_KEY = 'eodLayout_v1';
  const MIN_W = { a: 190, b: 280, c: 280 };
  let layout = null;   // { a: px, b: px } ya null = auto
  function applyWidths() {
    const sh = $('sheet');
    if (layout) { sh.style.setProperty('--wa', layout.a + 'px'); sh.style.setProperty('--wb', layout.b + 'px'); }
    else { sh.style.removeProperty('--wa'); sh.style.removeProperty('--wb'); }
    scheduleFit();
  }
  function wireSplitters() {
    storeGet(LAYOUT_KEY, (l) => {
      if (l && isFinite(l.a) && isFinite(l.b)) { layout = { a: +l.a, b: +l.b }; applyWidths(); }
    });
    document.querySelectorAll('.vsep').forEach((sep) => {
      const which = sep.dataset.sep;
      const move = (dx, base) => {
        let a = base.a, b = base.b;
        if (which === '1') {          // A aur B ke beech: dono ek doosre se lete hain
          const sum = base.a + base.b;
          a = clamp(base.a + dx, MIN_W.a, sum - MIN_W.b);
          b = sum - a;
        } else {                      // B aur Preview ke beech
          b = clamp(base.b + dx, MIN_W.b, base.b + base.c - MIN_W.c);
        }
        layout = { a: Math.round(a), b: Math.round(b) };
        applyWidths();
      };
      const cur = () => ({ a: $('colA').getBoundingClientRect().width, b: $('colB').getBoundingClientRect().width, c: document.querySelector('.col-c').getBoundingClientRect().width });
      const save = () => storeSet(LAYOUT_KEY, layout);
      sep.addEventListener('pointerdown', (e) => {
        if (window.innerWidth <= 900) return;
        e.preventDefault();
        const x0 = e.clientX, base = cur();
        sep.setPointerCapture(e.pointerId);
        sep.classList.add('drag');
        const onMove = (ev) => move(ev.clientX - x0, base);
        const onUp = () => {
          sep.classList.remove('drag');
          sep.removeEventListener('pointermove', onMove);
          sep.removeEventListener('pointerup', onUp);
          sep.removeEventListener('pointercancel', onUp);
          save(); fit();
        };
        sep.addEventListener('pointermove', onMove);
        sep.addEventListener('pointerup', onUp);
        sep.addEventListener('pointercancel', onUp);
      });
      sep.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        move((e.key === 'ArrowLeft' ? -20 : 20), cur()); save(); fit();
      });
      sep.addEventListener('dblclick', () => { layout = null; applyWidths(); storeSet(LAYOUT_KEY, null); fit(); });
    });
  }

  // ---- Style drawer (side me slide) -------------------------------------------
  function setDrawer(open) {
    $('shell').classList.toggle('drawer-open', open);
    $('styleBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) scheduleFit();
  }
  function wireDrawer() {
    $('styleBtn').addEventListener('click', () => setDrawer(!$('shell').classList.contains('drawer-open')));
    $('drawerClose').addEventListener('click', () => setDrawer(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
  }

  // ---- Init --------------------------------------------------------------
  function start(saved, design) {
    userDesign = design && typeof design === 'object' ? design : null;
    if (saved && saved.v !== SAVE_VER) { saved = Object.assign({}, saved); delete saved.style; delete saved.multi; delete saved.color; }

    // Pehli baar: user ka default design; warna jahan chhoda tha wahi se
    const src = saved || userDesign;
    applyCols(src);
    resetDesignFields();
    applyDesignFields(src);

    $('date').value = todayISO();
    $('additional').value = DEFAULT_ADDITIONAL;
    state.platforms.forEach((p) => { p.vals = emptyN(); });
    state.grand = emptyN();
    applyData(saved);
    normalizeVals();

    $('name').value = state.name;
    $('who').textContent = state.name;
    $('name').addEventListener('input', () => { state.name = $('name').value; $('who').textContent = state.name; });
    buildSwatches();
    wireStyleControls();
    buildGrandInputs();
    renderChips();
    renderCards(false);
    syncStyleUI();
    buildColStrip();
    applyLayout();
    updateDefaultUI();
    document.addEventListener('keydown', onNavKey);

    $('reset').addEventListener('click', onResetClick);

    // Koi bhi badlav hote hi live preview
    ['input', 'change', 'click'].forEach((ev) => document.addEventListener(ev, scheduleRender));

    wireDrawer();
    wireSplitters();
    $('colAddTop').addEventListener('click', () => insertColumn(0));
    generate();

    // Auto-sync: har second (badlav ho to). Tab band / chhupne par bhi turant.
    lastSaved = JSON.stringify(snapshot());
    setInterval(syncNow, 1000);
    window.addEventListener('pagehide', syncNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) syncNow(); });

    // Window ka size badle to sab dobara fit karo
    window.addEventListener('resize', () => { fit(); scheduleFit(); });
    scheduleFit();
    if (window.ResizeObserver) {
      new ResizeObserver(fit).observe($('viewport'));
      new ResizeObserver(scheduleFit).observe($('sheet'));
    }
  }

  storeGet(STORE_KEY, (saved) => storeGet(DESIGN_KEY, (design) => start(saved, design)));
})();
