// My Team Highlights (home page): a ready-to-share post for each team birthday and work anniversary, from a week before.
// The post is drawn here in the browser: design art (built-in or one of Amy's from the Highlight Designs board)
// + the person's headshot cutout + their name, title and the headline. Nothing is sent anywhere to make it.
(function () {
  const W = 1080;
  // built-in designs; Amy's live designs from the board are added after these
  const BUILT_IN = [
    { id: 'b1', name: 'Classic', kind: 'birthday', art: 'highlights/birthday.png' },
    { id: 'a1', name: 'Classic', kind: 'start', art: 'highlights/anniversary.png' },
    // celebration designs (balloons, confetti, fireworks); dark ones set their own text colours
    { id: 'b-balloons', name: 'Balloons', kind: 'birthday', art: 'highlights/birthday-balloons.png' },
    { id: 'b-confetti', name: 'Confetti', kind: 'birthday', art: 'highlights/birthday-confetti.png' },
    { id: 'b-red-party', name: 'Red party', kind: 'birthday', art: 'highlights/birthday-red-party.png', text: '#FFFFFF', accent: '#F3C969', small: '#F6DCE2' },
    { id: 'b-party-banner', name: 'Party banner', kind: 'birthday', art: 'highlights/birthday-party-banner.png' },
    { id: 'b-sparkle-night', name: 'Sparkle night', kind: 'birthday', art: 'highlights/birthday-sparkle-night.png', text: '#FFFFFF', accent: '#F3C969', small: '#CFCBC5' },
    { id: 'a-gold-stars', name: 'Gold stars', kind: 'start', art: 'highlights/anniversary-gold-stars.png' },
    { id: 'a-fireworks', name: 'Fireworks', kind: 'start', art: 'highlights/anniversary-fireworks.png', text: '#FFFFFF', accent: '#F3C969', small: '#CFCBC5' },
    { id: 'a-gold-streamers', name: 'Gold streamers', kind: 'start', art: 'highlights/anniversary-gold-streamers.png', text: '#FFFFFF', accent: '#F3C969', small: '#F6DCE2' },
    { id: 'a-celebration-burst', name: 'Celebration burst', kind: 'start', art: 'highlights/anniversary-celebration-burst.png' },
    { id: 'a-ribbons', name: 'Ribbons', kind: 'start', art: 'highlights/anniversary-ribbons.png' },
  ];
  const INK = '#1A1A1C', RED = '#A30C33', MUTED = '#6B6966';
  const CAPTIONS = {
    birthday: [
      'Happy birthday, {first}! 🎉 Wishing you a fantastic year ahead. We’re lucky to have you on the Stewart Title team!',
      'Join us in wishing {first} a very happy birthday! 🎂 Thank you for everything you bring to our team and our clients.',
      'Cheers to {first} today! 🥳 We hope your birthday is as great as you are. #StewartTitle #TeamStewart',
    ],
    start: [
      'Celebrating {years} at Stewart Title! 🎉 Thank you, {first}, for your dedication to our clients and our team.',
      'Happy work anniversary, {first}! ⭐ {Years} of hard work, great service and teamwork. We’re proud to have you at Stewart Title.',
      'Cheers to {years}, {first}! 🥂 Thank you for being such an important part of the Stewart Title family. #StewartTitle #TeamStewart',
    ],
  };
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = n => String(n || '').trim().split(/\s+/)[0];
  const yrs = n => n + (n === 1 ? ' year' : ' years');
  const caption = (h, i) => CAPTIONS[h.kind][i].replace(/\{first\}/g, first(h.name)).replace(/\{years\}/g, yrs(h.years)).replace(/\{Years\}/g, yrs(h.years).replace(/^./, c => c.toUpperCase()));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const when = iso => { const d = new Date(iso + 'T12:00:00'); return DAY[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); };
  const inDays = n => n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? 'in ' + n + ' days' : n === -1 ? 'yesterday' : (-n) + ' days ago';

  // ---------- drawing ----------
  let fontsReady = null;
  function fonts() {
    if (!fontsReady) fontsReady = Promise.all([600, 700, 800].map(w => new FontFace('HLM', 'url(fonts/montserrat-latin-' + w + '-normal.woff2)', { weight: String(w) }).load().then(f => document.fonts.add(f)))).catch(() => {});
    return fontsReady;
  }
  const IMG = {};
  function img(src) {
    if (!IMG[src]) IMG[src] = new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Could not load ' + src)); i.src = src; });
    return IMG[src];
  }
  function font(ctx, w, px) { ctx.font = w + ' ' + px + 'px HLM, Montserrat, sans-serif'; }
  function spacing(ctx, em, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = (em * px) + 'px'; }
  function wrap(ctx, text, max) {
    const out = []; let line = '';
    String(text || '').split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
    return out;
  }
  // Layout "Classic": headline top-left, headshot bottom-right, name + title bottom-left. Amy's art goes underneath.
  // Each layout places the headline, photo and name its own way. New layouts are added here (Kevin only).
  const LAYOUTS = { classic: classic };
  function draw(h, d) { return (LAYOUTS[d.layout || 'classic'] || classic)(h, d); }
  async function classic(h, d) {
    await fonts();
    const c = document.createElement('canvas'); c.width = c.height = W;
    const ctx = c.getContext('2d'), ink = d.text || INK, red = d.accent || RED, small = d.small || MUTED;
    ctx.drawImage(await img(d.art), 0, 0, W, W);
    // headshot cutout (or initials when there isn't one yet)
    let person = null; if (h.photo) person = await img(h.photo).catch(() => null);
    if (person) {
      const ph = 780, pw = person.naturalWidth * ph / person.naturalHeight;
      ctx.drawImage(person, W + 70 - pw, W - ph, pw, ph);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(800, 760, 210, 0, Math.PI * 2); ctx.fill();
      font(ctx, 800, 150); spacing(ctx, 0, 150); ctx.fillStyle = red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(h.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(), 800, 768);
      ctx.textAlign = 'left';
    }
    ctx.textBaseline = 'alphabetic';
    // headline: three lines, shrunk together so the longest fits beside the photo
    const lines = h.kind === 'birthday' ? ['Happy', 'Birthday,', first(h.name) + '!'] : ['Happy', h.years + (h.years === 1 ? ' Year,' : ' Years,'), first(h.name) + '!'];
    let px = h.kind === 'birthday' ? 104 : 96;
    const fit = () => { font(ctx, 800, px); spacing(ctx, -0.02, px); return Math.max.apply(null, lines.map(l => ctx.measureText(l).width)); };
    while (fit() > 540 && px > 56) px -= 2;
    const lh = px * (h.kind === 'birthday' ? 0.98 : 1);
    let y = 170 + px * 0.86;
    lines.forEach((l, i) => { ctx.fillStyle = i === 1 ? red : ink; ctx.fillText(l, 80, y); y += lh; });
    // small line under the headline (anniversary)
    if (h.kind === 'start') {
      y += 12; spacing(ctx, 0, 30);
      font(ctx, 600, 30); ctx.fillStyle = ink;
      ctx.fillText(h.years === 1 ? 'Thank you for a great first year' : 'Thank you for ' + h.years + ' great years', 80, y);
      y += 40; ctx.fillText('at ', 80, y); const at = ctx.measureText('at ').width;
      font(ctx, 800, 30); ctx.fillStyle = red; ctx.fillText('Stewart Title.', 80 + at, y);
    }
    // name + title, sitting on the line above the logo
    spacing(ctx, 0, 26); font(ctx, 600, 26);
    const tl = wrap(ctx, h.title, 385).slice(0, 2);
    let by = 1080 - 190 - 8;
    ctx.fillStyle = small; for (let i = tl.length - 1; i >= 0; i--) { ctx.fillText(tl[i], 80, by); by -= 35; }
    font(ctx, 800, 40); let np = 40; while (ctx.measureText(h.name).width > 395 && np > 22) { np -= 2; font(ctx, 800, np); }
    ctx.fillStyle = ink; ctx.fillText(h.name, 80, by - 4);
    copyright(ctx, d);
    return c;
  }
  // the copyright line every posted graphic carries: a soft strip across the bottom so it reads on any art or photo
  function copyright(ctx, d) {
    const dark = !!d.text && d.text.toUpperCase() === '#FFFFFF';
    ctx.fillStyle = dark ? 'rgba(26,26,28,.78)' : 'rgba(255,255,255,.82)'; ctx.fillRect(0, W - 34, W, 34);
    spacing(ctx, 0, 15); font(ctx, 600, 15); ctx.fillStyle = dark ? '#CFCBC5' : MUTED; ctx.textAlign = 'center';
    ctx.fillText('© ' + new Date().getFullYear() + ' Stewart. All rights reserved. Trademarks are the property of their respective owners.', W / 2, W - 12);
    ctx.textAlign = 'left';
  }
  window.hlDraw = draw;   // used by the template preview

  // ---------- state ----------
  const HL = window.HL = { data: null, loading: false, err: '', pick: {}, pics: {}, busy: {} };
  // built-ins turned off in Marketing Tools › Templates (if every design of a kind is off, the built-ins still show)
  const builtIn = kind => { const off = new Set((HL.data && HL.data.off) || []), all = BUILT_IN.filter(d => d.kind === kind); return all.filter(d => !off.has(kind + '|' + d.name.toLowerCase())); };
  const designsFor = kind => (ds => ds.length ? ds : BUILT_IN.filter(d => d.kind === kind))(builtIn(kind).concat(((HL.data && HL.data.designs) || []).filter(d => d.kind === kind && LAYOUTS[d.layout || 'classic'])));
  // each person starts on a different design (same one every time for them); the manager can still pick another
  const seedOf = k => { let n = 0; for (const ch of String(k)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
  const pick = h => HL.pick[h.key] || (HL.pick[h.key] = { d: (ds => ds[seedOf(h.key) % ds.length].id)(designsFor(h.kind)), c: 0 });
  const design = h => designsFor(h.kind).find(d => d.id === pick(h).d) || designsFor(h.kind)[0];
  async function load() {
    if (HL.loading) return; HL.loading = true;
    try { HL.data = await api('highlights'); HL.err = ''; } catch (err) { HL.err = err.message; HL.data = HL.data || { items: [], designs: [] }; }
    HL.loading = false;
    if (route() === 'home') render();
  }
  HL.load = load;
  function picture(h) {
    const d = design(h), k = h.key + '|' + d.id;
    if (HL.pics[k]) return HL.pics[k].url;
    HL.pics[k] = { url: '' };
    draw(h, d).then(c => new Promise(ok => c.toBlob(ok, 'image/png'))).then(b => { HL.pics[k] = { url: URL.createObjectURL(b), blob: b }; if (route() === 'home') render(); })
      .catch(() => { HL.pics[k] = { url: '', err: true }; if (route() === 'home') render(); });
    return '';
  }
  const findH = key => ((HL.data && HL.data.items) || []).find(x => x.key === key);

  // ---------- home card ----------
  window.hlHomeCard = function () {
    if (!HL.data) { load(); return ''; }
    const items = HL.data.items || [];
    if (!items.length) return '';
    return '<section class="card hl-card"><div><h2>My Team Highlights</h2><div class="hl-sub">Ready-to-share posts for your team’s birthdays and work anniversaries. Each one shows up a week before the date. Only you can see these.</div></div><div class="hl-grid">' +
      items.map(h => {
        const p = pick(h), d = design(h), ds = designsFor(h.kind), url = picture(h), pic = HL.pics[h.key + '|' + d.id] || {};
        return '<div class="hl' + (h.posted ? ' done' : '') + '"><div class="hl-pic">' + (url ? '<img src="' + url + '" alt="' + e((h.kind === 'birthday' ? 'Birthday' : 'Work anniversary') + ' post for ' + h.name) + '">' : pic.err ? '<span class="hl-ph">Couldn’t draw this one</span>' : '<span class="hl-ph"><span class="spin dark"></span></span>') + '</div>' +
          '<div class="r"><div class="who">' + e(h.name) + '</div>' +
          '<div class="when">' + (h.kind === 'birthday' ? '🎂 Birthday' : '⭐ ' + yrs(h.years) + ' at Stewart') + ' · ' + e(when(h.date)) + ' · <b>' + e(inDays(h.days)) + '</b></div>' +
          (ds.length > 1 ? '<div class="chips">Design ' + ds.map(x => '<button type="button" class="' + (x.id === d.id ? 'on' : '') + '" data-act="hl-design" data-key="' + e(h.key) + '" data-d="' + e(x.id) + '"' + (x.review ? ' title="Waiting for review: only Portal Admins see this"' : '') + '>' + e(x.name) + (x.review ? ' · review' : '') + '</button>').join('') + '</div>' : '') +
          '<div class="chips">Caption ' + [0, 1, 2].map(i => '<button type="button" class="' + (p.c === i ? 'on' : '') + '" data-act="hl-cap" data-key="' + e(h.key) + '" data-c="' + i + '">' + (i + 1) + '</button>').join('') + '</div>' +
          '<div class="cap">' + e(caption(h, p.c)) + '</div>' +
          '<div class="btns"><button type="button" class="btn primary" data-act="hl-dl" data-key="' + e(h.key) + '"' + (url ? '' : ' disabled') + '>Download image</button><button type="button" class="btn" data-act="hl-copy" data-key="' + e(h.key) + '">Copy caption</button>' +
          (h.posted ? '<span class="hl-ok">✓ Posted</span><button type="button" class="lnk" data-act="hl-post" data-key="' + e(h.key) + '" data-v="0"' + (HL.busy[h.key] ? ' disabled' : '') + '>Undo</button>'
            : '<button type="button" class="lnk" data-act="hl-post" data-key="' + e(h.key) + '" data-v="1"' + (HL.busy[h.key] ? ' disabled' : '') + '>' + (HL.busy[h.key] ? 'Saving…' : 'Mark as posted') + '</button>') +
          '</div></div></div>';
      }).join('') + '</div></section>';
  };

  ACT['hl-design'] = el => { const h = findH(el.dataset.key); if (h) { pick(h).d = el.dataset.d; render(); } };
  ACT['hl-cap'] = el => { const h = findH(el.dataset.key); if (h) { pick(h).c = Number(el.dataset.c); render(); } };
  ACT['hl-dl'] = el => {
    const h = findH(el.dataset.key); if (!h) return;
    const pic = HL.pics[h.key + '|' + design(h).id]; if (!pic || !pic.url) return;
    const a = document.createElement('a'); a.href = pic.url;
    a.download = (h.kind === 'birthday' ? 'Happy Birthday' : 'Work Anniversary ' + yrs(h.years)) + ' - ' + h.name + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  };
  ACT['hl-copy'] = async el => {
    const h = findH(el.dataset.key); if (!h) return;
    const t = caption(h, pick(h).c);
    try { await navigator.clipboard.writeText(t); toast('Caption copied'); }
    catch (err) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Caption copied'); } catch (x) { toast('Couldn’t copy. Select the caption and copy it.'); } ta.remove(); }
  };
  ACT['hl-post'] = async el => {
    const h = findH(el.dataset.key); if (!h || HL.busy[h.key]) return;
    const v = el.dataset.v === '1';
    HL.busy[h.key] = true; render();
    try { const r = await api('highlights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: h.id, kind: h.kind, key: h.key, posted: v }) }); h.posted = v ? r.posted || true : false; }
    catch (err) { toast(err.message, 7000); }
    HL.busy[h.key] = false; render();
  };
})();
