// My Marketing: each employee signs in with the email on their monday.com guest account,
// gets a code in the monday app, and sees only the pieces assigned to them on the Employee Marketing Portal board.
import { nk, boardMembers, userByEmail, allowed, itemsFor, notify, forget } from './monday.js';

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

  const s = await session(request, env);
  if (!s) return fail(401, 'Please sign in.', { signin: true });
  if (!(await allowed(env, s.uid))) return fail(403, 'Your access to My Marketing has ended. Ask West Marketing if this is a mistake.', { signin: true, clear: true });

  if (method === 'GET' && path === '/api/me') return json({ name: s.name, email: s.email });
  if (method === 'GET' && path === '/api/content') {
    if (url.searchParams.get('fresh')) forget('items:' + s.uid);
    return json(await content(env, s));
  }
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
async function session(request, env) {
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)mm_s=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  const sig = Uint8Array.from(atob(m[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('HMAC', await key(env), sig, enc.encode(m[1]));
  if (!ok) return null;
  let s; try { s = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))); } catch (e) { return null; }
  return s && s.exp > Date.now() && s.uid ? s : null;
}

// ---------- content ----------
const IMG = /^(png|jpe?g|gif|webp)$/i, VID = /^(mp4|mov|m4v)$/i;
const ORDER = ['market update', 'title tips', 'flyers', 'new hire', 'social media', 'holiday', 'happy anniversary', 'anniversary', 'newsletter', 'photos'];

function cleanTitle(assetName, itemName, employee, single) {
  if (single) return itemName;
  let t = String(assetName || '').replace(/\.[a-z0-9]+$/i, '');
  if (employee) t = t.split(' - ' + employee).join('').split(employee).join('');
  t = t.replace(/\s*Market Update\s*$/i, '').replace(/\s+-\s*$/, '').trim();
  if (/slideshow/i.test(t)) return 'Market Update video';
  return t || itemName;
}

async function content(env, s) {
  const { p, items } = await itemsFor(env, s.uid);
  const now = Date.now();
  const pieces = [];
  items.forEach(it => {
    const v = {}; (it.column_values || []).forEach(c => v[c.id] = c.text || '');
    if (p.status && /archiv|old|inactive|remove/i.test(v[p.status] || '')) return;
    const category = (p.category && v[p.category]) || (it.group && it.group.title) || 'Other';
    const date = (p.date && v[p.date]) || String(it.updated_at || it.created_at || '').slice(0, 10);
    const employee = p.employee ? v[p.employee] : '';
    const isMU = /market update/i.test(category);
    const assets = (it.assets || []).slice().sort((a, b) => (VID.test(b.file_extension.replace('.', '')) ? 1 : 0) - (VID.test(a.file_extension.replace('.', '')) ? 1 : 0));
    assets.forEach(a => {
      const ext = String(a.file_extension || '').replace('.', '').toLowerCase();
      const kind = IMG.test(ext) ? 'image' : VID.test(ext) ? 'video' : ext === 'pdf' ? 'pdf' : 'file';
      const created = Date.parse(it.created_at || '') || 0;
      const dated = Date.parse(date) || 0;
      pieces.push({
        id: String(a.id), item: String(it.id), title: cleanTitle(a.name, it.name, employee, assets.length === 1),
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
  return { name: s.name, categories, pieces, week, board: p.name };
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
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', pdf: 'application/pdf' }[ext] || 'application/octet-stream';
  const name = (found.it.assets.length === 1 ? found.it.name : String(a.name).replace(/\.[a-z0-9]+$/i, '')).replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.' + ext;
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
