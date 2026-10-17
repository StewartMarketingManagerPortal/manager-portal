// Talking to monday.com from the portal's server side. The API token never reaches the browser.

export async function gql(env, query, variables) {
  const r = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.MONDAY_TOKEN, 'API-Version': '2024-10' },
    body: JSON.stringify({ query, variables: variables || {} }),
    signal: AbortSignal.timeout(25e3),   // a stalled monday.com call gives up instead of leaving pages loading forever
  }).catch(e => { throw new Error(e && e.name === 'TimeoutError' ? 'monday.com is taking too long to answer. Try again in a minute.' : 'Could not reach monday.com: ' + (e.message || e)); });
  const j = await r.json().catch(() => ({}));
  if (j.errors || j.error_message) {
    const m = j.errors ? j.errors.map(e => e.message).join('; ') : j.error_message;
    throw new Error('monday.com: ' + m);
  }
  return j.data;
}

export const escHtml = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>');
export const nk = s => String(s || '').normalize('NFC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Two-level cache. Each server copy keeps its own memory, and keys marked "shared" also go to one SharedCache
// (a Durable Object, src/cache.js) that every copy reads, so a page served by a fresh copy doesn't have to load
// whole monday boards again. A shared value that has gone stale is still served once while it reloads in the
// background, so nobody waits on monday.com for it.
import { AsyncLocalStorage } from 'node:async_hooks';
const CACHE = new Map(), LOADING = new Map(), BYPASS = new Map();
let GEN = 0;   // goes up on every forget(), so a load that started before a change doesn't store the old answer
const REQ = new AsyncLocalStorage();
export const withRequest = (env, ctx, fn) => REQ.run({ env, ctx }, fn);
const store = () => { const r = REQ.getStore(); return r && r.env.SHARED ? r.env.SHARED.getByName('main') : null; };
const later = p => { const r = REQ.getStore(); p = Promise.resolve(p).catch(e => console.log('cache: ' + (e.message || e))); if (r && r.ctx) r.ctx.waitUntil(p); return p; };
const STALE_MAX = 30 * 60e3;   // never serve anything older than this
const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timed out')), ms))]);

function load(key, ms, fn, shared) {
  if (LOADING.has(key)) return LOADING.get(key);          // several requests asking at once share one monday call
  const gen = GEN;
  const p = (async () => {
    const value = await fn(), at = Date.now();
    if (gen !== GEN) return value;
    CACHE.set(key, { value, at, until: at + ms });
    const s = shared && store();
    if (s) later(s.put(key, value, at));
    return value;
  })().finally(() => { if (LOADING.get(key) === p) LOADING.delete(key); });
  LOADING.set(key, p);
  return p;
}
export async function cached(key, ms, fn, opt) {
  const hit = CACHE.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const shared = !!(opt && opt.shared), s = shared && store();
  if (shared && hit && LOADING.has(key) && Date.now() - hit.at < STALE_MAX) return hit.value;   // already reloading: the last answer will do
  if (s && !LOADING.has(key) && !bypassed(key)) {
    let got = null;
    try { got = await within(s.get(key), 3e3); } catch (e) { console.log('cache get: ' + (e.message || e)); }   // a slow shared cache is skipped
    if (got) {
      const age = Date.now() - got.at;
      if (age < ms) { CACHE.set(key, { value: got.value, at: got.at, until: got.at + ms }); return got.value; }
      if (age < STALE_MAX) { later(load(key, ms, fn, true)); return got.value; }
    }
  }
  return load(key, ms, fn, shared);
}
const bypassed = key => { for (const [k, until] of BYPASS) { if (until < Date.now()) BYPASS.delete(k); else if (key.startsWith(k)) return true; } return false; };
// after a change: drop the old value here and in the shared cache, and skip the shared copy here until that has gone
export function forget(prefix) {
  GEN++;
  for (const k of CACHE.keys()) if (k.startsWith(prefix)) CACHE.delete(k);
  for (const k of LOADING.keys()) if (k.startsWith(prefix)) LOADING.delete(k);
  BYPASS.set(prefix, Date.now() + 15e3);
  const s = store();
  if (s) later(s.forget(prefix));
}

// finds a board by its name (or uses the id set in the Cloudflare settings)
export async function boardId(env, name, envKey) {
  if (env[envKey]) return String(env[envKey]);
  return cached('board:' + name, 3600e3, async () => {
    for (let page = 1; page < 30; page++) {
      const d = await gql(env, 'query($p:Int){boards(limit:200,page:$p,state:active){id name}}', { p: page });
      if (!d.boards.length) break;
      const b = d.boards.find(x => nk(x.name) === nk(name));
      if (b) return String(b.id);
    }
    throw new Error('Could not find the "' + name + '" board on monday.com.');
  }, { shared: true });
}

// columns by lower-case title
export async function columns(env, bid) {
  return cached('cols:' + bid, 600e3, async () => {
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){groups{id title} columns{id title type settings_str}}}', { b: [bid] });
    const b = d.boards[0], byTitle = {};
    b.columns.forEach(c => { let s = {}; try { s = JSON.parse(c.settings_str || '{}'); } catch (e) {} byTitle[nk(c.title)] = Object.assign({}, c, { settings: s }); });
    return { byTitle, groups: b.groups };
  }, { shared: true });
}

