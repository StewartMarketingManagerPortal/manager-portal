// Talking to monday.com from the server side. The API token never reaches the browser.

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

// short-lived memory cache per server instance
const CACHE = new Map();
export async function cached(key, ms, fn) {
  const hit = CACHE.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  CACHE.set(key, { value, until: Date.now() + ms });
  if (CACHE.size > 2000) CACHE.delete(CACHE.keys().next().value);
  return value;
}
export function forget(key) { CACHE.delete(key); }

const PORTAL_NAME = 'Employee Marketing Portal-New';

// the Employee Marketing Portal board and the columns we use (matched by title, like the Mac app does)
export async function portal(env) {
  return cached('portal', 3600e3, async () => {
    let id = env.PORTAL_BOARD_ID ? String(env.PORTAL_BOARD_ID) : '';
    if (!id) {
      for (let page = 1; page < 40 && !id; page++) {
        const d = await gql(env, 'query($p:Int){boards(limit:200,page:$p,state:active){id name}}', { p: page });
        if (!d.boards.length) break;
        const b = d.boards.find(x => nk(x.name) === nk(env.PORTAL_BOARD_NAME || PORTAL_NAME));
        if (b) id = String(b.id);
      }
    }
    if (!id) throw new Error('Could not find the "' + (env.PORTAL_BOARD_NAME || PORTAL_NAME) + '" board on monday.com.');
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){id name columns{id title type}}}', { b: [id] });
    const cols = d.boards[0].columns;
    const col = (title, type) => { const c = cols.find(x => nk(x.title) === nk(title) && (!type || x.type === type)); return c ? c.id : null; };
    const p = {
      id, name: d.boards[0].name,
      person: col('Person', 'people'), file: col('Document', 'file'), employee: col('Employee'),
      category: col('Category'), date: col('Date'), status: col("Don't Touch!!"),
    };
    if (!p.person || !p.file) throw new Error('The portal board needs its "Person" and "Document" columns.');
    return p;
  });
}

// who is on the portal board (board members, guests included). Removing someone from the board removes access.
export async function boardMembers(env) {
  return cached('members', 120e3, async () => {
    const p = await portal(env);
    const d = await gql(env, 'query($b:[ID!]){boards(ids:$b){subscribers{id}}}', { b: [p.id] });
    return new Set((d.boards[0].subscribers || []).map(u => String(u.id)));
  });
}

export async function userByEmail(env, email) {
  const d = await gql(env, 'query($e:[String]){users(emails:$e,limit:5){id name email enabled is_guest photo_thumb_small}}', { e: [email] });
  return (d.users || []).find(u => String(u.email || '').toLowerCase() === email) || null;
}
export async function userById(env, uid) {
  return cached('user:' + uid, 120e3, async () => {
    const d = await gql(env, 'query($i:[ID!]){users(ids:$i){id name email enabled is_guest photo_thumb_small}}', { i: [String(uid)] });
    return (d.users || [])[0] || null;
  });
}

// may this monday user use the site right now?
export async function allowed(env, uid) {
  const [u, members] = await Promise.all([userById(env, uid), boardMembers(env)]);
  return !!(u && u.enabled && members.has(String(uid)));
}

// everything on the portal board assigned to this person (Person column), with its files
export async function itemsFor(env, uid) {
  return cached('items:' + uid, 30e3, async () => {
    const p = await portal(env);
    const cols = [p.category, p.date, p.employee, p.status].filter(Boolean);
    const fields = 'cursor items{id name created_at updated_at group{title} column_values(ids:$c){id text} assets(column_ids:$f){id name file_extension file_size public_url created_at}}';
    const qp = { rules: [{ column_id: p.person, compare_value: ['person-' + uid], operator: 'any_of' }] };
    let d = await gql(env, 'query($b:[ID!],$c:[String!],$f:[String],$q:ItemsQuery){boards(ids:$b){items_page(limit:200,query_params:$q){' + fields + '}}}',
      { b: [p.id], c: cols, f: [p.file], q: qp });
    let pg = d.boards[0].items_page, items = pg.items;
    for (let i = 0; pg.cursor && i < 20; i++) {
      d = await gql(env, 'query($k:String!,$c:[String!],$f:[String]){next_items_page(limit:200,cursor:$k){' + fields + '}}', { k: pg.cursor, c: cols, f: [p.file] });
      pg = d.next_items_page; items = items.concat(pg.items);
    }
    return { p, items, at: Date.now() };
  });
}

export async function notify(env, uid, targetId, text) {
  await gql(env, 'mutation($u:ID!,$t:ID!,$x:String!){create_notification(user_id:$u,target_id:$t,text:$x,target_type:Project){text}}',
    { u: String(uid), t: String(targetId), x: text });
}
