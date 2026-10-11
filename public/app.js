// Stewart Marketing Manager Portal
'use strict';

// ---------- request types (label = the exact "Purpose of Project" label on the Marketing Request board) ----------
const T = (key, name, sub, label, kind) => ({ key, name, sub, label, kind: kind || 'basic' });
const TYPES = {
  California: [
    ['Print', [T('flyer', 'Flyer · full page', '8.5 × 11 in', 'Flyer Full Page 8.5x11 in'), T('halfflyer', 'Flyer · half page', '8.5 × 5.5 in', 'Flyer Half Page 8.5x5.5 in'),
      T('postcard', 'Postcard', '4 × 6 in', 'Postcard 4x6 in'), T('bizcard', 'Business card', '3.5 × 2 in', 'Business Card 3.5x2 in')]],
    ['Events + classes', [T('class', 'Class flyer', 'Workshop or seminar (non-CE)', 'Class Flyer - Non CE', 'class'), T('event', 'Event promotion', 'Flyer, post and email together', 'Event Promotion', 'event'),
      T('video', 'Video', 'Event or promo video', 'Video')]],
    ['Digital + social', [T('square', 'Social post · square', '1080 × 1080 px', 'Social Media Square 1080x1080 px'), T('story', 'Social story / reel', '1080 × 1920 px', 'Social Media Story/Reel 1080x1920 px'),
      T('fbcover', 'Facebook cover', 'Page or profile header', 'Social Media Facebook Cover'), T('emailtpl', 'Email template', 'Reusable email design', 'Email Marketing Template'),
      T('eblast', 'Email e-blast', 'One-time send to a list', 'Email Marketing E-Blast')]],
    ['More', [T('sig', 'Signature block', 'Email signature update', 'Signature Block'), T('photo', 'Edit a picture', 'Headshot or photo fix', 'Edit Picture'), T('qr', 'QR code', 'Linked to any web page', 'QR Code')]],
  ],
  Arizona: [
    ['Events + classes', [T('broker', 'Broker open', 'Flyer for a broker open', 'Broker Open', 'property'), T('openhouse', 'Open house', 'Flyer for an open house', 'Open House', 'property'),
      T('classce', 'Class flyer · CE', 'Continuing-education course', 'Class Flyer - CE', 'classce'), T('class', 'Class flyer · non-CE', 'Workshop or seminar', 'Class Flyer - Non CE', 'class')]],
    ['Print + digital', [T('bizcard', 'Business cards', '3.5 × 2 in', 'Business Card 3.5x2 in'), T('eblast', 'Email marketing e-blast', 'One-time send to a list', 'Email Marketing E-Blast')]],
    ['Photos', [T('headshot', 'Update headshot', 'New photo on your materials', 'Update Headshot')]],
  ],
};
const OTHER = T('other', 'Something else', 'Don’t see what you need? Describe it.', 'Other (Please specify in the project description below)', 'other');
const LOOKS = [['Modern Dark', 'dark', 'Bold, high-contrast, red accents'], ['Classic Light', 'light', 'Clean and bright, timeless']];

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const nice = s => { if (!s) return ''; const d = new Date(String(s).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? s : DAYS[d.getDay()].slice(0, 3) + ', ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
function toast(msg, ms) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), ms || 4000); }
function statusClass(s) { return /complete|done|ready on/i.test(s) ? 'done' : /proof/i.test(s) ? 'proof' : /work|design|waiting/i.test(s) ? 'work' : ''; }
async function api(path, opts) {
  const r = await fetch('/api/' + path, Object.assign({ credentials: 'same-origin' }, opts || {}));
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(j.error || ('Something went wrong (' + r.status + ')')); err.status = r.status; err.data = j; throw err; }
  return j;
}

// red icons used in the contact blocks (same as on the flyers)
const CB_ICONS = {
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#A30C33" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
  mail: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4.5" width="20" height="15" rx="1.5" fill="#A30C33"/><path d="M3 6l9 7 9-7" fill="none" stroke="#FFFFFF" stroke-width="1.6"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="#A30C33" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
};

// ---------- state ----------
const S = { me: null, reqs: null, busy: false, nh: null, rq: null, last: null };
function freshNewHire() { return { step: 1, firstName: '', lastName: '', title: '', titleOther: '', startDate: '', company: 'Stewart Title of California, Inc.', office: '', address1: '', address2: '', phone: '', email: '', show: { phone: true, email: true, address: true, headshot: true }, photo: null, photoUrl: '', areas: [], ar: null, nlAreas: [], nlf: null, bio: null, looks: ['Modern Dark'], notes: '' }; }
function freshRequest() { return { step: 1, state: 'California', type: null, other: '', projectName: '', who: 'pick', people: [], needBy: inDays(7), description: '', files: [], photos: [], x: {} }; }

// ---------- routing ----------
const route = () => (location.hash || '#home').slice(1).split('/')[0] || 'home';
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }

function nav() {
  const r = route(), me = S.me;
  const open = S.reqs ? S.reqs.requests.filter(x => !/complete/i.test(x.status)).length : 0;
  const link = (h, label, extra) => '<a class="nav ' + ((r === h || (h === 'newhire' && r === 'submitted') || (h === 'request' && r === 'sent')) ? 'on' : '') + '" href="#' + h + '">' + label + (extra ? '<span class="count">' + extra + '</span>' : '') + '</a>';
  return '<img class="logo" src="logo-light.png" alt="Stewart Title"><div class="tag">MANAGER PORTAL</div>' +
    link('home', 'Home') + link('team', 'My Team') + link('newhire', 'New Hires') + link('request', 'Marketing Requests') + link('mine', 'My Requests', open || '') +
    '<div class="me"><span class="av">' + esc(initials(me.name)) + '</span><span class="who"><b>' + esc(me.name) + '</b><span>' + (me.admin ? 'Portal admin' : 'Manager') + '</span></span>' +
    '<a href="/cdn-cgi/access/logout">Sign out</a></div>' +
    (!isInstalled() ? '<button class="install" onclick="installApp()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 19h16"/></svg>Install on this computer</button>' : '');
}
// "Install on this computer" - Edge/Chrome let the portal live on the desktop and taskbar as its own app
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.me) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; if (S.me) render(); });
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
// Edge and Chrome can install with one click. Safari and others need a couple of steps, so we show how.
async function installApp() {
  if (installEvt) { const e = installEvt; e.prompt(); try { await e.userChoice; } catch (x) {} installEvt = null; if (S.me) render(); return; }
  const ua = navigator.userAgent, mac = /Macintosh/.test(ua), ios = /iPhone|iPad|iPod/.test(ua) || (mac && navigator.maxTouchPoints > 1);
  const edge = /Edg\//.test(ua), chrome = /Chrome\//.test(ua) && !edge, firefox = /Firefox\//.test(ua), safari = /Safari\//.test(ua) && !chrome && !edge;
  let title = 'Install the Manager Portal', steps;
  if (ios) steps = ['Tap the <b>Share</b> button (the square with an arrow).', 'Choose <b>Add to Home Screen</b>, then <b>Add</b>.'];
  else if (safari && mac) { title = 'Add the Manager Portal to your Dock'; steps = ['In the menu bar at the top of the screen, click <b>File</b>.', 'Choose <b>Add to Dock…</b>, then click <b>Add</b>.', 'It opens in its own window from the Dock and Launchpad. (Needs macOS Sonoma or newer.)']; }
  else if (edge) steps = ['Click the <b>⋯</b> menu at the top right of Edge.', 'Choose <b>Apps</b> → <b>Install this site as an app</b>, then <b>Install</b>.', 'Tick <b>Pin to taskbar</b> and <b>Create desktop shortcut</b> if Edge asks.'];
  else if (chrome) steps = ['Click the <b>⋮</b> menu at the top right of Chrome.', 'Choose <b>Cast, save and share</b> → <b>Install page as app</b> (or <b>Install Manager Portal</b>).', 'Click <b>Install</b>.'];
  else if (firefox) steps = ['Firefox can’t install websites as apps.', 'Drag the <b>padlock</b> next to the web address onto your desktop to make a shortcut, or open the portal in <b>Edge</b> or <b>Chrome</b> to install it.'];
  else steps = ['Open your browser’s menu and look for <b>Install</b> or <b>Add to Dock / Home Screen</b>.', 'Or drag the <b>padlock</b> next to the web address onto your desktop to make a shortcut.'];
  const box = document.createElement('div');
  box.className = 'inst-wrap';
  box.innerHTML = '<div class="inst" role="dialog" aria-modal="true" aria-labelledby="inst-t"><img src="icons/icon-192.png" alt="" width="64" height="64"><h2 id="inst-t">' + title + '</h2><ol>' + steps.map(x => '<li>' + x + '</li>').join('') + '</ol><button class="btn primary" type="button">Got it</button></div>';
  const close = () => { box.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('button')) close(); });
  document.addEventListener('keydown', esc);
  document.body.appendChild(box);
  box.querySelector('button').focus();
}
function render() {
  if (!S.me) return;
  $('#app').innerHTML = '<nav class="side" aria-label="Main">' + nav() + '</nav><main id="main">' + (PAGES[route()] || PAGES.home)() + '</main>';
  after.forEach(f => f()); after = [];
}
let after = [];

