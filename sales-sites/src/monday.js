// Everything the websites read from monday.com. The API token stays on the server; visitors only ever see
// the finished page and the files that page shows.
import { slugify, PHOTOS } from './sites.js';

export async function gql(env, query, variables) {
  const r = await fetch(env.MONDAY_API || 'https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.MONDAY_TOKEN, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.errors || j.error_message) {
    const m = j.errors ? j.errors.map(e => e.message).join('; ') : j.error_message;
    throw new Error('monday.com: ' + m);
  }
  if (!j.data) throw new Error('monday.com did not answer (' + r.status + ')');
  return j.data;
}

export const nk = s => String(s || '').normalize('NFC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const CACHE = new Map();
export async function cached(key, ms, fn) {
  const hit = CACHE.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  CACHE.set(key, { value, until: Date.now() + ms });
  if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value);
  return value;
}
export function forget(prefix) { for (const k of CACHE.keys()) if (k.startsWith(prefix)) CACHE.delete(k); }

// ---------- boards (found by name, or by the id set in Cloudflare) ----------
export const BOARDS = {
  employees: ['Main Employee Sheet', 'EMPLOYEES_BOARD_ID'],
  managers: ['Manager Contacts', 'MANAGERS_BOARD_ID'],
  portal: ['Employee Marketing Portal-New', 'PORTAL_BOARD_ID'],
  websites: ['Employee Websites', 'WEBSITES_BOARD_ID'],
  leads: ['Website Leads', 'LEADS_BOARD_ID'],
};
async function allBoards(env) {
  return cached('boards', 3600e3, async () => {
    const out = [];
    for (let page = 1; page < 40; page++) {
      const d = await gql(env, 'query($p:Int){boards(limit:200,page:$p,state:active){id name}}', { p: page });
      if (!d.boards.length) break;
      out.push(...d.boards);
      if (d.boards.length < 200) break;
    }
    return out;
  });
}
export async function boardId(env, key, optional) {
  const [name, envKey] = BOARDS[key];
  if (env[envKey]) return String(env[envKey]);
  const b = (await allBoards(env)).find(x => nk(x.name) === nk(name));
  if (!b && !optional) throw new Error('Could not find the "' + name + '" board on monday.com.');
  return b ? String(b.id) : '';
}
export async function columns(env, bid) {
  return cached('cols:' + bid, 600e3, async () => {
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){columns{id title type settings_str}}}', { b: [bid] });
    const byTitle = {}, byId = {};
    d.boards[0].columns.forEach(c => { let s = {}; try { s = JSON.parse(c.settings_str || '{}'); } catch (e) {} const x = Object.assign({}, c, { settings: s }); byTitle[nk(c.title)] = x; byId[c.id] = x; });
    return { byTitle, byId };
  });
}
const FIELDS = 'id name created_at updated_at group{title} column_values{id text value type ... on BoardRelationValue{linked_item_ids} ... on PeopleValue{persons_and_teams{id}}}';
async function itemsPage(env, bid, qp, extra) {
  const f = 'cursor items{' + FIELDS + (extra || '') + '}';
  const vars = { b: [bid] }; if (qp) vars.q = qp;
  let d = await gql(env, 'query($b:[ID!]' + (qp ? ',$q:ItemsQuery' : '') + '){boards(ids:$b){items_page(limit:200' + (qp ? ',query_params:$q' : '') + '){' + f + '}}}', vars);
  let pg = d.boards[0].items_page, items = pg.items;
  for (let i = 0; pg.cursor && i < 30; i++) {
    d = await gql(env, 'query($k:String!){next_items_page(limit:200,cursor:$k){' + f + '}}', { k: pg.cursor });
    pg = d.next_items_page; items = items.concat(pg.items);
  }
  return items;
}
// a row's values by column title: { 'phone': '...', ... } plus the raw column objects
function valuesOf(it, cols) {
  const v = {}, raw = {};
  (it.column_values || []).forEach(cv => { const c = cols.byId[cv.id]; if (!c) return; const t = nk(c.title); v[t] = (cv.text || '').trim(); raw[t] = cv; });
  return { v, raw };
}
const SKIP = n => /don.?t use|\(demo\)|\btest\b/i.test(n || '');

// ---------- people ----------
async function employees(env) {
  return cached('employees', 600e3, async () => {
    const bid = await boardId(env, 'employees');
    const cols = await columns(env, bid);
    const items = await itemsPage(env, bid);
    const out = {};
    items.forEach(it => {
      if (SKIP(it.name)) return;
      const { v } = valuesOf(it, cols);
      out[it.id] = {
        id: String(it.id), name: it.name.trim(), slug: slugify(it.name),
        title: v.title || '', email: v.email || '', phone: v.phone || v['cell phone'] || v['direct phone'] || '',
        company: v.company || '', address1: v.address1 || v.address || '', address2: v.address2 || '',
      };
    });
    return out;
  });
}
export async function person(env, name) {
  const all = Object.values(await employees(env));
  const p = all.find(x => nk(x.name) === nk(name));
  return p ? withPhoto(p) : null;
}
function withPhoto(p) { return Object.assign({}, p, { photo: PHOTOS.has(p.slug) ? '/people/' + p.slug + '.webp' : '' }); }

