// Manager Portal server: every /api/... call lands here.
// Who is signed in comes from Cloudflare Access (it checks the email code); what they may do comes from the
// Manager Contacts board on monday.com (Managers group = their own team, Portal Admins group = everyone).
import { gql, escHtml, nk, cached, forget, boardId, columns, allItems, buildValues, createItem, addUpdate, addFile, colValue } from '../lib/monday.js';

const BOARDS = {
  managers: ['Manager Contacts', 'MANAGERS_BOARD_ID'],
  employees: ['Main Employee Sheet', 'EMPLOYEES_BOARD_ID'],
  requests: ['Marketing Request', 'REQUESTS_BOARD_ID'],
  areas: ['Market Areas', 'AREAS_BOARD_ID'],
  newsletter: ['Newsletter Template', 'NEWSLETTER_BOARD_ID'],
  portal: ['Employee Marketing Portal-New', 'PORTAL_BOARD_ID'],
};
const bid = (env, k) => boardId(env, BOARDS[k][0], BOARDS[k][1]);
const json = (data, status) => new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (msg, status) => json({ error: msg }, status || 400);
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const SKIP = n => /don.?t use|\(demo\)/i.test(n || '');

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const route = (params.route || []).join('/');
  try {
    if (!env.MONDAY_TOKEN) return fail('The portal is not connected to monday.com yet (MONDAY_TOKEN is missing in Cloudflare).', 500);
    const me = await whoAmI(request, env);
    if (!me.ok) return json({ error: me.error, signedInAs: me.email || null, notAllowed: true }, 403);
    const m = request.method;
    if (route === 'me' && m === 'GET') return json(await profile(env, me));
    if (route === 'requests' && m === 'GET') return json(await myRequests(env, me));
    if (route === 'requests' && m === 'POST') return json(await submitRequest(env, me, await request.formData()));
    if (route === 'newhire' && m === 'POST') return json(await submitNewHire(env, me, await request.formData()));
    if (route === 'team' && m === 'GET') return json(await myTeam(env, me));
    if (route.startsWith('photo/') && m === 'GET') return await teamPhoto(env, me, route.split('/')[1]);
    if (route === 'areas' && m === 'POST') { const r = await changeArea(env, me, await request.json()); return json(r, r.error ? 403 : 200); }
    if (route.startsWith('content/') && m === 'GET') { const r = await teamContent(env, me, route.split('/')[1]); return json(r, r.error ? 403 : 200); }
    if (route.startsWith('asset/') && m === 'GET') return await teamAsset(env, me, route.split('/')[1], route.split('/')[2], new URL(request.url).searchParams.get('dl'));
    if (route === 'bio' && m === 'POST') { const r = await writeBios(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'nlareas' && m === 'GET') return json({ options: await nlOptions(env) });
    if (route === 'nlarea' && m === 'POST') { const r = await changeNl(env, me, await request.json()); return json(r, r.error ? 403 : 200); }
    if (route === 'altos' && m === 'POST') return json(await checkAltos((await request.json()).link));
    if (route === 'proof' && m === 'POST') { const r = await answerProof(env, me, await request.json()); return json(r, r.error ? 403 : 200); }
    if (route === 'refresh' && m === 'POST') { forget(''); return json({ ok: true }); }
    return fail('Not found', 404);
  } catch (e) {
    return fail(String(e.message || e), 500);
  }
}

