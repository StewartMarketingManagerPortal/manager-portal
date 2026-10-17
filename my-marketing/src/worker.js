// My Marketing: each employee signs in with the email on their monday.com guest account,
// gets a code in the monday app, and sees only the pieces assigned to them on the Employee Marketing Portal board.
import { nk, gql, cached, boardMembers, userByEmail, allowed, itemsFor, notify, forget, boardByName } from './monday.js';

const DAY = 86400e3;
const CODE_MINUTES = 10;
const json = (data, status, headers) => new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}) });
const fail = (status, error, extra) => json(Object.assign({ error }, extra || {}), status);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!env.MONDAY_TOKEN) return fail(500, 'The site is missing its monday.com connection (MONDAY_TOKEN). Ask West Marketing.');
    try {
      return await route(request, env, ctx, url);
    } catch (e) {
      console.error(e && e.stack || e);
      return fail(500, 'Something went wrong. Please try again in a minute.');
    }
  },
};

async function route(request, env, ctx, url) {
  const path = url.pathname, method = request.method;
  if (method === 'POST' && path === '/api/code') return sendCode(request, env);
  if (method === 'POST' && path === '/api/verify') return verify(request, env);
  if (method === 'POST' && path === '/api/logout') return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  if (method === 'GET' && path === '/api/viewas') return viewAs(env, url);
  if (method === 'POST' && path === '/api/viewas/exit') return json({ ok: true }, 200, { 'Set-Cookie': viewCookie('', 0) });
  if (path.startsWith('/api/sample')) return sampleRoute(request, env, url);

  const s = await session(request, env);
  if (!s) return fail(401, 'Please sign in.', { signin: true });
  if (!(await allowed(env, s.uid))) return fail(403, 'Your access to My Marketing has ended. Ask West Marketing if this is a mistake.', { signin: true, clear: true });

  // a manager looking at a team member's page from the Manager Portal can look, not change anything
  if (s.ro && method !== 'GET') return fail(403, 'This is a read-only view from the Manager Portal.');
  if (method === 'GET' && path === '/api/me') return json({ name: s.name, email: s.email, viewAs: s.ro ? { by: s.by || '' } : null });
  if (method === 'GET' && path === '/api/content') {
    if (url.searchParams.get('fresh')) forget('items:' + s.uid);
    return json(await content(env, s));
  }
  if (method === 'GET' && path === '/api/scripts') return json(await scripts(env, s));
  if (method === 'POST' && path === '/api/video') return uploadVideo(request, env, s, url);
  if (method === 'GET' && path === '/api/popup') return json({ popup: s.ro ? null : await popupFor(env, s).catch(() => null) });
  if (method === 'POST' && path === '/api/popup') return popupMark(request, env, ctx, s);
  const m = path.match(/^\/api\/file\/(\d+)$/);
  if (method === 'GET' && m) return file(request, env, ctx, s, m[1], url.searchParams.get('dl') === '1');
  return fail(404, 'Not found');
}

// ---------- sign-in ----------
const okEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 200;
const gate = (env, name) => env.GATE.get(env.GATE.idFromName(name));
async function gateCall(env, name, body) {
  const r = await gate(env, name).fetch('https://gate/', { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

async function sendCode(request, env) {
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  if (!okEmail(email)) return fail(400, 'Please enter a valid email address.');
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const lim = await gateCall(env, 'ip:' + ip, { op: 'hit', limit: 30, window: 3600e3 });
  if (!lim.ok) return fail(429, 'Too many tries from this network. Please wait a bit and try again.');

  const notFound = 'We couldn’t find that email on the Employee Marketing Portal. Use the email on your monday.com account, or ask West Marketing for access.';
  const u = await userByEmail(env, email);
  if (!u || !u.enabled) return fail(404, notFound);
  const members = await boardMembers(env);
  if (!members.has(String(u.id))) return fail(404, notFound);

  const issued = await gateCall(env, 'email:' + email, { op: 'issue', uid: String(u.id), name: u.name });
  if (!issued.ok) return fail(429, 'You’ve asked for several codes in a row. Please wait a few minutes and use the last code we sent.');
  // the notification points at one of their own pieces (or the board) so it opens somewhere they can see
  const { p, items } = await itemsFor(env, u.id);
  const target = items.length ? items[0].id : p.id;
  await notify(env, u.id, target, 'Your My Marketing sign-in code is ' + issued.code + '. It expires in ' + CODE_MINUTES + ' minutes.');
  return json({ ok: true });
}

async function verify(request, env) {
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || '').trim().toLowerCase();
  const code = String(b.code || '').replace(/\D/g, '');
  if (!okEmail(email) || code.length !== 6) return fail(400, 'Enter the 6-digit code from your monday app.');
  const r = await gateCall(env, 'email:' + email, { op: 'check', code });
  if (!r.ok) return fail(400, r.reason === 'locked' ? 'Too many wrong tries. Please ask for a new code.' : r.reason === 'expired' ? 'That code has expired. Please ask for a new one.' : 'That code doesn’t match. Please check it and try again.');
  if (!(await allowed(env, r.uid))) return fail(403, 'Your access to My Marketing has ended. Ask West Marketing if this is a mistake.');
  const days = b.remember === false ? 0 : 90;
  const token = await sign(env, { uid: r.uid, name: r.name, email, exp: Date.now() + (days || 1) * DAY });
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, days ? days * 86400 : null) });
}

