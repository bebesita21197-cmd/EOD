(function (root) {
  'use strict';

  // Hamesha same rehne wale colours
  const BASE = { line: '#000000', text: '#000000', white: '#FFFFFF' };

  // Default colours = example wale (exact). Custom colour sliders se banta hai.
  const DEFAULT_THEME = { id: 'navy', name: 'Navy Blue', main: '#1F4E79', top: '#26598A', bot: '#194069', hue: 209, sat: 59 };
  const DEFAULT_HSL = { h: 209, s: 59, l: 30 };

  // ---- Style options (drawer ke saare chhote-chhote options yahin se aate hain) ----
  const DEFAULT_STYLE = {
    harmony: 'shades',      // multi colour ka rang-mel (main colour se nikalta hai)
    spread: 0,              // rang kitne door tak failen (0-100)
    rowH: 38,               // data row ki height
    rowGap: 10,             // rows ke beech gap
    radius: 12,             // kone kitne gol (0-24)
    shadow: 100,            // shadow ki gehrai % (0-150)
    scale: 2,               // image quality 1x / 2x / 3x
    bg: 'tint',             // white | tint | grey
    showNo: true,           // row number badge
    showBar: true,          // row ke side ki rang-patti
    showTint: true,         // cell ke peeche halka rang
    showLines: true,        // beech ki patli lines (grooves)
    showAdd: true,          // Additional Work row
    showGrand: true,        // Grand Total row
    nameAlign: 'center'     // platform ka naam: center | left
  };

  const HARMONIES = [
    { id: 'shades',        name: 'Shades (ek hi rang)' },
    { id: 'analogous',     name: 'Analogous (paas ke rang)' },
    { id: 'complementary', name: 'Complementary (vipreet)' },
    { id: 'triadic',       name: 'Triadic (teen rang)' },
    { id: 'split',         name: 'Split (mila-jula)' }
  ];
  // Har harmony: 8 colours ke liye hue offset (degree), lightness aur saturation badlav
  const Z8 = [0, 0, 0, 0, 0, 0, 0, 0];
  const HARM = {
    shades:        { h: Z8, l: [0, 9, -7, 16, -12, 5, -16, 12], s: [0, -8, 6, -14, 10, -4, 12, -10] },
    analogous:     { h: [0, 28, -28, 56, -56, 84, -84, 112], l: [0, 2, -2, 4, -4, 0, 2, -2], s: Z8 },
    complementary: { h: [0, 180, 24, 204, -24, 156, 48, 228], l: [0, 0, 3, 3, -3, -3, 0, 0], s: Z8 },
    triadic:       { h: [0, 120, 240, 24, 144, 264, -24, 96], l: [0, 0, 0, 3, 3, 3, -3, -3], s: Z8 },
    split:         { h: [0, 150, 210, 30, 180, -30, 120, 240], l: [0, 0, 0, 3, 3, -3, -3, 0], s: Z8 }
  };

  // Font choices (har section ke liye dropdown me aate hain)
  const FONTS = [
    { id: 'cambria',   name: 'Cambria',          css: 'Cambria, \"Cambria Math\", Georgia, \"Times New Roman\", serif' },
    { id: 'georgia',   name: 'Georgia',          css: 'Georgia, \"Times New Roman\", serif' },
    { id: 'times',     name: 'Times New Roman',  css: '\"Times New Roman\", Times, serif' },
    { id: 'garamond',  name: 'Garamond',         css: 'Garamond, \"EB Garamond\", Georgia, serif' },
    { id: 'palatino',  name: 'Palatino',         css: '\"Palatino Linotype\", Palatino, \"Book Antiqua\", Georgia, serif' },
    { id: 'calibri',   name: 'Calibri',          css: 'Calibri, Carlito, \"Segoe UI\", Arial, sans-serif' },
    { id: 'segoe',     name: 'Segoe UI',         css: '\"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif' },
    { id: 'arial',     name: 'Arial',            css: 'Arial, Helvetica, sans-serif' },
    { id: 'verdana',   name: 'Verdana',          css: 'Verdana, Geneva, sans-serif' },
    { id: 'tahoma',    name: 'Tahoma',           css: 'Tahoma, Geneva, sans-serif' },
    { id: 'trebuchet', name: 'Trebuchet MS',     css: '\"Trebuchet MS\", Helvetica, sans-serif' },
    { id: 'century',   name: 'Century Gothic',   css: '\"Century Gothic\", \"Avenir Next\", Futura, sans-serif' },
    { id: 'courier',   name: 'Courier New',      css: '\"Courier New\", Courier, monospace' },
    { id: 'consolas',  name: 'Consolas',         css: 'Consolas, Menlo, monospace' }
  ];
  // Purane save ke named sizes -> percent
  const LEGACY_SIZES = { small: 85, normal: 100, large: 115, xl: 130 };
  const SIZE_MIN = 60, SIZE_MAX = 180, SIZE_STEP = 5;
  const sizePct = (v) => {
    if (typeof v === 'string' && LEGACY_SIZES[v] != null) return LEGACY_SIZES[v];
    const n = +v;
    return isFinite(n) && n > 0 ? Math.max(SIZE_MIN, Math.min(SIZE_MAX, n)) : 100;
  };
  const fontCss = (id) => (FONTS.find((f) => f.id === id) || FONTS[0]).css;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, target, t) {
    const a = hexToRgb(hex);
    const b = target === 'white' ? [255, 255, 255] : [0, 0, 0];
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function hslToHex(h, sPct, lPct) {
    h = ((h % 360) + 360) % 360;
    const sN = sPct / 100, lN = lPct / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = sN * Math.min(lN, 1 - lN);
    const f = (n) => lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }

  // Slider (hue, saturation, lightness) se main colour
  function makeTheme(c) {
    if (!c) return DEFAULT_THEME;
    return { id: 'custom', name: 'Custom', main: hslToHex(c.h, c.s, c.l), hue: c.h, sat: c.s };
  }

  // Multi colour palette: SIRF selected main colour se banta hai (8 rang).
  // c = {h,s,l}; harmony = shades|analogous|...; spread = 0..100
  function makePalette(c, harmony, spread) {
    c = c || DEFAULT_HSL;
    const hm = HARM[harmony] || HARM.analogous;
    const sp = clamp(spread == null ? 70 : spread, 0, 100) / 100;
    const baseS = clamp(c.s, 35, 88);
    const baseL = clamp(c.l + 6, 32, 46);
    const out = [];
    for (let i = 0; i < 8; i++) {
      const h = c.h + hm.h[i] * sp;
      let l = baseL + hm.l[i] * (harmony === 'shades' ? sp : 1);
      const hh = ((h % 360) + 360) % 360;
      if (hh > 45 && hh < 110) l -= 8;          // peela/hara: safed text ke liye thoda gehra
      const s = baseS + hm.s[i] * (harmony === 'shades' ? sp : 1);
      out.push(hslToHex(h, clamp(s, 25, 95), clamp(l, 24, 58)));
    }
    return out;
  }

  // Soft background + shadows + contrast accent
  function resolveTheme(t, bgMode) {
    t = t || DEFAULT_THEME;
    const h = t.hue != null ? t.hue : DEFAULT_THEME.hue;
    const s = t.sat != null ? t.sat : DEFAULT_THEME.sat;
    const bgS = Math.min(30, s * 0.45);
    let bg = '#ffffff', bgHi = '#ffffff', bgLo = '#f1f4f9', page = '#ffffff';
    if (bgMode === 'tint') {
      bg = hslToHex(h, 38, 96); bgHi = hslToHex(h, 40, 98.5); bgLo = hslToHex(h, 36, 92); page = hslToHex(h, 34, 94);
    } else if (bgMode === 'grey') {
      bg = '#eceff4'; bgHi = '#f6f8fb'; bgLo = '#e2e7ee'; page = '#eceff4';
    }
    const accent2 = hslToHex((h + 180) % 360, 70, 42);
    return {
      navy: t.main,
      navyTop: t.top || mix(t.main, 'white', 0.12),
      navyBot: t.bot || mix(t.main, 'black', 0.17),
      text: mix(t.main, 'black', 0.55),
      bg: bg, bgHi: bgHi, bgLo: bgLo, page: page,
      shDark: rgba(hslToHex(h, Math.min(34, bgS + 10), 48), 1),
      shLight: 'rgba(255,255,255,0.97)',
      grooveDark: rgba(hslToHex(h, Math.min(32, bgS + 8), 66), 0.85),
      accent2: accent2,
      accent2Top: mix(accent2, 'white', 0.14),
      accent2Bot: mix(accent2, 'black', 0.16),
      accent2Text: mix(accent2, 'black', 0.28)
    };
  }

  // ---- Layout ----------------------------------------------------------------
  const BASE_W = 1035;   // image width (4 column ke saath)
  const COL_W = 155;     // har extra column ke liye extra width
  const M = 0;           // canvas margin (nil)
  const IN = 0;          // card ke andar padding (nil)
  const GAP = 16;        // sections ke beech gap
  const TITLE_LH = 43;
  const XHEAD_H = 38;
  const NUM_W = 64;
  const LEFT_W = 300;

  function renderTable(canvas, data, options) {
    const o = Object.assign({ scale: 2, ai: true }, options || {});
    const st = Object.assign({}, DEFAULT_STYLE, o.style || {});
    const S = o.scale || st.scale || 2;
    const multi = o.multi !== false;
    const nc = Math.max(1, (data.headers || []).length - 1);
    const W = BASE_W + Math.max(0, nc - 4) * COL_W;
    const C = Object.assign({}, BASE, resolveTheme(o.theme, st.bg));
    const PAL = o.palette && o.palette.length ? o.palette : makePalette(DEFAULT_HSL, st.harmony, st.spread);
    const pal = (i) => PAL[i % PAL.length];

    const F = Object.assign({ title: 'cambria', header: 'cambria', rows: 'cambria', additional: 'cambria', grand: 'cambria' }, o.fonts || {});
    const Z = Object.assign({ title: 100, header: 100, rows: 100, additional: 100, grand: 100 }, o.sizes || {});
    const B = Object.assign({ title: true, header: true, rows: true, additional: true, grand: true }, o.bold || {});
    let curFont = fontCss(F.title);
    let curK = sizePct(Z.title) / 100;
    let curW = B.title ? 'bold' : 'normal';
    const useSec = (k) => { curFont = fontCss(F[k]); curK = sizePct(Z[k]) / 100; curW = B[k] === false ? 'normal' : 'bold'; };

    // Style se nikle naap
    const ROW_H = clamp(+st.rowH || 38, 28, 60);
    const RG = clamp(+st.rowGap || 0, 0, 30);
    const HEAD_H = Math.max(36, ROW_H + 6);
    const FOOT_H = ROW_H + 4;
    const kR = clamp(st.radius == null ? 12 : +st.radius, 0, 24) / 12;       // radius multiplier
    const kS = clamp(st.shadow == null ? 100 : +st.shadow, 0, 150) / 100;    // shadow multiplier
    const rowFs = Math.round(22 * Math.min(1, ROW_H / 38));
    const hasAdd = !!data.additional && st.showAdd !== false;
    const hasGrand = !!data.grand && st.showGrand !== false;
    const lines = st.showLines !== false;
    const showNo = st.showNo !== false;
    const leftName = st.nameAlign === 'left';

    const titleLines = data.titleLines && data.titleLines.length ? data.titleLines : [''];
    // Title ke neeche wali line text se bilkul chipki hui (gap = 0)
    const titleFs = Math.round(29 * sizePct(Z.title) / 100);
    const TITLE_TOP = 16;
    const titleH = TITLE_TOP + titleFs + (titleLines.length - 1) * TITLE_LH + 2;
    const xHeads = (data.extraHeaders || []).filter(Boolean);
    const xH = xHeads.length * XHEAD_H;
    const n = data.rows.length;
    const hh = titleH + xH + HEAD_H;

    const parts = [hh];
    if (n) parts.push(n * ROW_H + (n - 1) * RG);
    if (hasAdd) parts.push(FOOT_H);
    if (hasGrand) parts.push(FOOT_H);
    const H = 2 * (M + IN) + parts.reduce((a, b) => a + b, 0) + (parts.length - 1) * GAP;

    canvas.width = Math.round(W * S);
    canvas.height = Math.round(H * S);
    const ctx = canvas.getContext('2d');
    ctx.scale(S, S);

    const ix = M + IN;
    const iw = W - 2 * (M + IN);
    const colW = (iw - LEFT_W) / nc;
    const colX = (i) => ix + LEFT_W + colW * i;
    const colCenter = (i) => ix + LEFT_W + colW * (i + 0.5);
    const leftCenter = ix + LEFT_W / 2;
    const numCenter = ix + NUM_W / 2;
    const nameCenter = showNo ? ix + (NUM_W + LEFT_W) / 2 : leftCenter;
    const nameMaxW = (showNo ? LEFT_W - NUM_W : LEFT_W) - 16;

    // ---- drawing helpers --------------------------------------------------
    function rrPath(x, y, w, h, r) {
      r = Math.max(0, Math.min(r * kR, w / 2, h / 2));
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); rrPath(x, y, w, h, r); }

    // Canvas ke shadow offset/blur transform se scale nahi hote, isliye S se guna karte hain
    function raised(x, y, w, h, r, fill, d, b, n) {
      d *= kS; b *= kS;
      ctx.save();
      rr(x, y, w, h, r);
      ctx.fillStyle = fill;
      if (kS > 0) {
        ctx.shadowColor = C.shDark; ctx.shadowBlur = b * S;
        ctx.shadowOffsetX = d * S; ctx.shadowOffsetY = d * S;
        for (let k = 0; k < (n || 2); k++) ctx.fill();   // kai baar = gehra shadow
        ctx.shadowColor = C.shLight;
        ctx.shadowOffsetX = -d * S; ctx.shadowOffsetY = -d * S;
      }
      ctx.fill();
      ctx.restore();
    }

    function inset(x, y, w, h, r, fill, d, b) {
      d *= kS; b *= kS;
      ctx.save();
      rr(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
      if (kS > 0) {
        ctx.clip();
        const E = 80;
        const frame = (color, dx, dy) => {
          ctx.save();
          ctx.shadowColor = color; ctx.shadowBlur = b * S;
          ctx.shadowOffsetX = dx * S; ctx.shadowOffsetY = dy * S;
          ctx.beginPath();
          ctx.rect(x - E, y - E, w + 2 * E, h + 2 * E);
          rrPath(x, y, w, h, r);
          ctx.fillStyle = '#000';
          ctx.fill('evenodd');
          ctx.restore();
        };
        frame(C.shDark, d, d);
        frame(C.shDark, d, d);
        frame(C.shLight, -d, -d);
      }
      ctx.restore();
    }

    function softFill(x, y, w, h) {
      if (!o.ai) return C.bg;
      const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
      g.addColorStop(0, C.bgHi);
      g.addColorStop(1, C.bgLo);
      return g;
    }
    function navyFill(y, h) {
      if (!o.ai) return C.navy;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, C.navyTop);
      g.addColorStop(1, C.navyBot);
      return g;
    }
    function badgeFill(y, h) {
      if (!o.ai) return C.accent2;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, C.accent2Top);
      g.addColorStop(1, C.accent2Bot);
      return g;
    }
    function colFill(c, yy, hh2) {
      if (!o.ai) return c;
      const g = ctx.createLinearGradient(0, yy, 0, yy + hh2);
      g.addColorStop(0, mix(c, 'white', 0.14));
      g.addColorStop(1, mix(c, 'black', 0.16));
      return g;
    }
    // multi colour ka ek chhota rang-bhara pill (header / grand total ke cells)
    function pill(x, yy, w, hh2, r, c) {
      ctx.save();
      rr(x, yy, w, hh2, r);
      if (kS > 0) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4 * S * kS; ctx.shadowOffsetY = 2 * S * kS; }
      ctx.fillStyle = colFill(c, yy, hh2);
      ctx.fill();
      ctx.restore();
    }

    function sheen(x, y, w, h, r, sh) {
      if (!o.ai) return;
      ctx.save();
      rr(x, y, w, h, r);
      ctx.clip();
      const g = ctx.createLinearGradient(0, y, 0, y + sh * 0.55);
      g.addColorStop(0, 'rgba(255,255,255,0.13)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, sh * 0.55);
      ctx.fillStyle = 'rgba(255,255,255,0.24)';
      ctx.fillRect(x + r * kR, y, w - 2 * r * kR, 1);
      ctx.restore();
    }

    function text(str, cx, cy, maxW, size, color, softShadow, align) {
      str = String(str == null ? '' : str);
      if (!str) return;
      let s = Math.round(size * curK);
      const f = (px) => curW + ' ' + px + 'px ' + curFont;
      ctx.font = f(s);
      while (ctx.measureText(str).width > maxW && s > 9) { s -= 1; ctx.font = f(s); }
      ctx.save();
      if (o.ai && softShadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 2 * S * kS;
        ctx.shadowOffsetY = 1 * S * kS;
      }
      ctx.fillStyle = color;
      ctx.textAlign = align === 'left' ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(str, align === 'left' ? cx - maxW / 2 : cx, cy + 1);
      ctx.restore();
    }

    // Engraved (khodi hui) lines: ek dark + ek light patli patti saath saath
    function vGroove(x, y, h, onAccent) {
      if (!lines) return;
      ctx.fillStyle = onAccent ? 'rgba(0,0,0,0.24)' : C.grooveDark;
      ctx.fillRect(x - 1, y, 1.5, h);
      ctx.fillStyle = onAccent ? 'rgba(255,255,255,0.22)' : C.shLight;
      ctx.fillRect(x + 0.5, y, 1.5, h);
    }
    function hGroove(x, y, w, onAccent) {
      if (!lines) return;
      ctx.fillStyle = onAccent ? 'rgba(0,0,0,0.24)' : C.grooveDark;
      ctx.fillRect(x, y - 1, w, 1.5);
      ctx.fillStyle = onAccent ? 'rgba(255,255,255,0.22)' : C.shLight;
      ctx.fillRect(x, y + 0.5, w, 1.5);
    }

    // ---- Background + outer card -----------------------------------------
    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, W, H);
    // Margin/padding nil: bahar ka card poore canvas ko bharta hai (koi kinara nahi)
    ctx.fillStyle = softFill(0, 0, W, H);
    ctx.fillRect(0, 0, W, H);

    let y = M + IN;

    // ---- Title + extra headers + column header (accent block) ------------
    raised(ix, y, iw, hh, 18, navyFill(y, hh), 4, 9);
    sheen(ix, y, iw, hh, 18, titleH);

    useSec('title');
    titleLines.forEach((line, i) => {
      text(line, W / 2, y + TITLE_TOP + titleFs / 2 + i * TITLE_LH, iw - 60, 29, C.white, true);
    });
    hGroove(ix + 18, y + titleH, iw - 36, true);

    useSec('header');
    xHeads.forEach((line, i) => {
      const yy = y + titleH + i * XHEAD_H;
      text(line, W / 2, yy + XHEAD_H / 2, iw - 60, 21, C.white, true);
      hGroove(ix + 18, yy + XHEAD_H, iw - 36, true);
    });

    const hTop = y + titleH + xH;
    const hy = hTop + HEAD_H / 2;
    const h = data.headers;
    text(h[0], leftCenter, hy, LEFT_W - 20, 19, C.white, true);
    for (let i = 0; i < nc; i++) {
      if (multi) pill(colX(i) + 3, hTop + 6, colW - 6, HEAD_H - 12, 10, pal(i));
      text(h[i + 1] || '', colCenter(i), hy, colW - (multi ? 26 : 16), 19, C.white, true);
      if (!multi) vGroove(colX(i), hTop + 9, HEAD_H - 18, true);
    }

    y += hh + GAP;

    // ---- Data rows (har row ek raised bar) -------------------------------
    useSec('rows');
    const bs = Math.min(28, ROW_H - 10);
    data.rows.forEach((r, idx) => {
      raised(ix, y, iw, ROW_H, 12, softFill(ix, y, iw, ROW_H), 3, 8);
      const cy = y + ROW_H / 2;
      const rc = pal(idx);

      if (multi && st.showBar !== false) {
        ctx.save();
        rr(ix + 5, y + 9, 4, ROW_H - 18, 2);
        ctx.fillStyle = rc;
        ctx.fill();
        ctx.restore();
      }

      if (showNo) {
        // number badge: multi me row ka apna rang, warna contrast accent
        raised(numCenter - bs / 2, cy - bs / 2, bs, bs, bs / 2, multi ? colFill(rc, cy - bs / 2, bs) : badgeFill(cy - bs / 2, bs), 2, 5);
        text(r.no, numCenter, cy, bs - 6, Math.round(16 * bs / 28), C.white, true);
      }

      if (leftName) text(r.name, ix + (showNo ? NUM_W : 14) + nameMaxW / 2, cy, nameMaxW, rowFs, C.text, false, 'left');
      else text(r.name, nameCenter, cy, nameMaxW, rowFs, C.text);
      for (let i = 0; i < nc; i++) {
        const cc = pal(i);
        if (multi && st.showTint !== false) {
          ctx.save();
          rr(colX(i) + 4, y + 5, colW - 8, ROW_H - 10, 9);
          ctx.fillStyle = rgba(cc, 0.13);
          ctx.fill();
          ctx.restore();
        }
        text(r.values[i], colCenter(i), cy, colW - 16, rowFs, multi ? mix(cc, 'black', 0.5) : C.text);
        if (!multi) vGroove(colX(i), y + 8, ROW_H - 16, false);
      }
      y += ROW_H + (idx < n - 1 ? RG : 0);
    });
    if (n) y += GAP;

    // ---- Additional work (andar dabi hui / inset patti) ------------------
    if (hasAdd) {
      useSec('additional');
      inset(ix, y, iw, FOOT_H, 14, C.bg, 5, 11);
      const cy = y + FOOT_H / 2;
      text(data.additional.label, leftCenter, cy, LEFT_W - 20, 21, C.accent2Text);
      text(data.additional.value, ix + LEFT_W + (iw - LEFT_W) / 2, cy, iw - LEFT_W - 30, 21, C.text);
      vGroove(ix + LEFT_W, y + 9, FOOT_H - 18, false);
      y += FOOT_H + GAP;
    }

    // ---- Grand total (accent raised bar) ----------------------------------
    if (hasGrand) {
      useSec('grand');
      raised(ix, y, iw, FOOT_H, 14, navyFill(y, FOOT_H), 4, 9);
      sheen(ix, y, iw, FOOT_H, 14, FOOT_H);
      const cy = y + FOOT_H / 2;
      text(data.grand.label, leftCenter, cy, LEFT_W - 20, 22, C.white, true);
      for (let i = 0; i < nc; i++) {
        if (multi) pill(colX(i) + 3, y + 5, colW - 6, FOOT_H - 10, 10, pal(i));
        text(data.grand.values[i], colCenter(i), cy, colW - 16, 22, C.white, true);
        if (!multi) vGroove(colX(i), y + 9, FOOT_H - 18, true);
      }
    }
  }

  const api = {
    renderTable, makeTheme, makePalette, hslToHex, mix, sizePct,
    FONTS, HARMONIES, DEFAULT_HSL, DEFAULT_STYLE, SIZE_MIN, SIZE_MAX, SIZE_STEP
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EODRender = api;
})(typeof self !== 'undefined' ? self : this);