// ---------- who is this? ----------
async function directory(env) {
  return cached('dir', 300e3, async () => {
    const [mb, eb] = await Promise.all([bid(env, 'managers'), bid(env, 'employees')]);
    const [mc, ec] = await Promise.all([columns(env, mb), columns(env, eb)]);
    const [mItems, eItems] = await Promise.all([allItems(env, mb), allItems(env, eb)]);
    const etitle = {}; Object.values(ec.byTitle).forEach(c => etitle[c.id] = nk(c.title));
    const employees = {};
    eItems.forEach(it => {
      const f = {}; it.column_values.forEach(cv => { if (etitle[cv.id]) f[etitle[cv.id]] = (cv.text || '').trim(); });
      employees[it.id] = { id: it.id, name: it.name.trim(), email: (f.email || '').toLowerCase(), title: f.title || '', phone: f.phone || '', company: f.company || '',
        address1: f.address1 || '', address2: f.address2 || '', setup: f['marketing setup'] || '', requestedBy: (f['requested by'] || '').toLowerCase(), skip: SKIP(it.name) };
    });
    const rel = Object.values(mc.byTitle).find(c => c.type === 'board_relation');
    const ppl = Object.values(mc.byTitle).find(c => c.type === 'people');
    const st = mc.byTitle['status'];
    // monday user emails for the Person column
    const uids = new Set();
    mItems.forEach(it => it.column_values.forEach(cv => { if (ppl && cv.id === ppl.id && cv.persons_and_teams) cv.persons_and_teams.forEach(p => uids.add(String(p.id))); }));
    const users = {};
    if (uids.size) (await gql(env, 'query($i:[ID!]){users(ids:$i){id email}}', { i: Array.from(uids) })).users.forEach(u => users[u.id] = (u.email || '').toLowerCase());
    const managers = mItems.map(it => {
      const cv = id => it.column_values.find(x => x.id === id) || {};
      const linked = rel ? (cv(rel.id).linked_item_ids || []).map(String) : [];
      const own = linked.map(i => employees[i]).find(p => p && nk(p.name) === nk(it.name));
      const emails = new Set();
      if (own && own.email) emails.add(own.email);
      if (ppl) (cv(ppl.id).persons_and_teams || []).forEach(p => users[p.id] && emails.add(users[p.id]));
      return { rowId: it.id, name: it.name.trim(), group: it.group.title, admin: /admin/i.test(it.group.title), paused: st ? /pause|inactive|off|no access/i.test(cv(st.id).text || '') : false,
        emails: Array.from(emails), linked, self: own || null };
    });
    return { managers, employees, relColId: rel ? rel.id : null, managersBoard: mb };
  });
}
// Cloudflare Access signs every request it lets through (Cf-Access-Jwt-Assertion). We check that signature
// instead of trusting the plain email header, so the code stays safe even if it ever runs without Access in front.
const ACCESS_TEAM = 'snowy-silence-966e.cloudflareaccess.com';
const b64d = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function accessEmail(request, env) {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const parts = jwt.split('.');
  if (parts.length !== 3) return '';
  let head, claims;
  try { head = JSON.parse(new TextDecoder().decode(b64d(parts[0]))); claims = JSON.parse(new TextDecoder().decode(b64d(parts[1]))); } catch (e) { return ''; }
  const team = env.ACCESS_TEAM || ACCESS_TEAM;
  if (head.alg !== 'RS256' || claims.iss !== 'https://' + team || !(claims.exp * 1000 > Date.now())) return '';
  if (env.ACCESS_AUD && !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(env.ACCESS_AUD)) return '';
  const keys = await cached('access-certs', 3600e3, async () => (await (await fetch('https://' + team + '/cdn-cgi/access/certs')).json()).keys || []);
  const jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) { forget('access-certs'); return ''; }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64d(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  return ok ? String(claims.email || '').toLowerCase() : '';
}
async function whoAmI(request, env) {
  let email = await accessEmail(request, env);
  if (!email && env.DEV_EMAIL) email = env.DEV_EMAIL.toLowerCase();       // only for testing before sign-in is set up
  if (!email) return { ok: false, error: 'Sign-in is not set up yet.' };
  const dir = await directory(env);
  const row = dir.managers.find(m => m.emails.includes(email));
  if (!row) return { ok: false, email, error: 'You’re not on the Manager Portal list.' };
  if (row.paused) return { ok: false, email, error: 'Your access to the Manager Portal is paused.' };
  return { ok: true, email, row, dir };
}
function teamOf(me) {
  const E = me.dir.employees;
  if (me.row.admin) return Object.values(E).filter(p => !p.skip);
  return me.row.linked.map(i => E[i]).filter(p => p && !p.skip && (!me.row.self || p.id !== me.row.self.id));
}
async function profile(env, me) {
  const all = Object.values(me.dir.employees).filter(p => !p.skip);
  // offices and titles come from the people already on the sheet, so the dropdowns stay in step with the board
  const offices = {}, titles = {};
  all.forEach(p => { if (p.address1) offices[p.address1 + '|' + p.address2] = { address1: p.address1, address2: p.address2 }; if (p.title) titles[p.title] = 1; });
  const pub = p => ({ id: p.id, name: p.name, email: p.email, title: p.title });
  return {
    name: me.row.name, email: me.email, admin: me.row.admin,
    team: teamOf(me).map(pub).sort((a, b) => a.name.localeCompare(b.name)),
    offices: Object.values(offices).sort((a, b) => (a.address2 + a.address1).localeCompare(b.address2 + b.address1)),
    titles: Object.keys(titles).sort(),
    companies: ['Stewart Title of California, Inc.', 'Stewart Title & Trust of Tucson'],
    selfServe: env.SELF_SERVE === '1',
  };
}

// ---------- marketing requests ----------
async function myRequests(env, me) {
  const rb = await bid(env, 'requests');
  const rc = await columns(env, rb);
  const c = t => rc.byTitle[nk(t)];
  const want = ["Manager's Name", 'Managers Email', 'Full Name', 'Status', 'Order Date', 'Due Date', 'Project Name', 'Purpose of Project', 'Proof', 'CA or AZ'].map(c).filter(Boolean);
  const items = await allItems(env, rb, want.map(x => x.id));
  const name = nk(me.row.name);
  const rows = items.map(it => {
    const v = {}; it.column_values.forEach(cv => { const col = want.find(w => w.id === cv.id); if (col) v[nk(col.title)] = { text: (cv.text || '').trim(), value: cv.value }; });
    const g = k => (v[nk(k)] || {}).text || '';
    let proofs = []; try { proofs = (JSON.parse((v['proof'] || {}).value || '{}').files || []).map(f => ({ id: String(f.assetId), name: f.name })); } catch (e) {}
    return { id: it.id, project: g('Project Name') || it.name, type: g('Purpose of Project'), forWho: g('Full Name'), status: g('Status') || 'New', ordered: g('Order Date'), due: g('Due Date'), state: g('CA or AZ'),
      manager: g("Manager's Name"), managerEmail: g('Managers Email').toLowerCase(), group: it.group.title, proofs, created: it.created_at };
  }).filter(r => me.row.admin || r.managerEmail === me.email || nk(r.manager) === name)
    .sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, me.row.admin ? 150 : 100);
  // a link to look at the proof (monday gives a link that works for about an hour)
  const ids = rows.filter(r => /proof/i.test(r.status) && r.proofs.length).flatMap(r => r.proofs.map(p => p.id)).slice(0, 50);
  if (ids.length) {
    const a = await gql(env, 'query($i:[ID!]!){assets(ids:$i){id public_url}}', { i: ids });
    const url = {}; a.assets.forEach(x => url[x.id] = x.public_url);
    rows.forEach(r => r.proofs.forEach(p => p.url = url[p.id] || null));
  }
  // new hires this manager submitted
  const hires = Object.values(me.dir.employees).filter(p => p.requestedBy && (me.row.admin || p.requestedBy === me.email))
    .map(p => ({ id: p.id, name: p.name, setup: p.setup, kind: 'newhire' }));
  return { requests: rows, newHires: hires };
}