// the team linked to this person's row on the Manager Contacts board (empty if they aren't a manager)
export async function team(env, name) {
  return cached('team:' + nk(name), 600e3, async () => {
    const mb = await boardId(env, 'managers', true);
    if (!mb) return [];
    const cols = await columns(env, mb);
    const items = await itemsPage(env, mb);
    const row = items.find(it => nk(it.name) === nk(name));
    if (!row) return [];
    const rel = Object.values(cols.byId).find(c => c.type === 'board_relation');
    if (!rel) return [];
    const cv = (row.column_values || []).find(x => x.id === rel.id) || {};
    const E = await employees(env);
    return (cv.linked_item_ids || []).map(id => E[String(id)]).filter(p => p && nk(p.name) !== nk(name)).map(withPhoto);
  });
}

// monday accounts with this person's name (their guest account is the one in the portal's Person column)
async function uidsFor(env, name) {
  return cached('uids:' + nk(name), 3600e3, async () => {
    const d = await gql(env, 'query($n:String){users(name:$n,limit:20){id name enabled}}', { n: name });
    return (d.users || []).filter(u => nk(u.name) === nk(name)).map(u => String(u.id));
  });
}

// ---------- content ----------
const IMG = /^(png|jpe?g|gif|webp)$/i, VID = /^(mp4|mov|m4v|webm)$/i;
const tidy = s => String(s || '').replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
const extOf = a => String(a.file_extension || '').replace('.', '').toLowerCase();
const kindOf = ext => IMG.test(ext) ? 'image' : VID.test(ext) ? 'video' : ext === 'pdf' ? 'pdf' : 'file';
function asset(a, label, files) {
  const ext = extOf(a);
  files[String(a.id)] = { url: a.public_url, ext, name: tidy(label || String(a.name).replace(/\.[a-z0-9]+$/i, '')) };
  return { id: String(a.id), ext, kind: kindOf(ext), size: Number(a.file_size) || 0 };
}

// the person's own rows on the Employee Marketing Portal board: market update, title tips, flyers
async function portalContent(env, name, files, ids) {
  const uids = ids && ids.length ? ids.map(String) : await uidsFor(env, name);
  const out = { market: [], marketDate: '', tips: [], flyers: [], notifyTarget: '', uids };
  if (!uids.length) return out;
  const bid = await boardId(env, 'portal');
  const cols = await columns(env, bid);
  const col = (t, type) => { const c = cols.byTitle[nk(t)]; return c && (!type || c.type === type) ? c.id : null; };
  const personCol = col('Person', 'people'), fileCol = col('Document', 'file');
  if (!personCol || !fileCol) return out;
  const qp = { rules: [{ column_id: personCol, compare_value: uids.map(u => 'person-' + u), operator: 'any_of' }] };
  const items = await itemsPage(env, bid, qp, ' assets(column_ids:["' + fileCol + '"]){id name file_extension file_size public_url created_at}');
  if (items.length) out.notifyTarget = String(items[0].id);
  const rows = [];
  items.forEach(it => {
    const { v } = valuesOf(it, cols);
    if (/archiv|old|inactive|remove|hide/i.test(v["don t touch"] || '')) return;
    const category = v.category || (it.group && it.group.title) || '';
    const date = v.date || String(it.created_at || '').slice(0, 10);
    rows.push({ it, category, date, employee: v.employee || name });
  });
  // Market update: the newest week only (video first, then each area's snapshot)
  const mu = rows.filter(r => /market update/i.test(r.category));
  const latest = mu.map(r => r.date).sort().pop() || '';
  out.marketDate = latest;
  mu.filter(r => r.date === latest).forEach(r => (r.it.assets || []).forEach(a => {
    let t = String(a.name).replace(/\.[a-z0-9]+$/i, '');
    t = tidy(t.split(r.employee).join('').replace(/_+/g, ' ').replace(/\s*market\s*update\s*/ig, ' '));
    const x = asset(a, t, files);
    if (x.kind === 'video') t = 'This week’s video';
    if (x.kind === 'image' || x.kind === 'video') out.market.push(Object.assign(x, { title: t || 'Market update' }));
  }));
  out.market.sort((a, b) => (b.kind === 'video') - (a.kind === 'video') || a.title.localeCompare(b.title));
  // one card per row: show a picture (or the PDF's first page), download the PDF when there is one
  const card = r => {
    const as = r.it.assets || [];
    const show = as.find(a => kindOf(extOf(a)) === 'image') || as.find(a => extOf(a) === 'pdf');
    if (!show) return null;
    const dl = as.find(a => extOf(a) === 'pdf') || show;
    const title = tidy(r.it.name.split(r.employee).join('').replace(/^\s*[-–]\s*|\s*[-–]\s*$/g, ''));
    return { title, date: r.date, show: asset(show, title, files), dl: asset(dl, title, files) };
  };
  const newest = (a, b) => String(b.date).localeCompare(String(a.date));
  out.tips = rows.filter(r => /title tip/i.test(r.category)).sort(newest).map(card).filter(Boolean).slice(0, 8);
  out.flyers = rows.filter(r => /flyer/i.test(r.category)).sort(newest).map(card).filter(Boolean);
  return out;
}

