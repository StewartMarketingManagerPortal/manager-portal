// Stewart Title West sales team websites: one site, a page for each salesperson (see sites.js),
// built live from the monday.com boards. Visitors never see the monday token or anything not on the page.
import { SITES } from './sites.js';
import { siteData, saveLead } from './monday.js';
import { sitePage, teamPage, homePage, messagePage, vcard } from './render.js';

const html = (body, status, extra) => new Response(body, { status: status || 200, headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, HEAD, extra || {}) });
const json = (data, status) => new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, HEAD) });
const HEAD = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN',
  // while the sample is being tested, keep it out of Google (remove when the sites go live)
  'X-Robots-Tag': 'noindex, nofollow',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (/\.(css|js|png|webp|jpg|ico|svg|txt)$/.test(path)) return env.ASSETS.fetch(request);
    if (path === '/') return html(homePage(SITES));
    const m = path.match(/^\/([a-z0-9-]+)(?:\/(team|contact\.vcf|contact|file\/(\d+)))?$/);
    const site = m && SITES.find(s => s.slug === m[1]);
    if (!site) return html(messagePage('Page not found', 'We couldn’t find that page.'), 404);
    if (!env.MONDAY_TOKEN) return html(messagePage('Almost ready', 'This site isn’t connected to monday.com yet (MONDAY_TOKEN).'), 500);
    try {
      const sub = m[2] || '';
      const fresh = url.searchParams.has('refresh');
      if (sub === 'contact' && request.method === 'POST') return contact(request, env, site, url);
      const data = await siteData(env, site, fresh);
      if (sub === '') return html(sitePage(site, data, url.origin, url.searchParams.get('sent')));
      if (sub === 'team') return data.team.length ? html(teamPage(site, data, url.origin)) : Response.redirect(url.origin + '/' + site.slug, 302);
      if (sub === 'contact.vcf') {
        const name = site.slug + '.vcf';
        return new Response(vcard(site, data.person, url.origin), { headers: Object.assign({ 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + name + '"', 'Cache-Control': 'no-cache' }, HEAD) });
      }
      if (m[3]) return file(request, env, ctx, site, data, m[3], url.searchParams.get('dl') === '1');
      return html(messagePage('Page not found', 'We couldn’t find that page.'), 404);
    } catch (e) {
      console.error(e && e.stack || e);
      return html(messagePage('Be right back', 'This page couldn’t load just now. Please try again in a minute.'), 503, { 'Retry-After': '60' });
    }
  },
};

// ---------- files: only the ones shown on this person's page ----------
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' };
async function file(request, env, ctx, site, data, id, download) {
  // monday's file links last about an hour, so re-read the boards when ours are getting old
  if (!data.files[id] || Date.now() - data.at > 45 * 60e3) data = await siteData(env, site, true);
  const f = data.files[id];
  if (!f) return html(messagePage('File not found', 'That file is no longer available.'), 404);
  const type = TYPES[f.ext] || 'application/octet-stream';
  const name = (f.name || 'file').replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.' + f.ext;
  const head = Object.assign({}, HEAD, {
    'Content-Type': type, 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes',
    'Content-Disposition': (download ? 'attachment' : 'inline') + '; filename="' + name.replace(/[^\x20-\x7e]/g, '') + '"; filename*=UTF-8\'\'' + encodeURIComponent(name),
  });
  const range = request.headers.get('Range');
  // pictures and PDFs are kept at Cloudflare's edge (a new upload gets a new id, so they never go stale)
  const cache = caches.default, ck = new Request('https://stewart-west.cache/asset/' + id);
  if (!range) {
    const hit = await cache.match(ck);
    if (hit) { if (hit.headers.get('Content-Length')) head['Content-Length'] = hit.headers.get('Content-Length'); return new Response(hit.body, { status: 200, headers: head }); }
  }
  const up = await fetch(f.url, range ? { headers: { Range: range } } : {});
  if (!up.ok && up.status !== 206) return html(messagePage('Try again', 'That file couldn’t load right now.'), 502);
  if (up.headers.get('Content-Length')) head['Content-Length'] = up.headers.get('Content-Length');
  if (up.headers.get('Content-Range')) head['Content-Range'] = up.headers.get('Content-Range');
  if (!range && up.status === 200 && !/^video\//.test(type)) {
    const [b1, b2] = up.body.tee();
    ctx.waitUntil(cache.put(ck, new Response(b2, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000' } })).catch(() => {}));
    return new Response(b1, { status: 200, headers: head });
  }
  return new Response(up.body, { status: up.status, headers: head });
}

// ---------- contact form ----------
async function contact(request, env, site, url) {
  const isJson = (request.headers.get('Content-Type') || '').includes('application/json');
  const back = ok => isJson ? json(ok ? { ok: true } : { error: ok === false ? 'Sorry, that didn’t send. Please call or email instead.' : ok }, ok === true ? 200 : 400)
    : Response.redirect(url.origin + '/' + site.slug + '?sent=' + (ok === true ? 'ok' : 'no') + '#contact', 303);
  let b = {};
  try { b = isJson ? await request.json() : Object.fromEntries(await request.formData()); } catch (e) { return back(false); }
  const clean = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, n);
  const lead = { name: clean(b.name, 120), phone: clean(b.phone, 40), email: clean(b.email, 200).toLowerCase(), message: clean(b.message, 3000) };
  // bots: filled the hidden box, or sent the form faster than a person could type it
  const age = Date.now() - Number(b.t || 0);
  if (b.website || !(age > 2500 && age < 86400e3)) return back(true);
  if (!lead.name || !lead.message) return back('Please add your name and a message.');
  if (!lead.phone && !lead.email) return back('Please add a phone number or email so we can reach you.');
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return back('Please check your email address.');
  if ((lead.message.match(/https?:\/\//g) || []).length > 2) return back(true);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const lim = await env.LIMITS.get(env.LIMITS.idFromName('ip:' + ip)).fetch('https://limits/', { method: 'POST', body: JSON.stringify({ limit: 5, window: 3600e3 }) }).then(r => r.json());
  if (!lim.ok) return back('You’ve sent a few messages already. Please call or email instead.');
  try {
    const data = await siteData(env, site);
    return back(await saveLead(env, site, data, lead));
  } catch (e) {
    console.error(e && e.stack || e);
    return back(false);
  }
}

// a small counter per visitor network (spam limit for the contact form)
export class Limits {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const b = await request.json(), now = Date.now(), st = this.state.storage;
    const hits = ((await st.get('hits')) || []).filter(t => now - t < b.window);
    if (hits.length >= b.limit) return Response.json({ ok: false });
    hits.push(now); await st.put('hits', hits);
    return Response.json({ ok: true });
  }
}