async function submitRequest(env, me, fd) {
  const f = JSON.parse(fd.get('fields') || '{}');
  if (!f.projectName || !f.type) throw new Error('Project name and type are required.');
  const rb = await bid(env, 'requests');
  const rc = await columns(env, rb);
  const ordered = today();
  const forPeople = f.forPeople || [];
  const fields = {
    'Order Date': ordered, 'CA or AZ': f.state, 'Due Date': f.needBy || addDays(ordered, 7), 'Status': 'New',
    "Manager's Name": me.row.name, 'Managers Email': me.email,
    'Full Name': f.forLabel || forPeople.map(p => p.name).join(', '), 'Email Address': (forPeople[0] || {}).email || '',
    'Project Name': f.projectName, 'Purpose of Project': f.type, 'Project Type-Other': f.other || '', 'Project Description': f.description || '',
  };
  Object.assign(fields, f.extra || {});      // type-specific answers, keyed by board column title
  const { values, missing } = buildValues(rc, fields);
  const group = rc.groups.find(g => /incoming/i.test(g.title));
  const itemId = await createItem(env, rb, group ? group.id : null, f.projectName, values);
  const notes = ['Submitted through the Manager Portal by ' + escHtml(me.row.name) + ' (' + escHtml(me.email) + ')'];
  if (forPeople.length > 1) notes.push('For: ' + escHtml(forPeople.map(p => p.name + (p.email ? ' (' + p.email + ')' : '')).join(', ')));
  missing.forEach(t => notes.push(escHtml(t) + ': ' + escHtml(typeof fields[t] === 'object' ? JSON.stringify(fields[t]) : fields[t])));
  await addUpdate(env, itemId, notes.join('<br>'));
  const filesCol = rc.byTitle[nk('Content Examples')], picsCol = rc.byTitle[nk('Property Images')] || filesCol;
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string' || !v.size) continue;
    const col = k === 'photos' ? picsCol : filesCol;
    if (col) await addFile(env, itemId, col.id, v);
  }
  return { ok: true, id: itemId, reference: itemId, due: fields['Due Date'] };
}

async function answerProof(env, me, b) {
  const rb = await bid(env, 'requests');
  const mine = (await myRequests(env, me)).requests.find(r => String(r.id) === String(b.id));
  if (!mine) return { error: 'That request isn’t one of yours.' };
  const rc = await columns(env, rb);
  const st = rc.byTitle['status'];
  if (b.action === 'approve') {
    await addUpdate(env, b.id, '✅ Proof approved by ' + escHtml(me.row.name) + ' in the Manager Portal.' + (b.note ? '<br>' + escHtml(b.note) : ''));
    if (st && env.APPROVED_STATUS) await gql(env, 'mutation($b:ID!,$i:ID!,$c:String!,$v:JSON!){change_column_value(board_id:$b,item_id:$i,column_id:$c,value:$v){id}}', { b: rb, i: String(b.id), c: st.id, v: JSON.stringify(colValue(st, env.APPROVED_STATUS)) });
  } else {
    if (!b.note) throw new Error('Tell us what to change.');
    await addUpdate(env, b.id, '✏️ Changes requested by ' + escHtml(me.row.name) + ' in the Manager Portal:<br>' + escHtml(b.note));
    if (st) await gql(env, 'mutation($b:ID!,$i:ID!,$c:String!,$v:JSON!){change_column_value(board_id:$b,item_id:$i,column_id:$c,value:$v){id}}', { b: rb, i: String(b.id), c: st.id, v: JSON.stringify(colValue(st, env.CHANGES_STATUS || 'Working On It')) });
  }
  return { ok: true };
}