// ---------- pages ----------
const PAGES = {};
PAGES.home = () => {
  const now = new Date(), hr = now.getHours(), first = S.me.name.split(' ')[0];
  const reqs = S.reqs ? S.reqs.requests : [];
  const proofs = reqs.filter(r => /proof/i.test(r.status)).length, open = reqs.filter(r => !/complete/i.test(r.status)).length;
  let h = '<div><div class="eyebrow">' + DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate() + '</div><h1>' + (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', ' + esc(first) + '</h1></div>';
  h += '<div class="tiles3">' +
    '<a class="bigtile red" href="#newhire"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="8" r="4"/><path d="M3 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M19 8v6M16 11h6"/></svg><span class="t">Add a new hire</span><span class="d">Their details, headshot and the look for their announcement, signature and social headers.</span><span class="go">Start →</span></a>' +
    '<a class="bigtile" href="#request"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A30C33" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg><span class="t">Request marketing</span><span class="d">Flyers, classes, events, social posts and more — sent straight to the marketing team.</span><span class="go">Start a request →</span></a>' +
    '<a class="bigtile" href="#mine"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A30C33" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="t">Track my requests</span><span class="d">See where each request stands and approve proofs.</span><span class="go">' +
    (S.reqs ? (open ? open + ' in progress' + (proofs ? ' · ' + plural(proofs, 'proof') + ' to approve' : '') : 'Nothing open') : 'Loading…') + ' →</span></a></div>';
  h += '<div class="cols"><section class="card col3"><div class="row"><h2 class="grow">Your requests</h2><a href="#mine" style="font-size:14px;font-weight:600">See all</a></div>' + reqList(reqs.slice(0, 5)) + '</section>' +
    '<section class="card col2"><h2>Good to know</h2><div class="muted2" style="font-size:14px;line-height:1.6">Most requests are ready within 7 days. You’ll get an email when your proof is ready to approve.</div>' +
    '<div class="muted2" style="font-size:14px;line-height:1.6">Best headshots: shoulders up, plain background, facing the camera.</div>' +
    '<a href="mailto:MarketingTeam@stewart.com" style="font-size:14px;font-weight:600;margin-top:auto">Contact West Marketing</a></section></div>';
  return h;
};
function reqList(list) {
  if (!S.reqs) return '<div class="empty"><span class="spin dark"></span></div>';
  if (!list.length) return '<div class="empty">No requests yet.</div>';
  return list.map(r => '<div class="rq"><span class="av">' + esc(initials(r.forWho || r.project)) + '</span><span class="grow"><b>' + esc(r.project) + '</b><span class="meta">' + esc([r.type, r.forWho].filter(Boolean).join(' · ')) + '</span></span>' +
    '<span class="status ' + statusClass(r.status) + '">' + esc(/proof/i.test(r.status) ? 'Proof ready' : r.status) + '</span><span class="meta" style="width:90px;text-align:right">' + esc(nice(r.due)) + '</span></div>').join('');
}

// ----- new hire -----
PAGES.newhire = () => {
  const n = S.nh || (S.nh = freshNewHire());
  if (window.Cutout) Cutout.load().catch(() => {});
  const steps = ['Details + photo', 'Bio', 'Choose a look', 'Review'];
  let h = '<div class="head"><div><h1>' + (n.step === 2 ? (n.firstName ? esc(n.firstName) + '’s' : 'Their') + ' bio' : n.step === 3 ? 'Choose ' + (n.firstName ? esc(n.firstName) + '’s' : 'their') + ' look' : n.step === 4 ? 'Review and submit' : 'Add a new hire') + '</h1><div class="sub">' +
    (n.step === 1 ? 'Takes about 3 minutes. Everything goes straight to West Marketing.' : n.step === 2 ? 'Used on their website and marketing pieces. Answer a few questions or paste one they have.' : n.step === 3 ? 'Pick one, or both to get every piece in dark and light.' : 'Check everything once — this is exactly what goes on their materials.') + '</div></div>' +
    '<ol class="steps" aria-label="Steps">' + steps.map((s, i) => '<li class="' + (i + 1 === n.step ? 'on' : i + 1 < n.step ? 'done' : '') + '"><span>' + (i + 1 < n.step ? '✓' : i + 1) + '</span>' + s + '</li>').join('') + '</ol></div>';
  if (n.step === 1) h += nhDetails(n); else if (n.step === 2) h += nhBio(n); else if (n.step === 3) h += nhLooks(n); else h += nhReview(n);
  return h;
};
function fld(label, key, val, o) {
  o = o || {};
  return '<label class="field' + (o.full ? ' full' : '') + '">' + label + (o.hint ? ' <span class="hint">' + o.hint + '</span>' : '') +
    '<input type="' + (o.type || 'text') + '" data-f="' + key + '" value="' + esc(val) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.req ? ' required' : '') + '></label>';
}
function nhDetails(n) {
  const me = S.me;
  const offices = me.offices.map((o, i) => '<option value="' + i + '" ' + (String(i) === n.office ? 'selected' : '') + '>' + esc(o.address2.replace(/,?\s*[A-Z]{2}\s*\d{5}.*$/, '') + ' – ' + o.address1) + '</option>').join('');
  const titles = me.titles.map(t => '<option ' + (t === n.title ? 'selected' : '') + '>' + esc(t) + '</option>').join('');
  let h = '<div class="cols"><section class="card col3"><h2>Their details</h2><div class="grid2">' +
    fld('First name', 'firstName', n.firstName, { req: 1 }) + fld('Last name', 'lastName', n.lastName, { req: 1 }) +
    '<label class="field">Title<select data-f="title"><option value="">Choose…</option>' + titles + '<option value="__other" ' + (n.title === '__other' ? 'selected' : '') + '>Something else…</option></select></label>' +
    (n.title === '__other' ? fld('Their title', 'titleOther', n.titleOther) : fld('Start date', 'startDate', n.startDate, { type: 'date' })) +
    (n.title === '__other' ? fld('Start date', 'startDate', n.startDate, { type: 'date' }) : '') +
    '<label class="field">Company<select data-f="company">' + me.companies.map(c => '<option ' + (c === n.company ? 'selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' +
    '<label class="field">Office<select data-f="office"><option value="">Choose…</option>' + offices + '<option value="__new" ' + (n.office === '__new' ? 'selected' : '') + '>A different address…</option></select>' +
    (n.office && n.office !== '__new' && me.offices[+n.office] ? '<span class="hint">' + esc(me.offices[+n.office].address1 + ', ' + me.offices[+n.office].address2) + '</span>' : '') + '</label>' +
    (n.office === '__new' ? fld('Street address', 'address1', n.address1, { ph: '123 Main St., Suite 100' }) + fld('City, state, zip', 'address2', n.address2, { ph: 'Sacramento, CA 95814' }) : '') +
    fld('Work phone', 'phone', n.phone, { type: 'tel', ph: '(916) 555-0100' }) + fld('Work email', 'email', n.email, { type: 'email', ph: 'first.last@stewart.com' }) + '</div>' +
    '<div class="field">Show on their materials<div class="row" style="gap:4px 24px">' + [['phone', 'Phone'], ['email', 'Email'], ['address', 'Office address'], ['headshot', 'Headshot']].map(([k, l]) =>
      '<label class="check"><input type="checkbox" data-show="' + k + '" ' + (n.show[k] ? 'checked' : '') + '> ' + l + '</label>').join('') + '</div></div>' +
    '<div id="nh-areas" style="border-top:1px solid var(--line);padding-top:18px;display:flex;flex-direction:column;gap:12px"><div><h2>Market update areas <span class="muted" style="font-size:14px;font-weight:500">· at least 2</span></h2>' +
    '<div class="muted2" style="font-size:14px;margin-top:4px">The cities or zip codes they work. They’ll get a weekly market snapshot graphic for each one.</div></div>' +
    (n.areas.length ? '<div class="tm-areas">' + n.areas.map((a, i) => '<div class="tm-area"><span class="grow"><b>' + esc(a.label || a.area) + '</b><a class="small" href="' + esc(a.link) + '" target="_blank" rel="noopener">View report</a></span>' +
      '<button type="button" class="btn small" data-act="nh-area-del" data-i="' + i + '">Remove</button></div>').join('') + '</div>' : '') +
    (n.areas.length < 2 ? '<div class="small" style="color:var(--brand);font-weight:600">' + (n.areas.length ? 'Add 1 more area to continue.' : 'Add at least 2 areas to continue.') + '</div>' : '') +
    '<div class="tm-add" style="border-top:none;padding-top:0"><h3>Add an area</h3>' + areaSteps() + areaFields('nh') +
    '<div class="row" style="justify-content:flex-end"><button type="button" class="btn primary" data-act="nh-area-add" data-ar-add="nh"' + (arState('nh').link && arState('nh').area ? '' : ' disabled') + '>Add area</button></div></div></div>' +
    '<div id="nh-nl" style="border-top:1px solid var(--line);padding-top:18px;display:flex;flex-direction:column;gap:12px"><div><h2>Newsletter area <span class="muted" style="font-size:14px;font-weight:500">· at least 1</span></h2>' +
    '<div class="muted2" style="font-size:14px;margin-top:4px">The area for their monthly newsletter / event calendar (local events plus a seasonal feature).</div></div>' +
    (n.nlAreas.length ? '<div class="tm-areas">' + n.nlAreas.map((a, i) => '<div class="tm-area"><span class="grow"><b>' + esc(nlName(a.header)) + '</b>' + (a.location ? '<span class="small muted">' + esc(a.location) + '</span>' : '') + '</span>' +
      '<button type="button" class="btn small" data-act="nh-nl-del" data-i="' + i + '">Remove</button></div>').join('') + '</div>' : '<div class="small" style="color:var(--brand);font-weight:600">Add their newsletter area to continue.</div>') +
    nlForm('nh') + '</div></section>';
  h += '<section class="col2"><div class="card"><h2>Headshot</h2><div class="row" style="align-items:center;flex-wrap:nowrap">' +
    '<div class="headshot" id="headshot">' + headshotBox(n) + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;font-size:13px" class="muted2">' + (n.photo ? '<span style="color:var(--green-text);font-weight:700">✓ ' + esc(n.photo.name) + '</span>' : '') +
    '<span id="cutnote">' + cutNote(n) + '</span>' +
    '<label class="btn small" style="align-self:flex-start">' + (n.photo ? 'Replace photo' : 'Upload photo') + '<input type="file" accept="image/*" data-file="photo" hidden></label></div></div></div>' +
    '<div class="preview"><div class="cardlabel" style="color:var(--navmuted)">Live preview · contact block</div><div class="cblock" id="cblock">' + cblock(n) + '</div>' +
    '<div class="small" style="color:var(--border)">This is how their details appear on flyers and the email signature.</div></div></section></div>';
  h += '<div class="row" style="justify-content:space-between"><a href="#home" style="font-weight:600">Cancel</a><button type="button" class="btn primary" data-act="nh-next">Next: their bio →</button></div>';
  return h;
}
function headshotBox(n) {
  if (!n.photoUrl) return 'No photo yet';
  if (n.cutUrl) return '<img class="cut" src="' + n.cutUrl + '" alt="Headshot with the background removed">';
  return '<img src="' + n.photoUrl + '" alt="Uploaded headshot"><div class="guide"></div>' + (n.cutState === 'working' ? '<div class="cutting"><span class="spin"></span>Removing background…</div>' : '');
}
function cutNote(n) {
  if (n.cutUrl) return 'Background removed for the preview. Marketing makes the final cutout in Photoshop.';
  if (n.cutState === 'failed') return 'We couldn’t preview the cutout here, but marketing removes the background for you.';
  return 'Head and shoulders inside the guide. We remove the background for you.';
}
// the live preview: the same contact block the flyers (and My Team) use
function cblock(n) {
  const name = (n.firstName + ' ' + n.lastName).trim();
  const pic = n.show.headshot && n.cutUrl ? '<img src="' + n.cutUrl + '" alt="">' : n.show.headshot && n.photoUrl ? '<img class="raw" src="' + n.photoUrl + '" alt="">'
    : '<span class="cblk-ini">' + esc(initials(name) || '?') + '</span>';
  const ad = n.show.address ? nhAddress(n) : { address1: '', address2: '' };
  const addr = [ad.address1, ad.address2].filter(Boolean).map(esc).join('<br>');
  return '<div class="cblk mini"><div class="cblk-pic">' + pic + '</div><div class="cblk-txt">' +
    '<div class="cblk-name">' + esc(name || 'Their name') + '</div><div class="cblk-title">' + esc(nhTitle(n) || 'Title') + '</div>' +
    (n.company ? '<div class="cblk-co">' + esc(n.company) + '</div>' : '') + '<div class="cblk-lines">' +
    (n.show.phone && n.phone ? '<div>' + CB_ICONS.phone + '<span>' + esc(fmtPhone(n.phone)) + '</span></div>' : '') +
    (n.show.email && n.email ? '<div>' + CB_ICONS.mail + '<span>' + esc(n.email) + '</span></div>' : '') +
    (addr ? '<div>' + CB_ICONS.pin + '<span>' + addr + '</span></div>' : '') + '</div>' +
    '<img class="cblk-logo" src="logo-dark.png" alt="Stewart Title"></div></div>';
}
// (916) 555-0142 however it was typed; anything that isn't a 10-digit US number is left as typed
function fmtPhone(v) { const d = String(v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(v || ''); }
const nhTitle = n => n.title === '__other' ? n.titleOther : n.title;
function nhAddress(n) { if (n.office === '__new') return { address1: n.address1, address2: n.address2 }; const o = S.me.offices[+n.office]; return o || { address1: '', address2: '' }; }
function lookSample(n, cls) {
  const nm = (n.firstName || 'First') + '<br>' + (n.lastName || 'Last');
  const pic = n.cutUrl ? '<img class="p" src="' + n.cutUrl + '" alt="">' : n.photoUrl ? '<img class="p raw" src="' + n.photoUrl + '" alt="">' : '';
  return '<span class="samples ' + cls + '"><span class="s-ann"><span class="w">PLEASE WELCOME</span><span class="n">' + esc(n.firstName || 'First') + '<br>' + esc(n.lastName || 'Last') + '</span><span class="r"></span><span style="font-size:10px">' + esc(nhTitle(n) || 'Title') + '</span>' + pic +
    '<img class="l" src="' + (cls === 'dark' ? 'logo-light.png' : 'logo-dark.png') + '" alt=""></span>' +
    '<span class="s-sig"><span class="av" style="width:34px;height:34px;font-size:10px">' + esc(initials(n.firstName + ' ' + n.lastName)) + '</span><span><b style="font-size:11px">' + esc((n.firstName + ' ' + n.lastName).trim() || 'Their name') + '</b><br>' + esc(nhTitle(n) || 'Title') + '<br>' + esc(fmtPhone(n.phone)) + '</span></span>' +
    '<span class="s-ban">' + esc((n.firstName + ' ' + n.lastName).trim() || 'Their name') + ' · Stewart Title</span></span>';
}
// ---------- bio step: Claude writes 2 to start, "Show 2 more" up to twice (6 in all) ----------
const BIO_Q = [['years', 'Years in title & escrow', '12'], ['areas', 'Areas they serve', 'Riverside, Corona, Temecula'], ['known', 'What they’re known for / specialties', 'Smooth closings, new construction, investors', 1],
  ['langs', 'Languages', 'English, Spanish'], ['before', 'Before Stewart (optional)', 'Escrow officer at a builder’s in-house escrow'], ['personal', 'A personal touch (optional)', 'Mom of two, coaches youth soccer, loves hiking', 1]];
function bioState(n) {
  if (!n.bio) n.bio = { mode: 'write', q: { areas: (n.areas || []).map(a => a.label || a.area).join(', ') }, paste: '', opts: [], pick: -1, text: '', more: 0, busy: false, err: '' };
  return n.bio;
}
const nhBioText = n => (n.bio && n.bio.text) || '';
function nhBio(n) {
  const b = bioState(n), write = b.mode === 'write';
  let h = '<div class="cols"><section class="card col3" style="gap:18px">' +
    '<div class="seg" role="group" aria-label="How to make the bio"><button type="button" aria-pressed="' + write + '" data-act="bio-mode" data-m="write">Write one for me</button><button type="button" aria-pressed="' + !write + '" data-act="bio-mode" data-m="clean">I have a bio</button></div>';
  if (write) h += '<div class="muted2" style="font-size:14px">Answer a few questions and Claude writes options to pick from. Short answers are fine.</div><div class="grid2">' +
    BIO_Q.map(([k, l, ph, full]) => '<label class="field"' + (full ? ' style="grid-column:1/-1"' : '') + '>' + l + '<input type="text" data-bq="' + k + '" value="' + esc(b.q[k] || '') + '" placeholder="' + esc(ph) + '"></label>').join('') + '</div>';
  else h += '<label class="field">Paste their bio<textarea rows="5" data-bq="paste" placeholder="Paste the bio they already use…">' + esc(b.paste) + '</textarea></label>';
  h += '<div class="row" style="justify-content:flex-end"><button type="button" class="btn primary" data-act="bio-go"' + (b.busy ? ' disabled' : '') + '>' + (b.busy && !b.opts.length ? '<span class="spin"></span> Writing…' : '✦ ' + (b.opts.length ? 'Start over' : write ? 'Write bios' : 'Clean it up')) + '</button></div>';
  if (b.err) h += '<div class="err">' + esc(b.err) + '</div>';
  if (b.opts.length) {
    h += '<div style="border-top:1px solid var(--line);padding-top:18px;display:flex;flex-direction:column;gap:12px"><div class="row" style="justify-content:space-between"><h2>Pick one</h2>' +
      (b.more < 2 ? '<button type="button" class="btn small" data-act="bio-more"' + (b.busy ? ' disabled' : '') + '>' + (b.busy ? '<span class="spin dark"></span> Writing…' : '↻ Show 2 more (' + (2 - b.more) + ' left)') + '</button>' : '<span class="small muted">That’s all 6 - edit the one you like best below.</span>') + '</div>' +
      '<div class="bios">' + b.opts.map((o, i) => '<button type="button" class="bio" aria-pressed="' + (i === b.pick) + '" data-act="bio-pick" data-i="' + i + '"><span class="bt">' + esc(o.style) + '</span><p>' + esc(o.text) + '</p><span class="bw">' + o.text.split(/\s+/).filter(Boolean).length + ' words</span></button>').join('') + '</div>' +
      '<label class="field">' + (b.pick >= 0 ? 'Edit the one you picked (optional)' : 'Pick one above - or type your own here') + '<textarea rows="5" data-bq="text">' + esc(b.text) + '</textarea></label></div>';
  }
  h += '</section><section class="col2"><div class="preview"><div class="cardlabel" style="color:var(--navmuted)">How it works</div>' +
    '<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:var(--navtext)">' + (write ? '<li>Answer the questions.</li><li>Claude writes 2 bios in different styles.</li>' : '<li>Paste the bio they have.</li><li>Claude tidies the spelling, grammar and flow - it keeps their facts and adds nothing new.</li>') +
    '<li>Not quite right? <b>Show 2 more</b> (up to 6 in all).</li><li>Pick one and edit it if you like. A bio is needed to continue.</li></ol></div></section></div>';
  h += '<div class="row" style="justify-content:space-between"><a href="#" data-act="nh-back" style="font-weight:600">← Back</a><button type="button" class="btn primary" data-act="nh-next" ' + (nhBioText(n).trim() ? '' : 'disabled') + '>Next: choose a look →</button></div>';
  return h;
}
async function bioAsk(more) {
  const n = S.nh, b = bioState(n);
  b.busy = true; b.err = ''; render();
  const a = nhAddress(n);
  try {
    const r = await api('bio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      mode: b.mode, count: 2, answers: b.q, text: b.paste, have: b.opts.map(o => o.text), styles: b.opts.map(o => o.style),
      person: { name: (n.firstName + ' ' + n.lastName).trim(), title: nhTitle(n), company: n.company, city: String(a.address2 || '').replace(/,?\s*[A-Z]{2}\s*\d{5}.*$/, '') } }) });
    if (!more) {
      b.opts = []; b.pick = -1; b.more = 0;
      if (b.mode === 'clean') b.opts.push({ style: 'As written', text: b.paste.trim() });
      // a cleaned-up bio is 1 + original to start (2 to choose from); written bios start with 2
      const add = b.mode === 'clean' ? r.bios.slice(0, 1).map(x => Object.assign(x, { style: '✦ Cleaned up · recommended' })) : r.bios;
      b.opts = b.opts.concat(add);
      b.pick = b.mode === 'clean' ? 1 : -1;
    } else { b.opts = b.opts.concat(r.bios); b.more++; }
    if (b.pick >= 0 && b.opts[b.pick]) b.text = b.opts[b.pick].text;
  } catch (e) { b.err = e.message; }
  b.busy = false; render();
}
function nhLooks(n) {
  let h = '<div class="looks">' + LOOKS.map(([name, cls, d]) => { const on = n.looks.includes(name); return '<button type="button" class="look" aria-pressed="' + on + '" data-act="look" data-look="' + name + '">' +
    '<span class="row" style="flex-wrap:nowrap"><input type="checkbox" tabindex="-1" ' + (on ? 'checked' : '') + ' aria-hidden="true"><span class="grow"><b style="display:block;font-size:19px">' + name + '</b><span class="muted small">' + d + '</span></span>' +
    (on ? '<span class="status proof" style="background:var(--brand);color:#fff">Selected</span>' : '') + '</span>' + lookSample(n, cls) +
    '<span class="chips" style="font-size:12px">' + ['Announcement', 'Email signature', 'Facebook header', 'LinkedIn banner'].map(x => '<span class="status">' + x + '</span>').join('') + '</span></button>'; }).join('') + '</div>';
  h += '<div class="card" style="flex-direction:row;flex-wrap:wrap;gap:10px 28px;font-size:14px;padding:18px 22px"><b>Also included for every new hire:</b><span class="muted2">All current Title Tips</span><span class="muted2">Personalized flyers</span><span class="muted2">Weekly market update (once areas are set)</span></div>';
  h += '<div class="row" style="justify-content:space-between"><a href="#" data-act="nh-back" style="font-weight:600">← Back</a><button type="button" class="btn primary" data-act="nh-next" ' + (n.looks.length ? '' : 'disabled') + '>Next: review →</button></div>';
  return h;
}
function nhReview(n) {
  const a = nhAddress(n);
  const line = (k, v, edit) => '<div class="rq" style="padding:10px 0"><span class="muted" style="width:130px;flex:none">' + k + '</span><span class="grow">' + esc(v || '—') + '</span>' + (edit ? '<a href="#" data-act="nh-step" data-step="' + edit + '" style="font-weight:600;font-size:14px">' + (edit === 3 ? 'Change' : 'Edit') + '</a>' : '') + '</div>';
  let h = '<div class="cols"><section class="card col3" style="gap:4px"><div class="row" style="padding-bottom:16px;border-bottom:1px solid var(--line);flex-wrap:nowrap">' +
    (n.photoUrl ? '<img class="av" style="width:84px;height:84px" src="' + n.photoUrl + '" alt="">' : '<span class="av" style="width:84px;height:84px;font-size:24px">' + esc(initials(n.firstName + ' ' + n.lastName)) + '</span>') +
    '<div class="grow"><div style="font-size:24px;font-weight:800">' + esc(n.firstName + ' ' + n.lastName) + '</div><div style="color:var(--brand);font-weight:700">' + esc(nhTitle(n)) + '</div></div><a href="#" data-act="nh-step" data-step="1" style="font-weight:600;font-size:14px">Edit</a></div>' +
    line('Company', n.company) + line('Office', [a.address1, a.address2].filter(Boolean).join(', ')) + line('Phone', fmtPhone(n.phone) + (n.show.phone ? '' : ' (not shown)')) + line('Email', n.email + (n.show.email ? '' : ' (not shown)')) +
    line('Start date', nice(n.startDate)) + line('Market areas', n.areas.map(a => a.label || a.area).join(', ')) + line('Newsletter', n.nlAreas.map(a => nlName(a.header)).join(', ')) + line('Bio', nhBioText(n).length > 140 ? nhBioText(n).slice(0, 140) + '…' : nhBioText(n), 2) + line('Look', n.looks.join(' + ') + (n.looks.length > 1 ? ' (both)' : ''), 3) +
    '<label class="field" style="margin-top:10px">Anything else marketing should know? (optional)<textarea data-f="notes" rows="3">' + esc(n.notes) + '</textarea></label></section>';
  h += '<section class="col2"><div class="card"><h2>What happens next</h2><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7" class="muted2"><li>' + esc(n.firstName || 'They') + ' is added to the Main Employee Sheet and your team.</li>' +
    '<li>Marketing removes the photo background and builds the package' + (n.looks.length > 1 ? ' in both looks' : ' in ' + esc(n.looks[0])) + '.</li><li>Everything lands on the Employee Marketing Portal.</li></ol></div>' +
    '<div class="preview"><div style="font-size:16px;font-weight:700">Ready to send?</div><button type="button" class="btn primary" data-act="nh-submit" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? '<span class="spin"></span> Sending…' : 'Submit new hire') + '</button>' +
    '<div class="small" style="color:var(--border);line-height:1.5">By submitting you confirm ' + esc(n.firstName || 'they') + ' agreed to have their photo and contact details used in Stewart marketing.</div></div>' +
    '<a href="#" data-act="nh-back" style="font-weight:600">← Back</a></section></div>';
  return h;
}
PAGES.submitted = () => {
  const l = S.last; if (!l) { go('newhire'); return ''; }
  return '<div class="banner ok"><span class="av" style="background:var(--green);color:#fff">✓</span><div class="grow"><h1 style="font-size:28px;color:#124D2B">' + esc(l.first) + ' is on the way</h1><div style="margin-top:4px">Added to the Main Employee Sheet. Marketing will build the package and put it on the Employee Marketing Portal.</div></div>' +
    '<a class="btn" href="#newhire" data-act="nh-another">Add another new hire</a></div>' +
    (l.selfServe ? '<div class="preview" style="max-width:560px"><div class="cardlabel" style="color:var(--navmuted)">Don’t want to wait?</div><h2>Create the package now</h2><div style="font-size:14px;color:var(--navtext)">Starts the full package right away instead of waiting for the marketing team.</div><button type="button" class="btn primary">Create the package now</button></div>' : '');
};

