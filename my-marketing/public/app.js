// My Marketing: the screens. Plain JavaScript, no build step.
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => nk(s).replace(/ /g, '-');
const store = {
  get(k) { try { return localStorage.getItem('mm.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('mm.' + k, v); } catch (e) {} },
};
const firstName = n => String(n || '').trim().split(/\s+/)[0] || '';
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nice = d => { const t = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? '' : MONTHS[t.getMonth()].slice(0, 3) + ' ' + t.getDate(); };
const isComputer = () => window.matchMedia('(min-width: 900px)').matches;
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// ---------- icons (inline, stroke) ----------
const I = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  share: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>',
  play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  bulb: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
  person: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  star: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
  film: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>',
  refresh: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
function catIcon(name) {
  const n = nk(name);
  if (/video|reel/.test(n)) return I.film;
  if (/market/.test(n)) return I.chart;
  if (/tip/.test(n)) return I.bulb;
  if (/newsletter|calendar/.test(n)) return I.cal;
  if (/flyer/.test(n)) return I.doc;
  if (/photo|brand|new hire/.test(n)) return I.person;
  return I.star;
}
const short = name => { const n = nk(name); return /video/.test(n) ? 'Videos' : /market/.test(n) ? 'Market' : /tip/.test(n) ? 'Tips' : /flyer/.test(n) ? 'Flyers' : String(name).split(' ')[0]; };

// ---------- server ----------
async function api(path, opts) {
  const r = await fetch('/api/' + path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}));
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || 'Something went wrong (' + r.status + ')'); e.status = r.status; e.signin = j.signin; throw e; }
  return j;
}

// ---------- state ----------
const S = { data: null, loading: false, err: '', step: 'email', email: store.get('email') || '', busy: false, msg: '', q: '', filter: 'all', installEvt: null };

// ---------- routing: #home, #c/<category>, #p/<id>, #search ----------
const route = () => { const h = (location.hash || '#home').slice(1).split('/'); return { page: h[0] || 'home', arg: decodeURIComponent(h.slice(1).join('/')) }; };
let lastCat = '';
window.addEventListener('hashchange', () => {
  // moving to another category resets its search box and filter
  const r = route(), k = r.page === 'c' ? r.arg : r.page;
  if (r.page !== 'p' && k !== lastCat) { if (r.page !== 'search') S.q = ''; S.filter = 'all'; lastCat = k; }
  render(); window.scrollTo(0, 0);
});
function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

function render() {
  document.body.classList.remove('menu-open');
  const app = $('#app');
  if (!S.data) { app.innerHTML = S.loading ? '<div class="boot"><span class="spin"></span></div>' : signinHtml(); afterSignin(); return; }
  const r = route();
  const fn = { home: homeHtml, c: catHtml, p: pieceHtml, search: searchHtml }[r.page] || homeHtml;
  app.innerHTML = fn(r.arg);
  hydrate();
}

