// Manager Portal server: every /api/... call lands here.
// Who is signed in comes from Cloudflare Access (it checks the email code); what they may do comes from the
// Manager Contacts board on monday.com (Managers group = their own team, Portal Admins group = everyone).
import { gql, escHtml, nk, cached, forget, boardId, columns, allItems, buildValues, createItem, addUpdate, addFile, colValue } from '../lib/monday.js';

const BOARDS = {
  managers: ['Manager Contacts', 'MANAGERS_BOARD_ID'],
  employees: ['Main Employee Sheet', 'EMPLOYEES_BOARD_ID'],
  requests: ['Marketing Request', 'REQUESTS_BOARD_ID'],
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
async function whoAmI(request, env) {
  let email = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase();
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
    companies: ['Stewart Title Guaranty Company', 'Stewart Title & Trust of Tucson'],
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
  const ec = await columns(env, eb);
  const show = f.show || {};
  const fields = {
    title: f.title, company: f.company, email: f.email,
    phone: show.phone === false ? '' : f.phone,
    address1: show.address === false ? '' : f.address1, address2: show.address === false ? '' : f.address2,
    'Marketing Setup': 'Pending', 'Package Look': (f.looks || []).join(', '), 'Requested By': me.email,
    'Start Date': f.startDate, 'Market Areas': (f.areas || []).join(', '), 'Notes for Marketing': f.notes,
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
  forget('dir');
  return { ok: true, id: itemId, name };
}
