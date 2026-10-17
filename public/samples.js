// Recruiting samples: a candidate's photo, name and contact details drawn onto the real marketing pieces, on screen only.
// The same file is in manager-portal/public and my-marketing/public - change both together.
// Flyers, title tips, the market update and the newsletter are the Recruiting board's own blank copies (its "Sample pieces" group),
// with the person drawn where the Marketing Tools templates put them. The 4 new hire looks come from looks.js, and the branding
// (email signatures, profile headers, business cards) is drawn here to match the 7_Branding templates.
'use strict';
const Samples = (() => {
  const CSS = `
.sp{--b:#A30C33;--k:#1A1A1C;--m:#6B6966;--ln:#E4E1DC;font-family:Montserrat,-apple-system,sans-serif;color:var(--k)}
.sp-sec{padding:18px 0 4px}.sp-sec h3{margin:0 0 2px;font-size:18px;font-weight:700}.sp-sec>.s{font-size:13px;color:var(--m);margin-bottom:10px}
.sp-row{margin:10px 0 4px}.sp-row>b{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.sp-row>b span{font-weight:500;color:var(--m)}
.sp-strip{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 10px;scrollbar-width:thin;--rh:170px}.sp-strip.br{--rh:96px}
.sp-it{flex:none;display:flex;flex-direction:column;gap:5px}
.sp-cap{font-size:11.5px;font-weight:600;width:0;min-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--k)}
.sp-none{font-size:13px;color:var(--m);background:#F7F5F2;border-radius:10px;padding:12px 14px}
.sx{position:relative;overflow:hidden;height:var(--rh);width:calc(var(--rh) * var(--ar));flex:none;border-radius:8px;background:#fff;box-shadow:0 0 0 1px var(--ln);cursor:zoom-in;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.sx img{pointer-events:none}
.sx-in{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;font-family:Montserrat,sans-serif;color:var(--k);line-height:1.2;text-align:left}
.sx-a{position:absolute}.sx-bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.sx-rib{position:absolute;background:var(--b);color:#fff;font-weight:800;letter-spacing:.14em;text-align:center;transform:rotate(35deg);z-index:5}
.sx-ph{position:absolute;overflow:hidden}.sx-ph img{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:100%;width:auto;max-width:none}
.sx-ph.raw img{left:0;transform:none;width:100%;height:100%;object-fit:cover;object-position:top}
.sx-ph.o{border-radius:50%}.sx-ph.o img{height:96%}
.sx-ph svg{position:absolute;inset:0;width:100%;height:100%}
.sx-1{white-space:nowrap;overflow:hidden}.sx-ic{display:flex;align-items:center;white-space:nowrap}
.sx-ic svg{flex:none;fill:none;stroke:var(--b);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.sx-fn{font-family:NHScript,Montserrat,sans-serif;white-space:nowrap;line-height:1}
.sp-zoom{position:fixed;inset:0;z-index:300;background:rgba(26,26,28,.82);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out}
.sp-zoom .sx{--rh:min(86vh,calc((100vw - 48px) / var(--ar)));box-shadow:0 10px 40px rgba(0,0,0,.4);cursor:zoom-out}
/* the new hire looks (same rules as the portal's style.css, so the looks draw here too) */
.sx .lk-post{position:absolute;left:0;top:0;width:1080px;height:1350px;overflow:hidden;color:var(--lk-ink);font-family:Montserrat,sans-serif;text-align:left;line-height:normal;--lk-red:#A30C33;--lk-ink:#1A1A1C;--lk-paper:#F2F1EF;--lk-muted:#6B6966;--lk-line:#CFCBC5}
.sx .lk-abs{position:absolute}.sx .lk-kick{font-size:28px;font-weight:700;letter-spacing:.3em;text-transform:uppercase;color:var(--lk-red)}
.sx .lk-fn{font-family:NHScript,Montserrat,sans-serif;white-space:nowrap;line-height:1;transform:rotate(-8deg);transform-origin:left bottom}
.sx .lk-ln{font-weight:700;letter-spacing:.2em;text-transform:uppercase;white-space:nowrap}.sx .lk-tt{font-weight:700;letter-spacing:.3em;text-transform:uppercase;white-space:nowrap}
.sx .lk-tt2{white-space:normal;letter-spacing:.2em;line-height:1.25}.sx .lk-bio{font-size:31px;font-weight:500;line-height:1.55}
.sx .lk-lbl{font-size:20px;font-weight:700;letter-spacing:.25em;text-transform:uppercase;color:var(--lk-red);margin-bottom:16px}
.sx .lk-hd{font-weight:800;line-height:1.05;letter-spacing:-.01em}.sx .lk-rows{font-weight:600}
.sx .lk-rows div{display:flex;align-items:center;gap:18px;height:50px}
.sx .lk-rows svg{width:32px;height:32px;fill:none;stroke:var(--lk-red);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.sx .lk-circ{border-radius:50%;overflow:hidden}.sx .lk-circ .lk-cut{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:96%}
.sx .lk-circ .lk-raw{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sx .lk-nophoto{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:600;color:var(--lk-muted)}
.sx .lk-ring{border-radius:50%;border:8px solid var(--lk-red)}`;
  let styled = false;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const CO = 'Stewart Title of California, Inc.';
  const ICON = {
    ph: '<path d="M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5zM11 18.5h2"/>',
    em: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  };
  const svg = (k, s, color) => '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '"' + (color ? ' style="stroke:' + color + '"' : '') + '>' + ICON[k] + '</svg>';
  // c: { name, title, area, phone, email }, photo: image URL (background already removed) or ''
  // 9518342559 -> (951) 834-2559; anything else stays as typed
  function phoneFmt(v) {
    const t = String(v || '').trim(), d = t.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : t;
  }
  function person(c, photo) {
    const name = String(c.name || 'Candidate').trim(), parts = name.split(/\s+/);
    return { name, f: parts[0], l: parts.slice(1).join(' ') || parts[0], t: c.title || 'Sales Representative', area: c.area || '', ph: phoneFmt(c.phone), em: c.email || '', pic: photo || '' };
  }
  // ---------- drawing helpers, in the piece's own pixels ----------
  const box = (x, y, w, h, inner, st) => '<div class="sx-a" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (st || '') + '">' + inner + '</div>';
  // one line of text that shrinks to fit its width
  const line = (x, y, w, fs, txt, st) => '<div class="sx-a sx-1 sx-fit" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + Math.ceil(fs * 1.3) + 'px;font-size:' + fs + 'px;' + (st || '') + '">' + txt + '</div>';
  const iconLine = (x, y, w, fs, k, txt, st, ic) => '<div class="sx-a sx-ic sx-fit" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + Math.ceil(fs * 1.4) + 'px;font-size:' + fs + 'px;gap:' + Math.round(fs * .45) + 'px;' + (st || '') + '">' + svg(k, Math.round(fs * 1.05), ic) + '<span>' + txt + '</span></div>';
  // the person's photo in a box: a cutout stands on the bottom edge; no photo = a plain silhouette
  function photo(P, x, y, w, h, o) {
    o = o || {};
    const inner = P.pic ? '<img data-center="1" src="' + esc(P.pic) + '" alt="" draggable="false">'
      : '<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><circle cx="50" cy="44" r="21" fill="#B9B5AF"/><path d="M10 120c2-30 18-46 40-46s38 16 40 46z" fill="#B9B5AF"/></svg>';
    return '<div class="sx-ph' + (o.round ? ' o' : '') + '" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + (o.bg ? 'background:' + o.bg + ';' : '') + (o.ring ? 'box-shadow:0 0 0 ' + o.ring + ';' : '') + (o.st || '') + '">' + inner + '</div>';
  }
  const logo = (x, y, w, white) => '<img class="sx-a" src="brand/stewart-logo' + (white ? '-white' : '') + '.png" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px" alt="" draggable="false">';
  // one piece: W × H pixels, scaled to the row's height by fit()
  function frame(W, H, inner, bg) {
    const rf = Math.round(Math.min(W, H) * .032), rw = Math.round(Math.min(W, H) * .5);
    return '<div class="sx" data-w="' + W + '" data-h="' + H + '" style="aspect-ratio:' + W + '/' + H + ';--ar:' + (W / H).toFixed(4) + '"><div class="sx-in" style="width:' + W + 'px;height:' + H + 'px;' + (bg ? 'background:' + bg : '') + '">' + inner +
      '<div class="sx-rib" style="font-size:' + rf + 'px;padding:' + Math.round(rf * .4) + 'px 0;width:' + rw + 'px;right:' + Math.round(-rw * .28) + 'px;top:' + Math.round(rw * .16) + 'px">SAMPLE</div></div></div>';
  }
  // ---------- pieces drawn over the Recruiting board's blank art ----------
  const lay = s => { const o = {}; String(s || '').split(';').forEach(kv => { const m = kv.split('='); if (m[0] && m[1]) o[m[0].trim()] = m[1].trim(); }); return o; };
  const ART = {
    // flyers: 8.5 × 11 at 150 per inch; the contact block sits at the list's "Block Top" (and "Block Left") like the Mac app puts it
    'Flyer': (p, P) => {
      const L = lay(p.layout), d = 150, T = (parseFloat(L.top) || 8.44) * d, X = (L.left ? parseFloat(L.left) : 0.51) * d, tx = X + 211, w = Math.min(1275 - tx - 40, 330);
      return [1275, 1650, '<img class="sx-bg" src="' + esc(p.img) + '" alt="" loading="lazy" draggable="false">' + photo(P, X, T + 43, 194, 206) +
        line(tx, T + 72, w, 21, esc(P.name), 'font-weight:700') + line(tx, T + 97, w, 17.5, esc(P.t)) + line(tx, T + 124, w, 20, CO, 'font-weight:700') +
        (P.ph ? iconLine(tx, T + 150, w, 17.5, 'ph', esc(P.ph)) : '') + (P.em ? iconLine(tx, T + 174, w, 17.5, 'em', esc(P.em)) : '') + (P.area ? iconLine(tx, T + 198, w, 17.5, 'pin', esc(P.area)) : '')];
    },
    // title tips: 1080 × 1350, photo and white contact lines at the bottom left (the Title Tip Frame)
    'Title tip': (p, P) => [1080, 1350, '<img class="sx-bg" src="' + esc(p.img) + '" alt="" loading="lazy" draggable="false">' + photo(P, 16, 1100, 223, 250) +
      line(267, 1146, 520, 26, esc(P.name), 'font-weight:700;color:#fff') + line(267, 1182, 520, 23, esc(P.t), 'font-weight:600;color:#fff') +
      (P.ph ? line(267, 1214, 520, 21, esc(P.ph), 'color:#fff') : '') + line(267, P.ph ? 1242 : 1214, 520, 21, esc(P.em), 'color:#fff')],
    // weekly market snapshot: a sample area's numbers, with the person in the footer
    'Market update': (p, P) => [1080, 1350, '<img class="sx-bg" src="' + esc(p.img) + '" alt="" loading="lazy" draggable="false">' + photo(P, 60, 1144, 94, 94, { round: true, bg: '#E7E4DF' }) +
      line(172, 1152, 560, 27, esc(P.name), 'font-weight:700') + line(172, 1189, 560, 18.5, esc(P.t + ', ' + CO), 'color:#6B6966') +
      line(172, 1214, 560, 18.5, esc([P.ph, P.em].filter(Boolean).join('  ·  ')), 'color:#6B6966')],
    // monthly newsletter: a sample county's events, with the person at the bottom left
    'Newsletter': (p, P) => [1020, 1320, '<img class="sx-bg" src="' + esc(p.img) + '" alt="" loading="lazy" draggable="false">' + photo(P, 48, 1077, 226, 243) +
      line(297, 1112, 520, 29, esc(P.name), 'font-weight:700;color:#1E2321') + line(297, 1150, 520, 17, esc(P.t), 'color:#555') +
      (P.ph ? iconLine(297, 1184, 520, 17, 'ph', esc(P.ph), 'color:#1E2321') : '') + (P.em ? iconLine(297, 1212, 520, 17, 'em', esc(P.em), 'color:#1E2321') : '') +
      (P.area ? iconLine(297, 1240, 520, 17, 'pin', esc(P.area), 'color:#1E2321') : '')],
  };
  // ---------- branding, drawn to match the 7_Branding templates ----------
  const fn = (x, y, fs, P, color) => '<div class="sx-a sx-fn" style="left:' + x + 'px;top:' + y + 'px;font-size:' + fs + 'px;color:' + (color || 'var(--k)') + '">' + esc(P.f) + '</div>';
  const caps = (x, y, w, fs, txt, color, ls, h) => '<div class="sx-a sx-fit" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + (h || Math.ceil(fs * 1.3)) + 'px;font-size:' + fs + 'px;font-weight:700;letter-spacing:' + (ls || .15) + 'em;text-transform:uppercase;color:' + color + ';' + (h ? 'line-height:1.3' : 'white-space:nowrap') + '">' + txt + '</div>';
  const letters = (x, y, w, fs, rows, gap, st) => rows.map((r, i) => '<div class="sx-a sx-1 sx-fit" style="left:' + x + 'px;top:' + (y + i * gap) + 'px;width:' + w + 'px;height:' + Math.ceil(fs * 1.35) + 'px;font-size:' + fs + 'px;' + (st || '') + '"><b style="color:var(--b);display:inline-block;width:' + Math.round(fs * 1.4) + 'px">' + r[0] + '</b>' + esc(r[1]) + '</div>').join('');
  const curve = (cx, cy, r, ring) => '<div class="sx-a" style="left:' + (cx - r) + 'px;top:' + (cy - r) + 'px;width:' + 2 * r + 'px;height:' + 2 * r + 'px;border-radius:50%;background:#1C1C1E;box-shadow:0 0 0 ' + ring + 'px var(--b)"></div>';
  const stripes = (x, y, h) => [0, 1, 2].map(i => '<div class="sx-a" style="left:' + (x + i * 62) + 'px;top:' + y + 'px;width:42px;height:' + h + 'px;background:var(--b);transform:skewX(-28deg)"></div>').join('');
  // script first name tilted up (sx-w: shrinks for width only, the script's tall letters always overrun their box), then the last name in red caps with the title under it; the whole block shrinks together to fit its width
  const sigName = (x, y, w, h, P) => '<div class="sx-a sx-fit sx-w" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;font-size:48px;display:flex;flex-direction:column;justify-content:flex-end;white-space:nowrap"><div style="display:flex;align-items:flex-start">' +
    '<span class="sx-fn" style="position:static;display:inline-block;font-size:2.1em;padding:.66em .12em 0 0;transform:rotate(-8deg);transform-origin:left bottom">' + esc(P.f) + '</span>' +
    '<span style="padding-top:2.33em;margin-left:.3em"><span style="display:block;font-weight:800;color:var(--b);letter-spacing:.125em;text-transform:uppercase;line-height:1">' + esc(P.l) + '</span>' +
    '<span style="display:block;margin-top:.45em;font-size:.36em;font-weight:700;letter-spacing:.3em;text-transform:uppercase;opacity:.8">' + esc(P.t) + '</span></span></div></div>';
  const BRAND = [
    ['Email signature · Script Name', P => [1200, 400, box(300, 40, 852, 156, '', 'background:#E9E5DF') +
      box(0, 0, 404, 400, '', 'background:var(--b);border-radius:0 220px 220px 0/0 50% 50% 0') + photo(P, 0, 0, 392, 400, { st: 'border-radius:0 212px 212px 0/0 50% 50% 0;background:#F4F2EE' }) +
      sigName(424, 0, 728, 196, P) +
      (P.ph ? iconLine(444, 226, 420, 23, 'ph', esc(P.ph), 'font-weight:600') : '') + (P.em ? iconLine(444, 264, 420, 23, 'em', esc(P.em), 'font-weight:600') : '') + (P.area ? iconLine(444, 302, 420, 23, 'pin', esc(P.area), 'font-weight:600') : '') + logo(897, 316, 250), '#fff']],
    ['Email signature · Left Edge', P => [1200, 344, box(28, 32, 8, 280, '', 'background:var(--b)') + photo(P, 60, 57, 229, 229, { round: true, bg: '#EEECE8' }) +
      line(324, 40, 600, 46, esc(P.name), 'font-weight:700') + caps(325, 100, 600, 15, esc(P.t), 'var(--b)', .12) +
      letters(324, 140, 520, 20, [['M', P.ph], ['E', P.em], ['W', 'stewart.com']].filter(r => r[1]), 32) +
      line(324, 248, 560, 17, CO, 'font-weight:700;color:#555') + (P.area ? line(324, 276, 560, 17, esc(P.area), 'color:#666') : '') + logo(953, 254, 217), '#fff']],
    ['Email signature · Light', P => [1200, 344, photo(P, 52, 34, 272, 272, { round: true, bg: '#F1EFEB' }) + box(340, 40, 7, 258, '', 'background:var(--b)') +
      line(370, 36, 560, 42, esc(P.name), 'font-weight:700') + line(370, 94, 560, 26, esc(P.t), 'font-weight:500;color:#666') +
      line(370, 152, 560, 23, esc(P.ph), 'font-weight:700') + line(370, 190, 560, 23, esc(P.em), 'font-weight:700') + logo(370, 246, 258) + stripes(1012, 30, 110), '#fff']],
    ['LinkedIn header', P => [1584, 396, curve(1518, 196, 551, 10) + fn(365, 50, 110, P) + caps(502, 178, 440, 44, esc(P.l), 'var(--b)', .15) + caps(505, 232, 420, 12, esc(P.t), 'var(--k)', .3, 32) +
      logo(1108, 112, 247, true) + (P.ph ? iconLine(1110, 214, 440, 24, 'ph', esc(P.ph), 'color:#fff;font-weight:600', '#fff') : '') + (P.em ? iconLine(1110, 260, 440, 24, 'em', esc(P.em), 'color:#fff;font-weight:600', '#fff') : ''), '#F2F1EE']],
    ['Facebook header', P => [1640, 624, curve(1547, 312, 508, 12) + fn(416, 96, 150, P) + caps(615, 262, 470, 52, esc(P.l), 'var(--b)', .15) + caps(618, 342, 440, 15, esc(P.t), 'var(--k)', .3, 40) +
      logo(1173, 160, 317, true) + (P.ph ? iconLine(1175, 320, 440, 28, 'ph', esc(P.ph), 'color:#fff;font-weight:600', '#fff') : '') + (P.em ? iconLine(1175, 378, 440, 28, 'em', esc(P.em), 'color:#fff;font-weight:600', '#fff') : ''), '#F2F1EE']],
    ['Business card · Left Edge', P => [1050, 600, box(40, 0, 30, 600, '', 'background:var(--b)') + line(150, 92, 820, 54, esc(P.name), 'font-weight:700') + caps(152, 168, 800, 19, esc(P.t), 'var(--b)', .15) +
      letters(150, 228, 700, 25, [['M', P.ph], ['E', P.em], ['W', 'stewart.com']].filter(r => r[1]), 42) + line(150, 400, 600, 19, CO, 'font-weight:700;color:#555') +
      (P.area ? line(150, 430, 600, 19, esc(P.area), 'color:#666') : '') + logo(790, 470, 220), '#fff']],
    ['Business card · Left Edge Photo', P => [1050, 600, box(40, 0, 30, 600, '', 'background:var(--b)') + photo(P, 115, 150, 260, 260, { round: true, bg: '#EEECE8' }) +
      line(420, 120, 590, 46, esc(P.name), 'font-weight:700') + caps(422, 184, 590, 16, esc(P.t), 'var(--b)', .15) +
      letters(420, 236, 580, 22, [['M', P.ph], ['E', P.em], ['W', 'stewart.com']].filter(r => r[1]), 36) + line(420, 380, 580, 17, CO, 'font-weight:700;color:#555') +
      (P.area ? line(420, 406, 580, 17, esc(P.area), 'color:#666') : '') + logo(790, 470, 220), '#fff']],
    ['Business card · Script Name', P => [1050, 600, fn(90, 74, 128, P, '#fff') + caps(170, 222, 700, 40, esc(P.l), '#fff', .25) + caps(173, 280, 700, 15, esc(P.t), '#CFCBC5', .3) +
      (P.ph ? iconLine(173, 330, 620, 24, 'ph', esc(P.ph), 'color:#fff;font-weight:600') : '') + (P.em ? iconLine(173, 374, 620, 24, 'em', esc(P.em), 'color:#fff;font-weight:600') : '') +
      (P.area ? iconLine(173, 418, 620, 24, 'pin', esc(P.area), 'color:#fff;font-weight:600') : '') + logo(810, 500, 190, true), '#1C1C1E']],
    ['Business card · Script Name Photo', P => [1050, 600, fn(80, 72, 120, P, '#fff') + caps(160, 214, 480, 36, esc(P.l), '#fff', .22) + caps(163, 268, 480, 13, esc(P.t), '#CFCBC5', .3, 36) +
      (P.ph ? iconLine(163, 330, 460, 22, 'ph', esc(P.ph), 'color:#fff;font-weight:600') : '') + (P.em ? iconLine(163, 370, 460, 22, 'em', esc(P.em), 'color:#fff;font-weight:600') : '') +
      (P.area ? iconLine(163, 410, 460, 22, 'pin', esc(P.area), 'color:#fff;font-weight:600') : '') + photo(P, 680, 120, 300, 300, { round: true, bg: '#2A2A2D', ring: '8px var(--b)' }) + logo(810, 500, 190, true), '#1C1C1E']],
  ];
  // the 4 approved new hire looks, each an announcement and an "I've joined" post (from looks.js)
  function looks(P) {
    if (!window.nhLookPosts) return [];
    const L = { f: P.f, l: P.l, t: P.t, ph: P.ph || '(000) 000-0000', em: P.em || 'name@stewart.com', a1: CO, a2: P.area, bio: '', noBio: true, pic: P.pic, cut: !!P.pic };
    const out = [];
    (window.nhLookNames || []).forEach(n => (nhLookPosts(n, L) || []).forEach((post, i) => out.push({ cap: n + (i ? ' · I’ve joined' : ' · Announcement'), html: frame(1080, 1350, post) })));
    return out;
  }
  const item = (html, cap) => '<div class="sp-it">' + html + '<div class="sp-cap" title="' + esc(cap) + '">' + esc(cap) + '</div></div>';
  // everything they'd get, grouped by when it comes: [{ when, sub, rows: [{ title, br, items: [{ html, cap }] }] }]
  function groups(c, pic, pieces) {
    if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
    const P = person(c, pic), list = (pieces || []).filter(p => !p.retired);
    const art = kind => list.filter(p => p.kind === kind).map(p => { const r = ART[kind](p, P); return { cap: p.name, html: frame(r[0], r[1], r[2]) }; });
    const month = MONTHS[new Date().getMonth()];
    return [
      { when: 'Week one', sub: 'Made for them the week they join', rows: [
        { title: 'Welcome announcement', note: 'They pick one of 4 looks', items: looks(P) },
        { title: 'Branding', note: 'Email signatures, profile headers and business cards', br: true, items: BRAND.map(b => { const r = b[1](P); return { cap: b[0], html: frame(r[0], r[1], r[2], r[3]) }; }) }] },
      { when: 'Every week', sub: 'For their area', rows: [{ title: 'Market update', note: 'Sample area', items: art('Market update') }] },
      { when: 'Every month', sub: 'New each month', rows: [
        { title: 'Flyers', items: art('Flyer') }, { title: 'Title tips', items: art('Title tip') }, { title: 'Newsletter', note: 'Sample county', items: art('Newsletter') }] },
    ];
  }
  const missing = '<div class="sp-none">Shows here once a Portal Admin adds the sample pieces on the Recruiting page.</div>';
  const row = r => '<div class="sp-row"><b>' + esc(r.title) + (r.items.length > 1 ? ' <span>· ' + r.items.length + '</span>' : '') + (r.note ? ' <span>· ' + esc(r.note) + '</span>' : '') + '</b>' +
    (r.items.length ? '<div class="sp-strip' + (r.br ? ' br' : '') + '">' + r.items.map(i => item(i.html, i.cap)).join('') + '</div>' : missing) + '</div>';
  // My Marketing's page: one section per "when", each a few rows of pieces you scroll sideways
  function html(c, pic, pieces) {
    return '<div class="sp">' + groups(c, pic, pieces).map(g => '<section class="sp-sec"><h3>' + esc(g.when) + '</h3><div class="s">' + esc(g.sub) + '</div>' + g.rows.map(row).join('') + '</section>').join('') + '</div>';
  }
  // ---------- sizing ----------
  // scale each piece to its row's height, then shrink long text a little at a time until it fits (like the templates do)
  function fit(root) {
    (root || document).querySelectorAll('.sx').forEach(el => {
      const inn = el.firstElementChild, h = el.clientHeight; if (!inn || !h) return;
      inn.style.transform = 'scale(' + (h / Number(el.dataset.h)) + ')';
      inn.querySelectorAll('.sx-fit,.lk-fit').forEach(t => {
        let fs = Number(t.dataset.fs) || parseFloat(getComputedStyle(t).fontSize), n = 0;
        t.dataset.fs = fs; t.style.fontSize = fs + 'px';
        while (((!t.classList.contains('sx-w') && t.scrollHeight > t.clientHeight + 1) || t.scrollWidth > t.clientWidth + 1) && n++ < 16) { fs *= 0.94; t.style.fontSize = fs + 'px'; }
      });
    });
  }
  window.addEventListener('resize', () => fit());
  if (document.fonts) document.fonts.addEventListener('loadingdone', () => fit());
  // click a piece to see it big
  document.addEventListener('click', e => {
    const z = e.target.closest && e.target.closest('.sp-zoom');
    if (z) { z.remove(); return; }
    const el = e.target.closest && e.target.closest('.sx');
    if (!el) return;
    const o = document.createElement('div'); o.className = 'sp-zoom sp'; o.innerHTML = el.outerHTML;
    document.body.appendChild(o); fit(o);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.sp-zoom').forEach(z => z.remove()); });
  // ---------- photos ----------
  // Cutouts are trimmed to the whole person, so a turned body or a clipped shoulder leaves the face off center.
  // center(url) pads the cutout with clear space so the head sits in the middle; photos with no clear background come back as they are.
  const centered = {};
  function center(url) {
    if (!url) return Promise.resolve(url);
    return centered[url] || (centered[url] = new Promise(res => {
      const im = new Image();
      im.onload = () => {
        try {
          const w = im.naturalWidth, h = im.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0); const d = cx.getImageData(0, 0, w, h).data;
          let top = -1, clear = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = d[(y * w + x) * 4 + 3]; if (a < 20) clear++; else if (a > 120 && top < 0) top = y; }
          if (top < 0 || clear < w * h * 0.05) return res(url);
          // head = the opaque pixels in the top quarter of the person
          const band = top + Math.max(4, Math.round((h - top) * 0.25));
          let sx = 0, n = 0, x0 = w, x1 = 0;
          for (let y = top; y < band; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 120) { sx += x; n++; }
          for (let y = top; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
          const hx = sx / n, half = Math.ceil(Math.max(hx - x0, x1 - hx)) + 2;
          if (Math.abs(hx - (x0 + x1) / 2) < w * 0.02) return res(url);
          const out = document.createElement('canvas'); out.width = half * 2; out.height = h - top;
          out.getContext('2d').drawImage(cv, 0, top, w, h - top, Math.round(half - hx), 0, w, h - top);
          out.toBlob(b => res(b ? URL.createObjectURL(b) : url), 'image/png');
        } catch (x) { res(url); }
      };
      im.onerror = () => res(url);
      im.src = url;
    }));
  }
  // swaps every img[data-center] under root for its centered version, then sizes the pieces
  function fix(root) {
    (root || document).querySelectorAll('img[data-center]').forEach(el => {
      const u = el.getAttribute('src'); el.removeAttribute('data-center');
      center(u).then(v => { if (v !== u && el.getAttribute('src') === u) el.src = v; });
    });
    fit(root);
  }
  return { html, groups, row, fit, center, fix };
})();