// ================= sign in =================
function signinHtml() {
  const hero = '<div class="hero"><img src="logo-light.png" alt="Stewart Title"><div class="eyebrow">MY MARKETING</div>' +
    '<h1>Your marketing, ready to share.</h1><p>Flyers, title tips and your weekly market update, all in one place.</p></div>';
  let sheet;
  if (S.step === 'email') {
    sheet = '<form id="f-email"><h2>Sign in</h2>' +
      (S.err ? '<div class="err" role="alert">' + esc(S.err) + '</div>' : '') +
      '<label class="field">Email<input id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="' + esc(S.email) + '" required></label>' +
      '<p class="hint">Use the email on your monday.com account (the one you use for the Employee Marketing Portal).</p>' +
      '<button class="btn primary block" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? '<span class="spin"></span>Sending…' : 'Send my code') + '</button>' +
      '<div class="note" style="margin-top:12px">' + I.bell + '<span>We’ll send a 6-digit code to your <b>monday app</b>. No password to remember.</span></div></form>';
  } else {
    sheet = '<form id="f-code"><button type="button" class="back" data-act="change-email">' + I.back + 'Use a different email</button>' +
      '<h2 style="font-size:24px">Check your monday app</h2>' +
      '<p class="hint" style="font-size:15px">We sent a 6-digit code to the monday.com app for <b>' + esc(S.email) + '</b>. It’s good for 10 minutes.</p>' +
      '<div class="notif"><span class="ic" style="color:#fff">' + I.bell + '</span><span><b style="display:block">monday.com</b>Your My Marketing sign-in code is ······</span></div>' +
      (S.err ? '<div class="err" role="alert">' + esc(S.err) + '</div>' : '') +
      '<fieldset style="border:none;margin:0;padding:0"><legend class="field" style="padding:0;margin-bottom:10px">Enter your code</legend><div class="digits">' +
      [0, 1, 2, 3, 4, 5].map(i => '<input aria-label="Digit ' + (i + 1) + '" inputmode="numeric" pattern="[0-9]*" maxlength="' + (i ? 1 : 6) + '" ' + (i ? '' : 'autocomplete="one-time-code"') + ' data-d="' + i + '">').join('') +
      '</div></fieldset>' +
      '<label class="check"><input type="checkbox" id="remember" checked>Keep me signed in on this device for 90 days</label>' +
      '<button class="btn primary block" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? '<span class="spin"></span>Checking…' : 'Sign in') + '</button>' +
      '<div style="text-align:center;display:flex;flex-direction:column;gap:4px;margin-top:6px"><button type="button" class="link" data-act="resend">Send a new code</button>' +
      '<span class="hint">Not getting it? Open the monday app and check your notifications (the bell). Make sure notifications are on for monday.</span></div></form>';
  }
  return '<div class="signin">' + hero + '<div class="sheet"><div>' + sheet + '</div></div></div>';
}
function afterSignin() {
  const e = $('#email'); if (e && !S.busy) e.focus();
  const d0 = document.querySelector('.digits input'); if (d0 && !S.busy) d0.focus();
}
async function requestCode() {
  S.busy = true; S.err = ''; render();
  try { await api('code', { method: 'POST', body: JSON.stringify({ email: S.email }) }); S.step = 'code'; store.set('email', S.email); }
  catch (e) { S.err = e.message; }
  S.busy = false; render();
}
async function submitCode() {
  const code = Array.from(document.querySelectorAll('.digits input')).map(i => i.value).join('');
  if (code.length !== 6) { S.err = 'Enter all 6 digits.'; render(); return; }
  const remember = $('#remember') ? $('#remember').checked : true;
  S.busy = true; S.err = ''; render();
  try { await api('verify', { method: 'POST', body: JSON.stringify({ email: S.email, code, remember }) }); S.busy = false; S.step = 'email'; await load(); }
  catch (e) { S.busy = false; S.err = e.message; render(); }
}

// ================= data =================
async function load(fresh) {
  if (!S.data) { S.loading = true; render(); }
  try { S.data = rename(await api('content' + (fresh ? '?fresh=1' : ''))); S.err = ''; }
  catch (e) { S.data = null; if (e.status !== 401) S.err = e.message; }
  S.loading = false; render();
}
// shorter names for some categories on the site (the monday board keeps its own names)
const NAMES = [[/photos? (and|&)? ?personal branding/, 'Personal Branding'], [/newsletter/, 'Newsletter']];
function rename(d) {
  const fix = n => { const m = NAMES.find(([re]) => re.test(nk(n).replace(/ +/g, ' ')) || re.test(String(n).toLowerCase())); return m ? m[1] : n; };
  (d.categories || []).forEach(c => c.name = fix(c.name));
  (d.pieces || []).forEach(p => p.category = fix(p.category));
  (d.week || []).forEach(p => p.category = fix(p.category));
  // newsletter pictures are named "November 2026 Newsletter - San Diego County": show the area, keep the month aside
  const MRX = new RegExp('(' + MONTHS.join('|') + ')\\s+\\d{4}', 'i');
  const nlFix = p => { if (p._nl) return; const m = String(p.title).match(MRX); p.month = m ? m[1] : ''; const a = String(p.title).replace(/^.*?newsletter\s*[-·]\s*/i, '').trim(); if (a && a !== p.title) p.title = a; p._nl = 1; };
  (d.pieces || []).filter(p => /newsletter/i.test(p.category)).forEach(nlFix);
  (d.newsletter || []).forEach(p => { p.category = fix(p.category); const same = (d.pieces || []).find(x => x.id === p.id); if (same) { p.title = same.title; p.month = same.month; } else nlFix(p); });
  return d;
}
const pieces = () => (S.data && S.data.pieces) || [];
const byId = id => pieces().find(p => p.id === id);
const inCat = c => pieces().filter(p => nk(p.category) === nk(c));
const catByslug = s => ((S.data && S.data.categories) || []).find(c => slug(c.name) === s);