// the Employee Websites board: forms & documents and tools for agents
async function websiteContent(env, p, uids, files) {
  const out = { docs: [], tools: [] };
  const bid = await boardId(env, 'websites', true);
  if (!bid) return out;
  const cols = await columns(env, bid);
  const fileCols = Object.values(cols.byId).filter(c => c.type === 'file').map(c => c.id);
  const items = await itemsPage(env, bid, null, fileCols.length ? ' assets(column_ids:' + JSON.stringify(fileCols) + '){id name file_extension file_size public_url}' : '');
  const docCol = cols.byTitle['document'];
  const ca = /california|\bca\b/i.test(p.company + ' ' + p.address2), az = /arizona|tucson|\baz\b/i.test(p.company + ' ' + p.address2);
  const mine = new Set(uids);
  items.forEach(it => {
    if (SKIP(it.name)) return;
    const { v, raw } = valuesOf(it, cols);
    if (/hide|hidden|draft|inactive|archiv|remove|off/i.test(v.status || '')) return;
    // who sees it: the Employee column (All, All CA, All AZ, or names); if that's empty, the people in the Person column
    const who = (v.employee || '').split(/\s*,\s*/).filter(Boolean);
    let ok;
    if (who.length) ok = who.some(w => nk(w) === 'all' || (nk(w) === 'all ca' && ca) || (nk(w) === 'all az' && az) || nk(w) === nk(p.name));
    else ok = ((raw.person && raw.person.persons_and_teams) || []).some(x => mine.has(String(x.id)));
    if (!ok) return;
    const group = nk((it.group && it.group.title) + ' ' + (v.category || ''));
    const link = ['template link', 'search website', 'link', 'website'].map(t => { try { return JSON.parse((raw[t] || {}).value || 'null'); } catch (e) { return null; } }).find(x => x && x.url);
    const desc = v.description || v.notes || '';
    const as = (it.assets || []);
    const pdf = as.find(a => extOf(a) === 'pdf') || as[0];
    if (/tool/.test(group) || (!/document|form/.test(group) && link && !pdf)) {
      if (link) out.tools.push({ title: tidy(it.name), url: link.url, desc, app: /\bapp\b/i.test(it.name) });
    } else if (pdf) {
      out.docs.push({ title: tidy(it.name), file: asset(pdf, it.name, files) });
    }
  });
  return out;
}

// everything one website shows, refreshed every few minutes
export async function siteData(env, site, fresh) {
  const key = 'site:' + site.slug;
  if (fresh) forget(key);
  return cached(key, 180e3, async () => {
    const p = await person(env, site.name);
    if (!p) throw new Error(site.name + ' is not on the Main Employee Sheet.');
    const files = {};
    const portal = await portalContent(env, p.name, files, site.mondayIds);
    const [web, crew] = await Promise.all([websiteContent(env, p, portal.uids, files), team(env, p.name)]);
    return { at: Date.now(), person: p, portal, web, team: crew, files };
  });
}

// ---------- leads from the contact form ----------
export async function saveLead(env, site, data, lead) {
  let saved = false, notified = false;
  const lb = await boardId(env, 'leads', true).catch(() => '');
  if (lb) {
    try {
      const cols = await columns(env, lb);
      const set = {};
      const put = (title, val) => { const c = cols.byTitle[nk(title)]; if (!c || !val) return; set[c.id] = c.type === 'email' ? { email: val, text: val } : c.type === 'phone' ? { phone: val.replace(/[^\d+]/g, ''), countryShortName: 'US' } : c.type === 'long_text' ? { text: val } : c.type === 'date' ? { date: val } : c.type === 'status' ? { label: val } : String(val); };
      put('Email', lead.email); put('Phone', lead.phone); put('Message', lead.message);
      put('Salesperson', data.person.name); put('Website', site.slug); put('Date', new Date().toISOString().slice(0, 10)); put('Status', 'New');
      await gql(env, 'mutation($b:ID!,$n:String!,$v:JSON){create_item(board_id:$b,item_name:$n,column_values:$v,create_labels_if_missing:true){id}}',
        { b: lb, n: lead.name, v: JSON.stringify(set) });
      saved = true;
    } catch (e) { console.error('lead board', e); }
  }
  // a monday notification to the salesperson (it opens one of their own portal rows)
  const target = data.portal.notifyTarget;
  if (target && data.portal.uids.length) {
    const text = ('New message from your website — ' + lead.name + (lead.phone ? ', ' + lead.phone : '') + (lead.email ? ', ' + lead.email : '') + ': ' + lead.message).slice(0, 900);
    for (const u of data.portal.uids) {
      try { await gql(env, 'mutation($u:ID!,$t:ID!,$x:String!){create_notification(user_id:$u,target_id:$t,text:$x,target_type:Project){text}}', { u, t: target, x: text }); notified = true; } catch (e) { console.error('notify', e); }
    }
  }
  return saved || notified;
}
