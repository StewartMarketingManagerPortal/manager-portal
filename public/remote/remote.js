// Marketing Tools · phone remote. Reads the Mac's status (through the Manager Portal) and sends it requests.
// The Mac app does the work; this page only shows what's going on and asks for things.
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const R = { st: null, err: '', loading: false, sheet: null, q: '' };

async function api(path, opts) {
  const r = await fetch('/api/' + path, Object.assign({ credentials: 'same-origin' }, opts || {}));
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || 'Something went wrong (' + r.status + ')');
  return j;
}
async function load() {
  if (R.loading) return; R.loading = true;
  try { R.st = await api('remote/status'); R.err = ''; } catch (e) { R.err = e.message; }
  R.loading = false;
  // don't interrupt a playing video or someone typing
  if (route()[0] === 'post') { navRefresh(); return; }
  const v = document.querySelector('video'), f = document.activeElement;
  if ((v && !v.paused) || (f && /INPUT|TEXTAREA/.test(f.tagName))) return;
  render();
}
function toast(msg, bad) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.innerHTML = '<i></i><span>' + esc(msg) + '</span>';
  document.body.appendChild(el); setTimeout(() => el.remove(), 4500);
}
async function send(action, args, msg) {
  try { await api('remote/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, args }) }); toast(msg || 'Sent to your Mac'); setTimeout(load, 1500); }
  catch (e) { toast(e.message, true); }
}

// ---------- status helpers ----------
const D = () => (R.st && R.st.data) || {};
function macState() {
  const s = R.st; if (!s || !s.beat) return { k: 'off', t: 'Waiting for your Mac' };
  const age = (s.now || Date.now()) - s.beat;
  if (age < 90e3) return { k: 'ok', t: (s.mac ? String(s.mac).replace(/[<>&"]/g, '') : 'Your Mac') + ' is ready' };
  if (age < 15 * 60e3) return { k: 'late', t: 'Mac checked in ' + Math.round(age / 60e3) + ' min ago' };
  return { k: 'off', t: 'Mac is asleep or Marketing Tools is closed · requests will wait' };
}
const ago = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : MON[new Date(t).getMonth()] + ' ' + new Date(t).getDate(); };
const today = () => { const d = new Date(); return MON[d.getMonth()] + ' ' + d.getDate(); };
const pstPill = s => s === 'ok' ? '<span class="pill ok">On portal</span>' : s === 'wait' ? '<span class="pill w">Invited</span>' : s === 'account' ? '<span class="pill b">Has login</span>' : s === 'none' ? '<span class="pill no">Not on portal</span>' : '';
const distOf = note => /^on the list/i.test(note) ? 'on' : /^requested/i.test(note) ? 'req' : 'none';
const distPill = s => s === 'on' ? '<span class="pill ok">On WM All</span>' : s === 'req' ? '<span class="pill w">Requested</span>' : '<span class="pill no">Not on WM All</span>';
const stateWord = s => /^new$/i.test(s) ? ['g', 'Waiting for Mac'] : /taken|running/i.test(s) ? ['w', 'Working'] : /done/i.test(s) ? ['ok', 'Done'] : /problem/i.test(s) ? ['no', 'Problem'] : ['g', s || '…'];

// ---------- pages ----------
const route = () => (location.hash || '#home').slice(1).split('/');
window.addEventListener('hashchange', () => { R.sheet = null; render(); window.scrollTo(0, 0); });
const IC = {
  home: '<path d="M3 11l9-8 9 8v10H3z"/><path d="M9 21v-6h6v6"/>', video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  hires: '<circle cx="10" cy="8" r="4"/><path d="M3 21c1-4 4-6 7-6s6 2 7 6"/><path d="M19 8v6M16 11h6"/>', post: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor"/>', people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5.4"/>',
};
const svg = k => '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + IC[k] + '</svg>';
// a slim dark bar at the top, with every page in the menu behind the button at the top right (same as the Manager Portal)
function nav(on) {
  const c = D().c || {}, due = SP.due(), any = due || c.inbox || c.hires;
  const t = (k, label, n) => '<a class="mlink' + (on === k ? ' on' : '') + '" href="#' + k + '"' + (on === k ? ' aria-current="page"' : '') + '>' + svg(k) + label + (n ? '<span class="count">' + n + '</span>' : '') + '</a>';
  return '<header class="mtop"><img class="logo" src="/logo-light.png" alt="Stewart Title"><span class="tag">MARKETING TOOLS</span>' +
    '<details class="mmenu"><summary aria-label="Menu"><svg class="mm-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
    '<svg class="mm-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' + (any ? '<span class="mm-dot"></span>' : '') + '</summary>' +
    '<nav class="mmenu-list" aria-label="Main">' + t('home', 'Home') + t('post', 'Post', due) + t('video', 'Video', c.inbox) + t('hires', 'New Hires', c.hires) + t('people', 'People') + '</nav><span class="mm-scrim" aria-hidden="true"></span></details></header>';
}
// refresh the menu's counts without closing it if it's open
function navRefresh() { const n = document.querySelector('.mtop'); if (n && !R.sheet && !n.querySelector('details[open]')) n.outerHTML = nav(route()[0]); }
// tapping outside the open menu closes it
document.addEventListener('click', e => { const m = document.querySelector('details.mmenu[open]'); if (m && (!m.contains(e.target) || e.target.classList.contains('mm-scrim'))) m.open = false; });
function render() {
  const [pg, arg] = route();
  // social posts don't need the Mac: they come straight from the board
  if (pg === 'post') { $('#app').innerHTML = nav(pg) + (arg ? postOne(arg) : postList()) + (R.sheet ? R.sheet() : ''); return; }
  if (!R.st) { $('#app').innerHTML = R.err ? '<div class="body"><div class="card">' + esc(R.err) + '</div><button class="btn" onclick="load()">Try again</button></div>' : '<div class="boot"><span class="spin"></span></div>'; return; }
  const f = { home: home, video: arg != null ? videoOne : videoList, hires: arg != null ? hireOne : hireList, people: arg != null ? personOne : peopleList }[pg] || home;
  $('#app').innerHTML = nav(pg) + f(arg) + (R.sheet ? R.sheet() : '');
}

function home() {
  const d = D(), c = d.c || {}, m = macState(), now = new Date();
  const hr = now.getHours(), first = (d.who || '').split(' ')[0];
  let h = '<div class="top"><div class="t">REMOTE</div><h1>' + (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (first ? ', ' + esc(first) : '') + '</h1>' +
    '<p>' + DAYS[now.getDay()] + ', ' + MON[now.getMonth()] + ' ' + now.getDate() + '</p><div class="mac ' + (m.k === 'ok' ? '' : m.k) + '"><i></i>' + esc(m.t) + '</div></div><div class="body">';
  if (!R.st.data) h += '<div class="card"><b>Not connected yet</b><div class="note" style="margin-top:6px">Open Marketing Tools on your Mac. It connects to this remote within about 15 seconds.</div></div>';
  if (d.job) h += '<div class="card"><div class="lbl">Running now</div><div style="margin-top:8px"><b style="font-size:14.5px">' + esc(d.job.t) + '</b><div class="note">' + esc(d.job.l) + ' · step ' + d.job.s + ' of ' + d.job.n + '</div><div class="bar"><i style="width:' + (d.job.p != null ? d.job.p : Math.round((d.job.s - 1) / d.job.n * 100)) + '%"></i></div></div></div>';
  const tile = (n, label, href, red) => '<a class="tile' + (red && n ? ' red' : '') + '" href="' + href + '"><b>' + (n == null ? '–' : n) + '</b><span>' + label + '</span></a>';
  h += '<div class="tiles">' + tile(c.inbox, 'Videos in the inbox', '#video', true) + tile(c.hires, 'New hires pending', '#hires') + tile(c.req, 'New marketing requests', '#home') + tile(c.noPortal, 'Not on the portal', '#people') + '</div>';
  if (d.last) h += '<div class="card"><div class="lbl">Last finished</div><div class="row"><div class="g"><b>' + esc(d.last.t) + '</b><small>' + ago(d.last.f) + (d.last.bad ? ' · ' + plural(d.last.bad, 'problem') : d.last.stop ? ' · stopped' : '') + '</small></div><span class="pill ' + (d.last.bad || d.last.stop ? 'no">Problem' : 'ok">Done') + '</span></div></div>';
  const cmds = R.st.commands || [];
  if (cmds.length) h += '<div class="card reqs"><div class="lbl">Your requests</div>' + cmds.slice(0, 6).map(x => { const [k, w] = stateWord(x.state); return '<div class="row"><div class="g"><b>' + esc(x.title) + '</b><small>' + esc(x.result || ago(Date.parse(x.created))) + '</small></div><span class="pill ' + k + '">' + w + '</span></div>'; }).join('') + '</div>';
  return h + '</div>';
}

// video
function videoList() {
  const L = D().inbox || [];
  let h = '<div class="hd"><h2>Video inbox</h2><div class="sub">' + plural(L.length, 'clip') + ' waiting to be built</div></div><div class="body">';
  if (!L.length) return h + '<div class="empty">The inbox is empty.</div></div>';
  return h + '<div class="card list">' + L.map((c, i) => '<a class="row" href="#video/' + i + '"><span class="av">' + esc(initials(c.who || '?')) + '</span><span class="g"><b>' + esc(c.who || 'Who’s this?') + '</b><small>' + esc(c.topic) + ' · ' + (c.phone ? 'phone' : 'studio') + '</small></span><span class="pill ' + (c.k === 'ready' ? 'ok' : 'w') + '">' + esc(c.lab) + '</span></a>').join('') + '</div></div>';
}
function videoOne(i) {
  const c = (D().inbox || [])[+i]; if (!c) return '<div class="hd"><a class="back" href="#video">‹ Video inbox</a><h2>Gone</h2></div><div class="body"><div class="empty">That clip isn’t in the inbox any more.</div></div>';
  let h = '<div class="hd"><a class="back" href="#video">‹ Video inbox</a><h2>' + esc(c.who || 'Who’s this?') + '</h2><div class="sub">' + esc(c.topic) + ' · ' + (c.phone ? 'phone upload' : 'studio clip') + '</div></div><div class="body">';
  h += c.phone && c.item ? '<video class="vid" src="/api/remote/video/' + esc(c.item) + '" controls playsinline preload="metadata"></video>' : '<div class="novid">' + (c.phone ? 'This one can only be watched on the Mac.' : 'Studio clip (' + c.mb + ' MB) · watch it on the Mac') + '</div>';
  h += '<div class="card"><div class="row"><div class="g"><b>' + (c.k === 'ready' ? 'Ready to build' : c.k === 'setup' ? 'Needs setup on the Mac' : 'Pick who’s in it on the Mac') + '</b><small>' + esc(c.shoot) + '</small></div><span class="pill ' + (c.k === 'ready' ? 'ok' : 'w') + '">' + esc(c.lab) + '</span></div></div>';
  h += '<button class="btn p" data-a="vbuild" data-i="' + i + '"' + (c.k === 'ready' ? '' : ' disabled') + '>Build video</button>';
  h += '<button class="btn" data-a="vremove" data-i="' + i + '">' + (c.phone ? 'Remove + reshoot' : 'Remove from the inbox') + '</button></div>';
  return h;
}

// new hires
function hireList() {
  const L = D().hires || [];
  let h = '<div class="hd"><h2>New hires</h2><div class="sub">Marketing Setup = Pending · one at a time</div></div><div class="body">';
  if (!L.length) return h + '<div class="empty">Nobody is pending.</div></div>';
  return h + '<div class="card list">' + L.map((p, i) => '<a class="row" href="#hires/' + i + '"><span class="av">' + esc(initials(p.n)) + '</span><span class="g"><b>' + esc(p.n) + '</b><small>' + esc(p.t || '') + '</small></span>' + (p.ps && p.ps !== 'ok' ? pstPill(p.ps) : '') + '<span class="chev">›</span></a>').join('') + '</div></div>';
}
function hireOne(i) {
  const p = (D().hires || [])[+i]; if (!p) return '<div class="hd"><a class="back" href="#hires">‹ New hires</a><h2>Gone</h2></div><div class="body"><div class="empty">They’re not pending any more.</div></div>';
  let h = '<div class="hd"><a class="back" href="#hires">‹ New hires</a><h2>' + esc(p.n) + '</h2><div class="sub">' + esc(p.t || '') + '</div></div><div class="body">';
  h += '<div class="card"><div class="lbl">Day-one package</div><div class="row"><div class="g"><b>' + (p.photo ? 'Headshot ready' : 'No headshot yet') + '</b><small>New hire package, title tips, flyers' + (p.areas ? ', market update (' + plural(p.areas, 'area') + ')' : '') + ', upload to the portal</small></div><span class="pill ' + (p.photo ? 'ok">✓' : 'w">No photo') + '</span></div></div>';
  h += accessCard(p.n, p.ps, p.pe, p.d);
  h += '<button class="btn p" data-a="hmake" data-n="' + esc(p.n) + '">Make everything + upload</button><div class="note" style="text-align:center">Marks them Done on the board when finished. Runs on your Mac.</div></div>';
  return h;
}
function accessCard(name, ps, pe, note) {
  const ds = distOf(note || ''), N = esc(name);
  let h = '<div class="card"><div class="row"><div class="g"><b>Employee Marketing Portal</b><small>' + esc(pe || (ps === 'none' ? 'Not invited yet' : '')) + '</small></div>' + pstPill(ps) + '</div>';
  if (ps === 'none' || ps === 'wait') h += '<button class="btn" style="margin:4px 0 8px" data-a="pinvite" data-n="' + N + '" data-e="' + esc(pe || '') + '">' + (ps === 'wait' ? 'Resend invite' : 'Send invite') + '</button>';
  if (ps === 'account') h += '<button class="btn" style="margin:4px 0 8px" data-a="padd" data-n="' + N + '">Add to portal</button>';
  h += '<div class="row"><div class="g"><b>West Marketing All</b><small>' + esc(ds === 'none' ? 'Not requested yet' : note.split(' · ')[0]) + '</small></div>' + distPill(ds) + '</div>';
  h += ds === 'on' ? '' : '<div class="btns" style="margin-top:4px">' + (ds === 'req' ? '<button class="btn" data-a="dconfirm" data-n="' + N + '" data-note="' + esc(note) + '">✓ On the list</button><button class="btn" data-a="dmail" data-n="' + N + '">Resend email</button>' : '<button class="btn" data-a="dmail" data-n="' + N + '">Send email</button><button class="btn" data-a="dalready" data-n="' + N + '">Already on it</button>') + '</div>';
  return h + '</div>';
}

// people
function peopleList() {
  const L = D().people || [], q = R.q.toLowerCase().trim();
  const hits = L.map((p, i) => [p, i]).filter(([p]) => !q || (p[0] + ' ' + p[1]).toLowerCase().includes(q)).slice(0, 60);
  return '<div class="hd"><h2>People</h2><div class="sub">' + plural(L.length, 'person') + ' on the Main Employee Sheet</div></div><div class="body"><input class="search" type="search" placeholder="Search name or title" value="' + esc(R.q) + '" data-q>' +
    '<div class="card list" id="plist">' + (hits.length ? hits.map(([p, i]) => '<a class="row" href="#people/' + i + '"><span class="av">' + esc(initials(p[0])) + '</span><span class="g"><b>' + esc(p[0]) + '</b><small>' + esc(p[1]) + '</small></span>' + (p[2] && p[2] !== 'ok' ? pstPill(p[2]) : '') + '<span class="chev">›</span></a>').join('') : '<div class="empty">Nobody matches.</div>') + '</div></div>';
}
function personOne(i) {
  const p = (D().people || [])[+i]; if (!p) return '<div class="hd"><a class="back" href="#people">‹ People</a></div>';
  const hire = (D().hires || []).find(h => h.n === p[0]);
  let h = '<div class="hd"><a class="back" href="#people">‹ People</a><h2>' + esc(p[0]) + '</h2><div class="sub">' + esc(p[1]) + '</div></div><div class="body">';
  h += accessCard(p[0], p[2], p[4], hire ? hire.d : p[3] === 'on' ? 'On the list' : p[3] === 'req' ? 'Requested' : '');
  h += '<button class="btn p" data-a="prefresh" data-n="' + esc(p[0]) + '">Refresh their pieces</button><div class="note" style="text-align:center">Remakes their new hire package, title tips, flyers and market update with what’s on the board now, and uploads them. Use it after a title, phone or headshot change.</div></div>';
  return h;
}

// ---------- social posts (Projects › Social on the Mac): post them from this phone ----------
// The QR code on the Mac and the monday reminder open #post/<id>. Save the pictures, copy the caption, post it in the app, mark it posted.
const SP = { list: null, err: '', loading: false, app: {}, me: '', due: () => (SP.list || []).filter(p => spLate(p) || spSoon(p)).length };
const spAll = p => p.apps.length > 0 && p.apps.every(a => p.posted[a]);
const spLate = p => !spAll(p) && Date.parse(p.at) <= Date.now();
const spSoon = p => !spAll(p) && Date.parse(p.at) > Date.now() && Date.parse(p.at) - Date.now() < 3 * 3600e3;
const SP_APP = { ig: 'Instagram', li: 'LinkedIn' }, SP_FULL = { ig: 'Instagram + Facebook', li: 'LinkedIn' };
const spWhen = t => { const d = new Date(t); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = (h + 11) % 12 + 1; return DAYS[d.getDay()].slice(0, 3) + ', ' + MON[d.getMonth()] + ' ' + d.getDate() + ' · ' + h + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap; };
const spImg = (p, i) => '/api/social/img/' + encodeURIComponent(p.id) + '/' + encodeURIComponent(i.id);
const spNet = a => '<span class="net ' + a + '">' + (a === 'ig' ? 'IG' : 'in') + '</span>';
async function spLoad() {
  if (SP.loading) return; SP.loading = true;
  try { const r = await api('social'); SP.list = r.posts || []; SP.me = r.me || ''; SP.err = r.missing ? 'The social calendar isn’t set up yet.' : ''; } catch (e) { SP.err = e.message; SP.list = SP.list || []; }
  SP.loading = false;
  const f = document.activeElement; if (route()[0] === 'post' && !(f && /INPUT|TEXTAREA/.test(f.tagName)) && !R.sheet) render(); else navRefresh();
}
function spState(p) { return spAll(p) ? ['g', 'Posted'] : spLate(p) ? ['no', 'Time to post'] : ['ok', 'Ready']; }
function spRow(p) {
  const [k, t] = spState(p), i = p.images[0];
  return '<a class="row" href="#post/' + esc(p.id) + '"><span class="sth">' + (i && !i.video ? '<img src="' + spImg(p, i) + '" alt="" loading="lazy">' : '<span>' + (i && i.video ? '▶' : '') + '</span>') + '</span><span class="g"><b>' + esc(p.name) + '</b><small>' + esc(spWhen(p.at)) + ' · ' + p.apps.map(a => SP_APP[a]).join(' + ') + '</small></span><span class="pill ' + k + '">' + t + '</span></a>';
}
function postList() {
  if (!SP.list) { spLoad(); return '<div class="hd"><h2>Post</h2><div class="sub">Stewart Title of California</div></div><div class="body"><div class="boot" style="min-height:40vh"><span class="spin"></span></div></div>'; }
  const L = SP.list, now = Date.now();
  const late = L.filter(spLate), soon = L.filter(p => !spAll(p) && Date.parse(p.at) > now), done = L.filter(spAll).reverse();
  let h = '<div class="hd"><h2>Post</h2><div class="sub">Stewart Title of California · Instagram, Facebook and LinkedIn</div></div><div class="body">';
  if (SP.err) h += '<div class="card note">' + esc(SP.err) + '</div>';
  if (late.length) h += '<div class="card list"><div class="lbl" style="color:var(--brand)">Time to post · ' + late.length + '</div>' + late.map(spRow).join('') + '</div>';
  h += '<div class="card list"><div class="lbl">Coming up</div>' + (soon.length ? soon.slice(0, 12).map(spRow).join('') : '<div class="empty" style="padding:16px 0">Nothing on the calendar yet. Posts come from finished projects in Marketing Tools.</div>') + '</div>';
  if (done.length) h += '<div class="card list"><div class="lbl">Posted lately</div>' + done.slice(0, 8).map(spRow).join('') + '</div>';
  return h + '</div>';
}
function postOne(id) {
  if (!SP.list) { spLoad(); return '<div class="hd"><a class="back" href="#post">‹ Post</a><h2>…</h2></div><div class="body"><div class="boot" style="min-height:40vh"><span class="spin"></span></div></div>'; }
  const p = SP.list.find(x => x.id === String(id));
  if (!p) return '<div class="hd"><a class="back" href="#post">‹ Post</a><h2>Not found</h2></div><div class="body"><div class="empty">' + esc(SP.err || 'This post isn’t on the calendar any more.') + '</div></div>';
  const a = p.apps.indexOf(SP.app[p.id]) >= 0 ? SP.app[p.id] : (p.apps.find(x => !p.posted[x]) || p.apps[0]), cap = a === 'ig' ? p.capIg : p.capLi, done = p.posted[a], vids = p.images.filter(i => i.video).length;
  let h = '<div class="hd"><a class="back" href="#post">‹ Post</a><h2>' + esc(p.name) + '</h2><div class="sub">' + esc(spWhen(p.at)) + '</div></div><div class="body">';
  if (p.apps.length > 1) h += '<div class="seg">' + p.apps.map(x => '<a data-a="spapp" data-id="' + esc(p.id) + '" data-app="' + x + '" class="' + (x === a ? 'on' : '') + '">' + spNet(x) + SP_APP[x] + (p.posted[x] ? ' ✓' : '') + '</a>').join('') + '</div>';
  h += '<div class="spimgs">' + p.images.map(i => i.video ? '<video src="' + spImg(p, i) + '" controls playsinline preload="metadata"></video>' : '<img src="' + spImg(p, i) + '" alt="' + esc(i.name) + '">').join('') + '</div>';
  if (p.images.length > 1) h += '<div class="note" style="text-align:center;margin-top:-4px">' + plural(p.images.length, vids ? 'file' : 'picture') + ' · swipe to see them all</div>';
  h += '<button class="btn k" data-a="spsave" data-id="' + esc(p.id) + '">' + (p.images.length > 1 ? 'Save ' + p.images.length + ' to Photos' : vids ? 'Save the video to Photos' : 'Save the picture to Photos') + '</button>';
  h += '<div class="card"><div class="lbl">' + (a === 'ig' ? 'Instagram caption · shares to Facebook' : 'LinkedIn caption') + '</div><div class="spcap">' + (cap ? esc(cap) : '<span class="note">No caption</span>') + '</div></div>';
  if (cap) h += '<button class="btn" data-a="spcopy" data-id="' + esc(p.id) + '" data-app="' + a + '">Copy caption</button>';
  h += '<button class="btn p" data-a="spopen" data-app="' + a + '">Open ' + SP_APP[a] + '</button>';
  h += done ? '<div class="card"><div class="row"><div class="g"><b>✓ Posted on ' + SP_APP[a] + '</b><small>' + (done.by === SP.me ? 'By you · ' : '') + esc(spWhen(done.at)) + '</small></div><a class="pill g" data-a="spposted" data-id="' + esc(p.id) + '" data-app="' + a + '" data-undo="1">Undo</a></div></div>'
    : '<button class="btn" data-a="spposted" data-id="' + esc(p.id) + '" data-app="' + a + '">✓ Mark posted on ' + SP_APP[a] + '</button>';
  h += '<div class="note" style="text-align:center">' + (a === 'ig' ? 'In Instagram tap +, pick the new pictures from the top of your photos, paste the caption, and turn on Facebook sharing if it’s off.' : 'In LinkedIn switch to the Stewart Title of California page, start a post, add the pictures and paste the caption.') + '</div>';
  return h + '</div>';
}
async function spSave(p) {
  const btn = document.querySelector('[data-a="spsave"]'), old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Getting them ready…'; }
  try {
    const files = [];
    for (const i of p.images) { const r = await fetch(spImg(p, i), { credentials: 'same-origin' }); if (!r.ok) throw new Error('A picture couldn’t be loaded.'); const bl = await r.blob(); files.push(new File([bl], i.name || ('picture-' + (files.length + 1)), { type: bl.type })); }
    if (navigator.canShare && navigator.canShare({ files })) {
      if (btn) btn.textContent = old;
      await navigator.share({ files });   // the phone's share sheet: Save Image / Save Video
    } else {
      // no share sheet (a computer): download them one by one
      p.images.forEach((i, n) => setTimeout(() => { const a = document.createElement('a'); a.href = spImg(p, i) + '?dl=1'; a.download = i.name || ''; document.body.appendChild(a); a.click(); a.remove(); }, n * 400));
      toast('Downloading ' + plural(p.images.length, 'file'));
    }
  } catch (e) { if (e && e.name !== 'AbortError') toast(e.message || 'Couldn’t save them', true); }
  if (btn) { btn.disabled = false; btn.textContent = old; }
}
async function spCopy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length); document.execCommand('copy'); t.remove(); }
  toast('Caption copied · paste it in the app');
}
function spOpen(a) {
  // the app if it's installed, the website if not
  const app = a === 'ig' ? 'instagram://app' : 'linkedin://', web = a === 'ig' ? 'https://www.instagram.com/' : 'https://www.linkedin.com/';
  const t = setTimeout(() => { if (document.visibilityState === 'visible') location.href = web; }, 1400);
  document.addEventListener('visibilitychange', () => clearTimeout(t), { once: true });
  location.href = app;
}
async function spPosted(p, a, undo) {
  const keep = p.posted[a];
  p.posted[a] = undo ? null : { by: SP.me, at: new Date().toISOString() }; render();
  try { await api('social/posted', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, app: a, undo: !!undo }) }); toast(undo ? 'Marked not posted' : 'Marked posted on ' + SP_APP[a]); }
  catch (e) { p.posted[a] = keep; render(); toast(e.message, true); }
}