// ================= shared pieces =================
function tabs(active) {
  const cats = S.data.categories || [];
  const allCats = [['home', 'Home']].concat(cats.map(c => ['c/' + slug(c.name), c.name]));
  // computers: menu across the top
  const desk = '<header class="topbar"><div class="wrap"><img class="logo" src="logo-light.png" alt="Stewart Title"><nav aria-label="Main">' +
    allCats.map(([h, l]) => '<a href="#' + h + '" class="' + (active === h ? 'on' : '') + '">' + esc(l) + '</a>').join('') + '</nav>' +
    '<button class="avatar" data-act="account" aria-label="Account">' + esc(initials(S.data.name)) + '</button></div></header>';
  // phones: a top bar with the three-line menu button that slides the menu out
  const link = (h, label, ic, extra) => '<a href="#' + h + '" class="' + (active === h ? 'on' : '') + '"' + (active === h ? ' aria-current="page"' : '') + '><span class="mi">' + ic + '</span><span class="ml">' + esc(label) + '</span>' + (extra || '') + '</a>';
  const phone = '<header class="mbar"><a href="#home" class="mlogo"><img src="logo-light.png" alt="Stewart Title · My Marketing home"></a>' +
    '<button class="menubtn" data-act="menu" aria-label="Open menu" aria-expanded="false" aria-controls="drawer"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></header>' +
    '<div class="scrim" data-act="menu-close" hidden></div>' +
    '<nav class="drawer" id="drawer" aria-label="Main" hidden><div class="dhead"><img src="logo-light.png" alt="Stewart Title"><button class="menubtn" data-act="menu-close" aria-label="Close menu">' + I.x.replace(/18/g, '24') + '</button></div>' +
    '<div class="dwho"><span class="avatar">' + esc(initials(S.data.name)) + '</span><span><b>' + esc(S.data.name) + '</b><span>My Marketing</span></span></div>' +
    '<div class="dlinks">' + link('home', 'Home', I.home) +
    cats.map(c => link('c/' + slug(c.name), c.name, catIcon(c.name), c.newCount ? '<span class="dnew">' + c.newCount + ' new</span>' : '')).join('') +
    link('search', 'Search', I.search) + '<button class="dl-refresh" data-act="refresh">' + '<span class="mi">' + I.refresh + '</span><span class="ml">Check for new pieces</span></button></div>' +
    '<div class="dfoot"><button class="btn block" data-act="signout">Sign out</button><span>Questions? Contact the West Marketing team.</span></div></nav>';
  return { top: desk + phone, bottom: '' };
}
function openMenu(open) {
  const d = $('#drawer'), sc = document.querySelector('.scrim'), b = document.querySelector('.mbar .menubtn');
  if (!d) return;
  d.hidden = !open; sc.hidden = !open; if (b) b.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
  requestAnimationFrame(() => d.classList.toggle('in', open));
  if (open) { const f = d.querySelector('.dlinks a.on') || d.querySelector('.dlinks a'); if (f) f.focus(); } else if (b) b.focus();
}
function thumbInner(p) {
  if (p.kind === 'image') return '<img src="' + esc(p.url) + '" alt="" loading="lazy" decoding="async">';
  if (p.kind === 'video') return '<video class="vthumb" src="' + esc(p.url) + '#t=0.5" muted playsinline preload="metadata" tabindex="-1"></video><span class="play">' + I.play + '</span><span class="vtag" hidden></span>';
  return '<span class="doc">' + I.doc + (p.ext || 'FILE').toUpperCase() + '</span>';
}
function card(p) {
  return '<a class="card" href="#p/' + esc(p.id) + '"><span class="thumb">' + thumbInner(p) + (p.isNew ? '<span class="badge">NEW</span>' : '') + '</span><span class="ttl">' + esc(p.title) + '</span></a>';
}
// a card with its own Download (and Share, where the device can share) underneath
function cardWithDownload(p) {
  const canShare = !!(navigator.share && navigator.canShare) && !isComputer();
  return '<div class="card dl">' + card(p).replace(/^<a class="card"/, '<a class="cardlink"') +
    '<div class="cardacts"><a class="btn mini" href="' + esc(p.url) + '?dl=1" download aria-label="Download ' + esc(p.title) + '">' + I.down + 'Download</a>' +
    (canShare ? '<button class="btn mini icon" data-share="' + esc(p.id) + '" aria-label="Share ' + esc(p.title) + '">' + I.share + '</button>' : '') + '</div></div>';
}
function installCard() {
  if (standalone() || store.get('installHidden')) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let how;
  if (S.installEvt) how = '<button class="btn primary" style="min-height:44px;margin-top:10px" data-act="install">Add to home screen</button>';
  else if (ios) how = '<p>In Safari, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>';
  else if (isComputer()) how = '<p>In Edge or Chrome, open the browser menu and choose <b>Apps → Install</b> (or <b>Install My Marketing</b>).</p>';
  else how = '<p>In Chrome, tap the <b>⋮</b> menu, then <b>Add to Home screen</b>.</p>';
  return '<section class="blk"><div class="wrap"><div class="install"><img src="icons/icon-192.png" alt=""><div><b>Keep My Marketing one tap away</b>' + how + '</div>' +
    '<button class="x" data-act="hide-install" aria-label="Hide this tip">' + I.x + '</button></div></div></section>';
}
function foot() {
  return '<div class="foot"><div class="wrap"><span>Signed in as ' + esc(S.data.name) + '</span><button class="link" data-act="signout">Sign out</button>' +
    '<span>Questions? Contact the West Marketing team.</span></div></div>';
}