// ---------- sessions: a signed cookie, re-checked against the board on every visit ----------
function cookie(v, maxAge) {
  return 'mm_s=' + v + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (maxAge === 0 ? '; Max-Age=0' : maxAge ? '; Max-Age=' + maxAge : '');
}
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();
async function key(env) {
  const secret = (env.SESSION_SECRET || '') + '|my-marketing-sessions|' + env.MONDAY_TOKEN;
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await key(env), enc.encode(body));
  return body + '.' + b64u(sig);
}
// ---------- view as: a manager opens a team member's page (read only) from the Manager Portal ----------
// The Manager Portal signs a 5-minute pass with a key both sites can make (from VIEW_AS_SECRET, or their shared monday token).
function viewCookie(v, maxAge) {
  return 'mm_v=' + v + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (maxAge === 0 ? '; Max-Age=0' : '; Max-Age=' + maxAge);
}
async function viewKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode((env.VIEW_AS_SECRET || '') + '|view-as|' + env.MONDAY_TOKEN));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function viewAs(env, url) {
  const t = String(url.searchParams.get('t') || ''), m = t.match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  const bad = msg => new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;color:#1A1A1C"><h2>Can’t open this view</h2><p>' + msg + '</p><p>Go back to the Manager Portal and click the button again.</p>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (!m) return bad('The link is missing its pass.');
  const sig = Uint8Array.from(atob(m[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  if (!(await crypto.subtle.verify('HMAC', await viewKey(env), sig, enc.encode(m[1])))) return bad('The pass didn’t check out.');
  let p; try { p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return bad('The pass couldn’t be read.'); }
  if (!p || !p.uid || !(p.exp > Date.now())) return bad('The pass has expired (they last 5 minutes).');
  const token = await sign(env, { uid: String(p.uid), name: String(p.name || ''), email: '', ro: true, by: String(p.by || ''), exp: Date.now() + 2 * 3600e3 });
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': viewCookie(token, 7200), 'Cache-Control': 'no-store' } });
}
// ---------- recruiting samples: a manager shows a candidate sample marketing (read only) from the Manager Portal ----------
// The portal signs a 5-minute pass for one row on its private "Manager Portal Recruiting" board. Opening it gives this browser a
// 30-minute sample view of that candidate only; it is never a sign-in, and nothing is saved here.
const SAMPLE_MIN = 30;
function sampleCookie(v, maxAge) {
  return 'mm_r=' + v + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (maxAge === 0 ? '; Max-Age=0' : '; Max-Age=' + maxAge);
}
async function sampleKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode((env.VIEW_AS_SECRET || '') + '|recruit-sample|' + env.MONDAY_TOKEN));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function readSigned(k, t) {
  const m = String(t || '').match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  if (!(await crypto.subtle.verify('HMAC', k, unb64(m[2]), enc.encode(m[1])))) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64(m[1]))); } catch (e) { return null; }
}
async function sampleRow(env, cid) {
  const b = await boardByName(env, 'Manager Portal Recruiting');
  if (!b) return null;
  const want = ['Title', 'Area', 'Phone', 'Email', 'Photo'].map(t => b.cols[t]).filter(Boolean);
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){id name state board{id} column_values(ids:$c){id text} assets{id public_url created_at}}}', { i: [String(cid)], c: want });
  const it = (d.items || [])[0];
  if (!it || String(it.board.id) !== b.id || (it.state && it.state !== 'active')) return null;
  const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
  const photoId = b.cols.Photo, hasPhoto = photoId && v[photoId];
  const asset = hasPhoto ? (it.assets || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0] : null;
  return { name: it.name.trim(), title: v[b.cols.Title] || '', area: v[b.cols.Area] || '', phone: v[b.cols.Phone] || '', email: v[b.cols.Email] || '', photoUrl: asset ? asset.public_url : '' };
}
async function sampleRoute(request, env, url) {
  const path = url.pathname, method = request.method, k = await sampleKey(env);
  if (method === 'GET' && path === '/api/sample') {
    const p = await readSigned(k, url.searchParams.get('t'));
    const bad = msg => new Response('<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;color:#1A1A1C"><h2>Can’t open this sample</h2><p>' + msg + '</p><p>Go back to the Manager Portal and click “Show on My Marketing” again.</p>', { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (!p || !p.cid) return bad('The link is missing its pass, or it didn’t check out.');
    if (!(p.exp > Date.now())) return bad('The pass has expired (they last 5 minutes).');
    const exp = Date.now() + SAMPLE_MIN * 60e3;
    const body = b64u(enc.encode(JSON.stringify({ cid: String(p.cid), by: String(p.by || ''), exp })));
    const tok = body + '.' + b64u(await crypto.subtle.sign('HMAC', k, enc.encode(body)));
    return new Response(null, { status: 302, headers: { Location: '/sample.html', 'Set-Cookie': sampleCookie(tok, SAMPLE_MIN * 60), 'Cache-Control': 'no-store' } });
  }
  if (method === 'POST' && path === '/api/sample/exit') return json({ ok: true }, 200, { 'Set-Cookie': sampleCookie('', 0) });
  if (method !== 'GET') return fail(403, 'This is a read-only sample.');
  const ck = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)mm_r=([A-Za-z0-9_.-]+)/);
  const s = ck ? await readSigned(k, ck[1]) : null;
  if (!s || !s.cid || !(s.exp > Date.now())) return fail(401, 'This sample view has closed.');
  const row = await sampleRow(env, s.cid);
  if (!row) return fail(404, 'This candidate was removed.');
  if (path === '/api/sample/data') return json({ by: s.by, exp: s.exp, candidate: { name: row.name, title: row.title, area: row.area, phone: row.phone, email: row.email, photo: !!row.photoUrl } });
  if (path === '/api/sample/pieces') return json({ pieces: (await samplePieces(env)).map(x => ({ id: x.id, name: x.name, kind: x.kind, layout: x.layout, img: '/api/sample/art/' + x.art.id })) });
  if (path.startsWith('/api/sample/art/')) {
    const id = path.split('/').pop().replace(/\D/g, ''), x = (await samplePieces(env)).find(p => p.art.id === id);
    if (!x) return fail(404, 'Not found');
    const r = await fetch(x.art.url);
    if (!r.ok) { forget('samplePieces'); return fail(502, 'Could not load the piece'); }
    return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (path === '/api/sample/font') {
    const f = await sampleFont(env);
    const r = f ? await fetch(f.url) : null;
    if (!r || !r.ok) return fail(404, 'No font');
    return new Response(r.body, { headers: { 'Content-Type': { otf: 'font/otf', ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2' }[f.ext] || 'font/otf', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (path === '/api/sample/photo') {
    if (!row.photoUrl) return fail(404, 'No photo');
    const r = await fetch(row.photoUrl);
    if (!r.ok) return fail(502, 'Could not load the photo');
    return new Response(r.body, { headers: { 'Content-Type': r.headers.get('Content-Type') || 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  return fail(404, 'Not found');
}
// the Recruiting board's own copy of the marketing pieces (its "Sample pieces" group), live ones only - the Manager Portal adds them
async function samplePieces(env) {
  return cached('samplePieces', 600e3, async () => {
    const b = await boardByName(env, 'Manager Portal Recruiting');
    if (!b || !b.cols.Files) return [];
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){groups{id title}}}', { b: [b.id] });
    const g = (d.boards[0].groups || []).find(x => nk(x.title) === nk('Sample pieces'));
    if (!g) return [];
    const want = ['Kind', 'Layout', 'Piece Status'].map(t => b.cols[t]).filter(Boolean);
    let out = [], cursor = null;
    do {
      const q = cursor ? await gql(env, 'query($k:String!,$c:[String!],$f:[String!]){next_items_page(limit:200,cursor:$k){cursor items{id name column_values(ids:$c){id text} assets(column_ids:$f){id public_url created_at}}}}', { k: cursor, c: want, f: [b.cols.Files] })
        : await gql(env, 'query($b:[ID!],$g:[String],$c:[String!],$f:[String!]){boards(ids:$b){groups(ids:$g){items_page(limit:200){cursor items{id name column_values(ids:$c){id text} assets(column_ids:$f){id public_url created_at}}}}}}', { b: [b.id], g: [g.id], c: want, f: [b.cols.Files] });
      const pg = cursor ? q.next_items_page : q.boards[0].groups[0].items_page;
      out = out.concat(pg.items); cursor = pg.cursor;
    } while (cursor);
    return out.map(it => {
      const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
      const a = (it.assets || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
      return { id: String(it.id), name: it.name.trim(), kind: v[b.cols.Kind] || '', layout: v[b.cols.Layout] || '', status: (v[b.cols['Piece Status']] || 'live').toLowerCase(), art: a ? { id: String(a.id), url: a.public_url } : null };
    }).filter(x => x.art && x.status !== 'retired')
      // a piece added twice shows once: the newest row (highest id) of each kind + name wins
      .filter((p, i, all) => !all.some(o => o !== p && o.kind === p.kind && o.name.toLowerCase() === p.name.toLowerCase() && (o.id.length !== p.id.length ? o.id.length > p.id.length : o.id > p.id)));
  });
}
// the approved script font for the first name, from the "_Script font" row Marketing Tools keeps on the New Hire Packages board (licensed, so never in this repo)
async function sampleFont(env) {
  const b = await boardByName(env, 'New Hire Packages');
  if (!b) return null;
  const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){items_page(limit:200){items{name assets{name file_extension public_url}}}}}', { b: [b.id] });
  const it = d.boards[0].items_page.items.find(x => /^_script font$/i.test(x.name.trim()));
  const a = it && (it.assets || []).find(x => /\.(otf|ttf|woff2?)$/i.test(x.name || ''));
  return a ? { url: a.public_url, ext: a.name.split('.').pop().toLowerCase() } : null;
}
async function session(request, env) {
  const ck = request.headers.get('Cookie') || '';
  const m = ck.match(/(?:^|;\s*)mm_v=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/) || ck.match(/(?:^|;\s*)mm_s=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const sig = Uint8Array.from(atob(m[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', await key(env), sig, enc.encode(m[1]));
  if (!ok) return null;
  let s; try { s = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return null; }
  return s && s.exp > Date.now() && s.uid ? s : null;
}

// ---------- content ----------
const IMG = /^(png|jpe?g|gif|webp)$/i, VID = /^(mp4|mov|m4v|webm)$/i;
const ORDER = ['market update', 'newsletter', 'title tips', 'flyers', 'new hire', 'social media', 'holiday', 'happy anniversary', 'anniversary', 'branding', 'photos'];

// underscores (from file names) become spaces, and stray ones at the ends go away
const tidy = s => String(s || '').replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
function cleanTitle(assetName, itemName, employee, single) {
  if (single) return tidy(itemName);
  let t = String(assetName || '').replace(/\.[a-z0-9]+$/i, '');
  if (employee) t = t.split(' - ' + employee).join('').split(employee).join('');
  t = tidy(t.replace(/_+/g, ' ').replace(/\s*Market Update\s*$/i, ''));
  if (/slideshow/i.test(t)) return 'Market Update video';
  return t || tidy(itemName);
}

async function startDate(env, name) {
  return cached('start:' + nk(name), 3600e3, async () => {
    const b = await boardByName(env, 'Main Employee Sheet');
    const col = b && Object.keys(b.cols).find(t => nk(t) === 'start date');
    if (!col) return '';
    const qp = '{rules:[{column_id:"name",compare_value:[' + JSON.stringify(name) + '],operator:contains_text}]}';
    const d = await gql(env, 'query($b:[ID!],$c:[String!]){boards(ids:$b){items_page(limit:20,query_params:' + qp + '){items{name column_values(ids:$c){text}}}}}', { b: [b.id], c: [b.cols[col]] });
    const it = ((d.boards[0] && d.boards[0].items_page.items) || []).find(x => nk(x.name) === nk(name));
    const m = it && String((it.column_values[0] || {}).text || '').match(/\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : '';
  });
}
async function content(env, s) {
  const { p, items } = await itemsFor(env, s.uid);
  const now = Date.now();
  const pieces = [];
  items.forEach(it => {
    const v = {}; (it.column_values || []).forEach(c => v[c.id] = c.text || '');
    if (p.status && /archiv|old|inactive|remove/i.test(v[p.status] || '')) return;
    // "Photos & Personal Branding" was renamed "Branding": older rows still carry the old name
    const category = String((p.category && v[p.category]) || (it.group && it.group.title) || 'Other').replace(/^photos? (and|&) personal branding$/i, 'Branding');
    const date = (p.date && v[p.date]) || String(it.updated_at || it.created_at || '').slice(0, 10);
    const employee = p.employee ? v[p.employee] : '';
    const isMU = /market update/i.test(category);
    const assets = (it.assets || []).slice().sort((a, b) => (VID.test(b.file_extension.replace('.', '')) ? 1 : 0) - (VID.test(a.file_extension.replace('.', '')) ? 1 : 0));
    assets.forEach(a => {
      const ext = String(a.file_extension || '').replace('.', '').toLowerCase();
      const kind = IMG.test(ext) ? 'image' : VID.test(ext) ? 'video' : ext === 'pdf' ? 'pdf' : 'file';
      // each upload is a new file, so the file's own date says what's new (several pieces can share one row)
      const created = Date.parse(a.created_at || it.created_at || '') || 0;
      const dated = Date.parse(date) || 0;
      pieces.push({
        id: String(a.id), item: String(it.id), row: tidy(it.name), title: cleanTitle(a.name, it.name, employee, assets.length === 1),
        category, kind, ext, size: Number(a.file_size) || 0, date,
        isNew: isMU ? now - dated < 7 * DAY : now - created < 14 * DAY,
        url: '/api/file/' + a.id,
      });
    });
  });
  // categories in a sensible order
  const cats = {};
  pieces.forEach(x => { const c = cats[x.category] || (cats[x.category] = { name: x.category, count: 0, newCount: 0 }); c.count++; if (x.isNew) c.newCount++; });
  const rank = n => { const i = ORDER.findIndex(o => nk(n).includes(o)); return i < 0 ? 99 : i; };
  const categories = Object.values(cats).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  pieces.sort((a, b) => (b.isNew - a.isNew) || String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
  const week = pieces.filter(x => /market update/i.test(x.category));
  const newsletter = pieces.filter(x => /newsletter|event calendar/i.test(x.category));
  // their start date (Main Employee Sheet), so the "Share your move" card can go away 5 days after it
  const start = pieces.some(x => /new hire/i.test(x.category) && /move/i.test(x.row + ' ' + x.title)) ? await startDate(env, s.name).catch(() => '') : '';
  return { name: s.name, categories, pieces, week, newsletter, board: p.name, start };
}

// ---------- files: streamed through here so only the right person can open them ----------
async function file(request, env, ctx, s, assetId, download) {
  const find = d => { let f = null; d.items.forEach(it => (it.assets || []).forEach(a => { if (String(a.id) === assetId) f = { a, it }; })); return f; };
  let data = await itemsFor(env, s.uid), found = find(data);
  // monday's download links last an hour, so re-read when the copy we have is getting old (or the file is new)
  if (!found || Date.now() - data.at > 45 * 60e3) { forget('items:' + s.uid); data = await itemsFor(env, s.uid); found = find(data); }
  if (!found) return fail(404, 'That file is no longer available.');
  const a = found.a;
  const ext = String(a.file_extension || '').replace('.', '').toLowerCase();
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' }[ext] || 'application/octet-stream';
  const name = tidy(found.it.assets.length === 1 ? found.it.name : String(a.name).replace(/\.[a-z0-9]+$/i, '')).replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.' + ext;
  const head = {
    'Content-Type': type, 'Cache-Control': 'private, max-age=86400', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': (download ? 'attachment' : 'inline') + '; filename="' + name.replace(/[^\x20-\x7e]/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(name),
  };
  const range = request.headers.get('Range');
  // images and pdfs: keep a copy at Cloudflare's edge (asset ids never change; a new upload gets a new id)
  const cache = caches.default, ck = new Request('https://my-marketing.cache/asset/' + assetId);
  if (!range) {
    const hit = await cache.match(ck);
    if (hit) return new Response(hit.body, { status: 200, headers: head });
  }
  const up = await fetch(a.public_url, range ? { headers: { Range: range } } : {});
  if (!up.ok && up.status !== 206) return fail(502, 'Could not load that file right now. Please try again.');
  if (up.headers.get('Content-Length')) head['Content-Length'] = up.headers.get('Content-Length');
  if (up.headers.get('Content-Range')) head['Content-Range'] = up.headers.get('Content-Range');
  if (!range && up.status === 200 && type !== 'video/mp4' && type !== 'video/quicktime') {
    const [b1, b2] = up.body.tee();
    ctx.waitUntil(cache.put(ck, new Response(b2, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000' } })));
    return new Response(b1, { status: 200, headers: head });
  }
  return new Response(up.body, { status: up.status, headers: head });
}

// ---------- pop-ups Marketing writes in Stewart Marketing Tools (Publish › Pop-ups) ----------
// One row per pop-up on the "My Marketing Pop-ups" board: Message, Link (where the button goes), Button, Picture,
// Who ("Everyone" or a manager's name = that manager's team), Start / End (YYYY-MM-DD), State (Live / Stopped).
// Each person sees a pop-up until they close it or tap its button, on any device. Who saw / tapped / closed it is kept
// in a Gate per pop-up, and the counts go back on the row (Seen, Tapped, Closed) for Marketing Tools to show.
const POPUP_BOARD = 'My Marketing Pop-ups';
const todayLA = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
async function popupList(env) {
  return cached('popups', 120e3, async () => {
    const b = await boardByName(env, POPUP_BOARD);
    if (!b) return [];
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){items_page(limit:200){items{id name column_values{id text}}}}}', { b: [b.id] });
    const col = t => b.cols[t];
    return d.boards[0].items_page.items.map(it => {
      const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
      const g = t => col(t) ? v[col(t)] || '' : '';
      return { id: String(it.id), title: it.name.trim(), message: g('Message'), link: g('Link'), button: g('Button'), picture: g('Picture'),
        who: g('Who'), start: g('Start'), end: g('End'), live: /^live$/i.test(g('State')) };
    });
  });
}
// the manager's name on this person's row of the Main Employee Sheet (Manager column)
async function managerOf(env, name) {
  return cached('mgr:' + nk(name), 3600e3, async () => {
    const b = await boardByName(env, 'Main Employee Sheet');
    const col = b && Object.keys(b.cols).find(t => nk(t) === 'manager');
    if (!col) return '';
    const qp = '{rules:[{column_id:"name",compare_value:[' + JSON.stringify(name) + '],operator:contains_text}]}';
    const d = await gql(env, 'query($b:[ID!],$c:[String!]){boards(ids:$b){items_page(limit:20,query_params:' + qp + '){items{name column_values(ids:$c){text}}}}}', { b: [b.id], c: [b.cols[col]] });
    const it = ((d.boards[0] && d.boards[0].items_page.items) || []).find(x => nk(x.name) === nk(name));
    return it ? String((it.column_values[0] || {}).text || '').trim() : '';
  });
}
async function popupFor(env, s) {
  const today = todayLA();
  const list = (await popupList(env)).filter(p => p.live && p.title && (!p.start || p.start <= today) && (!p.end || today <= p.end))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));
  for (const p of list) {
    if (p.who && !/^everyone$/i.test(p.who) && nk(p.who) !== nk(s.name) && nk(await managerOf(env, s.name).catch(() => '')) !== nk(p.who)) continue;
    const st = await gateCall(env, 'pop:' + p.id, { op: 'popGet', uid: String(s.uid) });
    if (st.done) continue;
    return { id: p.id, title: p.title, message: p.message, link: p.link, button: p.button, picture: p.picture };
  }
  return null;
}
async function popupMark(request, env, ctx, s) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.id || ''), how = String(b.how || '');
  if (!/^\d+$/.test(id) || !['seen', 'close', 'tap'].includes(how)) return fail(400, 'Which pop-up?');
  if (!(await popupList(env)).some(p => p.id === id)) return json({ ok: true });
  const c = await gateCall(env, 'pop:' + id, { op: 'popMark', uid: String(s.uid), how });
  ctx.waitUntil((async () => {
    const pb = await boardByName(env, POPUP_BOARD);
    if (!pb) return;
    const v = {}; [['Seen', c.seen], ['Tapped', c.tapped], ['Closed', c.closed]].forEach(([t, n]) => { if (pb.cols[t]) v[pb.cols[t]] = String(n || 0); });
    if (Object.keys(v).length) await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: pb.id, i: id, v: JSON.stringify(v) });
  })().catch(e => console.error('popup counts', e && e.message)));
  return json({ ok: true });
}

// ---------- Make a video: scripts to record, and the phone recordings people send in ----------
const SCRIPTS_BOARD = 'Video Scripts', UPLOADS_BOARD = 'Phone Video Uploads';
const MAX_UPLOAD = 95 * 1024 * 1024;   // Cloudflare takes up to 100 MB in one request
async function scripts(env, s) {
  const list = await cached('scripts', 600e3, async () => {
    const b = await boardByName(env, SCRIPTS_BOARD);
    if (!b) return [];
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){items_page(limit:500){items{id name column_values{id text}}}}}', { b: [b.id] });
    return d.boards[0].items_page.items.map(it => {
      const v = {}; it.column_values.forEach(c => v[c.id] = c.text || '');
      // Stage (set by Stewart Marketing Tools): Live = everyone, Testing = only the Testers (the manager), Needs template = nobody.
      // Before the Stage column exists every active script shows, as it always has.
      const stage = b.cols.Stage ? (v[b.cols.Stage] || '').trim() : 'Live';
      const testers = b.cols.Testers ? (v[b.cols.Testers] || '').toLowerCase().split(/[,\s;]+/).filter(Boolean) : [];
      return { id: String(it.id), name: it.name.trim(), text: (v[b.cols.Script] || '').trim(), secs: Number(v[b.cols.Seconds]) || 0, active: !/^n/i.test(v[b.cols.Active] || 'Yes'), stage, testers };
    }).filter(x => x.active && x.text).sort((a, b) => a.name.localeCompare(b.name));
  });
  const me = String(s.email || '').toLowerCase();
  const visible = list.filter(x => /^live$/i.test(x.stage) || (/^testing$/i.test(x.stage) && me && x.testers.includes(me)))
    .map(x => ({ id: x.id, name: x.name, text: x.text, secs: x.secs, testing: /^testing$/i.test(x.stage) }));
  // which ones this person has already sent in, and any West Marketing asked them to record again
  // and the ones West Marketing asked them to record (Publish › Video in Stewart Marketing Tools)
  let mine = { filmed: [], reshoot: [], asked: [] };
  try { mine = await cached('filmed:' + s.uid, 60e3, () => myUploads(env, s)); } catch (e) {}
  return { scripts: visible, filmed: mine.filmed, reshoot: mine.reshoot, asked: mine.asked || [] };
}
async function myUploads(env, s) {
  const u = await boardByName(env, UPLOADS_BOARD);
  if (!u || !u.cols.Email) return { filmed: [], reshoot: [], asked: [], items: [] };
  const ids = [u.cols.Script, u.cols.Status, u.cols.Note, u.cols.Redo].filter(Boolean);
  const d = await gql(env, 'query($b:ID!,$c:String!,$v:[String]!,$i:[String!]){items_page_by_column_values(board_id:$b,limit:200,columns:[{column_id:$c,column_values:$v}]){items{id column_values(ids:$i){id text}}}}',
    { b: u.id, c: u.cols.Email, v: [s.email], i: ids });
  const items = d.items_page_by_column_values.items.map(it => { const v = {}; it.column_values.forEach(c => v[c.id] = c.text || ''); return { id: String(it.id), script: v[u.cols.Script] || '', status: v[u.cols.Status] || '', note: u.cols.Note ? v[u.cols.Note] || '' : '', redo: u.cols.Redo ? v[u.cols.Redo] || '' : '' }; });
  const re = items.filter(x => /^reshoot$/i.test(x.status));
  // a reshoot of just one part of a recording made in parts: Redo holds that part's number
  const ask = items.filter(x => /^asked$/i.test(x.status));
  return { filmed: items.filter(x => !/^(reshoot|reshot|uploading|asked|cancelled)$/i.test(x.status)).map(x => x.script),
    reshoot: re.map(x => ({ script: x.script, note: x.note, part: /^\d+$/.test(x.redo.trim()) ? Number(x.redo) : 0, id: x.id })),
    asked: ask.map(x => ({ script: x.script, note: x.note, id: x.id })), items: re, askItems: ask, board: u };
}
// A script recorded in parts sends one request per part (part=1..of): the first makes the monday item (Status "Uploading"),
// the rest add their file to it (item=…), and the last one marks it New so Marketing Tools brings it in and joins the parts.
// redo=<item> is one part recorded again after a part reshoot request; Marketing Tools takes the other parts from that item.
async function uploadVideo(request, env, s, url) {
  const script = String(url.searchParams.get('script') || '').trim().slice(0, 200);
  if (!script) return fail(400, 'Which script is this for?');
  const of = Math.min(6, Math.max(1, Number(url.searchParams.get('of')) || 1)), part = Math.min(of, Math.max(1, Number(url.searchParams.get('part')) || 1));
  const itemId = /^\d+$/.test(url.searchParams.get('item') || '') ? url.searchParams.get('item') : '';
  const redo = /^\d+$/.test(url.searchParams.get('redo') || '') ? url.searchParams.get('redo') : '';
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_UPLOAD) return fail(413, 'That video is too long to send. Keep it under 3 minutes and try again.');
  const type = String(request.headers.get('Content-Type') || 'video/mp4').split(';')[0];
  const ext = /webm/.test(type) ? 'webm' : /quicktime/.test(type) ? 'mov' : 'mp4';
  const body = await request.arrayBuffer();
  if (body.byteLength < 10000) return fail(400, 'The recording came through empty. Please record it again.');
  if (body.byteLength > MAX_UPLOAD) return fail(413, 'That video is too long to send. Keep it under 3 minutes and try again.');
  const b = await boardByName(env, UPLOADS_BOARD);
  if (!b || !b.cols.Video) return fail(500, 'Video uploads aren’t set up yet. Ask West Marketing.');
  const last = redo || part === of;
  const setCols = async (id, vals) => gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: id, v: JSON.stringify(vals) });
  let id = itemId;
  if (id) {
    // a later part: it has to be this person's own recording of the same script, still uploading
    const d = await gql(env, 'query($i:[ID!]){items(ids:$i){id board{id} column_values{id text}}}', { i: [id] });
    const it = d.items && d.items[0], v = {};
    if (it) it.column_values.forEach(c => v[c.id] = c.text || '');
    if (!it || String(it.board.id) !== String(b.id) || String(v[b.cols.Email] || '').toLowerCase() !== String(s.email || '').toLowerCase() || (v[b.cols.Script] || '').trim() !== script || !/^uploading$/i.test(v[b.cols.Status] || ''))
      return fail(400, 'That recording couldn’t be added to. Please record it again.');
  } else {
    // West Marketing asked for this script: the recording goes on the row they made for the ask
    if (!redo) try { const m = await myUploads(env, s); const a = m.askItems.find(x => x.script.trim().toLowerCase() === script.toLowerCase()); if (a) id = a.id; } catch (e) { console.error('ask lookup failed', e.message); }
    const vals = {};
    if (b.cols.Person) vals[b.cols.Person] = s.name;
    if (b.cols.Email) vals[b.cols.Email] = s.email;
    if (b.cols.Script) vals[b.cols.Script] = script;
    if (b.cols.Status) vals[b.cols.Status] = last ? 'New' : 'Uploading';
    if (b.cols.Uploaded) vals[b.cols.Uploaded] = new Date().toISOString().slice(0, 16).replace('T', ' ');
    if (b.cols.Parts && of > 1) vals[b.cols.Parts] = String(of);
    if (b.cols.Redo && redo) vals[b.cols.Redo] = part + ' of ' + redo;
    if (id) await setCols(id, vals);
    else id = String((await gql(env, 'mutation($b:ID!,$n:String!,$v:JSON!){create_item(board_id:$b,item_name:$n,column_values:$v){id}}', { b: b.id, n: s.name + ' - ' + script, v: JSON.stringify(vals) })).create_item.id);
  }
  const fd = new FormData();
  fd.append('query', 'mutation ($file: File!) { add_file_to_column (item_id: ' + id + ', column_id: "' + b.cols.Video + '", file: $file) { id } }');
  const name = (s.name + ' - ' + script + (of > 1 ? ' (part ' + part + ' of ' + of + (redo ? ', redo ' + redo : '') + ')' : '')).replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.' + ext;
  fd.append('variables[file]', new File([body], name, { type }));
  const r = await fetch('https://api.monday.com/v2/file', { method: 'POST', headers: { Authorization: env.MONDAY_TOKEN, 'API-Version': '2024-10' }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.errors || j.error_message || !(j.data && j.data.add_file_to_column)) {
    console.error('upload failed', r.status, JSON.stringify(j).slice(0, 400));
    return fail(502, 'The video didn’t finish sending. Please try again.');
  }
  if (!last) return json({ ok: true, item: id, more: true });
  if (itemId && b.cols.Status) { const v = {}; v[b.cols.Status] = 'New'; await setCols(id, v); }
  // a new take clears any reshoot request for that script
  try {
    const m = await myUploads(env, s);
    for (const x of m.items.filter(x => x.script.trim().toLowerCase() === script.toLowerCase())) {
      const v = {}; v[m.board.cols.Status] = 'Reshot';
      await setCols(x.id, v);
    }
  } catch (e) { console.error('reshoot clear failed', e.message); }
  forget('filmed:' + s.uid);
  return json({ ok: true, item: id });
}

// ---------- sign-in codes and rate limits ----------
export class Gate {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const b = await request.json();
    const st = this.state.storage, now = Date.now();
    if (b.op === 'hit') {
      const hits = ((await st.get('hits')) || []).filter(t => now - t < b.window);
      if (hits.length >= b.limit) return Response.json({ ok: false });
      hits.push(now); await st.put('hits', hits);
      return Response.json({ ok: true });
    }
    if (b.op === 'issue') {
      const sends = ((await st.get('sends')) || []).filter(t => now - t < 3600e3);
      if (sends.length >= 5) return Response.json({ ok: false });
      sends.push(now); await st.put('sends', sends);
      const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
      const code = String(n).padStart(6, '0');
      await st.put('code', { hash: await sha(code), exp: now + CODE_MINUTES * 60e3, tries: 0, uid: b.uid, name: b.name });
      return Response.json({ ok: true, code });
    }
    // pop-ups: who saw it, and who closed it or tapped its button (then it's done for them on every device)
    if (b.op === 'popGet') {
      const p = (await st.get('pop')) || { seen: [], tapped: [], closed: [] };
      return Response.json({ done: p.tapped.includes(b.uid) || p.closed.includes(b.uid) });
    }
    if (b.op === 'popMark') {
      const p = (await st.get('pop')) || { seen: [], tapped: [], closed: [] };
      const add = k => { if (!p[k].includes(b.uid)) p[k].push(b.uid); };
      add('seen'); if (b.how === 'tap') add('tapped'); if (b.how === 'close') add('closed');
      await st.put('pop', p);
      return Response.json({ seen: p.seen.length, tapped: p.tapped.length, closed: p.closed.length });
    }
    if (b.op === 'check') {
      const c = await st.get('code');
      if (!c || c.exp < now) { await st.delete('code'); return Response.json({ ok: false, reason: 'expired' }); }
      c.tries++;
      if (c.tries > 5) { await st.delete('code'); return Response.json({ ok: false, reason: 'locked' }); }
      if (c.hash !== await sha(String(b.code))) { await st.put('code', c); return Response.json({ ok: false, reason: 'wrong' }); }
      await st.delete('code');
      return Response.json({ ok: true, uid: c.uid, name: c.name });
    }
    return Response.json({ ok: false });
  }
}
async function sha(s) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