// ----- marketing requests -----
function typeByKey(state, key) { if (key === 'other') return OTHER; for (const [, list] of TYPES[state]) { const t = list.find(x => x.key === key); if (t) return t; } return null; }
PAGES.request = () => {
  const q = S.rq || (S.rq = freshRequest());
  return q.step === 1 ? rqTypes(q) : rqDetails(q);
};
function rqTypes(q) {
  const t = q.type ? typeByKey(q.state, q.type) : null;
  let h = '<div class="head"><div><h1>Request marketing</h1><div class="sub">What do you need? Most projects are ready within 7 days.</div></div><ol class="steps"><li class="on"><span>1</span>Project type</li><li><span>2</span>Details + submit</li></ol></div>';
  h += '<section class="card" style="flex-direction:row;flex-wrap:wrap;align-items:center;gap:16px 24px;padding:20px 22px"><div class="grow" style="min-width:220px"><h2>Which state is this for?</h2><div class="muted2" style="font-size:14px;margin-top:4px">Project types change with the state.</div></div>' +
    '<div class="row" role="group" aria-label="State">' + ['California', 'Arizona'].map(s => '<button type="button" class="state" aria-pressed="' + (q.state === s) + '" data-act="state" data-state="' + s + '"><i></i>' + s + '</button>').join('') + '</div></section>';
  TYPES[q.state].forEach(([g, list]) => {
    h += '<section style="display:flex;flex-direction:column;gap:10px"><div class="cardlabel">' + g + '</div><div class="typegrid">' + list.map(x =>
      '<button type="button" class="type" aria-pressed="' + (q.type === x.key) + '" data-act="type" data-type="' + x.key + '"><b>' + x.name + '</b><span>' + x.sub + '</span></button>').join('') + '</div></section>';
  });
  const oth = q.type === 'other';
  h += '<section style="display:flex;flex-direction:column;gap:10px"><div class="cardlabel">Something else</div>' +
    '<div class="card" style="border:2px solid ' + (oth ? 'var(--brand)' : 'transparent') + ';padding:16px;gap:14px"><button type="button" class="type" style="padding:0;border:none;min-height:0" aria-pressed="' + oth + '" data-act="type" data-type="other"><b>Something else</b><span>Don’t see what you need? Describe it.</span></button>' +
    (oth ? '<label class="field">What do you need?<textarea data-r="other" rows="4" placeholder="e.g. A one-page handout for our realtor breakfast with our rate info and a QR code to the sign-up page">' + esc(q.other) + '</textarea></label>' : '') + '</div></section>';
  h += '<div class="bar"><div class="grow" style="min-width:220px"><div class="t">' + (t ? esc(t.name) : 'Pick a project type') + '</div><div class="d">' + (t ? 'Next we’ll ask ' + (t.kind === 'class' || t.kind === 'classce' ? 'for the class name, date, location and instructor.' : t.kind === 'property' ? 'for the property, date and time, and photos.' : 'who it’s for, when you need it, and for any files.') : q.state + ' options') + '</div></div>' +
    '<button type="button" class="btn primary" data-act="rq-next" ' + (t ? '' : 'disabled') + '>Next: details →</button></div>';
  return h;
}
function rfld(label, key, o) {
  o = o || {}; const q = S.rq; const val = key.startsWith('x.') ? (q.x[key.slice(2)] || '') : (q[key] || '');
  if (o.area) return '<label class="field' + (o.full !== false ? ' full' : '') + '">' + label + '<textarea data-r="' + key + '" rows="' + (o.rows || 3) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '>' + esc(val) + '</textarea></label>';
  return '<label class="field' + (o.full ? ' full' : '') + '">' + label + '<input type="' + (o.type || 'text') + '" data-r="' + key + '" value="' + esc(val) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '></label>';
}
function yesNo(label, key) { const v = S.rq.x[key] || 'No'; return '<div class="field">' + label + '<div class="seg">' + ['No', 'Yes'].map(o => '<button type="button" aria-pressed="' + (v === o) + '" data-act="yn" data-k="' + key + '" data-v="' + o + '">' + o + '</button>').join('') + '</div></div>'; }
function rqDetails(q) {
  const t = typeByKey(q.state, q.type);
  const me = S.me;
  let h = '<div class="head"><div><div class="eyebrow"><a href="#" data-act="rq-back" style="font-weight:600">Request marketing</a> › ' + q.state + ' › ' + esc(t.name) + '</div><h1 style="margin-top:4px">' +
    (t.kind.startsWith('class') ? 'Tell us about the class' : t.kind === 'property' ? 'Tell us about the property' : 'Tell us about the project') + '</h1></div>' +
    '<ol class="steps"><li class="done"><span>✓</span>Project type</li><li class="on"><span>2</span>Details + submit</li></ol></div>';
  const team = me.team;
  const sel = new Set(q.people);
  h += '<div class="cols"><div class="col3"><section class="card"><h2>The project</h2><div class="grid2">' + rfld('Project name', 'projectName', { full: 1, ph: 'e.g. Estate Planning 101 workshop flyer' }) +
    '<div class="field full"><div class="row" style="justify-content:space-between"><span>Who is it for</span><span class="hint">' + (me.admin ? 'Everyone on the Main Employee Sheet' : 'Your team on the Manager Contacts board · ' + plural(team.length, 'person', 'people')) + '</span></div>' +
    '<div class="seg">' + [['pick', 'Pick people'], ['team', me.admin ? 'Whole team (all)' : 'My whole team'], ['me', 'Just me']].map(([k, l]) => '<button type="button" aria-pressed="' + (q.who === k) + '" data-act="who" data-who="' + k + '">' + l + '</button>').join('') + '</div>' +
    (q.who === 'pick' ? (team.length > 30 ? '<input type="search" data-act-input="teamsearch" placeholder="Search ' + team.length + ' people" value="' + esc(q.search || '') + '">' : '') +
      '<div class="chips" id="teamchips">' + teamChips(team, sel, q.search) + '</div>' : '') + '</div>' +
    rfld('Needed by', 'needBy', { type: 'date' }) + '<div class="field"><span>&nbsp;</span><span class="hint" style="padding-top:12px">Standard turnaround is 7 days.</span></div>' +
    rfld(t.kind === 'other' ? 'Anything else we should know?' : 'Description', 'description', { area: 1, ph: 'What should it say? Who is it for? Anything it must include?' }) + '</div></section>';
  if (t.kind === 'class' || t.kind === 'classce') h += '<section class="card"><h2>Class details</h2><div class="grid2">' + rfld('Course name', 'x.Course Name', { full: 1 }) + rfld('Course description', 'x.Course Description', { area: 1 }) +
    rfld('Instructor', 'x.Instructor Name') + rfld('Date', 'x.Event Date', { type: 'date' }) + rfld('Time', 'x.Event Time', { ph: '10:30 AM – 12:00 PM' }) + rfld('Cost', 'x.Cost', { ph: 'Free' }) +
    rfld('Location', 'x.Location', { full: 1, ph: 'Street address, city' }) + (t.kind === 'classce' ? rfld('Credit hours', 'x.Credited Hours', { ph: '3' }) : '') +
    yesNo('Sponsored?', 'Sponsor') + (q.x.Sponsor === 'Yes' ? rfld('Sponsor information', 'x.Sponsor Information', { area: 1, rows: 2 }) : '') + yesNo('Also make a social post?', 'Social Media Post') + '</div></section>';
  if (t.kind === 'property') h += '<section class="card"><h2>' + esc(t.name) + ' details</h2><div class="grid2">' + rfld('Property address', 'x.Location', { full: 1 }) + rfld('Date', 'x.Event Date', { type: 'date' }) + rfld('Time', 'x.Event Time', { ph: '1:00 – 4:00 PM' }) +
    rfld('Listing agent info', 'x.Agent info', { area: 1, rows: 2, ph: 'Name, brokerage, phone, email' }) + yesNo('Also make a social post?', 'Social Media Post') + '</div>' + dropZone('photos', 'Property photos', 'JPG or PNG — the best ones first') + '</section>';
  if (t.kind === 'event') h += '<section class="card"><h2>Event details</h2><div class="grid2">' + rfld('Event name', 'x.Course Name', { full: 1 }) + rfld('Date', 'x.Event Date', { type: 'date' }) + rfld('Time', 'x.Event Time') +
    rfld('Location', 'x.Location', { full: 1 }) + yesNo('Sponsored?', 'Sponsor') + (q.x.Sponsor === 'Yes' ? rfld('Sponsor information', 'x.Sponsor Information', { area: 1, rows: 2 }) : '') + '</div></section>';
  h += '<section class="card"><h2>Examples and files <span class="muted" style="font-size:14px;font-weight:500">· optional</span></h2>' + dropZone('files', 'Drop files here or browse', 'Logos, photos, an old flyer you liked — PDF, JPG, PNG or Word') + '</section></div>';
  const forLabel = whoLabel(q);
  h += '<aside class="col2"><div class="card" style="gap:10px;font-size:14px"><div class="cardlabel">Summary</div>' +
    [['Type', t.name], ['State', q.state], ['Requested by', me.name], ['For', forLabel || '—'], ['Needed by', nice(q.needBy)]].map(([k, v]) => '<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="muted">' + k + '</span><b style="text-align:right">' + esc(v) + '</b></div>').join('') + '</div>' +
    '<div class="preview"><div style="font-size:16px;font-weight:700">Ready to send?</div><button type="button" class="btn primary" data-act="rq-submit" ' + (S.busy ? 'disabled' : '') + '>' + (S.busy ? '<span class="spin"></span> Sending…' : 'Submit request') + '</button>' +
    '<div class="small" style="color:var(--border);line-height:1.5">You’ll get a confirmation email with your reference number, then another when your proof is ready to approve.</div></div>' +
    '<a href="#" data-act="rq-back" style="font-weight:600">← Change project type</a></aside></div>';
  return h;
}
function teamChips(team, sel, search) {
  const s = String(search || '').toLowerCase();
  const list = team.filter(p => sel.has(p.id) || !s || p.name.toLowerCase().includes(s));
  if (!team.length) return '<span class="muted small">No one is linked to your row on the Manager Contacts board yet.</span>';
  return list.slice(0, 60).map(p => '<button type="button" class="chip" aria-pressed="' + sel.has(p.id) + '" data-act="person" data-id="' + p.id + '">' + esc(p.name) + '</button>').join('') + (list.length > 60 ? '<span class="muted small">Search to find more…</span>' : '');
}
function whoLabel(q) {
  if (q.who === 'me') return S.me.name;
  if (q.who === 'team') return S.me.admin ? 'All BDOs' : 'My whole team';
  return S.me.team.filter(p => q.people.includes(p.id)).map(p => p.name).join(', ');
}
function dropZone(key, title, sub) {
  const files = S.rq[key];
  return '<label class="drop" data-drop="' + key + '"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#A30C33" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>' +
    '<span style="font-size:15px;font-weight:600">' + title + '</span><span class="small muted">' + sub + '</span><input type="file" multiple data-files="' + key + '" hidden></label>' +
    files.map((f, i) => '<div class="file"><b>' + esc((f.name.split('.').pop() || '').toUpperCase()) + '</b><span>' + esc(f.name) + '</span><span class="muted" style="flex:none">' + (f.size / 1048576).toFixed(1) + ' MB</span><button type="button" data-act="file-del" data-k="' + key + '" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">×</button></div>').join('');
}
PAGES.sent = () => {
  const l = S.last; if (!l) { go('request'); return ''; }
  return '<div class="banner ok"><span class="av" style="background:var(--green);color:#fff">✓</span><div class="grow"><b>Request received.</b> ' + esc(l.project) + ' · reference #' + esc(l.reference) + ' · estimated ready ' + esc(nice(l.due)) + '.</div></div>' +
    '<div class="row"><a class="btn primary" href="#request" data-act="rq-another">Make another request</a><a class="btn" href="#mine">See my requests</a></div>';
};