// ================= home =================
function homeHtml() {
  const t = tabs('home'), now = new Date();
  const all = pieces(), newCount = all.filter(p => p.isNew).length;
  let h = t.top + '<div class="frame">';
  h += '<header class="homehead"><div class="wrap"><div><div class="row1"><img src="logo-light.png" alt="Stewart Title"><button class="avatar" data-act="account" aria-label="Account">' + esc(initials(S.data.name)) + '</button></div>' +
    '<div class="date">' + DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + '</div>' +
    '<h1>Hi ' + esc(firstName(S.data.name)) + '</h1>' +
    '<p>' + (newCount ? 'You have <b>' + newCount + ' new piece' + (newCount === 1 ? '' : 's') + '</b> ready to share.' : all.length ? 'Everything you have is below, ready to share.' : 'Your marketing will show up here as soon as it’s ready.') + '</p></div>' +
    '<button class="refresh" data-act="refresh" aria-label="Check for new pieces">' + I.refresh + '<span>Refresh</span></button>' +
    '<form class="search dark" id="f-search" role="search"><span style="color:var(--muted-dark);display:flex">' + I.search + '</span><input type="search" id="q" placeholder="Search flyers, tips, updates" aria-label="Search"></form></div></header>';

  const week = S.data.week || [];
  if (week.length) {
    const vid = week.find(p => p.kind === 'video'), imgs = week.filter(p => p !== vid && p.kind === 'image');
    const anyNew = week.some(p => p.isNew), d = week[0].date;
    h += '<section class="blk"><div class="wrap"><div class="h2row"><h2 class="h">' + (anyNew ? 'This week’s market update' : 'Your market update') + '</h2>' + (anyNew ? '<span class="badge">NEW</span>' : '') + '</div>' +
      '<div class="sub">' + (d ? 'Updated ' + nice(d) : '') + (imgs.length ? ' · ' + esc(imgs.map(p => p.title).join(', ')) : '') + '</div>' +
      '<div class="week">' + (vid ? '<div class="hero"><video src="' + esc(vid.url) + '#t=0.5" controls playsinline preload="metadata" aria-label="Market update video"></video></div>' : '') +
      '<div style="display:flex;flex-direction:column;gap:12px">' + (imgs.length ? '<div class="areas">' + imgs.map(cardWithDownload).join('') + '</div>' : '') +
      '<button class="btn primary block" data-share-week="1">' + I.share + 'Share this week’s update</button>' +
      (vid ? '<a class="btn block" href="#p/' + esc(vid.id) + '">Open the video</a>' : '') + '</div></div></div></section>';
  }

  // this month's newsletter / event calendar (one picture per area)
  const nl = S.data.newsletter || [];
  if (nl.length) {
    const m = (nl.find(p => p.month) || {}).month || '';
    const areas = nl.map(p => p.title).filter(Boolean);
    const nlNew = nl.some(p => p.isNew);
    h += '<section class="blk"><div class="wrap"><div class="h2row"><h2 class="h">Your ' + esc(m ? m + ' ' : '') + 'newsletter</h2>' + (nlNew ? '<span class="badge">NEW</span>' : '') + '</div>' +
      '<div class="sub">Local events plus this month’s homeowner tips' + (areas.length ? ' · ' + esc(areas.join(', ')) : '') + '</div>' +
      '<div class="strip wide">' + nl.map(cardWithDownload).join('') + '</div>' +
      '<button class="btn primary" style="margin-top:12px" data-share-nl="1">' + I.share + 'Share the newsletter</button></div></section>';
  }

  const cats = S.data.categories || [];
  if (cats.length) {
    h += '<section class="blk"><div class="wrap"><h2 class="h">Browse</h2><div class="tiles">' + cats.map(c =>
      '<a class="tile" href="#c/' + esc(slug(c.name)) + '"><span class="ic" style="color:var(--brand)">' + catIcon(c.name) + '</span><b>' + esc(c.name) + '</b>' +
      '<span class="c">' + c.count + ' piece' + (c.count === 1 ? '' : 's') + (c.newCount ? ' · <em>' + c.newCount + ' new</em>' : '') + '</span></a>').join('') + '</div></div></section>';
  }

  const fresh = all.filter(p => p.isNew && !/market|newsletter/i.test(p.category));
  const latestCat = cats.find(c => !/market|newsletter/i.test(c.name));
  const row = fresh.length ? fresh : latestCat ? inCat(latestCat.name) : [];
  if (row.length) {
    h += '<section class="blk"><div class="wrap"><div class="h2row"><h2 class="h">' + (fresh.length ? 'New for you' : 'Latest ' + esc(latestCat.name.toLowerCase())) + '</h2>' +
      (!fresh.length && latestCat ? '<a href="#c/' + esc(slug(latestCat.name)) + '" style="font-size:14px;font-weight:600">See all</a>' : '') + '</div>' +
      '<div class="strip wide">' + row.slice(0, 12).map(cardWithDownload).join('') + '</div></div></section>';
  }
  if (!all.length) h += '<section class="blk"><div class="wrap"><div class="empty">Nothing here yet. When West Marketing adds pieces for you on the Employee Marketing Portal, they appear here automatically.</div></div></section>';
  h += installCard() + foot() + '</div>' + t.bottom;
  return h;
}