export async function allItems(env, bid, colIds) {
  const fields = 'cursor items{id name created_at group{id title} column_values' + (colIds ? '(ids:$c)' : '') + '{id text value type ... on BoardRelationValue{linked_item_ids} ... on PeopleValue{persons_and_teams{id}}}}';
  const vars = { b: [bid] }; if (colIds) vars.c = colIds;
  let d = await gql(env, 'query($b:[ID!]' + (colIds ? ',$c:[String!]' : '') + '){boards(ids:$b){items_page(limit:500){' + fields + '}}}', vars);
  let pg = d.boards[0].items_page, items = pg.items;
  while (pg.cursor) {
    const v2 = { k: pg.cursor }; if (colIds) v2.c = colIds;
    d = await gql(env, 'query($k:String!' + (colIds ? ',$c:[String!]' : '') + '){next_items_page(limit:500,cursor:$k){' + fields + '}}', v2);
    pg = d.next_items_page; items = items.concat(pg.items);
  }
  return items;
}

// a value in the shape monday wants for this column type
export function colValue(col, v) {
  if (v == null || v === '') return null;
  switch (col.type) {
    case 'long_text': return { text: String(v) };
    case 'email': return { email: String(v), text: String(v) };
    case 'phone': return { phone: String(v).replace(/[^\d+]/g, ''), countryShortName: 'US' };
    case 'date': return { date: String(v).slice(0, 10) };
    case 'status': return { label: matchLabel(col, v) };
    case 'dropdown': return { labels: [].concat(v).map(x => matchLabel(col, x)) };
    case 'checkbox': return { checked: v ? 'true' : 'false' };
    case 'numbers': return String(v).replace(/[^\d.\-]/g, '');
    case 'link': return { url: String(v), text: String(v) };
    default: return String(v);
  }
}
// uses the board's own label when one matches closely (e.g. "Business card" → "Business Card 3.5x2 in")
export function matchLabel(col, want) {
  const s = col.settings || {};
  let labels = [];
  if (Array.isArray(s.labels)) labels = s.labels.map(l => (typeof l === 'string' ? l : l.name));
  else if (s.labels) labels = Object.values(s.labels);
  const w = nk(want);
  return labels.find(l => nk(l) === w) || labels.find(l => nk(l).startsWith(w) || w.startsWith(nk(l))) || String(want);
}

// builds the column_values JSON from { 'Column Title': value }
export function buildValues(cols, fields) {
  const out = {}, missing = [];
  Object.keys(fields).forEach(title => {
    const col = cols.byTitle[nk(title)];
    const has = fields[title] != null && fields[title] !== '';
    // columns we can't fill from a form (a map location, files, people, links) get written into the update instead
    if (!col || /^(location|file|people|board_relation|mirror|formula|lookup|subtasks)$/.test(col.type)) { if (has) missing.push(title); return; }
    const v = colValue(col, fields[title]);
    if (v != null) out[col.id] = v;
  });
  return { values: out, missing };
}

export async function createItem(env, bid, groupId, name, values) {
  const d = await gql(env, 'mutation($b:ID!,$g:String,$n:String!,$v:JSON){create_item(board_id:$b,group_id:$g,item_name:$n,column_values:$v,create_labels_if_missing:true){id}}',
    { b: String(bid), g: groupId || null, n: name, v: JSON.stringify(values) });
  return d.create_item.id;
}
export async function addUpdate(env, itemId, body) {
  await gql(env, 'mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}', { i: String(itemId), b: body });
}
// attaches an uploaded file to a file column
export async function addFile(env, itemId, colId, file) {
  const fd = new FormData();
  fd.append('query', 'mutation($file:File!){add_file_to_column(item_id:' + JSON.stringify(String(itemId)) + ',column_id:' + JSON.stringify(colId) + ',file:$file){id}}');
  fd.append('map', JSON.stringify({ image: 'variables.file' }));
  fd.append('image', file, file.name || 'upload');
  const r = await fetch('https://api.monday.com/v2/file', { method: 'POST', headers: { Authorization: env.MONDAY_TOKEN, 'API-Version': '2024-10' }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (j.errors || j.error_message) throw new Error('monday.com file upload: ' + (j.errors ? j.errors.map(e => e.message).join('; ') : j.error_message));
}