// ----- my requests -----
PAGES.mine = () => {
  let h = '<div class="head"><div><h1>My requests</h1><div class="sub">' + (S.me.admin ? 'Every request on the Marketing Request board.' : 'Everything you’ve asked for, live from the marketing team’s board.') + '</div></div><a class="btn primary" href="#request">New request</a></div>';
  if (!S.reqs) return h + '<div class="card"><div class="empty"><span class="spin dark"></span></div></div>';
  const proofs = S.reqs.requests.filter(r => /proof/i.test(r.status));
  proofs.forEach(r => {
    const p = r.proofs[0] || {};
    const img = p.url && /\.(png|jpe?g|gif|webp)$/i.test(p.name || '') ? '<img src="' + esc(p.url) + '" alt="Proof" style="width:200px;height:250px;object-fit:cover;object-position:top;border-radius:10px;border:1px solid #E4E1DC;display:block">' :
      '<span class="av" style="width:200px;height:250px;border-radius:10px;font-size:16px">' + esc((p.name || 'PROOF').split('.').pop().toUpperCase()) + '</span>';
    h += '<section class="card" style="border:2px solid var(--brand);flex-direction:row;flex-wrap:wrap;gap:22px">' + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener" style="flex:none">' + img + '</a>' : img) +
      '<div class="grow" style="min-width:280px;display:flex;flex-direction:column;gap:12px"><div class="row"><span class="status proof">Proof ready</span><span class="small muted">#' + esc(r.id) + '</span></div><h2 style="font-size:22px;font-weight:800">' + esc(r.project) + '</h2>' +
      '<div class="muted2" style="font-size:14px;line-height:1.6">Take a look and approve it, or tell us what to change.' + (p.url ? ' <a href="' + esc(p.url) + '" target="_blank" rel="noopener">Open the proof full size</a>.' : '') + '</div>' +
      '<label class="field">Changes (if any)<textarea id="note-' + r.id + '" rows="3" placeholder="e.g. Use the 2nd photo on the front, and change the time to 1–4 PM"></textarea></label>' +
      '<div class="row" style="margin-top:auto"><button type="button" class="btn green" data-act="approve" data-id="' + r.id + '">Approve</button><button type="button" class="btn" data-act="changes" data-id="' + r.id + '">Send changes</button></div></div></section>';
  });
  const f = S.filter || 'open';
  const list = S.reqs.requests.filter(r => f === 'all' || (f === 'done' ? /complete/i.test(r.status) : !/complete/i.test(r.status)));
  h += '<section class="card"><div class="row" style="justify-content:space-between"><h2>All requests</h2><div class="seg">' + [['open', 'Open'], ['done', 'Complete'], ['all', 'All']].map(([k, l]) => '<button type="button" aria-pressed="' + (f === k) + '" data-act="filter" data-f="' + k + '">' + l + '</button>').join('') + '</div></div>' +
    (list.length ? '<div style="overflow-x:auto"><table class="list"><thead><tr><th>REF #</th><th>PROJECT</th><th>TYPE</th><th>FOR</th>' + (S.me.admin ? '<th>MANAGER</th>' : '') + '<th>STATUS</th><th style="text-align:right">DUE</th></tr></thead><tbody>' +
      list.map(r => '<tr><td class="muted">' + esc(r.id) + '</td><td style="font-weight:600">' + esc(r.project) + '</td><td class="muted2">' + esc(r.type) + '</td><td class="muted2">' + esc(r.forWho) + '</td>' + (S.me.admin ? '<td class="muted2">' + esc(r.manager) + '</td>' : '') +
        '<td><span class="status ' + statusClass(r.status) + '">' + esc(/proof/i.test(r.status) ? 'Proof ready' : r.status) + '</span></td><td class="muted2" style="text-align:right">' + esc(nice(r.due)) + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="empty">Nothing here.</div>') + '</section>';
  if (S.reqs.newHires.length) h += '<section class="card"><h2>New hires you submitted</h2>' + S.reqs.newHires.map(p => '<div class="rq"><span class="av">' + esc(initials(p.name)) + '</span><span class="grow"><b>' + esc(p.name) + '</b><span class="meta">New hire package</span></span><span class="status ' + (/done/i.test(p.setup) ? 'done' : 'work') + '">' + (/done/i.test(p.setup) ? 'Ready on the portal' : 'Being designed') + '</span></div>').join('') + '</section>';
  return h;
};

// ---------- actions ----------
const ACT = {};
ACT['bio-mode'] = el => { const b = bioState(S.nh); if (b.mode === el.dataset.m) return; b.mode = el.dataset.m; b.opts = []; b.pick = -1; b.more = 0; b.err = ''; render(); };
ACT['bio-go'] = () => {
  const b = bioState(S.nh);
  if (b.mode === 'clean' && b.paste.trim().length < 20) return toast('Paste their bio first.');
  if (b.mode === 'write' && ['years', 'areas', 'known', 'langs'].filter(k => String(b.q[k] || '').trim()).length < 2) return toast('Answer at least a couple of the questions first.');
  if (b.opts.length && b.text && !confirm('Start over? The bios below will be replaced.')) return;
  bioAsk(false);
};
ACT['bio-more'] = () => { if (bioState(S.nh).more < 2) bioAsk(true); };
ACT['bio-pick'] = el => { const b = bioState(S.nh); b.pick = +el.dataset.i; b.text = b.opts[b.pick].text; render(); };
ACT['nh-area-add'] = () => {
  const n = S.nh, st = arState('nh'), link = st.link.trim(), area = st.area.trim();
  if (!ALTOS_RX.test(link)) return toast('Paste an Altos report link (it starts with https://altos.re/r/…).');
  if (!area) return toast('Add the city or zip code.');
  if (n.areas.some(a => a.link === link)) return toast('That area is already added.');
  n.areas.push({ link, area, label: st.label.trim() || area }); arClear(st); render();
  const el = document.getElementById('nh-areas'); if (el) el.scrollIntoView({ block: 'nearest' });
};
ACT['nh-area-del'] = el => { S.nh.areas.splice(+el.dataset.i, 1); render(); };
ACT['nh-next'] = () => {
  const n = S.nh;
  if (n.step === 1) {
    const need = [['firstName', n.firstName], ['lastName', n.lastName], ['title', nhTitle(n)], ['office', n.office === '__new' ? n.address1 : n.office], ['email', n.email]];
    const miss = need.filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
    if (miss.length) { miss.forEach(k => { const el = document.querySelector('[data-f=' + k + ']'); if (el) el.classList.add('bad'); }); toast('Please fill in the highlighted fields.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n.email)) { toast('That email doesn’t look right.'); return; }
    if (n.areas.length < 2) { toast('Add at least 2 market update areas.'); const el = document.getElementById('nh-areas'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (!n.nlAreas.length) { toast('Add their newsletter area.'); const el = document.getElementById('nh-nl'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  }
  if (n.step === 2 && !nhBioText(n).trim()) return toast('Pick a bio (or write your own in the box) to continue.');
  if (n.step === 3 && !n.looks.length) return toast('Pick at least one look.');
  n.step++; render(); window.scrollTo(0, 0);
};
ACT['nh-back'] = (el, e) => { e.preventDefault(); S.nh.step--; render(); };
ACT['nh-step'] = (el, e) => { e.preventDefault(); S.nh.step = +el.dataset.step; render(); };
ACT.look = el => { const n = S.nh, l = el.dataset.look; n.looks = n.looks.includes(l) ? n.looks.filter(x => x !== l) : n.looks.concat([l]); render(); };
ACT['nh-another'] = () => { S.nh = freshNewHire(); };
ACT['nh-submit'] = async () => {
  const n = S.nh, a = nhAddress(n);
  S.busy = true; render();
  try {
    const fd = new FormData();
    fd.append('fields', JSON.stringify({ firstName: n.firstName, lastName: n.lastName, title: nhTitle(n), company: n.company, address1: a.address1, address2: a.address2, phone: fmtPhone(n.phone), email: n.email,
      startDate: n.startDate, show: n.show, areas: n.areas, nlAreas: n.nlAreas, bio: nhBioText(n), looks: n.looks, notes: n.notes }));
    if (n.photo) fd.append('photo', n.photo, n.photo.name);
    await api('newhire', { method: 'POST', body: fd });
    S.last = { first: n.firstName, selfServe: S.me.selfServe };
    S.nh = freshNewHire(); S.busy = false; loadRequests(); go('submitted');
  } catch (e) { S.busy = false; render(); toast(e.message, 7000); }
};
ACT.state = el => { S.rq.state = el.dataset.state; if (S.rq.type && S.rq.type !== 'other' && !typeByKey(S.rq.state, S.rq.type)) S.rq.type = null; render(); };
ACT.type = el => { S.rq.type = el.dataset.type; render(); if (S.rq.type === 'other') { const t = document.querySelector('[data-r=other]'); if (t) t.focus(); } };
ACT['rq-next'] = () => { const q = S.rq; if (q.type === 'other' && !q.other.trim()) { toast('Tell us what you need.'); return; } if (!q.projectName && q.type === 'other') q.projectName = q.other.split(/[.\n]/)[0].slice(0, 60); q.step = 2; render(); window.scrollTo(0, 0); };
ACT['rq-back'] = (el, e) => { e.preventDefault(); S.rq.step = 1; render(); };
ACT.who = el => { S.rq.who = el.dataset.who; render(); };
ACT.person = el => { const q = S.rq, id = el.dataset.id; q.people = q.people.includes(id) ? q.people.filter(x => x !== id) : q.people.concat([id]); el.setAttribute('aria-pressed', q.people.includes(id)); updateSummary(); };
ACT.yn = el => { S.rq.x[el.dataset.k] = el.dataset.v; render(); };
ACT['file-del'] = el => { S.rq[el.dataset.k].splice(+el.dataset.i, 1); render(); };
ACT['rq-another'] = () => { S.rq = freshRequest(); };
ACT['rq-submit'] = async () => {
  const q = S.rq, t = typeByKey(q.state, q.type), me = S.me;
  if (!q.projectName.trim()) { const el = document.querySelector('[data-r=projectName]'); if (el) { el.classList.add('bad'); el.focus(); } return toast('Give the project a name.'); }
  if (q.who === 'pick' && !q.people.length) return toast('Pick who it’s for (or choose Just me).');
  const forPeople = q.who === 'me' ? [{ name: me.name, email: me.email }] : q.who === 'team' ? [] : me.team.filter(p => q.people.includes(p.id)).map(p => ({ name: p.name, email: p.email }));
  const extra = {};
  Object.keys(q.x).forEach(k => { if (k !== 'Event Time' && q.x[k]) extra[k] = q.x[k]; });
  let desc = q.description;
  if (q.x['Event Time']) desc = (desc ? desc + '\n\n' : '') + 'Time: ' + q.x['Event Time'];
  if (q.type === 'other') desc = q.other + (desc ? '\n\n' + desc : '');
  S.busy = true; render();
  try {
    const fd = new FormData();
    fd.append('fields', JSON.stringify({ state: q.state, type: t.label, other: q.type === 'other' ? q.other : '', projectName: q.projectName, needBy: q.needBy, description: desc,
      forPeople, forLabel: q.who === 'team' ? (me.admin ? 'ALL BDOs' : 'Whole team') : '', extra }));
    q.files.forEach(f => fd.append('files', f, f.name));
    q.photos.forEach(f => fd.append('photos', f, f.name));
    const r = await api('requests', { method: 'POST', body: fd });
    S.last = { project: q.projectName, reference: r.reference, due: r.due };
    S.rq = freshRequest(); S.busy = false; loadRequests(); go('sent');
  } catch (e) { S.busy = false; render(); toast(e.message, 7000); }
};
ACT.filter = el => { S.filter = el.dataset.f; render(); };
ACT.approve = async el => proof(el, 'approve');
ACT.changes = async el => proof(el, 'changes');
async function proof(el, action) {
  const id = el.dataset.id, note = (document.getElementById('note-' + id) || {}).value || '';
  if (action === 'changes' && !note.trim()) return toast('Write what should change first.');
  el.disabled = true;
  try { await api('proof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, note }) }); toast(action === 'approve' ? 'Approved — thank you!' : 'Sent to the marketing team.'); loadRequests(); }
  catch (e) { el.disabled = false; toast(e.message, 7000); }
}
function updateSummary() { const q = S.rq; const b = [...document.querySelectorAll('aside .card .row')].find(r => r.textContent.startsWith('For')); if (b) b.querySelector('b').textContent = whoLabel(q) || '—'; }

// ---------- events ----------
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a && ACT[a.dataset.act]) { if (a.tagName === 'A' && a.getAttribute('href') === '#') e.preventDefault(); ACT[a.dataset.act](a, e); }
});
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.f && S.nh) { S.nh[d.f] = t.value; t.classList.remove('bad'); if (/firstName|lastName|phone|email|titleOther|address1|address2/.test(d.f)) refreshPreview(); }
  if (d.r && S.rq) { if (d.r.startsWith('x.')) S.rq.x[d.r.slice(2)] = t.value; else S.rq[d.r] = t.value; t.classList.remove('bad'); if (d.r === 'needBy') updateSummaryDate(); }
  if (d.nlf && t.tagName === 'INPUT') { const [sc, k] = d.nlf.split('.'); nlfState(sc)[k] = t.value; const st = nlfState(sc), b = document.querySelector('[data-act=' + sc + '-nl-add]'); if (b) b.disabled = !(st.header === '__other' ? st.other.trim() : st.header); return; }
  if (d.bq && S.nh) { const b = bioState(S.nh); if (d.bq === 'paste') b.paste = t.value; else if (d.bq === 'text') { b.text = t.value; const nx = document.querySelector('[data-act=nh-next]'); if (nx) nx.disabled = !t.value.trim(); } else b.q[d.bq] = t.value; return; }
  if (d.tm === 'q') { const t = tmState(); t.q = e.target.value; document.getElementById('tm-list').innerHTML = tmList(t); return; }
  if (d.ar) {
    const [scope, k] = d.ar.split('.'), st = arState(scope); st[k] = e.target.value;
    if (k === 'link') { clearTimeout(arTimers[scope]); st.check = null; arTimers[scope] = setTimeout(() => arCheck(scope), 700); }
    arPaint(scope);
    return;
  }
  if (d.actInput === 'teamsearch') { S.rq.search = t.value; document.getElementById('teamchips').innerHTML = teamChips(S.me.team, new Set(S.rq.people), t.value); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (d.nlf && t.tagName === 'SELECT') { const [sc, k] = d.nlf.split('.'); const st = nlfState(sc); st[k] = t.value; st.loc = ''; render(); return; }
  if (d.f && (t.tagName === 'SELECT')) { S.nh[d.f] = t.value; render(); }
  if (d.f === 'phone' && S.nh) { S.nh.phone = t.value = fmtPhone(t.value); refreshPreview(); }
  if (d.show) { S.nh.show[d.show] = t.checked; refreshPreview(); }
  if (d.file === 'photo' && t.files[0]) {
    const f = t.files[0]; if (!/^image\//.test(f.type)) return toast('Please choose a photo (JPG or PNG).');
    const n = S.nh; if (n.photoUrl) URL.revokeObjectURL(n.photoUrl); if (n.cutUrl) URL.revokeObjectURL(n.cutUrl);
    n.photo = f; n.photoUrl = URL.createObjectURL(f); n.cutUrl = ''; n.cutState = 'working'; render();
    // preview cutout in the background; only the headshot box is redrawn, so typing elsewhere isn't disturbed
    Cutout.make(f).then(url => { if (n.photo !== f) return URL.revokeObjectURL(url); n.cutUrl = url; n.cutState = 'done'; })
      .catch(() => { if (n.photo === f) n.cutState = 'failed'; })
      .finally(() => { const h = document.getElementById('headshot'), c = document.getElementById('cutnote'); if (h) h.innerHTML = headshotBox(n); if (c) c.innerHTML = cutNote(n); refreshPreview(); if (route() === 'newhire' && n.step > 1) render(); });
  }
  if (d.files) { addFiles(d.files, t.files); }
});
document.addEventListener('keydown', e => { const d = e.target.dataset || {}; if (e.key === 'Enter' && d.ar === 'nh.link') { e.preventDefault(); arCheck('nh'); } });
['dragover', 'dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  const z = e.target.closest && e.target.closest('[data-drop]'); if (!z) return;
  e.preventDefault(); z.classList.toggle('over', ev === 'dragover');
  if (ev === 'drop') addFiles(z.dataset.drop, e.dataTransfer.files);
}));
function addFiles(key, list) {
  const total = () => S.rq.files.concat(S.rq.photos).reduce((n, f) => n + f.size, 0);
  for (const f of list) { if (f.size > 25 * 1048576) { toast(f.name + ' is over 25 MB — please send a smaller file.'); continue; } S.rq[key].push(f); }
  if (total() > 90 * 1048576) toast('That’s a lot of files — the upload may be slow.');
  render();
}
// only the preview box is redrawn while typing, so the field being typed in is never touched
function refreshPreview() { const el = document.getElementById('cblock'); if (el && S.nh) el.innerHTML = cblock(S.nh); }
function updateSummaryDate() { const b = [...document.querySelectorAll('aside .card .row')].find(r => r.textContent.startsWith('Needed by')); if (b) b.querySelector('b').textContent = nice(S.rq.needBy); }


// ----- my team (view only, except market update areas) -----
const TM_IC = {
  market: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12l4-4 3 3 5-6"/></svg>',
  news: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg>' };
function tmState() { return S.tm || (S.tm = { data: null, err: '', q: '', sel: '', link: '', area: '', label: '', check: null, checking: false, busy: false }); }
async function loadTeam() {
  const t = tmState();
  try { t.data = await api('team'); t.err = ''; } catch (e) { t.err = e.message; }
  if (route() === 'team') render();
}
function tmList(t) {
  const list = (t.data ? t.data.team : []).filter(p => !t.q || (p.name + ' ' + (p.title || '') + ' ' + (p.address2 || '')).toLowerCase().includes(t.q.toLowerCase()));
  if (!t.data) return '<div class="empty"><span class="spin dark"></span></div>';
  if (!list.length) return '<div class="empty">' + (t.data.team.length ? 'Nobody matches.' : 'No one is linked to your team yet. Ask West Marketing.') + '</div>';
  return list.map(p => { const n = p.areas.filter(a => a.active).length, nl = (p.nl || []).filter(a => a.active !== false).length;
    return '<button type="button" class="tm-row' + (p.name === t.sel ? ' on' : '') + '" data-act="tm-sel" data-name="' + esc(p.name) + '">' + (p.photo ? '<span class="av tm-ph"><img src="' + esc(p.photo) + '" alt="" loading="lazy"></span>' : '<span class="av">' + esc(initials(p.name)) + '</span>') +
      '<span class="grow"><b>' + esc(p.name) + '</b><span>' + esc(p.title || '') + '</span></span>' +
      '<span class="tm-chips"><span class="tm-n' + (!n ? ' none' : n === 1 ? ' part' : ' full') + '" title="' + plural(n, 'market update area') + '">' + TM_IC.market + n + '</span>' +
      '<span class="tm-n' + (nl ? ' full' : ' none') + '" title="' + plural(nl, 'newsletter area') + '">' + TM_IC.news + nl + '</span></span></button>'; }).join('');
}
PAGES.team = () => {
  const t = tmState();
  if (!t.data && !t.err) loadTeam();
  let h = '<div class="head"><div><h1>My Team</h1><div class="sub">' + (S.me.admin ? 'Everyone on the Main Employee Sheet' : 'The people linked to you on the Manager Contacts board') + '. Details are view only - ask West Marketing to change them.</div></div></div>';
  if (t.err) return h + '<div class="card"><div class="err">' + esc(t.err) + '</div><button class="btn" data-act="tm-reload">Try again</button></div>';
  const team = t.data ? t.data.team : [];
  if (!t.sel && team[0]) t.sel = team[0].name;
  const p = team.find(x => x.name === t.sel);
  h += '<div class="tm"><section class="card tm-side"><input type="search" placeholder="Search your team" data-tm="q" value="' + esc(t.q) + '"><div class="tm-list" id="tm-list">' + tmList(t) + '</div><div class="tm-key"><span class="tm-n">' + TM_IC.market + '</span>Market update<span class="tm-n">' + TM_IC.news + '</span>Newsletter</div></section>';
  h += '<div class="tm-main">';
  if (!p) h += '<section class="card"><div class="empty">' + (t.data ? 'Pick someone on the left.' : '<span class="spin dark"></span>') + '</div></section>';
  else {
    // their contact block, laid out like the one on their flyers
    const I = CB_ICONS;
    const addr = [p.address1, p.address2].filter(Boolean).map(esc).join('<br>');
    h += '<section class="cblk"><div class="cblk-pic">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '">' : '<span class="cblk-ini">' + esc(initials(p.name)) + '</span>') + '</div>' +
      '<div class="cblk-txt"><div class="cblk-name">' + esc(p.name) + '</div>' + (p.title ? '<div class="cblk-title">' + esc(p.title) + '</div>' : '') +
      (p.company ? '<div class="cblk-co">' + esc(p.company) + '</div>' : '') + '<div class="cblk-lines">' +
      (p.phone ? '<a href="tel:' + esc(p.phone.replace(/[^\d+]/g, '')) + '">' + I.phone + esc(fmtPhone(p.phone)) + '</a>' : '') +
      (p.email ? '<a href="mailto:' + esc(p.email) + '">' + I.mail + esc(p.email) + '</a>' : '') +
      (addr ? '<div>' + I.pin + '<span>' + addr + '</span></div>' : '') + '</div>' +
      '<img class="cblk-logo" src="logo-dark.png" alt="Stewart Title"></div></section>';
    // market areas
    const ready = t.data.areasReady;
    h += '<section class="card"><div><h2>Market update areas</h2><div class="sub" style="font-size:14px">Each area gets its own weekly market snapshot graphic. Changes are picked up by the next weekly run.</div></div>';
    if (!ready) h += '<div class="err">Market areas aren’t connected yet. West Marketing needs to open the Marketing Tools app once to set this up.</div>';
    else {
      h += p.areas.length ? '<div class="tm-areas">' + p.areas.map(a => '<div class="tm-area' + (a.active ? '' : ' off') + '"><span class="grow"><b>' + esc(a.label || a.area) + '</b>' +
        '<a class="small" href="' + esc(a.link) + '" target="_blank" rel="noopener">View report</a>' + (a.active ? '' : '<span class="tm-off">Off</span>') + '</span>' +
        '<label class="tm-switch" title="' + (a.active ? 'Turn off (skipped in the weekly run)' : 'Turn back on') + '"><input type="checkbox" data-act="tm-active" data-id="' + esc(a.id) + '"' + (a.active ? ' checked' : '') + (t.busy ? ' disabled' : '') + '><i></i>' + (a.active ? 'On' : 'Off') + '</label>' +
        '<button type="button" class="btn small" data-act="tm-remove" data-id="' + esc(a.id) + '" data-label="' + esc(a.label || a.area) + '"' + (t.busy ? ' disabled' : '') + '>Remove</button></div>').join('') + '</div>'
        : '<div class="empty" style="padding:16px">No market areas yet.</div>';
      const ck = t.check;
      h += '<div class="tm-add"><h3>Add an area</h3>' + areaSteps() + areaFields('tm') +
        '<div class="row" style="justify-content:flex-end"><button type="button" class="btn primary" data-act="tm-add" data-ar-add="tm"' + (t.link && t.area && !t.busy ? '' : ' disabled') + '>' + (t.busy ? '<span class="spin"></span> Saving…' : 'Add area') + '</button></div></div>';
    }
    h += '</section>';
    h += tmContent(p, 'market', 'Current market update', 'What’s on ' + p.name.split(' ')[0] + '’s portal now - this week’s graphics and slideshow.');
    // newsletter / event calendar areas
    h += '<section class="card"><div><h2>Newsletter areas</h2><div class="sub" style="font-size:14px">Their monthly newsletter / event calendar - one for each area, with that area’s local events. Changes are picked up by the next monthly run.</div></div>';
    if (!t.data.nlReady) h += '<div class="err">The Newsletter Template board isn’t available. Ask West Marketing.</div>';
    else {
      h += p.nl.length ? '<div class="tm-areas">' + p.nl.map(a => '<div class="tm-area' + (a.active ? '' : ' off') + '"><span class="grow"><b>' + esc(nlName(a.header)) + '</b>' + (a.location ? '<span class="small muted">' + esc(a.location) + '</span>' : '') + (a.active ? '' : '<span class="tm-off">Off</span>') + '</span>' +
        '<label class="tm-switch" title="' + (a.active ? 'Turn off (skipped in the monthly run)' : 'Turn back on') + '"><input type="checkbox" data-act="tm-nl-active" data-id="' + esc(a.id) + '"' + (a.active ? ' checked' : '') + (t.busy ? ' disabled' : '') + '><i></i>' + (a.active ? 'On' : 'Off') + '</label>' +
        '<button type="button" class="btn small" data-act="tm-nl-remove" data-id="' + esc(a.id) + '" data-label="' + esc(nlName(a.header)) + '"' + (t.busy ? ' disabled' : '') + '>Remove</button></div>').join('') + '</div>'
        : '<div class="empty" style="padding:16px">No newsletter area yet, so they don’t get a newsletter.</div>';
      h += nlForm('tm');
    }
    h += '</section>';
    h += tmContent(p, 'newsletter', 'Current newsletter', 'What’s on ' + p.name.split(' ')[0] + '’s portal now - this month’s event calendar.');
  }
  h += '</div></div>';
  return h;
};
// ---------- what's on their portal now (Market Update / Event Calendar rows), scrolls sideways ----------
function tmContent(p, kind, title, sub) {
  const t = tmState(); t.content = t.content || {};
  const c = t.content[p.id];
  if (c === undefined) { t.content[p.id] = null; api('content/' + p.id).then(r => { t.content[p.id] = r; }).catch(e => { t.content[p.id] = { error: e.message }; }).finally(() => { if (route() === 'team') render(); }); }
  let h = '<section class="card"><div class="row" style="justify-content:space-between;align-items:baseline"><div><h2>' + esc(title) + '</h2><div class="sub" style="font-size:14px">' + esc(sub) + '</div></div>';
  if (!c) return h + '</div><div class="empty"><span class="spin dark"></span></div></section>';
  if (c.error) return h + '</div><div class="err">' + esc(c.error) + '</div></section>';
  const row = c[kind];
  if (!row || !row.files.length) return h + '</div><div class="empty" style="padding:16px">Nothing on their portal yet.</div></section>';
  h += '<span class="small muted">' + plural(row.files.length, 'file') + (row.updated ? ' · updated ' + esc(new Date(row.updated).toLocaleDateString([], { month: 'short', day: 'numeric' })) : '') + '</span></div>';
  h += '<div class="pc-strip">' + row.files.map(f => {
    const nm = f.name.replace(/\.[^.]+$/, '').replace(new RegExp('\\s*-\\s*' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'), '').replace(/^Market Update Slideshow$/i, 'Slideshow').replace(/\s+Market Update$/i, '').replace(/\s+Newsletter\s+-\s+/i, ' · ');
    const media = f.ext === 'mp4' ? '<video src="' + esc(f.url) + '" controls preload="metadata" playsinline></video>'
      : /^(png|jpe?g|gif|webp)$/.test(f.ext) ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="' + esc(f.url) + '" alt="' + esc(nm) + '" loading="lazy"></a>'
      : '<a class="pc-file" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.ext.toUpperCase() || 'FILE') + '</a>';
    return '<figure class="pc-item">' + media + '<figcaption><span title="' + esc(f.name) + '">' + esc(nm) + '</span><a class="btn small" href="' + esc(f.url) + '?dl=1" download>Download</a></figcaption></figure>';
  }).join('') + '</div></section>';
  return h;
}
// ---------- newsletter area form (My Team and New Hires) ----------
const nlName = h => String(h || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s+Events$/i, '');
function nlfState(scope) {
  if (scope === 'tm') { const t = tmState(); return t.nlf || (t.nlf = { header: '', other: '', loc: '' }); }
  return S.nh.nlf || (S.nh.nlf = { header: '', other: '', loc: '' });
}
function nlOpts(scope) {
  if (scope === 'tm') return (tmState().data && tmState().data.nlOptions) || [];
  if (!S.nlOpts && !S.nlOptsLoading) { S.nlOptsLoading = true; api('nlareas').then(r => { S.nlOpts = r.options || []; }).catch(() => { S.nlOpts = []; }).finally(() => { S.nlOptsLoading = false; if (route() === 'newhire') render(); }); }
  return S.nlOpts || [];
}
function nlForm(scope) {
  const st = nlfState(scope), opts = nlOpts(scope), sel = opts.find(o => o.header === st.header);
  const busy = scope === 'tm' && tmState().busy;
  const ok = st.header === '__other' ? st.other.trim() : st.header;
  return '<div class="tm-add"' + (scope === 'nh' ? ' style="border-top:none;padding-top:0"' : '') + '><h3>Add a newsletter area</h3><div class="grid2">' +
    '<label class="field">Area<select data-nlf="' + scope + '.header"><option value="">' + (opts.length || scope === 'tm' ? 'Choose…' : 'Loading…') + '</option>' +
      opts.map(o => '<option value="' + esc(o.header) + '"' + (o.header === st.header ? ' selected' : '') + '>' + esc(nlName(o.header)) + (o.location ? ' · ' + esc(o.location) : '') + '</option>').join('') +
      '<option value="__other"' + (st.header === '__other' ? ' selected' : '') + '>A different area…</option></select></label>' +
    (st.header === '__other' ? '<label class="field">Area name<input type="text" data-nlf="' + scope + '.other" value="' + esc(st.other) + '" placeholder="e.g. Temecula Valley"></label>' : '') +
    '<label class="field">Town(s)<input type="text" data-nlf="' + scope + '.loc" value="' + esc(st.loc) + '" placeholder="' + esc(sel && sel.location ? sel.location : 'e.g. Temecula, Murrieta') + '"></label></div>' +
    (st.header === '__other' ? '<div class="small muted">A new area gets its own local events, found by West Marketing for the next month.</div>' : '') +
    '<div class="row" style="justify-content:flex-end"><button type="button" class="btn primary" data-act="' + scope + '-nl-add"' + (ok && !busy ? '' : ' disabled') + '>' + (busy ? '<span class="spin"></span> Saving…' : 'Add newsletter area') + '</button></div></div>';
}
function nlPicked(scope) {
  const st = nlfState(scope);
  const header = (st.header === '__other' ? st.other.trim() + (/\bevents$/i.test(st.other.trim()) ? '' : ' Events') : st.header).toUpperCase();
  return { header, location: st.loc.trim() };
}
ACT['nh-nl-add'] = () => {
  const n = S.nh, a = nlPicked('nh'); if (!a.header.trim()) return;
  if (n.nlAreas.some(x => x.header === a.header)) return toast('That area is already added.');
  if (!a.location) { const o = (S.nlOpts || []).find(x => x.header === a.header); a.location = o ? o.location : ''; }
  n.nlAreas.push(a); n.nlf = null; render();
};
ACT['nh-nl-del'] = el => { S.nh.nlAreas.splice(+el.dataset.i, 1); render(); };
ACT['tm-nl-add'] = async () => {
  const t = tmState(), a = nlPicked('tm'); if (!a.header.trim()) return;
  t.busy = true; render();
  try { const r = await api('nlarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'add', employee: t.sel, header: a.header, location: a.location }) }); tmUpdate(r.team); t.nlf = null; toast('Newsletter area added for ' + t.sel); }
  catch (e) { toast(e.message, 6000); } finally { t.busy = false; render(); }
};
ACT['tm-nl-active'] = async el => {
  const t = tmState(), on = el.checked;
  t.busy = true; render();
  try { const r = await api('nlarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'active', employee: t.sel, id: el.dataset.id, active: on }) }); tmUpdate(r.team); toast(on ? 'Turned on' : 'Turned off - skipped until you turn it back on'); }
  catch (e) { toast(e.message, 6000); } finally { t.busy = false; render(); }
};
ACT['tm-nl-remove'] = async el => {
  const t = tmState();
  if (!confirm('Remove ' + el.dataset.label + ' from ' + t.sel + '’s newsletter areas?')) return;
  t.busy = true; render();
  try { const r = await api('nlarea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'remove', employee: t.sel, id: el.dataset.id }) }); tmUpdate(r.team); toast('Removed ' + el.dataset.label); }
  catch (e) { toast(e.message, 6000); } finally { t.busy = false; render(); }
};
function tmUpdate(person) {
  const t = tmState(); if (!t.data || !person) return;
  const i = t.data.team.findIndex(x => x.id === person.id); if (i >= 0) t.data.team[i] = person;
}
async function tmChange(body, msg) {
  const t = tmState(); t.busy = true; render();
  try { const r = await api('areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); tmUpdate(r.team); toast(msg); return true; }
  catch (e) { toast(e.message, 6000); return false; }
  finally { t.busy = false; render(); }
}
ACT['tm-reload'] = () => { const t = tmState(); t.err = ''; t.data = null; render(); };
ACT['tm-sel'] = el => { const t = tmState(); t.sel = el.dataset.name; t.nlf = null; t.link = ''; t.area = ''; t.label = ''; t.check = null; render(); };
ACT['tm-add'] = async () => {
  const t = tmState(), p = t.data.team.find(x => x.name === t.sel); if (!p) return;
  if (await tmChange({ op: 'add', employee: p.name, link: t.link.trim(), area: t.area.trim(), label: t.label.trim() || t.area.trim() }, 'Area added for ' + p.name)) { arClear(t); render(); }
};
ACT['tm-remove'] = el => {
  const t = tmState();
  if (!confirm('Remove ' + el.dataset.label + ' from ' + t.sel + '’s market areas?')) return;
  tmChange({ op: 'remove', employee: t.sel, id: el.dataset.id }, 'Removed ' + el.dataset.label);
};
ACT['tm-active'] = el => { const t = tmState(); tmChange({ op: 'active', employee: t.sel, id: el.dataset.id, active: el.checked }, el.checked ? 'Turned on' : 'Turned off - skipped until you turn it back on'); };


// ---------- adding a market update area (My Team and New Hires use the same form) ----------
const ALTOS_SEARCH = 'https://altos.re/r/6a599414-73b5-40dd-a2ca-ab394e0b984d';
const ALTOS_RX = /^https:\/\/(www\.)?(altos\.re|altosresearch\.com)\//i;
const arState = scope => scope === 'tm' ? tmState() : (S.nh.ar || (S.nh.ar = { link: '', area: '', label: '', check: null, checking: false }));
function areaSteps() {
  return '<ol class="tm-steps"><li>Click <b>Search Altos</b> and look up the city or zip code.</li><li>Open the report and copy its link (the address bar, or <b>Share → Copy link</b>).</li><li>Paste the link below, then click <b>Add area</b>.</li></ol>' +
    '<div class="row"><a class="btn" href="' + ALTOS_SEARCH + '" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>Search Altos</a></div>';
}
function areaFields(scope) {
  const st = arState(scope);
  return '<label class="field">Altos report link<input type="text" inputmode="url" placeholder="https://altos.re/r/…" data-ar="' + scope + '.link" value="' + esc(st.link) + '"></label>' +
    '<div id="ar-check-' + scope + '">' + arCheckHtml(st) + '</div>' +
    '<div class="row" style="align-items:flex-end;flex-wrap:nowrap"><label class="field grow">City or zip<input type="text" data-ar="' + scope + '.area" value="' + esc(st.area) + '"></label>' +
    '<label class="field grow">Shows on the graphic as<input type="text" data-ar="' + scope + '.label" value="' + esc(st.label) + '" placeholder="Same as city"></label></div>';
}
function arCheckHtml(st) {
  const ck = st.check;
  return st.checking ? '<div class="muted" style="font-size:13px">Checking the link…</div>' : ck ? (ck.ok ? '<div class="okbox">✓ This link opens <b>' + esc(ck.location) + '</b></div>' : '<div class="err">' + esc(ck.error) + '</div>') : '';
}
// updates the check message and fills in empty boxes without redrawing the page (so typing isn't interrupted)
function arPaint(scope) {
  const st = arState(scope), c = document.getElementById('ar-check-' + scope); if (c) c.innerHTML = arCheckHtml(st);
  ['area', 'label'].forEach(k => { const el = document.querySelector('[data-ar="' + scope + '.' + k + '"]'); if (el && el !== document.activeElement && el.value !== st[k]) el.value = st[k]; });
  const add = document.querySelector('[data-ar-add="' + scope + '"]'); if (add) add.disabled = !(st.link && st.area) || !!st.busy;
}
const arTimers = {};
async function arCheck(scope) {
  const st = arState(scope), link = st.link.trim();
  if (!link) { st.check = null; arPaint(scope); return; }
  if (!ALTOS_RX.test(link)) { st.check = { ok: false, error: 'Paste an Altos report link (it starts with https://altos.re/r/…).' }; arPaint(scope); return; }
  st.checking = true; arPaint(scope);
  try {
    const r = await api('altos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link }) });
    if (st.link.trim() !== link) return;
    st.check = r;
    if (r.ok) { if (!st.area) st.area = r.city || r.zip || ''; if (!st.label) st.label = (r.location || '').replace(/,\s*[A-Z]{2}\b.*$/, '').trim() || st.area; }
  } catch (e) { st.check = null; }
  st.checking = false; arPaint(scope);
}
function arClear(st) { st.link = ''; st.area = ''; st.label = ''; st.check = null; }

// ---------- start ----------
async function loadRequests() { try { S.reqs = await api('requests'); } catch (e) { S.reqs = { requests: [], newHires: [] }; } render(); }
async function start() {
  try { S.me = await api('me'); }
  catch (e) {
    $('#app').innerHTML = '<div class="gate"><div class="card"><img src="logo-dark.png" alt="Stewart Title" style="width:200px"><h1 style="font-size:26px">' + (e.status === 403 ? 'Not on the list yet' : 'Something went wrong') + '</h1>' +
      '<div class="muted2" style="line-height:1.6">' + esc(e.message) + (e.data && e.data.signedInAs ? '<br>Signed in as ' + esc(e.data.signedInAs) + '.' : '') + '</div>' +
      (e.status === 403 ? '<div class="muted2">Ask West Marketing to add you to the Manager Portal.</div><a class="btn" href="/cdn-cgi/access/logout">Use a different email</a>' : '<button class="btn" onclick="location.reload()">Try again</button>') + '</div></div>';
    return;
  }
  render(); loadRequests();
}
start();