// ================= a category =================
function catHtml(s) {
  const c = catByslug(s);
  if (!c) return homeHtml();
  const t = tabs('c/' + s);
  const list = inCat(c.name);
  const shown = list.filter(p => (S.filter !== 'new' || p.isNew) && (!S.q || nk(p.title).includes(nk(S.q))));
  let h = t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#home">' + I.back + 'Home</a>' +
    '<div><h1>' + esc(c.name) + '</h1><p>' + list.length + ' piece' + (list.length === 1 ? '' : 's') + ' with your photo and contact info · tap one to share</p></div>' +
    (list.length > 6 ? '<label class="search">' + '<span style="color:var(--muted);display:flex">' + I.search + '</span><input type="search" id="cq" placeholder="Search ' + esc(c.name.toLowerCase()) + '" aria-label="Search ' + esc(c.name) + '" value="' + esc(S.q) + '"></label>' : '') +
    (c.newCount ? '<div class="chips"><button class="chip ' + (S.filter !== 'new' ? 'on' : '') + '" data-filter="all">All</button><button class="chip ' + (S.filter === 'new' ? 'on' : '') + '" data-filter="new">New (' + c.newCount + ')</button></div>' : '') +
    '</div></header><div class="body"><div class="wrap" id="results">' + resultsHtml(c.name, shown) + '</div></div>' + foot() + '</div>' + t.bottom;
  return h;
}
// ---------- sections ----------
// Each category can be split into sections (matched on each piece's name). Sections show as sideways rows;
// a section only appears once something is in it, and anything unmatched goes in the last "More …" section.
// A category with no rules here (any new one) shows as a grid. Every piece gets the red Download button.
const SECTION_RULES = [
  [/brand|photo/, 'More branding', [
    ['Headshots', /headshot|facing|portrait|photo/],
    ['Business Cards', /business card/],
    ['Drop Cards', /drop card|door hanger|leave behind/],
    ['Email Signature', /signature/],
    ['Name Badges', /badge|name tag/],
    ['Social Media Profile', /profile|banner|cover|avatar/],
    ['Bio & Introductions', /\bbio\b|about me|introduc|meet /],
  ]],
  [/flyer/, 'More flyers', [
    ['Spanish', /spanish|espanol/],
    ['Rates & Closing Costs', /\brate\b|\bstar\b|closing cost|expect to pay|fees?\b/],
    ['Plat Maps', /plat map/],
    ['Fraud & Safety', /fraud|cyber|wire|scam|notary/],
    ['Wildfire', /wildfire|fire safety|fire readiness/],
    ['Buyers & Sellers', /buyer|seller|earnest|renting|owning|closing disclosure|realtor|title insurance|holding title/],
    ['Property, Tax & Law', /tax|exemption|proposition|solar|adu|partition|quiet title|deed|trust|homestead|chapter|\bbill\b|guarantee|inspection|preliminary|investment|disbursement/],
    ['Local Info', /directory|numbers|utilities|services|stewart now|app\b/],
  ]],
  [/tip/, 'More tips', [
    ['Safety Tips', /safety|meeting|showing|access|red flag|verify|looked familiar/],
    ['Farming & Marketing', /farm|data|tool|marketing/],
    ['Title Stories', /^the |mystery|easement|deed|transfer|closing date/],
  ]],
  [/market/, 'Area graphics', [
    ['Video', /video|slideshow/],
  ]],
];
function sectionsFor(cat, list) {
  const rule = SECTION_RULES.find(([re]) => re.test(nk(cat)));
  if (!rule) return [{ name: cat, items: list }];
  const [, moreName, defs] = rule;
  const out = defs.map(([name]) => ({ name, items: [] })), more = { name: moreName, items: [] };
  list.forEach(p => {
    const text = nk(p.row + ' ' + p.title), raw = String(p.title).toLowerCase();
    const i = defs.findIndex(([, re]) => re.test(text) || re.test(raw));
    (i >= 0 ? out[i] : more).items.push(p);
  });
  return out.concat(more).filter(x => x.items.length);
}
function resultsHtml(cat, shown) {
  if (!shown.length) return '<div class="empty">Nothing matches. Try a different word.</div>';
  const secs = sectionsFor(cat, shown);
  if (secs.length < 2) return '<div class="grid dlgrid">' + shown.map(cardWithDownload).join('') + '</div>';
  return '<nav class="chips" aria-label="Sections" style="margin-bottom:18px">' + secs.map(x => '<a class="chip" style="display:inline-flex;align-items:center;text-decoration:none" href="#sec-' + slug(x.name) + '" data-jump="sec-' + slug(x.name) + '">' + esc(x.name) + ' (' + x.items.length + ')</a>').join('') + '</nav>' +
    secs.map(x => '<section id="sec-' + slug(x.name) + '" style="margin-bottom:28px;scroll-margin-top:84px"><div class="h2row" style="margin-bottom:12px"><h2 class="h">' + esc(x.name) + '</h2>' +
      (x.items.length > 2 ? '<span class="hint">Swipe for more →</span>' : '') + '</div><div class="strip wide">' + x.items.map(cardWithDownload).join('') + '</div></section>').join('');
}