// ---------- sheets (confirm / type something) ----------
function sheet(html) { R.sheet = () => '<div class="sheet" data-a="close"><div class="in">' + html + '</div></div>'; render(); const f = document.querySelector('.sheet input,.sheet textarea'); if (f) f.focus(); }
function confirmSheet(title, text, ok, run) { R.run = run; sheet('<h3>' + esc(title) + '</h3><div class="note">' + esc(text) + '</div><button class="btn p" data-a="ok">' + esc(ok) + '</button><button class="btn" data-a="close">Cancel</button>'); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, d = D();
  const sp = el.dataset.id && SP.list ? SP.list.find(x => x.id === el.dataset.id) : null;
  if (a === 'spapp' && sp) { SP.app[sp.id] = el.dataset.app; render(); return; }
  if (a === 'spsave' && sp) return spSave(sp);
  if (a === 'spcopy' && sp) return spCopy(el.dataset.app === 'ig' ? sp.capIg : sp.capLi);
  if (a === 'spopen') return spOpen(el.dataset.app);
  if (a === 'spposted' && sp) return spPosted(sp, el.dataset.app, !!el.dataset.undo);
  if (a === 'close') { if (e.target === el || el.tagName === 'BUTTON') { R.sheet = null; render(); } return; }
  if (a === 'ok') { const f = R.run; R.sheet = null; render(); if (f) f(); return; }
  if (a === 'vbuild') { const c = d.inbox[+el.dataset.i]; return confirmSheet('Build this video?', (c.who || '') + ' · ' + c.topic + '. Takes about 5 minutes on your Mac. Both sizes go to their 10_Videos folder.', 'Build video', () => send('video.build', { path: c.path, who: c.who + ' · ' + c.topic }, 'Sent to your Mac · building ' + c.topic)); }
  if (a === 'vremove') {
    const c = d.inbox[+el.dataset.i]; R.run = null;
    sheet('<h3>Remove this clip?</h3><div class="note">It comes out of the inbox and is kept in 3_Built › Removed for 30 days.</div>' +
      (c.phone ? '<label class="check"><input type="checkbox" id="rs" checked> Ask ' + esc((c.who || 'them').split(' ')[0]) + ' to reshoot it</label><label class="field">What to fix (they’ll see this)<textarea id="rn" rows="3" placeholder="For example: The room is too dark. Face a window and try again."></textarea></label>' : '') +
      '<button class="btn p" data-a="vremove-go" data-i="' + el.dataset.i + '">Remove</button><button class="btn" data-a="close">Cancel</button>');
    return;
  }
  if (a === 'vremove-go') { const c = d.inbox[+el.dataset.i], rs = $('#rs'), rn = $('#rn'); R.sheet = null; render(); return send('video.remove', { path: c.path, reshoot: !!(rs && rs.checked), note: rn ? rn.value.trim() : '', who: c.who + ' · ' + c.topic }, 'Sent to your Mac · removing the clip'); }
  if (a === 'hmake') { const n = el.dataset.n; return confirmSheet('Set up ' + n + '?', 'Makes their headshot, folders, new hire package, title tips, flyers and market update, uploads everything to the portal, and marks them Done. Runs on your Mac and takes a while.', 'Make everything + upload', () => send('hire.make', { name: n }, 'Sent to your Mac · setting up ' + n)); }
  if (a === 'prefresh') { const n = el.dataset.n; return confirmSheet('Refresh ' + n + '’s pieces?', 'Remakes their pieces with what’s on the board now and uploads them. Runs on your Mac.', 'Refresh their pieces', () => send('person.refresh', { name: n }, 'Sent to your Mac · refreshing ' + n)); }
  if (a === 'pinvite') { const n = el.dataset.n; sheet('<h3>Invite ' + esc(n) + '</h3><label class="field">Personal email<input type="email" id="pe" value="' + esc(el.dataset.e || '') + '" placeholder="The one they’ll check" autocomplete="off"></label><div class="note">monday.com emails them an invite and they’re added to the portal board right away.</div><button class="btn p" data-a="pinvite-go" data-n="' + esc(n) + '">Send invite</button><button class="btn" data-a="close">Cancel</button>'); return; }
  if (a === 'pinvite-go') { const n = el.dataset.n, em = ($('#pe').value || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast('That email doesn’t look right.', true); R.sheet = null; render(); return send('portal.invite', { name: n, email: em }, 'Sent to your Mac · inviting ' + n); }
  if (a === 'padd') { const n = el.dataset.n; return confirmSheet('Add ' + n + ' to the portal?', 'They already have a monday.com login. This adds them to the portal board and puts them on their rows.', 'Add to portal', () => send('portal.add', { name: n }, 'Sent to your Mac · adding ' + n)); }
  if (a === 'dmail') {
    // the email opens right here on the phone; then the Mac marks it requested
    const n = el.dataset.n, p = (d.people || []).find(x => x[0] === n) || [n, ''], me = (d.who || '').trim();
    const body = 'Hi,\n\nPlease add our new team member to the West Marketing All distribution list:\n\n' + [n, p[1], p[5]].filter(Boolean).join('\n') + '\n\nThank you' + (me ? ',\n' + me : '');
    location.href = 'mailto:' + encodeURIComponent(d.dto || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent('Please add ' + n + ' to the West Marketing All distribution list') + '&body=' + encodeURIComponent(body);
    setTimeout(() => confirmSheet('Did you send it?', 'Mark ' + n + ' as requested for West Marketing All.', 'Mark as requested', () => send('dist.mark', { name: n, note: 'Requested ' + today() + (d.dto ? ' · ' + d.dto : '') }, 'Marked as requested')), 900);
    return;
  }
  if (a === 'dconfirm' || a === 'dalready') { const n = el.dataset.n, by = (d.who || '').split(' ')[0], req = String(el.dataset.note || '').split(' · ')[0]; return send('dist.mark', { name: n, note: 'On the list · ' + (a === 'dconfirm' ? 'confirmed ' : 'marked ') + today() + (by ? ' by ' + by : '') + (a === 'dconfirm' && /^requested/i.test(req) ? ' · ' + req.replace(/^Requested/, 'requested') : '') }, n + ' marked on West Marketing All'); }
});
document.addEventListener('input', e => { if (e.target.hasAttribute && e.target.hasAttribute('data-q')) { R.q = e.target.value; const pos = e.target.selectionStart; render(); const s = $('[data-q]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } } });

load(); spLoad();
setInterval(() => { if (document.visibilityState === 'visible' && !R.sheet) load(); }, 10000);
setInterval(() => { if (document.visibilityState === 'visible' && !R.sheet) spLoad(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { load(); spLoad(); } });