// ---------- new hires ----------
async function submitNewHire(env, me, fd) {
  const f = JSON.parse(fd.get('fields') || '{}');
  const name = [f.firstName, f.lastName].map(s => String(s || '').trim()).filter(Boolean).join(' ');
  if (!name) throw new Error('First and last name are required.');
  const eb = await bid(env, 'employees');
  let ec = await columns(env, eb);
  // the "About Me" text goes in a long-text "About Me" column (made the first time; an older "Bio" column is renamed)
  if (f.bio && !ec.byTitle[nk('About Me')]) {
    try {
      const old = ec.byTitle[nk('Bio')];
      if (old) await gql(env, 'mutation($b:ID!,$c:String!){change_column_title(board_id:$b,column_id:$c,title:"About Me"){id}}', { b: String(eb), c: old.id });
      else await gql(env, 'mutation($b:ID!){create_column(board_id:$b,title:"About Me",column_type:long_text){id}}', { b: String(eb) });
      forget('cols:' + eb); ec = await columns(env, eb);
    } catch (e) {}
  }
  const show = f.show || {};
  const fields = {
    title: f.title, company: f.company, email: f.email,
    phone: show.phone === false ? '' : f.phone,
    address1: show.address === false ? '' : f.address1, address2: show.address === false ? '' : f.address2,
    'Marketing Setup': 'Pending', 'Package Look': (f.looks || []).join(', '), 'Requested By': me.email,
    'Start Date': f.startDate, 'About Me': f.bio, 'Market Areas': (f.areas || []).map(a => typeof a === 'string' ? a : (a.label || a.area)).join(', '), 'Notes for Marketing': f.notes,
  };
  const { values, missing } = buildValues(ec, fields);
  const itemId = await createItem(env, eb, null, name, values);
  const notes = ['New hire submitted through the Manager Portal by ' + escHtml(me.row.name) + ' (' + escHtml(me.email) + ')'];
  if (show.headshot === false) notes.push('No headshot on their materials.');
  missing.forEach(t => notes.push(escHtml(t) + ': ' + escHtml(fields[t])));
  await addUpdate(env, itemId, notes.join('<br>'));
  const photo = fd.get('photo');
  const up = ec.byTitle[nk('Image Upload')];
  if (photo && typeof photo !== 'string' && photo.size && up) await addFile(env, itemId, up.id, photo);
  // add them to this manager's team on the Manager Contacts board
  try {
    if (me.dir.relColId && !me.row.admin) {
      const ids = me.row.linked.concat([String(itemId)]).map(Number);
      await gql(env, 'mutation($b:ID!,$i:ID!,$c:String!,$v:JSON!){change_column_value(board_id:$b,item_id:$i,column_id:$c,value:$v){id}}',
        { b: me.dir.managersBoard, i: String(me.row.rowId), c: me.dir.relColId, v: JSON.stringify({ item_ids: ids }) });
    }
  } catch (e) {}
  // their market update areas go straight onto the Market Areas board (the weekly run picks them up)
  try {
    const b = await areasBoard(env);
    const areas = (f.areas || []).filter(a => a && typeof a === 'object' && /^https:\/\/(www\.)?(altos\.re|altosresearch\.com)\//i.test(String(a.link || '')));
    if (b) for (const a of areas) {
      const v = {}; v[b.col.Employee] = name; v[b.col.Area] = String(a.area || '').trim(); v[b.col['Location Label']] = String(a.label || a.area || '').trim();
      v[b.col['Altos Link']] = String(a.link).trim(); v[b.col.Active] = 'Yes'; v[b.col.Notes] = 'Added with the new hire by ' + me.row.name + ' in the Manager Portal ' + today();
      await createItem(env, b.id, null, name + ' - ' + v[b.col.Area], v);
    }
    forget('areas');
  } catch (e) { await addUpdate(env, itemId, 'Market areas could not be added to the Market Areas board: ' + escHtml(String(e.message || e))).catch(() => {}); }
  // their monthly newsletter / event calendar area(s) go onto the Newsletter Template board
  try {
    const nl = (f.nlAreas || []).filter(a => a && a.header);
    for (const a of nl) await nlAdd(env, { name, email: f.email, phone: f.phone, title: f.title, company: f.company, address1: f.address1, address2: f.address2 }, a.header, a.location, me.row.name);
  } catch (e) { await addUpdate(env, itemId, 'Newsletter areas could not be added to the Newsletter Template board: ' + escHtml(String(e.message || e))).catch(() => {}); }
  forget('dir');
  return { ok: true, id: itemId, name };
}

// ---------- My Team: the manager's team (view only) and their market update areas ----------
// The areas live on the "Market Areas" board, which the Marketing Tools app on Kevin's Mac keeps in step with
// Market Areas.csv - the list the weekly market update reads.
const AREA_COLS = ['Employee', 'Area', 'Location Label', 'Altos Link', 'Active', 'Notes'];
export const ALTOS_SEARCH = 'https://altos.re/r/6a599414-73b5-40dd-a2ca-ab394e0b984d';
async function areasBoard(env) {
  let id = await cached('areasBoard', 300e3, async () => { try { return await bid(env, 'areas'); } catch (e) { return ''; } });
  if (!id) { forget('areasBoard'); forget('board:Market Areas'); return null; }   // not made yet: look again next time
  const cols = await columns(env, id);
  const col = {}; AREA_COLS.forEach(t => { const c = cols.byTitle[nk(t)]; if (c) col[t] = c.id; });
  if (AREA_COLS.some(t => !col[t])) return null;
  return { id, col };
}
async function allAreas(env, b) {
  return cached('areas', 60e3, async () => {
    const items = await allItems(env, b.id, Object.values(b.col));
    const title = {}; Object.keys(b.col).forEach(t => title[b.col[t]] = t);
    return items.map(it => {
      const o = { id: String(it.id) };
      it.column_values.forEach(cv => { if (title[cv.id]) o[title[cv.id]] = (cv.text || '').trim(); });
      return { id: o.id, employee: o.Employee || '', area: o.Area || '', label: o['Location Label'] || '', link: o['Altos Link'] || '', active: !/^n/i.test(o.Active || 'Yes'), notes: o.Notes || '' };
    });
  });
}
async function myTeam(env, me) {
  const team = teamOf(me).slice().sort((a, b) => a.name.localeCompare(b.name));
  const b = await areasBoard(env);
  const areas = b ? await allAreas(env, b) : [];
  const photos = await headshots(env, team.map(p => p.id)).catch(() => ({}));
  const nb = await nlBoard(env).catch(() => null), nlRows = nb ? await nlAll(env, nb).catch(() => []) : [];
  const out = team.map(p => ({ id: p.id, name: p.name, title: p.title, email: p.email, phone: p.phone, company: p.company, address1: p.address1, address2: p.address2,
    photo: photos[p.id] ? 'api/photo/' + p.id + '?v=' + photos[p.id].id : '',
    areas: areas.filter(a => nk(a.employee) === nk(p.name) && (a.area || a.link)).sort((x, y) => (x.label || x.area).localeCompare(y.label || y.area)),
    nl: nlRows.filter(r => nk(r.name) === nk(p.name) && r.header).map(r => ({ id: r.id, header: r.header, location: r.location, active: r.active })).sort((x, y) => x.header.localeCompare(y.header)) }));
  return { team: out, areasReady: !!b, nlReady: !!nb, nlOptions: nb ? nlOptionsFrom(nlRows) : [], altosSearch: ALTOS_SEARCH };
}
async function changeArea(env, me, body) {
  const who = teamOf(me).find(p => nk(p.name) === nk(body.employee));
  if (!who) return { error: 'You can only change areas for people on your team.' };
  const b = await areasBoard(env);
  if (!b) throw new Error('The Market Areas board isn’t set up yet. Ask West Marketing.');
  forget('areas');
  const areas = await allAreas(env, b);
  const mine = areas.filter(a => nk(a.employee) === nk(who.name));
  const when = today(), by = me.row.name;
  const setVals = async (itemId, vals) => {
    const v = {}; Object.keys(vals).forEach(t => v[b.col[t]] = String(vals[t]));
    await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: String(itemId), v: JSON.stringify(v) });
  };
  if (body.op === 'add') {
    const link = String(body.link || '').trim(), area = String(body.area || '').trim(), label = String(body.label || '').trim() || area;
    if (!/^https:\/\/(www\.)?(altos\.re|altosresearch\.com)\//i.test(link)) return { error: 'Paste an Altos report link (it starts with https://altos.re/r/…).' };
    if (!area) return { error: 'Add the city or zip code.' };
    if (mine.some(a => a.link === link)) return { error: who.name + ' already has that link.' };
    for (const a of mine.filter(a => !a.area && !a.link)) await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: a.id });   // the empty "Needs areas" row
    const v = {}; v[b.col.Employee] = who.name; v[b.col.Area] = area; v[b.col['Location Label']] = label; v[b.col['Altos Link']] = link; v[b.col.Active] = 'Yes';
    v[b.col.Notes] = 'Added by ' + by + ' in the Manager Portal ' + when;
    await createItem(env, b.id, null, who.name + ' - ' + area, v);
  } else {
    const a = mine.find(x => x.id === String(body.id));
    if (!a) return { error: 'That area is no longer on ' + who.name + '’s list.' };
    if (body.op === 'remove') await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: a.id });
    else if (body.op === 'active') await setVals(a.id, { Active: body.active ? 'Yes' : 'No', Notes: (body.active ? 'Turned back on' : 'Turned off') + ' by ' + by + ' in the Manager Portal ' + when });
    else return { error: 'Unknown change.' };
  }
  forget('areas');
  return { ok: true, team: (await myTeam(env, me)).team.find(p => p.id === who.id) };
}
// reads an Altos report link to show which place it is (best effort - Altos may not always answer)
async function checkAltos(link) {
  link = String(link || '').trim();
  if (!/^https:\/\/(www\.)?(altos\.re|altosresearch\.com)\//i.test(link)) return { ok: false, error: 'That doesn’t look like an Altos report link.' };
  try {
    const r = await fetch(link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', Accept: 'text/html' } });
    const html = await r.text();
    const m = html.match(/<script[^>]*application\/json[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return { ok: false, error: 'Couldn’t read that report. Check the link opens in your browser.' };
    const dec = m[1].replace(/&q;/g, '"').replace(/&s;/g, "'").replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;/g, '&');
    const j = JSON.parse(dec);
    let params = j.reportParameters || null;
    if (!params) Object.keys(j).forEach(k => { const v = j[k]; if (v && v.u && /\/settings\?/.test(v.u)) params = v.b; });
    if (!params || !params.report) return { ok: false, error: 'That report wasn’t found (the link may have expired).' };
    const loc = params.report.location || {};
    const city = (loc.city || '').replace(/\b(\w)(\w*)/g, (a, b, c) => b + c.toLowerCase());
    return { ok: true, location: params.displayNameWithZip || loc.displayName || '', city, zip: loc.zip || '' };
  } catch (e) { return { ok: false, error: 'Couldn’t reach Altos to check the link.' }; }
}

// ---------- headshots: the cut-out copies the Marketing Tools app puts in the "Headshot Cutout" column ----------
async function headshots(env, ids) {
  const eb = await bid(env, 'employees');
  const ec = await columns(env, eb);
  const col = ec.byTitle[nk('Headshot Cutout')];
  if (!col || !ids.length) return {};
  const key = 'shots:' + ids.slice().sort().join(',').slice(0, 2000);
  return cached(key, 40 * 60e3, async () => {
    const out = {};
    for (let i = 0; i < ids.length; i += 100) {
      const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i,limit:100){id assets(column_ids:$c){id public_url created_at}}}', { i: ids.slice(i, i + 100).map(String), c: [col.id] });
      (d.items || []).forEach(it => { const a = (it.assets || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0]; if (a) out[String(it.id)] = { id: String(a.id), url: a.public_url }; });
    }
    return out;
  });
}
async function teamPhoto(env, me, id) {
  id = String(id || '').replace(/\D/g, '');
  if (!teamOf(me).some(p => String(p.id) === id) && !(me.row.self && String(me.row.self.id) === id)) return fail('Not found', 404);
  const cache = caches.default;
  let shots = await headshots(env, [id]);
  if (!shots[id]) return fail('No headshot', 404);
  const ck2 = new Request('https://manager-portal.cache/headshot/' + shots[id].id);
  const hit = await cache.match(ck2);
  const head = { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  if (hit) return new Response(hit.body, { headers: head });
  let r = await fetch(shots[id].url);
  if (!r.ok) { forget('shots:' + id); shots = await headshots(env, [id]); if (!shots[id]) return fail('No headshot', 404); r = await fetch(shots[id].url); }
  if (!r.ok) return fail('Could not load the headshot', 502);
  const buf = await r.arrayBuffer();
  try { await cache.put(ck2, new Response(buf, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=2592000' } })); } catch (e) {}
  return new Response(buf, { headers: head });
}

// ---------- newsletter / event calendar areas: the "Newsletter Template" board (one row per person per area) ----------
// "header" is the area's title (e.g. SAN BERNARDINO EVENTS) - everyone with the same header shares that area's events.
async function nlBoard(env) {
  const id = await cached('nlBoard', 300e3, async () => { try { return await bid(env, 'newsletter'); } catch (e) { return ''; } });
  if (!id) { forget('nlBoard'); return null; }
  const cols = await columns(env, id);
  const c = t => cols.byTitle[nk(t)];
  if (!c('header')) return null;
  return { id, cols, name: c('fullname'), header: c('header'), location: c('newsletter location'), active: c('active') };
}
async function nlAll(env, b) {
  return cached('nl', 60e3, async () => {
    const ids = [b.name, b.header, b.location, b.active].filter(Boolean).map(c => c.id);
    const items = await allItems(env, b.id, ids);
    return items.filter(it => !SKIP(it.name)).map(it => {
      const v = {}; it.column_values.forEach(cv => v[cv.id] = (cv.text || '').trim());
      return { id: String(it.id), item: it.name, group: it.group && it.group.id, name: (b.name && v[b.name.id]) || it.name.trim(), header: (v[b.header.id] || '').toUpperCase(), location: b.location ? v[b.location.id] || '' : '', active: !b.active ? true : b.active.type === 'checkbox' ? !!v[b.active.id] : !/^n/i.test(v[b.active.id] || '') };
    });
  });
}
function nlOptionsFrom(rows) {
  const m = {};
  rows.forEach(r => { if (!r.header) return; const o = m[r.header] || (m[r.header] = { header: r.header, locations: {}, people: 0 }); o.people++; if (r.location) o.locations[r.location] = (o.locations[r.location] || 0) + 1; });
  return Object.values(m).map(o => ({ header: o.header, people: o.people, location: Object.keys(o.locations).sort((a, b) => o.locations[b] - o.locations[a])[0] || '' })).sort((a, b) => a.header.localeCompare(b.header));
}
async function nlOptions(env) { const b = await nlBoard(env); return b ? nlOptionsFrom(await nlAll(env, b)) : []; }
async function nlAdd(env, p, header, location, by) {
  const b = await nlBoard(env); if (!b) throw new Error('The Newsletter Template board isn’t available.');
  header = String(header || '').trim().toUpperCase(); location = String(location || '').trim();
  if (!header) throw new Error('Pick an area.');
  const rows = await nlAll(env, b);
  if (rows.some(r => nk(r.name) === nk(p.name) && r.header === header)) return { already: true };
  if (!location) { const o = nlOptionsFrom(rows).find(x => x.header === header); location = o ? o.location : ''; }
  const fields = { fullname: p.name, header, 'newsletter location': location, email: p.email, phone: p.phone, title: p.title, company: p.company, address1: p.address1, address2: p.address2 };
  Object.keys(fields).forEach(k => { if (!fields[k]) delete fields[k]; });
  const { values } = buildValues(b.cols, fields);
  const mine = rows.find(r => nk(r.name) === nk(p.name)), same = rows.find(r => r.header === header);
  const id = await createItem(env, b.id, (mine || same || {}).group || null, mine ? mine.item : p.name, values);
  if (by) await addUpdate(env, id, 'Added by ' + escHtml(by) + ' in the Manager Portal ' + today()).catch(() => {});
  forget('nl');
  return { id };
}
async function changeNl(env, me, body) {
  const who = teamOf(me).find(p => nk(p.name) === nk(body.employee));
  if (!who) return { error: 'You can only change areas for people on your team.' };
  const b = await nlBoard(env);
  if (!b) throw new Error('The Newsletter Template board isn’t available. Ask West Marketing.');
  forget('nl');
  if (body.op === 'add') {
    const r = await nlAdd(env, who, body.header, body.location, me.row.name);
    if (r.already) return { error: who.name + ' already has that area.' };
  } else if (body.op === 'remove' || body.op === 'active') {
    const row = (await nlAll(env, b)).find(r => r.id === String(body.id) && nk(r.name) === nk(who.name));
    if (!row) return { error: 'That area is no longer on ' + who.name + '’s list.' };
    if (body.op === 'remove') await gql(env, 'mutation($i:ID!){archive_item(item_id:$i){id}}', { i: row.id });
    else {
      // on / off lives in an "Active" column (made the first time it's needed); off = skipped by the monthly run
      let col = b.active;
      if (!col) {
        const d = await gql(env, 'mutation($b:ID!){create_column(board_id:$b,title:"Active",column_type:text){id title type}}', { b: String(b.id) });
        col = Object.assign({ settings: {} }, d.create_column); forget('cols:' + b.id);
      }
      const v = {}; v[col.id] = col.type === 'checkbox' ? (body.active ? { checked: 'true' } : null) : colValue(col, body.active ? 'Yes' : 'No');
      await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v,create_labels_if_missing:true){id}}', { b: String(b.id), i: row.id, v: JSON.stringify(v) });
      await addUpdate(env, row.id, (body.active ? 'Turned back on' : 'Turned off') + ' by ' + escHtml(me.row.name) + ' in the Manager Portal ' + today()).catch(() => {});
    }
  } else return { error: 'Unknown change.' };
  forget('nl');
  return { ok: true, team: (await myTeam(env, me)).team.find(p => p.id === who.id) };
}

// ---------- what's on someone's portal now: their "Market Update" and "Event Calendar" rows ----------
const CONTENT_ROWS = { market: 'Market Update', newsletter: 'Event Calendar' };
async function portalCols(env) {
  const id = await bid(env, 'portal'), cols = await columns(env, id);
  return { id, emp: cols.byTitle[nk('Employee')], doc: Object.values(cols.byTitle).find(c => c.type === 'file' && nk(c.title) === nk('Document')) || Object.values(cols.byTitle).find(c => c.type === 'file') };
}
async function teamContent(env, me, id) {
  const who = teamOf(me).find(p => String(p.id) === String(id));
  if (!who) return { error: 'You can only see your own team.' };
  const pc = await portalCols(env);
  if (!pc.emp || !pc.doc) return { market: null, newsletter: null };
  return cached('content:' + who.id, 120e3, async () => {
    const d = await gql(env, 'query($b:ID!,$c:String!,$v:[String]!,$f:[String!]){items_page_by_column_values(board_id:$b,limit:100,columns:[{column_id:$c,column_values:$v}]){items{id name updated_at assets(column_ids:$f){id name file_extension created_at}}}}',
      { b: String(pc.id), c: pc.emp.id, v: [who.name], f: [pc.doc.id] });
    const items = (d.items_page_by_column_values || {}).items || [];
    const out = {};
    Object.keys(CONTENT_ROWS).forEach(k => {
      const it = items.find(x => nk(x.name) === nk(CONTENT_ROWS[k]));
      if (!it) { out[k] = null; return; }
      const files = (it.assets || []).map(a => ({ id: String(a.id), name: a.name, ext: String(a.file_extension || '').replace('.', '').toLowerCase(), url: 'api/asset/' + it.id + '/' + a.id }));
      // slideshow first, then pictures in name order
      files.sort((a, b) => (b.ext === 'mp4') - (a.ext === 'mp4') || a.name.localeCompare(b.name, undefined, { numeric: true }));
      out[k] = { item: String(it.id), updated: it.updated_at, files };
    });
    return out;
  });
}
// streams one file from a team member's portal row (preview, or download with ?dl=1). Videos are sent to monday's own link so they can play.
async function teamAsset(env, me, itemId, assetId, dl) {
  itemId = String(itemId || '').replace(/\D/g, ''); assetId = String(assetId || '').replace(/\D/g, '');
  const pc = await portalCols(env);
  const d = await gql(env, 'query($i:[ID!],$c:[String!],$a:[String!]){items(ids:$i){id column_values(ids:$c){text} assets(column_ids:$a){id name file_extension public_url}}}', { i: [itemId], c: [pc.emp.id], a: [pc.doc.id] });
  const it = (d.items || [])[0];
  if (!it) return fail('Not found', 404);
  const emp = ((it.column_values || [])[0] || {}).text || '';
  if (!teamOf(me).some(p => nk(p.name) === nk(emp))) return fail('Not found', 404);
  const a = (it.assets || []).find(x => String(x.id) === assetId);
  if (!a) return fail('Not found', 404);
  const ext = String(a.file_extension || '').replace('.', '').toLowerCase();
  if (!dl && ext === 'mp4') return Response.redirect(a.public_url, 302);
  const r = await fetch(a.public_url);
  if (!r.ok) return fail('Could not load the file', 502);
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf', mp4: 'video/mp4' }[ext] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  if (dl) head['Content-Disposition'] = 'attachment; filename="' + String(a.name).replace(/["\\\r\n]/g, '') + '"';
  return new Response(r.body, { headers: head });
}

// ---------- new hire bios, written by Claude (ANTHROPIC_API_KEY is a Cloudflare Secret) ----------
const BIO_MODEL = 'claude-sonnet-5-5';
const BIO_STYLES = { write: ['Warm', 'Polished', 'Short', 'Conversational', 'Community-focused', 'Straightforward'], clean: ['Cleaned up', 'Polished', 'Short', 'Warm', 'Straightforward'] };
async function writeBios(env, me, b) {
  if (!env.ANTHROPIC_API_KEY) return { error: 'About Me writing isn’t switched on yet (the Claude API key is missing in Cloudflare). Ask West Marketing.' };
  // a few per manager per hour is plenty; this stops runaway clicking
  const k = 'bios:' + me.email, used = await cached(k, 3600e3, async () => ({ n: 0 }));
  if (used.n >= 40) return { error: 'That’s a lot of writing this hour - try again a little later.' };
  used.n++;
  const mode = b.mode === 'clean' ? 'clean' : 'write', have = (b.have || []).slice(0, 8).map(String);
  const count = Math.min(2, Math.max(1, Number(b.count) || 2));
  const styles = BIO_STYLES[mode].filter(x => !(b.styles || []).includes(x)).slice(0, count);
  while (styles.length < count) styles.push(mode === 'clean' ? 'Another take' : 'Fresh take');
  const p = b.person || {}, a = b.answers || {};
  const who = ['Name: ' + (p.name || ''), 'Title: ' + (p.title || ''), 'Company: ' + (p.company || 'Stewart Title'), p.city ? 'Office: ' + p.city : ''].filter(x => !/: $/.test(x)).join('\n');
  let task;
  if (mode === 'clean') {
    const text = String(b.text || '').trim().slice(0, 3000);
    if (text.length < 20) return { error: 'Paste their About Me first.' };
    task = 'Here is a bio the new hire already has:\n<bio>\n' + text + '\n</bio>\n\nWrite ' + count + ' cleaned-up version(s). Fix spelling, grammar, capitals and flow, use their full name, and keep it professional and friendly. ' +
      'Keep ALL of their facts and do not add any new facts, numbers, awards or claims. Keep about the same length unless the style says otherwise.';
  } else {
    const lines = [['Years in title & escrow', a.years], ['Areas they serve', a.areas], ['Known for / specialties', a.known], ['Languages', a.langs], ['Before Stewart', a.before], ['Personal touch', a.personal]].filter(x => String(x[1] || '').trim()).map(x => x[0] + ': ' + String(x[1]).trim().slice(0, 300));
    if (lines.length < 2) return { error: 'Answer at least a couple of the questions first.' };
    task = 'Facts from their manager:\n' + lines.join('\n') + '\n\nWrite ' + count + ' different bio(s). Use ONLY these facts - never invent numbers, awards, designations, clients or claims. ' +
      'Third person, except a "Conversational" style may be first person. About 40-80 words; a "Short" style 20-35 words.';
  }
  const prompt = 'You write short professional bios for new team members at Stewart Title (title and escrow) to use on their website and marketing pieces.\n\nThe new hire:\n' + who + '\n\n' + task +
    '\n\nStyles to write, one bio each, in this order: ' + styles.join(', ') + '.' +
    (have.length ? '\nMake them clearly different from these bios they already have:\n' + have.map((t, i) => (i + 1) + '. ' + t).join('\n') : '') +
    '\nNo headings, no emojis, no hashtags, no quotation marks around the bio. Plain text, one paragraph each.\n\nAnswer with ONLY JSON: {"bios":[{"style":"...","text":"..."}]}';
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: BIO_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) return { error: 'Claude couldn’t write it right now (' + ((j.error && j.error.message) || r.status) + '). Try again in a moment.' };
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  let out = null; try { out = JSON.parse((text.match(/\{[\s\S]*\}/) || [''])[0]); } catch (e) {}
  const bios = ((out && out.bios) || []).map((x, i) => ({ style: String(x.style || styles[i] || 'Option'), text: String(x.text || '').trim() })).filter(x => x.text).slice(0, count);
  if (!bios.length) return { error: 'Claude’s answer came back empty. Try again.' };
  return { bios };
}