// ================= search everything =================
function searchHtml() {
  const t = tabs('search');
  const q = S.q;
  const shown = q ? pieces().filter(p => nk(p.title + ' ' + p.category).includes(nk(q))) : [];
  return t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#home">' + I.back + 'Home</a><h1>Search</h1>' +
    '<label class="search"><span style="color:var(--muted);display:flex">' + I.search + '</span><input type="search" id="sq" placeholder="Search flyers, tips, updates" aria-label="Search" value="' + esc(q) + '"></label></div></header>' +
    '<div class="body"><div class="wrap" id="results">' + (q ? (shown.length ? '<p class="hint" style="margin:0 0 12px">' + shown.length + ' result' + (shown.length === 1 ? '' : 's') + '</p><div class="grid dlgrid">' + shown.map(cardWithDownload).join('') + '</div>' : '<div class="empty">Nothing matches “' + esc(q) + '”.</div>') : '') + '</div></div></div>' + t.bottom;
}

// ================= one piece =================
function pieceHtml(id) {
  const p = byId(id);
  if (!p) return homeHtml();
  const sib = inCat(p.category), i = sib.indexOf(p);
  const prev = sib[i - 1], next = sib[i + 1];
  const t = tabs('c/' + slug(p.category));
  let media;
  if (p.kind === 'image') media = '<img src="' + esc(p.url) + '" alt="' + esc(p.title) + '">';
  else if (p.kind === 'video') media = '<video src="' + esc(p.url) + '#t=0.5" controls playsinline preload="metadata" aria-label="' + esc(p.title) + '"></video>';
  else media = '<span class="doc">' + I.doc + (p.ext || 'FILE').toUpperCase() + '<a class="btn" style="margin-top:10px;letter-spacing:0" href="' + esc(p.url) + '" target="_blank" rel="noopener">Open the ' + (p.ext || 'file').toUpperCase() + '</a></span>';
  const canShare = !!(navigator.share && navigator.canShare);
  return t.top + '<div class="piece"><div class="top"><a class="back light" href="#c/' + esc(slug(p.category)) + '">' + I.back + esc(p.category) + '</a>' +
    '<span class="pos">' + (prev ? '<button data-go="' + esc(prev.id) + '" aria-label="Previous">' + I.back + '</button>' : '') + (i + 1) + ' of ' + sib.length + (next ? '<button data-go="' + esc(next.id) + '" aria-label="Next">' + I.next + '</button>' : '') + '</span></div>' +
    '<div class="wrap2"><div class="stage"><div class="media">' + media + '</div><div><h1>' + esc(p.title) + '</h1><div class="meta">' + esc(p.category) + (p.kind === 'image' ? ' · image' : p.kind === 'video' ? (/video/i.test(p.category) ? '' : ' · video') : ' · ' + (p.ext || '').toUpperCase()) + (p.date ? ' · added ' + nice(p.date) : '') + (p.isNew ? ' · NEW' : '') + '</div></div></div>' +
    '<div class="acts">' +
    (canShare || !isComputer() ? '<button class="btn primary block" data-share="' + esc(p.id) + '" style="min-height:54px">' + I.share + 'Share</button>' : '') +
    '<a class="btn block' + (canShare || !isComputer() ? '' : ' primary') + '" href="' + esc(p.url) + '?dl=1" download>' + I.down + 'Download</a>' +
    '<div class="note" style="margin-top:4px">' + I.info + '<span>' + (isComputer() ? 'Download saves it to your computer so you can post it or attach it to an email.' : (p.kind === 'video' ? 'Share opens your phone’s share menu: Instagram, Facebook, LinkedIn, Messages and more. To keep it in your Photos, tap Share, then <b>Save Video</b>.' + (p.size > 25e6 ? ' Larger videos take a moment to get ready.' : '') : 'Share opens your phone’s share menu: Instagram, Facebook, LinkedIn, Messages, email and <b>Save Image</b> to keep it in your photos.')) + '</span></div>' +
    '</div></div></div>';
}

// ================= sharing =================
// phones only allow the share menu right after a tap, so files are fetched ahead of time where we can
const FILES = new Map();
function fileFor(p) {
  if (FILES.has(p.id)) return FILES.get(p.id);
  const pr = fetch(p.url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error('Could not load ' + p.title); return r.blob(); }).then(b => {
    const name = (p.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Stewart') + '.' + (p.ext || 'png');
    return new File([b], name, { type: b.type || 'application/octet-stream' });
  });
  pr.catch(() => FILES.delete(p.id));
  FILES.set(p.id, pr);
  if (FILES.size > 40) FILES.delete(FILES.keys().next().value);
  return pr;
}
function prefetch(list) { if (navigator.share && navigator.canShare) list.forEach(p => { if (p.size < 25e6) fileFor(p).catch(() => {}); }); }
async function share(list) {
  if (!list.length) return;
  if (!(navigator.share && navigator.canShare)) { download(list); return; }
  toast(list.length > 1 ? 'Getting ' + list.length + ' files ready…' : 'Getting it ready…', 15000);
  try {
    const files = await Promise.all(list.map(fileFor));
    hideToast();
    const data = { files };
    if (!navigator.canShare(data)) { download(list); return; }
    await navigator.share(data);
  } catch (e) {
    hideToast();
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'NotAllowedError') { toast('Tap Share again to open the share menu.'); return; }
    download(list);
  }
}
function download(list) {
  list.forEach((p, i) => setTimeout(() => { const a = document.createElement('a'); a.href = p.url + '?dl=1'; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); }, i * 400));
  toast(list.length > 1 ? 'Downloading ' + list.length + ' files' : 'Downloading');
}
let toastT;
function toast(text, ms) { hideToast(); const el = document.createElement('div'); el.className = 'toast'; el.id = 'toast'; el.setAttribute('role', 'status'); el.textContent = text; document.body.appendChild(el); toastT = setTimeout(hideToast, ms || 2600); }
function hideToast() { clearTimeout(toastT); const el = $('#toast'); if (el) el.remove(); }

// ================= events =================
function hydrate() {
  const r = route();
  if (r.page === 'p' && byId(r.arg)) prefetch([byId(r.arg)]);
  if (r.page === 'home' && S.data.week) setTimeout(() => prefetch(S.data.week), 1500);
  const cq = $('#cq'); if (cq && S.q) { cq.focus(); cq.setSelectionRange(cq.value.length, cq.value.length); }
  const sq = $('#sq'); if (sq) sq.focus();
}
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'f-email') { S.email = $('#email').value.trim().toLowerCase(); if (S.email) requestCode(); }
  if (e.target.id === 'f-code') submitCode();
  if (e.target.id === 'f-search') { S.q = $('#q').value.trim(); if (S.q) go('search'); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.d != null) {
    const all = Array.from(document.querySelectorAll('.digits input'));
    const v = t.value.replace(/\D/g, '');
    if (v.length > 1) { v.slice(0, 6).split('').forEach((c, k) => { if (all[k]) all[k].value = c; }); const last = all[Math.min(v.length, 6) - 1]; if (last) last.focus(); }
    else { t.value = v; if (v && all[+t.dataset.d + 1]) all[+t.dataset.d + 1].focus(); }
    if (all.every(x => x.value)) submitCode();
    return;
  }
  if (t.id === 'cq') { S.q = t.value; const c = catByslug(route().arg); const shown = inCat(c.name).filter(p => (S.filter !== 'new' || p.isNew) && (!S.q || nk(p.title).includes(nk(S.q)))); $('#results').innerHTML = resultsHtml(c.name, shown); }
  if (t.id === 'sq') { S.q = t.value; clearTimeout(window._sq); window._sq = setTimeout(() => { const pos = t.selectionStart; render(); const n = $('#sq'); if (n) n.setSelectionRange(pos, pos); }, 200); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { openMenu(false); return; }
  const t = e.target;
  if (t.dataset && t.dataset.d != null && e.key === 'Backspace' && !t.value) { const prev = document.querySelector('.digits input[data-d="' + (+t.dataset.d - 1) + '"]'); if (prev) { prev.focus(); prev.value = ''; } }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act],[data-share],[data-share-week],[data-share-nl],[data-go],[data-filter],[data-jump]');
  if (!el) return;
  const d = el.dataset;
  if (d.jump) { e.preventDefault(); const s = document.getElementById(d.jump); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (d.share) { e.preventDefault(); const p = byId(d.share); if (p) share([p]); return; }
  if (d.shareWeek) { e.preventDefault(); share((S.data.week || []).slice()); return; }
  if (d.shareNl) { e.preventDefault(); share((S.data.newsletter || []).slice()); return; }
  if (d.go) { go('p/' + d.go); return; }
  if (d.filter) { S.filter = d.filter; render(); return; }
  if (d.act === 'refresh') { doRefresh(); return; }
  if (d.act === 'menu') { openMenu(true); return; }
  if (d.act === 'menu-close') { openMenu(false); return; }
  if (d.act === 'change-email') { S.step = 'email'; S.err = ''; render(); }
  if (d.act === 'resend') { S.step = 'email'; await requestCode(); }
  if (d.act === 'signout' || d.act === 'account') {
    if (d.act === 'account' && !confirmSignout()) return;
    await api('logout', { method: 'POST' }).catch(() => {}); S.data = null; S.step = 'email'; S.err = ''; location.hash = ''; render();
  }
  if (d.act === 'hide-install') { store.set('installHidden', '1'); render(); }
  if (d.act === 'install' && S.installEvt) { const ev = S.installEvt; ev.prompt(); try { await ev.userChoice; } catch (x) {} S.installEvt = null; render(); }
});
function confirmSignout() { return window.confirm('Signed in as ' + S.data.name + '.\n\nSign out of My Marketing on this device?'); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (S.data) render(); });
window.addEventListener('appinstalled', () => { S.installEvt = null; store.set('installHidden', '1'); if (S.data) render(); });
// new things may have arrived while the app sat in the background
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.data && Date.now() - (S.loadedAt || 0) > 60e3) { S.loadedAt = Date.now(); load(); } });

S.loadedAt = Date.now();
load();

// video cards: show length and shape (Vertical for Reels/Stories, Square, Widescreen) once the video's details load
const vlen = t => { t = Math.round(t || 0); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
document.addEventListener('loadedmetadata', e => {
  const v = e.target;
  if (!(v instanceof HTMLVideoElement) || !v.classList.contains('vthumb')) return;
  const tag = v.parentNode.querySelector('.vtag'); if (!tag || !v.videoWidth) return;
  const r = v.videoWidth / v.videoHeight;
  tag.textContent = vlen(v.duration) + ' · ' + (r < 0.9 ? 'Vertical' : r > 1.1 ? 'Widescreen' : 'Square');
  tag.hidden = false;
}, true);

// ---------- check monday for new pieces (Refresh button, menu, or pull down from the top) ----------
let refreshing = false;
async function doRefresh() {
  if (refreshing || !S.data) return;
  refreshing = true;
  const y = window.scrollY;
  document.body.classList.add('updating'); toast('Updating…', 60000);
  S.loadedAt = Date.now(); await load(true);
  window.scrollTo(0, y);
  document.body.classList.remove('updating'); hideToast();
  refreshing = false;
}
// pull down from the top of the page to refresh (home-screen apps on iPhone have no reload button)
(function pullToRefresh() {
  const ptr = document.createElement('div');
  ptr.className = 'ptr'; ptr.setAttribute('aria-hidden', 'true'); ptr.innerHTML = I.refresh;
  document.body.appendChild(ptr);
  const spin = document.createElement('div'); spin.className = 'topspin'; spin.setAttribute('role', 'status'); spin.setAttribute('aria-label', 'Updating'); document.body.appendChild(spin);
  const LIMIT = 80;
  let startY = 0, startX = 0, pulling = false, dist = 0;
  document.addEventListener('touchstart', e => {
    if (!S.data || refreshing || window.scrollY > 0 || document.body.classList.contains('menu-open') || e.touches.length !== 1) return;
    if (e.target.closest('.strip, .chips, video, input, textarea')) return;
    startY = e.touches[0].clientY; startX = e.touches[0].clientX; pulling = true; dist = 0;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
    if (dy <= 0 || dx > dy || window.scrollY > 0) { dist = 0; ptr.style.transform = ''; ptr.classList.remove('on', 'ready'); return; }
    dist = Math.min(dy * 0.5, LIMIT + 30);
    ptr.classList.add('on'); ptr.classList.toggle('ready', dist >= LIMIT);
    ptr.style.transform = 'translate(-50%, ' + dist + 'px) rotate(' + (dist * 3) + 'deg)';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    const go = dist >= LIMIT;
    ptr.style.transform = ''; ptr.classList.remove('on', 'ready');
    if (go) doRefresh();
  });
})();
