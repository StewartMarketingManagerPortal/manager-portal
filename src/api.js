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
    if (route.startsWith('remote/')) { if (!me.row.admin) return fail('The Marketing Tools remote is for West Marketing only.', 403); const r = await remoteRoute(env, me, route.slice(7), m, request); if (r instanceof Response) return r; return json(r, r.error ? 400 : 200); }
    if (route.startsWith('viewas/') && m === 'GET') { const r = await viewAsLink(env, me, route.split('/')[1]); return json(r, r.error ? 403 : 200); }
    if (route.startsWith('content/') && m === 'GET') { const r = await teamContent(env, me, route.split('/')[1]); return json(r, r.error ? 403 : 200); }
    if (route.startsWith('asset/') && m === 'GET') return await teamAsset(env, me, route.split('/')[1], route.split('/')[2], new URL(request.url).searchParams.get('dl'));
    if (route === 'bio' && m === 'POST') { const r = await writeBios(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'nlareas' && m === 'GET') return json({ options: await nlOptions(env) });
    if (route === 'nlarea' && m === 'POST') { const r = await changeNl(env, me, await request.json()); return json(r, r.error ? 403 : 200); }
    if (route === 'altos' && m === 'POST') return json(await checkAltos((await request.json()).link));
    if (route === 'proof' && m === 'POST') { const r = await answerProof(env, me, await request.json()); return json(r, r.error ? 403 : 200); }
    if (route === 'onboarding' && m === 'GET') return json(await onbList(env, me));
    if (route === 'onboarding' && m === 'POST') { const r = await onbChange(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'dates' && m === 'POST') { const r = await setDate(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'packages' && m === 'GET') return json(await packageList(env, me));
    if (route.startsWith('pkgimg/') && m === 'GET') return await packageImg(env, me, route.split('/')[1]);
    if (route === 'highlights' && m === 'GET') return json(await highlights(env, me));
    if (route === 'highlights' && m === 'POST') { const r = await hlMark(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route.startsWith('hlart/') && m === 'GET') return await hlArt(env, me, route.split('/')[1]);
    if (route === 'welcome' && m === 'GET') return json(await welcomeList(env, me));
    if (route === 'welcome' && m === 'POST') { const r = await welcomeMark(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route.startsWith('welcome/') && m === 'GET') return await welcomeImg(env, me, route.split('/')[1]);
    if (route === 'recruiting' && m === 'GET') return json(await recList(env, me));
    if (route === 'recruiting' && m === 'POST') { const r = await recAdd(env, me, await request.formData()); return json(r, r.error ? 400 : 200); }
    if (route === 'recruiting/remove' && m === 'POST') { const r = await recRemove(env, me, (await request.json()).id); return json(r, r.error ? 403 : 200); }
    if (route === 'recruiting/edit' && m === 'POST') { const r = await recEdit(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route.startsWith('recruiting/log/') && m === 'GET') { const r = await recLog(env, me, route.split('/')[2]); return json(r, r.error ? 403 : 200); }
    if (route === 'recruiting/log' && m === 'POST') { const r = await recLogAdd(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'recruiting/log/remove' && m === 'POST') { const r = await recLogRemove(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'recruiting/forwarded' && m === 'POST') { const r = await recForwardAct(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'recruiting/email' && m === 'POST') { const r = await recEmail(env, me, await request.formData()); return json(r, r.error ? 400 : 200); }
    if (route.startsWith('recfile/') && m === 'GET') return await recFile(env, me, route.split('/')[1], route.split('/')[2]);
    if (route.startsWith('recphoto/') && m === 'GET') return await recPhoto(env, me, route.split('/')[1]);
    if (route.startsWith('recview/') && m === 'GET') { const r = await recViewLink(env, me, route.split('/')[1]); return json(r, r.error ? 403 : 200); }
    if (route === 'ideas' && m === 'GET') return json(await ideaList(env, me));
    if (route === 'ideas' && m === 'POST') { const r = await ideaAdd(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
    if (route === 'reviews' || route.startsWith('reviews/')) {
      const parts = route.split('/').slice(1);
      if (!parts.length && m === 'GET') return json(await drList(env, me));
      if (parts[0] === 'img' && m === 'GET') return await drImage(env, me, parts[1], parts[2]);
      if (parts[0] === 'answer' && m === 'POST') { const r = await drAnswer(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
      if (parts[0] === 'comment' && m === 'POST') { const r = await drComment(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
      if (parts.length === 1 && m === 'GET') { const r = await drDetail(env, me, parts[0]); return json(r, r.error ? 404 : 200); }
      return fail('Not found', 404);
    }
    if (route === 'social' || route.startsWith('social/')) {
      if (!me.row.admin) return fail('The social calendar is for West Marketing only.', 403);
      const parts = route.split('/').slice(1);
      if (!parts.length && m === 'GET') return json(await soList(env, me));
      if (parts[0] === 'img' && m === 'GET') return await soImage(env, parts[1], parts[2], new URL(request.url).searchParams.get('dl'));
      if (parts[0] === 'posted' && m === 'POST') { const r = await soPosted(env, me, await request.json()); return json(r, r.error ? 400 : 200); }
      return fail('Not found', 404);
    }
    if (route === 'refresh' && m === 'POST') { forget(''); return json({ ok: true }); }
    return fail('Not found', 404);
  } catch (e) {
    return fail(String(e.message || e), 500);
  }
}

// ---------- who is this? ----------
async function directory(env) {
  return cached('dir', 60e3, async () => {
    const [mb, eb] = await Promise.all([bid(env, 'managers'), bid(env, 'employees')]);
    const [mc, ec] = await Promise.all([columns(env, mb), columns(env, eb)]);
    const [mItems, eItems] = await Promise.all([allItems(env, mb), allItems(env, eb)]);
    const etitle = {}; Object.values(ec.byTitle).forEach(c => etitle[c.id] = nk(c.title));
    const employees = {};
    eItems.forEach(it => {
      const f = {}; it.column_values.forEach(cv => { if (etitle[cv.id]) f[etitle[cv.id]] = (cv.text || '').trim(); });
      employees[it.id] = { id: it.id, name: it.name.trim(), email: (f.email || '').toLowerCase(), title: f.title || '', phone: f.phone || '', company: f.company || '',
        address1: f.address1 || '', address2: f.address2 || '', setup: f['marketing setup'] || '', requestedBy: (f['requested by'] || '').toLowerCase(), skip: SKIP(it.name),
        birthday: monthDay(f.birthday), start: ymd(f['start date']), welcome: !!f['welcome post'], welcomePosted: f['welcome posted'] || '' };
    });
    const rel = Object.values(mc.byTitle).find(c => c.type === 'board_relation');
    const ppl = Object.values(mc.byTitle).find(c => c.type === 'people');
    const st = mc.byTitle['status'];
    const asst = mc.byTitle['assistant to'];   // Assistants group: the manager's name, exactly as on their row
    const over = mc.byTitle['managers'];        // Presidents group: their managers' names, separated by commas
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
        emails: Array.from(emails), linked, self: own || null,
        assistant: /assistant/i.test(it.group.title), assistTo: asst ? (cv(asst.id).text || '').trim() : '',
        president: /president/i.test(it.group.title), oversees: over ? (cv(over.id).text || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean) : [] };
    });
    // a president sees the teams of the managers named on their row (and those managers themselves)
    managers.filter(m => m.president).forEach(m => {
      m.under = m.oversees.map(n => managers.find(x => !x.assistant && !x.president && !x.admin && nk(x.name) === nk(n))).filter(Boolean);
      m.missing = m.oversees.filter(n => !m.under.some(x => nk(x.name) === nk(n)));
    });
    return { managers, employees, relColId: rel ? rel.id : null, managersBoard: mb };
  }, { shared: true });
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
  if (!row.assistant) return scoped({ ok: true, email, row, dir });
  // an assistant signs in as their manager: same team, same lists (they're kept under the manager's email),
  // and what they do is logged as "Jane for Vera"
  const boss = row.assistTo && dir.managers.find(m => !m.assistant && nk(m.name) === nk(row.assistTo));
  if (!boss) return { ok: false, email, error: 'You’re set up as an assistant, but the manager you assist isn’t found. Ask West Marketing to check “Assistant To” on your row.' };
  if (boss.paused) return { ok: false, email, error: 'Access to ' + boss.name + '’s Manager Portal is paused.' };
  const bossEmail = (boss.self && boss.self.email) || boss.emails[0];
  if (!bossEmail) return { ok: false, email, error: boss.name + ' doesn’t have an email on the Manager Contacts board yet. Ask West Marketing.' };
  return scoped({ ok: true, email: bossEmail, row: boss, dir, assistant: { name: row.name, email } });
}
// whose requests, new hires and onboarding this person sees: their own, plus (for a president) each of their managers'
function scoped(me) {
  const under = me.row.president ? me.row.under : [];
  me.scope = { emails: new Set([me.email].concat(...under.map(m => m.emails.concat(m.self && m.self.email ? [m.self.email] : [])))), names: new Set([me.row.name].concat(under.map(m => m.name)).map(nk)) };
  return me;
}
const inScope = (me, email, name) => me.row.admin || me.scope.emails.has(String(email || '').toLowerCase()) || (name != null && me.scope.names.has(nk(name)));
// who did it, for notes on monday.com: the manager, or "Jane Smith for Vera Mendoza"
const byName = me => me.assistant ? me.assistant.name + ' for ' + me.row.name : me.row.name;
function teamOf(me) {
  const E = me.dir.employees;
  if (me.row.admin) return Object.values(E).filter(p => !p.skip);
  const ids = new Set(me.row.linked);
  if (me.row.president) me.row.under.forEach(m => { m.linked.forEach(i => ids.add(i)); if (m.self) ids.add(m.self.id); });
  return Array.from(ids).map(i => E[i]).filter(p => p && !p.skip && (!me.row.self || p.id !== me.row.self.id));
}
async function profile(env, me) {
  const all = Object.values(me.dir.employees).filter(p => !p.skip);
  // offices and titles come from the people already on the sheet, so the dropdowns stay in step with the board
  const offices = {}, titles = {};
  all.forEach(p => { if (p.address1) offices[p.address1 + '|' + p.address2] = { address1: p.address1, address2: p.address2 }; if (p.title) titles[p.title] = 1; });
  const pub = p => ({ id: p.id, name: p.name, email: p.email, title: p.title });
  return {
    name: me.row.name, email: me.email, admin: me.row.admin, assistant: me.assistant ? me.assistant.name : '',
    president: !!me.row.president, managers: me.row.president ? me.row.under.map(m => m.name) : [], missing: me.row.president ? me.row.missing : [],
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
  // the whole board is loaded once for everyone and kept for 30 seconds; each person then gets their own rows
  const all = await cached('reqrows', 30e3, async () => (await allItems(env, rb, want.map(x => x.id))).map(it => {
    const v = {}; it.column_values.forEach(cv => { const col = want.find(w => w.id === cv.id); if (col) v[nk(col.title)] = { text: (cv.text || '').trim(), value: cv.value }; });
    const g = k => (v[nk(k)] || {}).text || '';
    let proofs = []; try { proofs = (JSON.parse((v['proof'] || {}).value || '{}').files || []).map(f => ({ id: String(f.assetId), name: f.name })); } catch (e) {}
    return { id: it.id, project: g('Project Name') || it.name, type: g('Purpose of Project'), forWho: g('Full Name'), status: g('Status') || 'New', ordered: g('Order Date'), due: g('Due Date'), state: g('CA or AZ'),
      manager: g("Manager's Name"), managerEmail: g('Managers Email').toLowerCase(), group: it.group.title, proofs, created: it.created_at };
  }), { shared: true });
  const rows = all.filter(r => inScope(me, r.managerEmail, r.manager)).map(r => Object.assign({}, r, { proofs: r.proofs.map(p => Object.assign({}, p)) }))
    .sort((a, b) => String(b.created).localeCompare(String(a.created))).slice(0, me.row.admin || me.row.president ? 150 : 100);
  // a link to look at the proof (monday gives a link that works for about an hour)
  const ids = rows.filter(r => /proof/i.test(r.status) && r.proofs.length).flatMap(r => r.proofs.map(p => p.id)).slice(0, 50);
  if (ids.length) {
    const a = await gql(env, 'query($i:[ID!]!){assets(ids:$i){id public_url}}', { i: ids });
    const url = {}; a.assets.forEach(x => url[x.id] = x.public_url);
    rows.forEach(r => r.proofs.forEach(p => p.url = url[p.id] || null));
  }
  // new hires this manager submitted
  const hires = Object.values(me.dir.employees).filter(p => p.requestedBy && inScope(me, p.requestedBy))
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
  const notes = ['Submitted through the Manager Portal by ' + escHtml(byName(me)) + ' (' + escHtml(me.assistant ? me.assistant.email : me.email) + ')'];
  if (forPeople.length > 1) notes.push('For: ' + escHtml(forPeople.map(p => p.name + (p.email ? ' (' + p.email + ')' : '')).join(', ')));
  missing.forEach(t => notes.push(escHtml(t) + ': ' + escHtml(typeof fields[t] === 'object' ? JSON.stringify(fields[t]) : fields[t])));
  await addUpdate(env, itemId, notes.join('<br>'));
  const filesCol = rc.byTitle[nk('Content Examples')], picsCol = rc.byTitle[nk('Property Images')] || filesCol;
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string' || !v.size) continue;
    const col = k === 'photos' ? picsCol : filesCol;
    if (col) await addFile(env, itemId, col.id, v);
  }
  forget('reqrows');
  return { ok: true, id: itemId, reference: itemId, due: fields['Due Date'] };
}

async function answerProof(env, me, b) {
  const rb = await bid(env, 'requests');
  const mine = (await myRequests(env, me)).requests.find(r => String(r.id) === String(b.id));
  if (!mine) return { error: 'That request isn’t one of yours.' };
  const rc = await columns(env, rb);
  const st = rc.byTitle['status'];
  if (b.action === 'approve') {
    await addUpdate(env, b.id, '✅ Proof approved by ' + escHtml(byName(me)) + ' in the Manager Portal.' + (b.note ? '<br>' + escHtml(b.note) : ''));
    if (st && env.APPROVED_STATUS) await gql(env, 'mutation($b:ID!,$i:ID!,$c:String!,$v:JSON!){change_column_value(board_id:$b,item_id:$i,column_id:$c,value:$v){id}}', { b: rb, i: String(b.id), c: st.id, v: JSON.stringify(colValue(st, env.APPROVED_STATUS)) });
  } else {
    if (!b.note) throw new Error('Tell us what to change.');
    await addUpdate(env, b.id, '✏️ Changes requested by ' + escHtml(byName(me)) + ' in the Manager Portal:<br>' + escHtml(b.note));
    if (st) await gql(env, 'mutation($b:ID!,$i:ID!,$c:String!,$v:JSON!){change_column_value(board_id:$b,item_id:$i,column_id:$c,value:$v){id}}', { b: rb, i: String(b.id), c: st.id, v: JSON.stringify(colValue(st, env.CHANGES_STATUS || 'Working On It')) });
  }
  forget('reqrows');
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
  const notes = ['New hire submitted through the Manager Portal by ' + escHtml(byName(me)) + ' (' + escHtml(me.assistant ? me.assistant.email : me.email) + ')'];
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
      v[b.col['Altos Link']] = String(a.link).trim(); v[b.col.Active] = 'Yes'; v[b.col.Notes] = 'Added with the new hire by ' + byName(me) + ' in the Manager Portal ' + today();
      await createItem(env, b.id, null, name + ' - ' + v[b.col.Area], v);
    }
    forget('areas');
  } catch (e) { await addUpdate(env, itemId, 'Market areas could not be added to the Market Areas board: ' + escHtml(String(e.message || e))).catch(() => {}); }
  // their monthly newsletter / event calendar area(s) go onto the Newsletter Template board
  try {
    const nl = (f.nlAreas || []).filter(a => a && a.header);
    for (const a of nl) await nlAdd(env, { name, email: f.email, phone: f.phone, title: f.title, company: f.company, address1: f.address1, address2: f.address2 }, a.header, a.location, byName(me));
  } catch (e) { await addUpdate(env, itemId, 'Newsletter areas could not be added to the Newsletter Template board: ' + escHtml(String(e.message || e))).catch(() => {}); }
  // optional: invite them to monday.com as a guest and add them to the Employee Marketing Portal board
  let invite = null;
  const pe = String(f.portalEmail || '').trim().toLowerCase();
  if (pe && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pe)) {
    try { invite = await portalInvite(env, eb, itemId, pe); await addUpdate(env, itemId, 'Employee Marketing Portal invite sent to ' + escHtml(pe) + (invite.already ? ' (they already had a monday.com login)' : '') + '. monday.com user ID ' + escHtml(invite.id) + '.'); }
    catch (e) { invite = { error: String(e.message || e) }; await addUpdate(env, itemId, 'Employee Marketing Portal invite to ' + escHtml(pe) + ' did not go through: ' + escHtml(invite.error)).catch(() => {}); }
  }
  forget('dir');
  return { ok: true, id: itemId, name, invite };
}
// invite_users is newer than the API version the rest of the portal uses
async function gqlNew(env, query, variables) {
  const r = await fetch('https://api.monday.com/v2', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: env.MONDAY_TOKEN, 'API-Version': '2025-04' }, body: JSON.stringify({ query, variables: variables || {} }) });
  const j = await r.json().catch(() => ({}));
  if (j.errors || j.error_message) throw new Error('monday.com: ' + (j.errors ? j.errors.map(e => e.message).join('; ') : j.error_message));
  return j.data;
}
async function portalInvite(env, eb, itemId, email) {
  let id = '', already = false;
  const d = await gqlNew(env, 'mutation($e:[String!]!){invite_users(emails:$e,user_role:GUEST,product:work_management){invited_users{id email} errors{message code email}}}', { e: [email] });
  const r = d.invite_users || {};
  if (r.invited_users && r.invited_users.length) id = String(r.invited_users[0].id);
  if (!id) {
    // already has a login on this account: use it
    const u = await gql(env, 'query($e:[String]){users(emails:$e){id}}', { e: [email] });
    if (u.users && u.users.length) { id = String(u.users[0].id); already = true; }
  }
  if (!id) throw new Error((r.errors && r.errors[0] && r.errors[0].message) || 'monday.com didn’t send the invite.');
  const pb = await bid(env, 'portal');
  await gql(env, 'mutation($b:ID!,$u:[ID!]!){add_users_to_board(board_id:$b,user_ids:$u,kind:subscriber){id}}', { b: String(pb), u: [id] });
  // keep their login on the Main Employee Sheet so Marketing Tools puts them in the People column of their portal rows
  let ec = await columns(env, eb);
  const need = ['Portal User ID', 'Portal Email'].filter(t => !ec.byTitle[nk(t)]);
  for (const t of need) await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:text){id}}', { b: String(eb), t });
  if (need.length) { forget('cols:' + eb); ec = await columns(env, eb); }
  const v = {}; v[ec.byTitle[nk('Portal User ID')].id] = id; v[ec.byTitle[nk('Portal Email')].id] = email;
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: String(eb), i: String(itemId), v: JSON.stringify(v) });
  return { id, already };
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
  }, { shared: true });
}
async function myTeam(env, me) {
  const team = teamOf(me).slice().sort((a, b) => a.name.localeCompare(b.name));
  const nbP = nlBoard(env).catch(() => null);
  const [b, areas, photos, nb, nlRows] = await Promise.all([
    areasBoard(env), areasBoard(env).then(x => x ? allAreas(env, x) : []),
    headshots(env, team.map(p => p.id)).catch(() => ({})),
    nbP, nbP.then(x => x ? nlAll(env, x).catch(() => []) : [])]);
  const out = team.map(p => ({ id: p.id, name: p.name, title: p.title, email: p.email, phone: p.phone, company: p.company, address1: p.address1, address2: p.address2,
    birthday: p.birthday || '', start: p.start || '',
    posts: Object.fromEntries(hlDue(p, today()).filter(h => h.days >= 0).map(h => [h.kind, h.date])),
    photo: photos[p.id] ? 'api/photo/' + p.id + '?v=' + photos[p.id].id : '',
    areas: areas.filter(a => nk(a.employee) === nk(p.name) && (a.area || a.link)).sort((x, y) => (x.label || x.area).localeCompare(y.label || y.area)),
    nl: nlRows.filter(r => nk(r.name) === nk(p.name) && r.header).map(r => ({ id: r.id, header: r.header, location: r.location, active: r.active })).sort((x, y) => x.header.localeCompare(y.header)) }));
  return { team: out, areasReady: !!b, nlReady: !!nb, nlOptions: nb ? nlOptionsFrom(nlRows) : [], altosSearch: ALTOS_SEARCH };
}
// ---------- birthday (MM-DD, no year) + Stewart start date (YYYY-MM-DD) on the Main Employee Sheet ----------
function monthDay(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^\d{4}-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2];
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})$/))) return m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return '';
}
function ymd(s) { const m = String(s || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : ''; }
async function setDate(env, me, body) {
  const who = teamOf(me).find(p => p.id === String(body.id));
  if (!who) return { error: 'You can only set dates for people on your team.' };
  const kind = body.kind === 'birthday' ? 'birthday' : body.kind === 'start' ? 'start' : '';
  if (!kind) return { error: 'Unknown date.' };
  const v = String(body.value || '').trim();
  if (v && kind === 'birthday' && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) return { error: 'Pick a month and day.' };
  if (v && kind === 'start' && !/^(19|20)\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)) return { error: 'Pick a date.' };
  const eb = await bid(env, 'employees'), title = kind === 'birthday' ? 'Birthday' : 'Start Date';
  let ec = await columns(env, eb), col = ec.byTitle[nk(title)];
  if (!col) {
    await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:' + (kind === 'birthday' ? 'text' : 'date') + '){id}}', { b: String(eb), t: title });
    forget('cols:' + eb); ec = await columns(env, eb); col = ec.byTitle[nk(title)];
  }
  const vals = {};
  vals[col.id] = col.type === 'date' ? (v ? { date: kind === 'birthday' ? '2000-' + v : v } : {}) : v;
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: String(eb), i: String(who.id), v: JSON.stringify(vals) });
  who[kind] = v;
  forget('dir');
  return { ok: true, id: who.id, kind, value: v };
}
async function changeArea(env, me, body) {
  const who = teamOf(me).find(p => nk(p.name) === nk(body.employee));
  if (!who) return { error: 'You can only change areas for people on your team.' };
  const b = await areasBoard(env);
  if (!b) throw new Error('The Market Areas board isn’t set up yet. Ask West Marketing.');
  forget('areas');
  const areas = await allAreas(env, b);
  const mine = areas.filter(a => nk(a.employee) === nk(who.name));
  const when = today(), by = byName(me);
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

// ---------- My Team Highlights: birthday + work anniversary posts, a week ahead, for the manager only ----------
// The post itself is drawn in the browser (art + headshot cutout + name). Art comes from the built-in designs
// plus any Amy adds to the "Highlight Designs" board (Status = Live; "Ready for review" ones show to Portal Admins only).
// "Mark as posted" is kept on the "Team Highlights" board (one row per person, kind and year).
const HL_AHEAD = 7, HL_AFTER = 2;
// Every board the portal makes goes in the Stewart West Marketing workspace (the words in either order). If it can't be found, nothing is made.
const isWest = name => { const w = nk(name).split(' '); return ['stewart', 'west', 'marketing'].every(x => w.includes(x)); };
async function wsWest(env) {
  const w = await gql(env, 'query{workspaces(limit:200){id name}}', {});
  const hit = (w.workspaces || []).find(x => isWest(x.name));
  if (!hit) throw new Error('The Stewart West Marketing workspace wasn’t found in monday.com, so the board wasn’t made. Ask West Marketing.');
  return String(hit.id);
}
async function ensureBoard(env, name, envKey, desc, cols) {
  return cached('hlb:' + name, 3600e3, async () => {
    let id = env[envKey] ? String(env[envKey]) : '';
    if (!id) { try { id = await boardId(env, name, envKey); } catch (e) { forget('board:' + name); } }
    if (!id) id = String((await gql(env, 'mutation($n:String!,$w:ID,$d:String){create_board(board_name:$n,board_kind:public,workspace_id:$w,description:$d){id}}', { n: name, w: await wsWest(env), d: desc })).create_board.id);
    let c = await columns(env, id);
    const missing = cols.filter(([t]) => !c.byTitle[nk(t)]);
    for (const [t, type, labels] of missing) {
      try { await gql(env, 'mutation($b:ID!,$t:String!,$d:JSON){create_column(board_id:$b,title:$t,column_type:' + type + ',defaults:$d){id}}', { b: id, t, d: labels ? JSON.stringify({ labels }) : null }); }
      catch (e) { await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:' + type + '){id}}', { b: id, t }); }
    }
    if (missing.length) { forget('cols:' + id); c = await columns(env, id); }
    const col = {}; cols.forEach(([t]) => col[t] = (c.byTitle[nk(t)] || {}).id);
    return { id, col };
  });
}
const hlDesignBoard = env => ensureBoard(env, 'Highlight Designs', 'HL_DESIGNS_BOARD_ID',
  'Team Highlight post designs for the Manager Portal. One row per design: pick the Type, leave Layout as Classic unless Kevin has added a new layout, add the 1080x1080 PNG to Art, then set Status to "Ready for review". Kevin sets it to "Live" when it should go out. The guide and Adobe templates are in 1_Administration/2_Templates/_Team Highlights.',
  [['Type', 'status', { 1: 'Birthday', 2: 'Anniversary' }], ['Art', 'file'], ['Status', 'status', { 0: 'Ready for review', 1: 'Live', 2: 'Retired' }], ['Text Color', 'text'], ['Accent Color', 'text'], ['Small Text Color', 'text'], ['Layout', 'text']]);
const hlPostedBoard = env => ensureBoard(env, 'Team Highlights', 'HL_POSTED_BOARD_ID',
  'Kept by the Manager Portal: one row each time a manager marks a team birthday or work anniversary post as posted.',
  [['Key', 'text'], ['Manager Email', 'text'], ['Posted On', 'text']]);
const hex = s => { const m = String(s || '').trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i); return m ? '#' + m[1] : ''; };
async function hlDesigns(env) {
  return cached('hlDesigns', 300e3, async () => {
    const b = await hlDesignBoard(env);
    const ids = Object.values(b.col).filter(Boolean);
    const d = await gql(env, 'query($b:[ID!],$c:[String!],$f:[String!]){boards(ids:$b){items_page(limit:200){items{id name column_values(ids:$c){id text} assets(column_ids:$f){id name file_extension public_url created_at}}}}}', { b: [b.id], c: ids, f: [b.col.Art] });
    return d.boards[0].items_page.items.map(it => {
      const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
      const type = (v[b.col.Type] || '').toLowerCase(), st = (v[b.col.Status] || '').toLowerCase();
      const art = (it.assets || []).filter(a => /png|jpe?g|webp/i.test(a.file_extension || a.name)).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
      const kind = /anniv/.test(type) ? 'start' : /birth/.test(type) ? 'birthday' : '';
      const status = /live/.test(st) ? 'live' : /retir/.test(st) ? 'retired' : /review|ready/.test(st) ? 'review' : '';
      return { id: String(it.id), name: it.name.trim(), kind, status, art: art ? { id: String(art.id), url: art.public_url } : null,
        layout: (v[b.col.Layout] || 'Classic').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'classic', text: hex(v[b.col['Text Color']]), accent: hex(v[b.col['Accent Color']]), small: hex(v[b.col['Small Text Color']]) };
    }).filter(x => x.kind && x.art && (x.status === 'live' || x.status === 'review'));
  });
}
async function hlPosted(env) {
  return cached('hlPosted', 120e3, async () => {
    const b = await hlPostedBoard(env), out = {};
    (await allItems(env, b.id, [b.col.Key, b.col['Manager Email'], b.col['Posted On']])).forEach(it => {
      const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
      if (v[b.col.Key]) out[v[b.col.Key]] = { row: String(it.id), by: v[b.col['Manager Email']], on: v[b.col['Posted On']] };
    });
    return out;
  });
}
function hlDue(p, now) {
  const out = [], t = new Date(now + 'T12:00:00');
  const occ = (md, y) => { let [m, d] = md.split('-').map(Number); if (m === 2 && d === 29 && new Date(y, 1, 29).getMonth() !== 1) d = 28; return new Date(y, m - 1, d, 12); };
  const add = (kind, md, from) => {
    for (const y of [t.getFullYear() - 1, t.getFullYear(), t.getFullYear() + 1]) {
      const dt = occ(md, y), days = Math.round((dt - t) / 864e5);
      if (days < -HL_AFTER || days > HL_AHEAD) continue;
      const years = from ? y - from : 0;
      if (from && years < 1) continue;
      out.push({ kind, date: dt.toISOString().slice(0, 10), days, years, key: p.id + '|' + kind + '|' + y });
    }
  };
  if (p.birthday) add('birthday', p.birthday, 0);
  if (p.start) add('start', p.start.slice(5), Number(p.start.slice(0, 4)));
  return out;
}
async function highlights(env, me) {
  const now = today(), team = teamOf(me);
  const due = [];
  team.forEach(p => hlDue(p, now).forEach(h => due.push(Object.assign({ id: p.id, name: p.name, title: p.title }, h))));
  if (!due.length) { await hlDesigns(env).catch(() => []); return { items: [], designs: [] }; }   // still sets up the Highlight Designs board
  const [photos, posted, designs] = await Promise.all([
    headshots(env, Array.from(new Set(due.map(h => h.id)))).catch(() => ({})),
    hlPosted(env).catch(() => ({})),
    hlDesigns(env).catch(() => [])]);
  const items = due.map(h => Object.assign(h, { photo: photos[h.id] ? 'api/photo/' + h.id + '?v=' + photos[h.id].id : '', posted: posted[h.key] ? posted[h.key].on || true : false }))
    .filter(h => !(h.days < 0 && h.posted))
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
  const show = designs.filter(d => d.status === 'live' || me.row.admin)
    .map(d => ({ id: d.id, name: d.name, kind: d.kind, review: d.status === 'review', layout: d.layout, art: 'api/hlart/' + d.art.id, text: d.text, accent: d.accent, small: d.small }));
  return { items, designs: show };
}
async function hlMark(env, me, body) {
  const p = teamOf(me).find(x => x.id === String(body.id));
  if (!p) return { error: 'That person isn’t on your team.' };
  const h = hlDue(p, today()).find(x => x.kind === body.kind && x.key === String(body.key));
  if (!h) return { error: 'That highlight isn’t coming up.' };
  const b = await hlPostedBoard(env), posted = await hlPosted(env);
  forget('hlPosted');
  if (body.posted === false) {
    if (posted[h.key]) await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: posted[h.key].row });
    return { ok: true, posted: false };
  }
  if (!posted[h.key]) {
    const v = {}; v[b.col.Key] = h.key; v[b.col['Manager Email']] = me.email; v[b.col['Posted On']] = today();
    await gql(env, 'mutation($b:ID!,$n:String!,$v:JSON!){create_item(board_id:$b,item_name:$n,column_values:$v){id}}',
      { b: b.id, n: p.name + ' - ' + (h.kind === 'birthday' ? 'Birthday' : h.years + ' Year Anniversary') + ' ' + h.date.slice(0, 4), v: JSON.stringify(v) });
  }
  return { ok: true, posted: today() };
}
async function hlArt(env, me, assetId) {
  assetId = String(assetId || '').replace(/\D/g, '');
  const d = (await hlDesigns(env)).find(x => x.art.id === assetId && (x.status === 'live' || me.row.admin));
  if (!d) return fail('Not found', 404);
  const ck = new Request('https://manager-portal.cache/hlart/' + assetId), cache = caches.default;
  const head = { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  const hit = await cache.match(ck);
  if (hit) return new Response(hit.body, { headers: Object.assign(head, { 'Content-Type': hit.headers.get('Content-Type') || 'image/png' }) });
  let r = await fetch(d.art.url);
  if (!r.ok) { forget('hlDesigns'); const d2 = (await hlDesigns(env)).find(x => x.art.id === assetId); if (d2) r = await fetch(d2.art.url); }
  if (!r.ok) return fail('Could not load the design', 502);
  const type = r.headers.get('Content-Type') || 'image/png', buf = await r.arrayBuffer();
  try { await cache.put(ck, new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000' } })); } catch (e) {}
  return new Response(buf, { headers: Object.assign(head, { 'Content-Type': type }) });
}
// ---------- welcome posts: Stewart's announcement for a new hire, made by Marketing Tools ----------
// Marketing Tools puts it in the "Welcome Post" file column on the Main Employee Sheet (it never goes to the new hire's own portal).
// Their manager sees it on the home page until they mark it posted ("Welcome Posted" column).
async function welcomeAssets(env, ids) {
  const eb = await bid(env, 'employees'), ec = await columns(env, eb), col = ec.byTitle[nk('Welcome Post')];
  if (!col || !ids.length) return {};
  return cached('welcome:' + ids.slice().sort().join(',').slice(0, 2000), 5 * 60e3, async () => {
    const out = {};
    for (let i = 0; i < ids.length; i += 100) {
      const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i,limit:100){id assets(column_ids:$c){id name public_url created_at}}}', { i: ids.slice(i, i + 100).map(String), c: [col.id] });
      (d.items || []).forEach(it => { const a = (it.assets || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0]; if (a) out[String(it.id)] = { id: String(a.id), url: a.public_url, at: a.created_at, name: a.name }; });
    }
    return out;
  });
}
async function welcomeList(env, me) {
  const team = teamOf(me).filter(p => p.welcome);
  const a = await welcomeAssets(env, team.map(p => p.id));
  return { items: team.filter(p => a[p.id]).map(p => ({ id: p.id, name: p.name, title: p.title, company: p.company, start: p.start || '', posted: p.welcomePosted || '',
    img: 'api/welcome/' + p.id + '?v=' + a[p.id].id, made: String(a[p.id].at || '').slice(0, 10) })).sort((x, y) => String(y.made).localeCompare(String(x.made))) };
}
async function welcomeImg(env, me, id) {
  id = String(id || '').replace(/\D/g, '');
  if (!teamOf(me).some(p => String(p.id) === id)) return fail('Not found', 404);
  const a = (await welcomeAssets(env, [id]))[id];
  if (!a) return fail('No welcome post', 404);
  const ck = new Request('https://manager-portal.cache/welcome/' + a.id), cache = caches.default;
  const head = { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  const hit = await cache.match(ck);
  if (hit) return new Response(hit.body, { headers: Object.assign(head, { 'Content-Type': hit.headers.get('Content-Type') || 'image/png' }) });
  let r = await fetch(a.url);
  if (!r.ok) { forget('welcome:'); const b = (await welcomeAssets(env, [id]))[id]; if (b) r = await fetch(b.url); }
  if (!r.ok) return fail('Could not load the welcome post', 502);
  const type = r.headers.get('Content-Type') || 'image/png', buf = await r.arrayBuffer();
  try { await cache.put(ck, new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000' } })); } catch (e) {}
  return new Response(buf, { headers: Object.assign(head, { 'Content-Type': type }) });
}
async function welcomeMark(env, me, body) {
  const who = teamOf(me).find(p => String(p.id) === String(body.id));
  if (!who) return { error: 'You can only mark posts for people on your team.' };
  const eb = await bid(env, 'employees');
  let ec = await columns(env, eb), col = ec.byTitle[nk('Welcome Posted')];
  if (!col) { await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:text){id}}', { b: String(eb), t: 'Welcome Posted' }); forget('cols:' + eb); ec = await columns(env, eb); col = ec.byTitle[nk('Welcome Posted')]; }
  const v = body.posted ? 'Posted ' + today() + ' by ' + byName(me) : '';
  const vals = {}; vals[col.id] = v;
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: String(eb), i: String(who.id), v: JSON.stringify(vals) });
  who.welcomePosted = v;
  return { ok: true, posted: v };
}
// ---------- new hire package looks: the "New Hire Packages" board, kept in step by Marketing Tools from 2_Templates/0_New Hire ----------
async function packages(env) {
  return cached('pkgs', 300e3, async () => {
    let id; try { id = await boardId(env, 'New Hire Packages', 'PACKAGES_BOARD_ID'); } catch (e) { forget('board:New Hire Packages'); return []; }
    const c = await columns(env, id), col = t => (c.byTitle[nk(t)] || {}).id;
    const ids = ['Description', 'Pieces', 'Posts', 'Package Status', 'Order'].map(col).filter(Boolean);
    const d = await gql(env, 'query($b:[ID!],$c:[String!]){boards(ids:$b){items_page(limit:100){items{id name column_values(ids:$c){id text} assets{id name file_extension public_url created_at}}}}}', { b: [id], c: ids });
    return d.boards[0].items_page.items.map(it => {
      const v = {}; it.column_values.forEach(x => v[x.id] = (x.text || '').trim());
      // the look's posts, in upload order ("1 - Announcement.png", "2 - I've Made a Move.png")
      const imgs = (it.assets || []).filter(x => /png|jpe?g/i.test(x.file_extension || '')).sort((x, y) => String(x.name).localeCompare(String(y.name), undefined, { numeric: true }))
        .map(x => ({ id: String(x.id), url: x.public_url, label: String(x.name || '').replace(/\.\w+$/, '').replace(/^\d+\s*-\s*/, '').replace(/\s+preview$/i, '') }));
      return { name: it.name.trim(), about: v[col('Description')] || '', pieces: [],
        status: (v[col('Package Status')] || '').toLowerCase(), order: Number(v[col('Order')]) || 99, imgs: imgs, img: imgs[0] || null };
    }).filter(x => x.img && x.status !== 'retired').sort((x, y) => x.order - y.order || x.name.localeCompare(y.name));
  });
}
async function packageList(env, me) {
  const all = await packages(env).catch(() => []);
  return { packages: all.filter(x => x.status === 'live' || me.row.admin).map(x => ({ name: x.name, about: x.about, pieces: x.pieces, notReady: x.status !== 'live', img: 'api/pkgimg/' + x.img.id, imgs: x.imgs.map(i => ({ src: 'api/pkgimg/' + i.id, label: i.label })) })) };
}
async function packageImg(env, me, assetId) {
  assetId = String(assetId || '').replace(/\D/g, '');
  const findImg = list => { for (const p of list) { const i = p.imgs.find(z => z.id === assetId); if (i) return i; } return null; };
  let x = findImg(await packages(env));
  if (!x) return fail('Not found', 404);
  const ck = new Request('https://manager-portal.cache/pkgimg/' + assetId), cache = caches.default;
  const head = { 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  const hit = await cache.match(ck);
  if (hit) return new Response(hit.body, { headers: Object.assign({ 'Content-Type': hit.headers.get('Content-Type') || 'image/png' }, head) });
  let r = await fetch(x.url);
  if (!r.ok) { forget('pkgs'); x = findImg(await packages(env)); if (x) r = await fetch(x.url); }
  if (!r.ok) return fail('Could not load the preview', 502);
  const type = r.headers.get('Content-Type') || 'image/png', buf = await r.arrayBuffer();
  try { await cache.put(ck, new Response(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=2592000' } })); } catch (e) {}
  return new Response(buf, { headers: Object.assign({ 'Content-Type': type }, head) });
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
  }, { shared: true });
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
    const r = await nlAdd(env, who, body.header, body.location, byName(me));
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
      await addUpdate(env, row.id, (body.active ? 'Turned back on' : 'Turned off') + ' by ' + escHtml(byName(me)) + ' in the Manager Portal ' + today()).catch(() => {});
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
  }, { shared: true });
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

// ---------- full onboarding: each manager's checklist for a new hire, kept on the "Manager Onboarding" board ----------
// One row per new hire (Data = which items are done / emailed), plus one "Contacts" row per manager (who each email goes to).
const ONB_NAME = 'Manager Onboarding';
const ONB_COLS = [['Kind', 'text'], ['Manager', 'text'], ['Manager Email', 'text'], ['Title', 'text'], ['Start Date', 'text'], ['Progress', 'text'], ['Data', 'long_text']];
async function onbBoard(env) {
  return cached('onbBoard', 3600e3, async () => {
    let id = env.ONBOARDING_BOARD_ID ? String(env.ONBOARDING_BOARD_ID) : '';
    if (!id) { try { id = await boardId(env, ONB_NAME, 'ONBOARDING_BOARD_ID'); } catch (e) { forget('board:' + ONB_NAME); } }
    if (!id) {
      const ws = await wsWest(env);
      id = String((await gql(env, 'mutation($n:String!,$w:ID,$d:String){create_board(board_name:$n,board_kind:private,workspace_id:$w,description:$d){id}}',
        { n: ONB_NAME, w: ws, d: 'Full onboarding checklists from the Manager Portal. One row per new hire, plus a Contacts row per manager. Kept up to date by the portal.' })).create_board.id);
    }
    let cols = await columns(env, id);
    const missing = ONB_COLS.filter(([t]) => !cols.byTitle[nk(t)]);
    for (const [t, type] of missing) await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:' + type + '){id}}', { b: id, t });
    if (missing.length) { forget('cols:' + id); cols = await columns(env, id); }
    const col = {}; ONB_COLS.forEach(([t]) => col[t] = cols.byTitle[nk(t)].id);
    return { id, col };
  });
}
async function onbRows(env, b) {
  const items = await allItems(env, b.id, Object.values(b.col));
  return items.map(it => {
    const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
    let data = {}; try { data = JSON.parse(v[b.col.Data] || '{}') || {}; } catch (e) {}
    return { id: String(it.id), name: it.name.trim(), kind: v[b.col.Kind] || 'hire', manager: v[b.col.Manager], managerEmail: (v[b.col['Manager Email']] || '').toLowerCase(),
      title: v[b.col.Title], start: v[b.col['Start Date']], progress: v[b.col.Progress], data, raw: v[b.col.Data] || '', created: it.created_at };
  });
}
async function onbList(env, me) {
  const b = await onbBoard(env), rows = await onbRows(env, b);
  const mine = r => r.managerEmail === me.email;
  const contacts = (rows.find(r => r.kind === 'contacts' && mine(r)) || {}).data || {};
  const hires = rows.filter(r => r.kind !== 'contacts' && r.kind !== 'steps' && inScope(me, r.managerEmail)).sort((a, b) => String(b.start || '').localeCompare(String(a.start || ''))).map(({ raw, ...r }) => r);
  // each manager's own onboarding steps (none = the standard steps), for everyone whose new hires this person sees
  const steps = {};
  new Set(rows.filter(r => r.kind === 'steps' && inScope(me, r.managerEmail)).map(r => r.managerEmail)).forEach(em => { const L = onbStepsOf(rows, em); if (L) steps[em] = L; });
  return { hires, contacts, steps };
}
// A manager's steps are kept as JSON split over one or more "Steps" rows (a monday text box holds about 2,000 characters); Progress = the part number.
const onbStepRows = (rows, em) => rows.filter(r => r.kind === 'steps' && r.managerEmail === em).sort((a, b) => (+a.progress || 0) - (+b.progress || 0));
function onbStepsOf(rows, em) {
  const parts = onbStepRows(rows, em); if (!parts.length) return null;
  try { const L = JSON.parse(parts.map(r => r.raw).join('')); return Array.isArray(L) && L.length ? L : null; } catch (e) { return null; }
}
// keep only what the page uses, with sensible limits; Marketing setup is always in the list, as just its key
function onbCleanSteps(list) {
  const txt = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
  const key = (x, p) => /^[a-z0-9]{1,12}$/i.test(String(x || '')) ? String(x) : p + Math.random().toString(36).slice(2, 8);
  const num = (x, lo, hi) => Math.min(hi, Math.max(lo, parseInt(x, 10) || 0));
  const seen = new Set(), out = [];
  for (const s of (Array.isArray(list) ? list : []).slice(0, 24)) {
    if (!s) continue;
    if (s.k === 'mkt') { if (!seen.has('mkt')) { seen.add('mkt'); out.push({ k: 'mkt' }); } continue; }
    let k = key(s.k, 's'); if (seen.has(k)) k = key('', 's'); seen.add(k);
    const w = s.w || {}, W = w.x === 'before' || w.x === 'after' ? { x: w.x, n: num(w.n, 0, 365) } : w.x === 'day' ? { x: 'day', a: num(w.a, 1, 60), b: num(w.b, 0, 60) } : { x: 'text', t: txt(w.t, 60) };
    if (W.x === 'day' && W.b <= W.a) delete W.b;
    const ik = new Set(), items = [];
    for (const it of (Array.isArray(s.items) ? s.items : []).slice(0, 40)) {
      const t = txt(it && it.t, 90); if (!t) continue;
      let k2 = key(it.k, 'i'); if (ik.has(k2)) k2 = key('', 'i'); ik.add(k2);
      const o = { k: k2, t };
      if (it.who && /^[a-z]{1,12}$/.test(it.who)) { o.who = it.who; if (txt(it.ask, 120)) o.ask = txt(it.ask, 120); }
      if (txt(it.note, 60)) o.note = txt(it.note, 60);
      if (it.day != null && it.day !== '') o.day = num(it.day, 0, 365);
      items.push(o);
    }
    const t = txt(s.t, 60); if (t && items.length) out.push({ k, t, w: W, items });
  }
  if (!seen.has('mkt')) out.splice(Math.min(1, out.length), 0, { k: 'mkt' });
  return out;
}
async function onbChange(env, me, body) {
  const b = await onbBoard(env), C = b.col;
  const txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 200);
  const own = async id => {
    const d = await gql(env, 'query($i:[ID!]){items(ids:$i){id board{id} column_values(ids:["' + C['Manager Email'] + '"]){text}}}', { i: [String(id)] });
    const it = d.items[0];
    if (!it || String(it.board.id) !== b.id) return false;
    return inScope(me, it.column_values[0].text);
  };
  const set = (id, vals) => gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: String(id), v: JSON.stringify(vals) });
  if (body.op === 'create') {
    const name = txt(body.name, 120); if (!name) return { error: 'Add the new hire’s name.' };
    const vals = {}; vals[C.Kind] = 'hire'; vals[C.Manager] = me.row.name; vals[C['Manager Email']] = me.email; vals[C.Title] = txt(body.title); vals[C['Start Date']] = txt(body.start, 10); vals[C.Progress] = '0';
    vals[C.Data] = { text: '{}' };
    const id = await createItem(env, b.id, null, name, vals);
    return { ok: true, hire: { id: String(id), name, kind: 'hire', manager: me.row.name, managerEmail: me.email, title: vals[C.Title], start: vals[C['Start Date']], progress: '0', data: {} } };
  }
  if (body.op === 'save') {
    if (!(await own(body.id))) return { error: 'That onboarding isn’t yours to change.' };
    const data = JSON.stringify(body.data || {}); if (data.length > 1900) return { error: 'Too much to save at once.' };
    const vals = {}; vals[C.Data] = { text: data }; vals[C.Progress] = txt(body.progress, 20);
    if (body.title != null) vals[C.Title] = txt(body.title); if (body.start != null) vals[C['Start Date']] = txt(body.start, 10);
    await set(body.id, vals);
    if (body.name) await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: String(body.id), v: JSON.stringify({ name: txt(body.name, 120) }) });
    return { ok: true };
  }
  if (body.op === 'remove') {
    if (!(await own(body.id))) return { error: 'That onboarding isn’t yours to remove.' };
    await gql(env, 'mutation($i:ID!){archive_item(item_id:$i){id}}', { i: String(body.id) });
    return { ok: true };
  }
  if (body.op === 'contacts') {
    const rows = await onbRows(env, b), row = rows.find(r => r.kind === 'contacts' && r.managerEmail === me.email);
    const clean = {}; Object.entries(body.contacts || {}).slice(0, 20).forEach(([k, v]) => { clean[txt(k, 20)] = { name: txt(v && v.name, 60), email: txt(v && v.email, 120) }; });
    const data = JSON.stringify(clean); if (data.length > 1900) return { error: 'Too many contacts.' };
    if (row) { const vals = {}; vals[C.Data] = { text: data }; await set(row.id, vals); }
    else { const vals = {}; vals[C.Kind] = 'contacts'; vals[C.Manager] = me.row.name; vals[C['Manager Email']] = me.email; vals[C.Data] = { text: data }; await createItem(env, b.id, null, 'Contacts · ' + me.row.name, vals); }
    return { ok: true, contacts: clean };
  }
  if (body.op === 'steps') {   // a manager's own onboarding steps; null = back to the standard steps
    const rows = await onbRows(env, b), old = onbStepRows(rows, me.email);
    const steps = body.steps == null ? null : onbCleanSteps(body.steps);
    const json = steps ? JSON.stringify(steps) : '', parts = [];
    for (let i = 0; i < json.length; i += 1900) parts.push(json.slice(i, i + 1900));
    if (parts.length > 12) return { error: 'That’s too many steps and items to save.' };
    for (let i = 0; i < parts.length; i++) {
      const vals = {}; vals[C.Data] = { text: parts[i] }; vals[C.Progress] = String(i + 1);
      if (old[i]) await set(old[i].id, vals);
      else { vals[C.Kind] = 'steps'; vals[C.Manager] = me.row.name; vals[C['Manager Email']] = me.email; await createItem(env, b.id, null, 'Steps · ' + me.row.name + (i ? ' · ' + (i + 1) : ''), vals); }
    }
    for (const r of old.slice(parts.length)) await gql(env, 'mutation($i:ID!){archive_item(item_id:$i){id}}', { i: String(r.id) });
    return { ok: true, steps };
  }
  return { error: 'Unknown change.' };
}

// ---------- open a team member's My Marketing page, read only ----------
// A 5-minute pass signed with a key My Marketing can make too (VIEW_AS_SECRET if set on both sites, otherwise the shared monday token).
const MY_MARKETING = 'https://my-marketing.keving-stewart.workers.dev';
async function viewAsLink(env, me, id) {
  const who = teamOf(me).find(p => String(p.id) === String(id));
  if (!who) return { error: 'You can only open your own team’s pages.' };
  const pc = await portalCols(env), cols = await columns(env, pc.id);
  const person = Object.values(cols.byTitle).find(c => c.type === 'people');
  if (!pc.emp || !person) return { error: 'Couldn’t read the Employee Marketing Portal board.' };
  const d = await gql(env, 'query($b:ID!,$c:String!,$v:[String]!,$p:[String!]){items_page_by_column_values(board_id:$b,limit:50,columns:[{column_id:$c,column_values:$v}]){items{column_values(ids:$p){value}}}}',
    { b: String(pc.id), c: pc.emp.id, v: [who.name], p: [person.id] });
  let uid = '';
  for (const it of ((d.items_page_by_column_values || {}).items || [])) {
    try { const pp = (JSON.parse(it.column_values[0].value || '{}').personsAndTeams || []).find(x => x.kind === 'person'); if (pp) { uid = String(pp.id); break; } } catch (e) {}
  }
  if (!uid) return { error: who.name + ' isn’t set up on the Employee Marketing Portal yet, so there’s no My Marketing page to show.' };
  const enc = new TextEncoder(), b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode((env.VIEW_AS_SECRET || '') + '|view-as|' + env.MONDAY_TOKEN));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const body = b64u(enc.encode(JSON.stringify({ uid, name: who.name, by: me.email, exp: Date.now() + 5 * 60e3 })));
  const sig = b64u(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return { url: (env.MY_MARKETING_URL || MY_MARKETING) + '/api/viewas?t=' + body + '.' + sig };
}

// ---------- Content ideas: managers suggest topics for West Marketing's monthly planning meeting ----------
// One row per idea on the private "Content Ideas" board (Stewart West Marketing workspace), shared with Stewart Marketing Tools
// (Projects › Plan › Idea box). The marketing team sets Status: New, Planned (with Planned For), In library or Passed.
const ID_NAME = 'Content Ideas';
const ID_COLS = [['Market', 'text'], ['Note', 'long_text'], ['From', 'text'], ['From Email', 'text'], ['Source', 'text'], ['Status', 'text'], ['Planned For', 'text'], ['Topic', 'text'], ['Added', 'text']];
async function ideaBoard(env) {
  return cached('ideaBoard', 3600e3, async () => {
    const ws = await wsWest(env);
    const bs = await gql(env, 'query($w:[ID!]){boards(workspace_ids:$w,state:active,limit:500){id name}}', { w: [ws] });
    let id = env.IDEAS_BOARD_ID ? String(env.IDEAS_BOARD_ID) : ((bs.boards || []).find(x => nk(x.name) === nk(ID_NAME)) || {}).id;
    if (!id) id = (await gql(env, 'mutation($n:String!,$w:ID,$d:String){create_board(board_name:$n,board_kind:private,workspace_id:$w,description:$d){id}}',
      { n: ID_NAME, w: ws, d: 'Topic ideas for marketing content, from managers (Manager Portal) and the marketing team (Stewart Marketing Tools › Projects › Plan). Looked at in the monthly planning meeting.' })).create_board.id;
    id = String(id);
    let cols = await columns(env, id);
    const missing = ID_COLS.filter(([t]) => !cols.byTitle[nk(t)]);
    for (const [t, type] of missing) await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:' + type + '){id}}', { b: id, t });
    if (missing.length) { forget('cols:' + id); cols = await columns(env, id); }
    const col = {}; ID_COLS.forEach(([t]) => col[t] = cols.byTitle[nk(t)].id);
    return { id, col };
  });
}
async function ideaList(env, me) {
  const b = await ideaBoard(env);
  const items = await allItems(env, b.id, Object.values(b.col));
  const rows = items.map(it => {
    const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
    return { id: String(it.id), idea: it.name.trim(), market: v[b.col.Market] || 'Both', note: v[b.col.Note], from: v[b.col.From], fromEmail: (v[b.col['From Email']] || '').toLowerCase(), source: v[b.col.Source],
      status: v[b.col.Status] || 'New', plannedFor: v[b.col['Planned For']], topic: v[b.col.Topic], added: v[b.col.Added] || String(it.created_at || '').slice(0, 10) };
  });
  // each manager sees the ideas they (or their assistant) sent; presidents see their managers' too
  const mine = rows.filter(r => r.source === 'Manager Portal' && inScope(me, r.fromEmail));
  return { ideas: mine.sort((a, b) => String(b.added).localeCompare(String(a.added))).slice(0, 30) };
}
async function ideaAdd(env, me, body) {
  const idea = String(body.idea || '').trim().slice(0, 200);
  if (idea.length < 4) return { error: 'Type your idea first.' };
  const market = ['Both', 'California', 'Tucson'].includes(body.market) ? body.market : 'Both';
  const b = await ideaBoard(env), v = {};
  v[b.col.Market] = market; v[b.col.From] = byName(me); v[b.col['From Email']] = me.email; v[b.col.Source] = 'Manager Portal'; v[b.col.Status] = 'New'; v[b.col.Added] = today();
  const note = String(body.note || '').trim().slice(0, 2000); if (note) v[b.col.Note] = { text: note };
  const id = await createItem(env, b.id, null, idea, v);
  return { ok: true, id: String(id) };
}

// ---------- Recruiting: sample marketing for a candidate ----------
// One row per candidate on the private "Manager Portal Recruiting" board (Stewart West Marketing workspace), made by the portal the
// first time it's used. The samples themselves are drawn on screen from samples.js - nothing is saved but this row.
// "Not hiring" deletes the row (and its photo); rows older than REC_DAYS are deleted the next time anyone opens Recruiting.
const REC_NAME = 'Manager Portal Recruiting', REC_DAYS = 60;
const REC_COLS = [['Manager', 'text'], ['Manager Email', 'text'], ['Title', 'text'], ['Area', 'text'], ['Phone', 'text'], ['Email', 'text'], ['Company', 'text'], ['Added', 'text'], ['Photo', 'file'], ['Work Email', 'text'], ['Work Phone', 'text'], ['Files', 'file']];
async function recBoard(env) {
  return cached('recBoard', 3600e3, async () => {
    let id = env.RECRUITING_BOARD_ID ? String(env.RECRUITING_BOARD_ID) : '';
    if (!id) { try { id = await boardId(env, REC_NAME, 'RECRUITING_BOARD_ID'); } catch (e) { forget('board:' + REC_NAME); } }
    if (!id) id = String((await gql(env, 'mutation($n:String!,$w:ID,$d:String){create_board(board_name:$n,board_kind:private,workspace_id:$w,description:$d){id}}',
      { n: REC_NAME, w: await wsWest(env), d: 'Candidates managers are recruiting, from the Manager Portal. Used only to show a candidate sample marketing. Kept private; rows are deleted when a manager clicks Not hiring, or after ' + REC_DAYS + ' days.' })).create_board.id);
    let cols = await columns(env, id);
    const missing = REC_COLS.filter(([t]) => !cols.byTitle[nk(t)]);
    for (const [t, type] of missing) await gql(env, 'mutation($b:ID!,$t:String!){create_column(board_id:$b,title:$t,column_type:' + type + '){id}}', { b: id, t });
    if (missing.length) { forget('cols:' + id); cols = await columns(env, id); }
    const col = {}; REC_COLS.forEach(([t]) => col[t] = cols.byTitle[nk(t)].id);
    return { id, col };
  });
}
async function recRows(env, b) {
  const items = await allItems(env, b.id, Object.values(b.col));
  return items.map(it => {
    const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
    return { id: String(it.id), name: it.name.trim(), manager: v[b.col.Manager], managerEmail: (v[b.col['Manager Email']] || '').toLowerCase(), title: v[b.col.Title], area: v[b.col.Area],
      phone: v[b.col.Phone], email: v[b.col.Email], company: v[b.col.Company], workEmail: v[b.col['Work Email']], workPhone: v[b.col['Work Phone']], added: v[b.col.Added] || String(it.created_at || '').slice(0, 10), photo: !!v[b.col.Photo] };
  });
}
async function recList(env, me) {
  const b = await recBoard(env);
  let rows = await recRows(env, b);
  const old = rows.filter(r => r.added && r.added < addDays(today(), -REC_DAYS));
  for (const r of old) { try { await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: r.id }); } catch (e) {} }
  if (old.length) rows = rows.filter(r => !old.includes(r));
  let mine = rows.filter(r => r.managerEmail && inScope(me, r.managerEmail));
  // rows with no manager are emails forwarded to the board's email address: file the ones this person sent
  const fwd = await recForwards(env, me, b, rows.filter(r => !r.managerEmail), mine).catch(e => ({ moved: 0, waiting: [], err: String(e.message || e) }));
  if (fwd.moved) mine = (await recRows(env, b)).filter(r => r.managerEmail && inScope(me, r.managerEmail));
  const out = { days: REC_DAYS, candidates: mine.sort((a, b) => String(b.added).localeCompare(String(a.added))), forwarded: fwd.waiting, moved: fwd.moved };
  if (me.row.admin) out.board = await recBoardInfo(env, b.id).catch(() => null);
  return out;
}
// ---------- Emails forwarded from a phone to the Recruiting board's email address ----------
// monday makes a row named after the subject, with the email as its first update and the attachments on it.
// The portal moves each one onto the candidate it's about (matched by their email address, or their name), then deletes the row.
const recSenders = me => [me.email, me.assistant && me.assistant.email].filter(Boolean).map(x => String(x).toLowerCase());
async function recFwdItems(env, ids) {
  if (!ids.length) return [];
  const d = await gql(env, 'query($i:[ID!]){items(ids:$i){id name created_at creator{name email} assets{id name public_url file_size} updates(limit:10){id text_body created_at creator{name email} assets{id name public_url file_size}}}}', { i: ids.map(String) });
  return (d.items || []).map(it => {
    const ups = (it.updates || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const assets = []; const seen = {};
    [it.assets || []].concat(ups.map(u => u.assets || [])).flat().forEach(a => { if (a && a.public_url && !seen[a.id]) { seen[a.id] = 1; assets.push(a); } });
    const by = it.creator || (ups[0] && ups[0].creator) || {};
    return { id: String(it.id), subject: String(it.name || '').replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').trim(), text: unEnt(ups[0] ? ups[0].text_body : '').replace(/^\s*signatureImage\s*$/gim, '').trim(),
      sender: String(by.email || '').toLowerCase(), senderName: by.name || '', at: it.created_at || '', assets };
  });
}
// the original sender, from the forwarded header ("From: Name <email>"); otherwise the person who forwarded it
function recFwdFrom(f) {
  const m = f.text.match(/From:\s*"?([^"<\n]*?)"?\s*<?([^\s<>@]+@[^\s<>]+?)>?\s*(\n|$|Sent:|Date:)/i);
  const date = (f.text.match(/(?:Sent|Date):\s*([^\n]+)/i) || [])[1];
  const d = date ? new Date(date.replace(/ at /i, ' ')) : null;
  return { name: m ? m[1].trim() : f.senderName, email: m ? m[2].toLowerCase() : f.sender, date: d && !isNaN(d) ? d.toISOString() : f.at };
}
function recFwdMatch(f, cands) {
  const hay = (f.subject + '\n' + f.text).toLowerCase();
  const byMail = cands.filter(c => [c.email, c.workEmail].some(e => e && hay.includes(String(e).toLowerCase())));
  if (byMail.length === 1) return byMail[0];
  if (byMail.length > 1) return null;
  const byName = cands.filter(c => c.name && hay.includes(c.name.toLowerCase()));
  return byName.length === 1 ? byName[0] : null;
}
// new contact details from the email: their address, and the last phone number near the end of their part of it
function recFwdDetails(f, c, from) {
  const det = {}, ours = e => /@stewart\.com$/i.test(e || '') || e === f.sender;
  const known = [c.email, c.workEmail].map(x => String(x || '').toLowerCase());
  if (from.email && !ours(from.email) && !known.includes(from.email)) det[c.email ? 'workEmail' : 'email'] = from.email;
  if (from.email && !ours(from.email)) {
    const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const body = f.text.slice(Math.max(0, f.text.search(/From:\s/i)));
    const p = (body.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []).map(digits).filter(x => x.length === 10 && x !== digits(c.phone) && x !== digits(c.workPhone))[0];
    if (p) det[c.phone ? 'workPhone' : 'phone'] = '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6);
  }
  return det;
}
async function recFwdFile(env, b, f, c, by) {
  const from = recFwdFrom(f), saved = [];
  for (const a of f.assets.slice(0, 10)) {
    // skip signature pictures Outlook adds (image001.png, signatureImage, Outlook-abc.png)
    if ((a.file_size || 0) > 25e6 || (/^(image\d+|signatureimage[\w-]*|outlook-[\w-]+)(\.(png|jpe?g|gif))?$/i.test(a.name) && (a.file_size || 0) < 80e3)) continue;
    try { const r = await fetch(a.public_url); if (!r.ok) continue; await addFile(env, c.id, b.col.Files, new File([await r.arrayBuffer()], a.name, { type: r.headers.get('Content-Type') || 'application/octet-stream' })); saved.push(String(a.name).slice(0, 150)); } catch (e) {}
  }
  const det = recFwdDetails(f, c, from), keys = { phone: 'Phone', email: 'Email', workPhone: 'Work Phone', workEmail: 'Work Email' }, vals = {};
  for (const k in det) vals[b.col[keys[k]]] = det[k];
  if (Object.keys(vals).length) await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: c.id, v: JSON.stringify(vals) });
  const entry = { text: f.text.slice(0, 3000), by, at: new Date().toISOString(), mail: { subject: f.subject.slice(0, 200), from: [from.name, from.email ? '<' + from.email + '>' : ''].filter(Boolean).join(' ').slice(0, 160), date: from.date }, files: saved, via: 'forward' };
  await gql(env, 'mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}', { i: c.id, b: escHtml('[portal:note] ' + JSON.stringify(entry)) });
  await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: f.id });
}
async function recForwards(env, me, b, fwdRows, mine) {
  const senders = recSenders(me), out = { moved: 0, waiting: [] };
  if (!fwdRows.length) return out;
  const items = (await recFwdItems(env, fwdRows.map(r => r.id))).filter(f => senders.includes(f.sender));
  for (const f of items) {
    const c = recFwdMatch(f, mine);
    if (c) { await recFwdFile(env, b, f, c, byName(me)); out.moved++; }
    else { const from = recFwdFrom(f); out.waiting.push({ id: f.id, subject: f.subject, from: [from.name, from.email].filter(Boolean).join(' · '), at: f.at, files: f.assets.length }); }
  }
  return out;
}
// file a forwarded email the portal couldn't match, or delete it
async function recForwardAct(env, me, body) {
  const b = await recBoard(env), fid = String((body && body.fid) || '').replace(/\D/g, '');
  const f = (await recFwdItems(env, fid ? [fid] : []))[0];
  if (!f || !recSenders(me).includes(f.sender)) return { error: 'That forwarded email is already gone.' };
  const rows = await recRows(env, b);
  if (rows.find(r => r.id === f.id && r.managerEmail)) return { error: 'That isn’t a forwarded email.' };
  if (body.remove) { await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: f.id }); return { ok: true }; }
  const c = rows.find(r => r.id === String(body.cid) && r.managerEmail && inScope(me, r.managerEmail));
  if (!c) return { error: 'Pick one of your candidates.' };
  await recFwdFile(env, b, f, c, byName(me));
  return { ok: true };
}
// for Portal Admins: where the board is, so it can be found in monday.com
async function recBoardInfo(env, id) {
  const d = await gql(env, 'query($b:[ID!]){me{account{slug}} boards(ids:$b){name workspace{id name}}}', { b: [id] });
  const bd = (d.boards || [])[0] || {}, ws = bd.workspace || null, slug = ((d.me || {}).account || {}).slug;
  return { id, name: bd.name || REC_NAME, url: slug ? 'https://' + slug + '.monday.com/boards/' + id : '', workspace: ws ? ws.name : 'Main workspace', inWest: !!(ws && isWest(ws.name)) };
}
async function recOwn(env, me, id) {
  id = String(id || '').replace(/\D/g, '');
  if (!id) return null;
  const b = await recBoard(env);
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){id name board{id} column_values(ids:$c){id text}}}', { i: [id], c: Object.values(b.col) });
  const it = (d.items || [])[0];
  if (!it || String(it.board.id) !== b.id) return null;
  const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
  return inScope(me, v[b.col['Manager Email']]) ? { id, name: it.name.trim(), b } : null;
}
async function recAdd(env, me, fd) {
  const f = JSON.parse(fd.get('fields') || '{}');
  const txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 120);
  const name = [txt(f.firstName, 60), txt(f.lastName, 60)].filter(Boolean).join(' ');
  if (!name) return { error: 'Add the candidate’s first and last name.' };
  const b = await recBoard(env), C = b.col, vals = {};
  vals[C.Manager] = me.row.name; vals[C['Manager Email']] = me.email; vals[C.Title] = txt(f.title); vals[C.Area] = txt(f.area);
  vals[C.Phone] = txt(f.phone, 40); vals[C.Email] = txt(f.email, 120); vals[C.Company] = txt(f.company); vals[C.Added] = today();
  const id = String(await createItem(env, b.id, null, name, vals));
  const photo = fd.get('photo');
  if (photo && typeof photo !== 'string' && photo.size) {
    if (photo.size > 8e6) return { ok: true, id, warn: 'The photo was too big to save (8 MB at most).' };
    try { await addFile(env, id, C.Photo, photo); } catch (e) { return { ok: true, id, warn: 'The photo didn’t save: ' + String(e.message || e) }; }
  }
  await addUpdate(env, id, 'Added in the Manager Portal by ' + escHtml(byName(me)) + '. Used only for sample marketing; delete this row to remove the candidate.').catch(() => {});
  return { ok: true, id };
}
async function recRemove(env, me, id) {
  const r = await recOwn(env, me, id);
  if (!r) return { error: 'That candidate isn’t yours to remove.' };
  await gql(env, 'mutation($i:ID!){delete_item(item_id:$i){id}}', { i: r.id });
  return { ok: true };
}
// Edit a candidate's details from their page (name and text columns; the photo stays as it is).
async function recEdit(env, me, body) {
  const r = await recOwn(env, me, body && body.id);
  if (!r) return { error: 'That candidate isn’t yours to change.' };
  const f = body.fields || {}, C = r.b.col, txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 120);
  const name = [txt(f.firstName, 60), txt(f.lastName, 60)].filter(Boolean).join(' ');
  if (!name) return { error: 'Add the candidate’s first and last name.' };
  const vals = { name };
  vals[C.Title] = txt(f.title); vals[C.Area] = txt(f.area); vals[C.Phone] = txt(f.phone, 40); vals[C.Email] = txt(f.email, 120); vals[C.Company] = txt(f.company);
  vals[C['Work Email']] = txt(f.workEmail, 120); vals[C['Work Phone']] = txt(f.workPhone, 40);
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: r.b.id, i: r.id, v: JSON.stringify(vals) });
  return { ok: true };
}
// Meetings and notes are kept as updates on the candidate's row ("[portal:meeting] {...}"), so they go when the row goes.
const REC_LOG = /^\s*\[portal:(meeting|note)\]\s*/;
const unEnt = s => String(s || '').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
async function recUpdates(env, id) {
  const d = await gql(env, 'query($i:[ID!]){items(ids:$i){updates(limit:100){id text_body created_at}}}', { i: [String(id)] });
  return (((d.items || [])[0] || {}).updates || []);
}
async function recLog(env, me, id) {
  const r = await recOwn(env, me, id);
  if (!r) return { error: 'That candidate isn’t yours.' };
  const meetings = [], notes = [];
  for (const u of await recUpdates(env, r.id)) {
    const t = unEnt(u.text_body), k = t.match(REC_LOG);
    if (!k) continue;
    let o; try { o = JSON.parse(t.replace(REC_LOG, '')); } catch (e) { continue; }
    o.id = String(u.id); o.at = o.at || u.created_at;
    (k[1] === 'meeting' ? meetings : notes).push(o);
  }
  meetings.sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
  notes.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return { meetings, notes, files: await recFiles(env, r.b, r.id) };
}
async function recLogAdd(env, me, body) {
  const r = await recOwn(env, me, body && body.id);
  if (!r) return { error: 'That candidate isn’t yours.' };
  const d = body.data || {}, txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 120);
  let o;
  if (body.kind === 'note') {
    o = { text: txt(d.text, 3000), by: byName(me), at: new Date().toISOString() };
    if (!o.text) return { error: 'Write a note first.' };
  } else if (body.kind === 'meeting') {
    o = { type: txt(d.type, 40) || 'Meeting', date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '', time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '',
      where: txt(d.where, 200), who: txt(d.who, 200), notes: txt(d.notes, 1000), done: !!d.done, by: byName(me), at: new Date().toISOString() };
    if (!o.date) return { error: 'Pick a date for the meeting.' };
  } else return { error: 'Unknown entry.' };
  const res = await gql(env, 'mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}', { i: r.id, b: escHtml('[portal:' + body.kind + '] ' + JSON.stringify(o)) });
  o.id = String(res.create_update.id);
  return { ok: true, entry: o };
}
async function recLogRemove(env, me, body) {
  const r = await recOwn(env, me, body && body.id);
  if (!r) return { error: 'That candidate isn’t yours.' };
  const u = (await recUpdates(env, r.id)).find(x => String(x.id) === String(body.uid) && REC_LOG.test(unEnt(x.text_body)));
  if (!u) return { error: 'That entry is already gone.' };
  await gql(env, 'mutation($u:ID!){delete_update(id:$u){id}}', { u: u.id });
  return { ok: true };
}
// An email dropped on the candidate page: the browser reads it (public/mail.js) and sends what the manager ticked.
async function recFiles(env, b, id) {
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){assets(column_ids:$c){id name file_extension file_size created_at}}}', { i: [String(id)], c: [b.col.Files] });
  return (((d.items || [])[0] || {}).assets || []).map(a => ({ id: String(a.id), name: a.name, ext: a.file_extension || '', size: a.file_size || 0, at: a.created_at })).sort((x, y) => String(y.at).localeCompare(String(x.at)));
}
async function recEmail(env, me, fd) {
  const f = JSON.parse(fd.get('fields') || '{}'), txt = (x, n) => String(x == null ? '' : x).trim().slice(0, n || 120);
  const r = await recOwn(env, me, f.id);
  if (!r) return { error: 'That candidate isn’t yours.' };
  const C = r.b.col, files = fd.getAll('file').filter(x => x && typeof x !== 'string' && x.size), warn = [];
  const d = f.details || {}, vals = {}, keys = { phone: [C.Phone, 40], email: [C.Email, 120], workPhone: [C['Work Phone'], 40], workEmail: [C['Work Email'], 120] };
  for (const k in keys) if (d[k]) vals[keys[k][0]] = txt(d[k], keys[k][1]);
  if (Object.keys(vals).length) await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: r.b.id, i: r.id, v: JSON.stringify(vals) });
  const saved = [];
  for (const file of files.slice(0, 10)) {
    if (file.size > 25e6) { warn.push(file.name + ' is too big to save (25 MB at most)'); continue; }
    try { await addFile(env, r.id, C.Files, file); saved.push(txt(file.name, 150)); } catch (e) { warn.push(file.name + ' didn’t save'); }
  }
  let entry = null;
  if (f.note) {
    const n = f.note;
    entry = { text: txt(n.text, 3000), by: byName(me), at: new Date().toISOString(), mail: { subject: txt(n.subject, 200), from: txt(n.from, 160), date: /^\d{4}-\d{2}-\d{2}T/.test(n.date || '') ? n.date : '' }, files: saved };
    const res = await gql(env, 'mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}', { i: r.id, b: escHtml('[portal:note] ' + JSON.stringify(entry)) });
    entry.id = String(res.create_update.id);
  }
  return { ok: true, entry, files: await recFiles(env, r.b, r.id), warn: warn.join('; ') };
}
async function recFile(env, me, id, aid) {
  const r = await recOwn(env, me, id);
  if (!r) return fail('Not found', 404);
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){assets(column_ids:$c){id name public_url}}}', { i: [r.id], c: [r.b.col.Files] });
  const a = ((((d.items || [])[0] || {}).assets) || []).find(x => String(x.id) === String(aid));
  if (!a || !a.public_url) return fail('Not found', 404);
  const up = await fetch(a.public_url);
  if (!up.ok) return fail('Could not load the file', 502);
  // PDFs and pictures open in the browser; anything else downloads
  const ct = (up.headers.get('Content-Type') || '').split(';')[0].toLowerCase(), view = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/.test(ct);
  return new Response(up.body, { headers: { 'Content-Type': view ? ct : 'application/octet-stream', 'Content-Disposition': (view ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(a.name),
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } });
}
async function recPhotoUrl(env, b, id) {
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){assets(column_ids:$c){id public_url created_at}}}', { i: [String(id)], c: [b.col.Photo] });
  const a = (((d.items || [])[0] || {}).assets || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
  return a ? a.public_url : '';
}
async function recPhoto(env, me, id) {
  const r = await recOwn(env, me, id);
  if (!r) return fail('Not found', 404);
  const url = await recPhotoUrl(env, r.b, r.id);
  if (!url) return fail('No photo', 404);
  const f = await fetch(url);
  if (!f.ok) return fail('Could not load the photo', 502);
  return new Response(f.body, { headers: { 'Content-Type': f.headers.get('Content-Type') || 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
// a 5-minute pass for My Marketing's sample view, signed with its own purpose so it can't be used as a "view as" pass
async function recViewLink(env, me, id) {
  const r = await recOwn(env, me, id);
  if (!r) return { error: 'That candidate isn’t yours.' };
  const enc = new TextEncoder(), b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode((env.VIEW_AS_SECRET || '') + '|recruit-sample|' + env.MONDAY_TOKEN));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const body = b64u(enc.encode(JSON.stringify({ cid: r.id, by: byName(me), exp: Date.now() + 5 * 60e3 })));
  const sig = b64u(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return { url: (env.MY_MARKETING_URL || MY_MARKETING) + '/api/sample?t=' + body + '.' + sig };
}

// ---------- Marketing Tools phone remote (portal admins only) ----------
// The Mac app writes its status to the "Marketing Tools Remote" board every 15 seconds and picks up requests from it.
const RM_ACTIONS = { 'video.build': 'Build video', 'video.remove': 'Remove video', 'hire.make': 'Set up new hire', 'person.refresh': 'Refresh pieces', 'portal.invite': 'Portal invite', 'portal.add': 'Add to portal', 'dist.mark': 'West Marketing All' };
async function rmBoard(env) {
  const id = await cached('rmBoard', 600e3, async () => { try { return await boardId(env, 'Marketing Tools Remote', 'REMOTE_BOARD_ID'); } catch (e) { return ''; } });
  if (!id) { forget('rmBoard'); forget('board:Marketing Tools Remote'); return null; }
  const cols = await columns(env, id), col = {};
  ['Kind', 'State', 'Payload', 'By', 'Result'].forEach(t => { const c = cols.byTitle[nk(t)]; if (c) col[t] = c.id; });
  return { id, col };
}
async function remoteRoute(env, me, sub, m, request) {
  const b = await rmBoard(env);
  if (sub === 'status' && m === 'GET') {
    if (!b) return { waiting: true };
    const items = await allItems(env, b.id, Object.values(b.col));
    const rows = items.map(it => { const v = {}; it.column_values.forEach(c => v[c.id] = c.text || ''); return { id: String(it.id), name: it.name, kind: v[b.col.Kind], state: v[b.col.State], payload: v[b.col.Payload], by: v[b.col.By], result: v[b.col.Result], created: it.created_at }; });
    const beatRaw = String((rows.find(r => r.name === 'beat') || {}).payload || ''); const beat = Number(beatRaw.split('|')[0]) || 0, mac = beatRaw.split('|')[1] || '';
    const parts = rows.filter(r => r.kind === 'data').sort((x, y) => Number(x.name.split(':')[1]) - Number(y.name.split(':')[1]));
    let data = null;
    if (parts.length) { const first = parts[0].payload, bar = first.indexOf('|'), n = Number(first.slice(0, bar)); if (parts.length >= n) { try { data = JSON.parse(first.slice(bar + 1) + parts.slice(1, n).map(x => x.payload).join('')); } catch (e) {} } }
    const commands = rows.filter(r => r.kind === 'command').sort((x, y) => Number(y.id) - Number(x.id)).slice(0, 12).map(r => ({ id: r.id, title: r.name, state: r.state, result: r.result, by: r.by, created: r.created }));
    return { beat, mac, now: Date.now(), data, commands };
  }
  if (sub === 'command' && m === 'POST') {
    if (!b || !b.col.Kind) return { error: 'The remote isn’t set up yet. Open Marketing Tools on the Mac once.' };
    const body = await request.json().catch(() => ({}));
    if (!RM_ACTIONS[body.action]) return { error: 'Unknown request.' };
    const args = body.args && typeof body.args === 'object' ? body.args : {};
    const vals = {}; vals[b.col.Kind] = 'command'; vals[b.col.State] = 'New'; vals[b.col.By] = me.email;
    vals[b.col.Payload] = { text: JSON.stringify({ action: body.action, args }).slice(0, 1900) };
    const name = RM_ACTIONS[body.action] + (args.name ? ' · ' + String(args.name).slice(0, 60) : args.who ? ' · ' + String(args.who).slice(0, 60) : '');
    const id = await createItem(env, b.id, null, name, vals);
    return { ok: true, id: String(id) };
  }
  const v = sub.match(/^video\/(\d+)$/);
  if (v && m === 'GET') {
    const d = await gql(env, 'query($i:[ID!]){items(ids:$i){board{name} assets{id name file_extension public_url}}}', { i: [v[1]] });
    const it = d.items[0];
    if (!it || nk(it.board.name) !== nk('Phone Video Uploads')) return { error: 'Video not found.' };
    const a = (it.assets || []).find(x => /\.(mp4|mov|m4v|webm)$/i.test(x.name)) || it.assets[0];
    if (!a || !a.public_url) return { error: 'Video not found.' };
    return Response.redirect(a.public_url, 302);
  }
  return { error: 'Not found' };
}

// ---------- Projects › Social: posts for the Stewart Title of California pages ----------
// Marketing Tools puts finished projects on the private "Social Posts" board (Stewart West Marketing). Nothing here posts to Facebook,
// Instagram or LinkedIn: at post time a monday reminder goes out, and the phone remote (/remote/#post/…) has the pictures and captions
// ready to save, copy and post by hand, then marks it posted.
const SO_NAME = 'Social Posts';
const SO_TITLES = ['Project', 'Apps', 'Post At', 'Caption IG', 'Caption LI', 'Images', 'Remind', 'Remind Names', 'Posted IG', 'Posted LI', 'Reminded', 'By', 'Market'];
const PORTAL_URL = 'https://manager-portal.keving-stewart.workers.dev';
async function soBoard(env) {
  const b = await cached('soBoard', 3600e3, async () => {
    const ws = await wsWest(env);
    const bs = await gql(env, 'query($w:[ID!]){boards(workspace_ids:$w,state:active,limit:500){id name}}', { w: [ws] });
    const id = env.SOCIAL_BOARD_ID ? String(env.SOCIAL_BOARD_ID) : ((bs.boards || []).find(x => nk(x.name) === nk(SO_NAME)) || {}).id;
    if (!id) return null;
    const cols = await columns(env, String(id)), col = {};
    SO_TITLES.forEach(t => { const c = cols.byTitle[nk(t)]; if (c) col[t] = c.id; });
    return { id: String(id), col };
  });
  if (!b) forget('soBoard');
  return b;
}
const soWho = t => { const p = String(t || '').split('|'); return p[0] ? { by: p[0], at: p[1] || '' } : null; };
async function soRows(env, b) {
  const items = await allItems(env, b.id, Object.values(b.col));
  return items.map(it => {
    const v = {}; it.column_values.forEach(c => v[c.id] = (c.text || '').trim());
    const g = t => b.col[t] ? v[b.col[t]] || '' : '';
    let images = []; try { images = JSON.parse(g('Images') || '[]'); } catch (e) {}
    return { id: String(it.id), name: it.name.trim(), apps: g('Apps').split(',').filter(x => x === 'ig' || x === 'li'), at: g('Post At'), capIg: g('Caption IG'), capLi: g('Caption LI'),
      images: (Array.isArray(images) ? images : []).map(i => ({ id: String(i.id), name: String(i.name || ''), video: !!i.video })), remind: g('Remind').split(',').filter(Boolean), remindNames: g('Remind Names'),
      posted: { ig: soWho(g('Posted IG')), li: soWho(g('Posted LI')) }, reminded: g('Reminded'), by: g('By') };
  }).filter(p => p.at && !isNaN(Date.parse(p.at)));   // items with no post time (monday's sample items, hand-added rows) aren't posts
}
const soAllPosted = p => p.apps.length > 0 && p.apps.every(a => p.posted[a]);
async function soList(env, me) {
  const b = await soBoard(env);
  if (!b) return { posts: [], missing: true };
  const now = Date.now();
  // what's waiting (any time), plus the last two weeks of posted ones
  const rows = (await soRows(env, b)).filter(p => p.at && (!soAllPosted(p) || Date.parse(p.at) > now - 14 * 864e5));
  rows.forEach(p => { p.mine = { ig: !!(p.posted.ig && p.posted.ig.by === me.email), li: !!(p.posted.li && p.posted.li.by === me.email) }; });
  return { posts: rows.sort((x, y) => x.at.localeCompare(y.at)), me: me.email, now };
}
// the pictures come through here, so the phone can save them (same site) and monday's links stay private
async function soImage(env, postId, assetId, dl) {
  const b = await soBoard(env); if (!b) return fail('Not found', 404);
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){board{id} column_values(ids:$c){id text}}}', { i: [String(postId)], c: [b.col.Images] });
  const it = d.items && d.items[0];
  if (!it || String(it.board.id) !== b.id) return fail('Not found', 404);
  let imgs = []; try { imgs = JSON.parse((it.column_values[0] || {}).text || '[]'); } catch (e) {}
  const img = imgs.find(x => String(x.id) === String(assetId)); if (!img) return fail('Not found', 404);
  const a = (await gql(env, 'query($i:[ID!]!){assets(ids:$i){id name file_extension public_url}}', { i: [String(assetId)] })).assets[0];
  if (!a || !a.public_url) return fail('Not found', 404);
  const r = await fetch(a.public_url);
  if (!r.ok) return fail('The picture couldn’t be read from monday.com.', 502);
  const ext = String(a.file_extension || a.name.split('.').pop() || '').replace('.', '').toLowerCase();
  const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v' }[ext] || r.headers.get('Content-Type') || 'application/octet-stream';
  const name = String(img.name || a.name).replace(/["\\\r\n]/g, '');
  return new Response(r.body, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600', 'Content-Disposition': (dl ? 'attachment' : 'inline') + '; filename="' + name + '"' } });
}
async function soPosted(env, me, body) {
  const b = await soBoard(env); if (!b) return { error: 'The social calendar isn’t set up yet.' };
  if (body.app !== 'ig' && body.app !== 'li') return { error: 'Instagram or LinkedIn?' };
  const col = b.col[body.app === 'ig' ? 'Posted IG' : 'Posted LI']; if (!col) return { error: 'The board is missing a column. Open Projects › Social on the Manager’s Mac once.' };
  const v = {}; v[col] = body.undo ? '' : me.email + '|' + new Date().toISOString();
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: String(body.id), v: JSON.stringify(v) });
  return { ok: true };
}
// every few minutes (Cloudflare cron): a post whose time has come gets one reminder, as a monday update with the phone link
// and a notification to each person picked for it. Posts more than a day late are left alone.
export async function socialReminders(env) {
  if (!env.MONDAY_TOKEN) return { skipped: 'no token' };
  const b = await soBoard(env); if (!b || !b.col.Reminded) return { skipped: 'no board' };
  const now = Date.now(), due = (await soRows(env, b)).filter(p => p.at && !p.reminded && !soAllPosted(p) && Date.parse(p.at) <= now && Date.parse(p.at) > now - 864e5);
  const sent = [];
  for (const p of due) {
    const link = PORTAL_URL + '/remote/#post/' + p.id, apps = p.apps.map(a => a === 'ig' ? 'Instagram + Facebook' : 'LinkedIn').join(' and ');
    try {
      // mark it first, so a slow run never reminds twice
      const v = {}; v[b.col.Reminded] = new Date().toISOString();
      await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: p.id, v: JSON.stringify(v) });
      const up = await gql(env, 'mutation($i:ID!,$b:String!){create_update(item_id:$i,body:$b){id}}', { i: p.id,
        b: '<p><b>Time to post: ' + escHtml(p.name) + '</b> (' + escHtml(apps) + ')</p><p>Open it on your phone to save the pictures and copy the caption: <a href="' + link + '">' + link + '</a></p><p>Then tap Mark posted.</p>' });
      for (const uid of p.remind) {
        try { await gql(env, 'mutation($u:ID!,$t:ID!,$x:String!){create_notification(user_id:$u,target_id:$t,text:$x,target_type:Post){text}}', { u: String(uid), t: String(up.create_update.id), x: 'Time to post: ' + p.name + '. Tap to open it, then use the link to post from your phone.' }); } catch (e) {}
      }
      sent.push(p.id);
    } catch (e) { console.log('social reminder ' + p.id + ': ' + e.message); }
  }
  return { sent };
}


// ---------- Design Reviews: design packages the marketing team sends from a brainstorm board ----------
// Stewart Marketing Tools (a board › Send to management) makes one row per package on the private "Design Reviews" board in the
// Stewart West Marketing workspace: the slides as PNGs (Slides), their titles (Slide List), who should look (Reviewers: Manager Contacts
// row ids) and their answers (Answers, keyed by row id). Comments are updates on the row, so the team sees them on monday.com too.
// The board is made by the Manager's Mac; the portal only reads it.
const DR_NAME = 'Design Reviews';
const DR_TITLES = ['Project', 'Board Key', 'Market', 'From', 'Sent', 'Note', 'Slides', 'Slide List', 'Reviewers', 'Answers', 'Status'];
async function drBoard(env) {
  const b = await cached('drBoard', 3600e3, async () => {
    const ws = await wsWest(env);
    const bs = await gql(env, 'query($w:[ID!]){boards(workspace_ids:$w,state:active,limit:500){id name}}', { w: [ws] });
    const id = env.REVIEWS_BOARD_ID ? String(env.REVIEWS_BOARD_ID) : ((bs.boards || []).find(x => nk(x.name) === nk(DR_NAME)) || {}).id;
    if (!id) return null;
    const cols = await columns(env, String(id)), col = {};
    DR_TITLES.forEach(t => { const c = cols.byTitle[nk(t)]; if (c) col[t] = c.id; });
    return { id: String(id), col };
  });
  if (!b) forget('drBoard');
  return b;
}
const drJson = (t, d) => { try { const v = JSON.parse(t || ''); return v == null ? d : v; } catch (e) { return d; } };
const drStrip = h => String(h || '').replace(/<br\s*\/?>|<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{2,}/g, '\n').trim();
// comments: "<b>Slide 2 · Name</b> text" from the portal; anything else on the row is from West Marketing (replies made in the app or on monday.com)
function drComments(ups) {
  const out = [];
  (ups || []).forEach(u => {
    const body = String(u.body || '');
    if (/<b>(Approved|Asked for changes) · /.test(body)) return;
    const m = body.match(/<b>(?:Slide (\d+)|Whole package) · ([^<]+)<\/b>/);
    const text = m ? drStrip(body.slice(body.indexOf(m[0]) + m[0].length)) : drStrip(body);
    if (text) out.push({ name: m ? drStrip(m[2]) : (u.creator && u.creator.name) || 'Marketing', slide: m && m[1] ? Number(m[1]) : 0, text, at: u.created_at || '', marketing: !m || /^marketing$/i.test(drStrip(m[2])) });
  });
  return out.sort((x, y) => String(x.at).localeCompare(String(y.at)));
}
function drRow(b, it) {
  const v = {}; (it.column_values || []).forEach(c => v[c.id] = (c.text || '').trim());
  const g = t => b.col[t] ? v[b.col[t]] || '' : '';
  const reviewers = drJson(g('Reviewers'), []).filter(r => r && r.id).map(r => ({ id: String(r.id), name: String(r.name || '') }));
  const answers = drJson(g('Answers'), {});
  return { id: String(it.id), name: it.name.trim(), project: g('Project'), market: g('Market'), from: g('From') || 'Marketing', sent: g('Sent') || it.created_at || '', note: g('Note'),
    slides: drJson(g('Slide List'), []).filter(x => x && x.asset).map((x, i) => ({ asset: String(x.asset), title: String(x.title || 'Slide ' + (i + 1)) })),
    reviewers, answers: answers && typeof answers === 'object' ? answers : {}, status: g('Status') || 'Open' };
}
const drMine = (me, r) => me.row.admin || r.reviewers.some(x => x.id === String(me.row.rowId));
function drPublic(me, r) {
  const ok = r.reviewers.filter(x => (r.answers[x.id] || {}).a === 'approve').length, ch = r.reviewers.filter(x => (r.answers[x.id] || {}).a === 'changes').length;
  const mine = r.answers[String(me.row.rowId)] || null;
  return { id: r.id, name: r.name, project: r.project, market: r.market, from: r.from, sent: r.sent, note: r.note, status: r.status, count: r.slides.length,
    cover: r.slides[0] ? '/api/reviews/img/' + r.id + '/' + r.slides[0].asset : '', reviewer: r.reviewers.some(x => x.id === String(me.row.rowId)),
    mine: mine ? mine.a : '', approved: ok, changes: ch, total: r.reviewers.length };
}
async function drList(env, me) {
  const b = await drBoard(env); if (!b) return { reviews: [] };
  const items = await allItems(env, b.id, Object.values(b.col));
  const rows = items.map(it => drRow(b, it)).filter(r => r.slides.length && drMine(me, r));
  return { reviews: rows.map(r => drPublic(me, r)).sort((x, y) => String(y.sent).localeCompare(String(x.sent))).slice(0, 60) };
}
async function drItem(env, b, id) {
  const d = await gql(env, 'query($i:[ID!],$c:[String!]){items(ids:$i){id name state created_at board{id} column_values(ids:$c){id text} updates(limit:100){body created_at creator{name}}}}', { i: [String(id)], c: Object.values(b.col) });
  const it = d.items && d.items[0];
  if (!it || String(it.board.id) !== b.id || (it.state && it.state !== 'active')) return null;
  return it;
}
async function drDetail(env, me, id) {
  const b = await drBoard(env); if (!b) return { error: 'Not found' };
  const it = await drItem(env, b, id); if (!it) return { error: 'This package isn’t there anymore.' };
  const r = drRow(b, it); if (!drMine(me, r)) return { error: 'This package wasn’t sent to you.' };
  return Object.assign(drPublic(me, r), {
    slides: r.slides.map(x => ({ title: x.title, url: '/api/reviews/img/' + r.id + '/' + x.asset })),
    people: r.reviewers.map(x => { const a = r.answers[x.id] || {}; return { name: x.name, you: x.id === String(me.row.rowId), a: a.a || '', by: a.by || '', at: a.at || '' }; }),
    comments: drComments(it.updates),
  });
}
async function drImage(env, me, id, asset) {
  const b = await drBoard(env); if (!b) return fail('Not found', 404);
  const it = await drItem(env, b, id); if (!it) return fail('Not found', 404);
  const r = drRow(b, it); if (!drMine(me, r) || !r.slides.some(x => x.asset === String(asset))) return fail('Not found', 404);
  const a = (await gql(env, 'query($i:[ID!]!){assets(ids:$i){id public_url}}', { i: [String(asset)] })).assets[0];
  if (!a || !a.public_url) return fail('Not found', 404);
  const res = await fetch(a.public_url);
  if (!res.ok) return fail('The slide couldn’t be read from monday.com.', 502);
  return new Response(res.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' } });
}
async function drAnswer(env, me, body) {
  const ans = body.a === 'approve' ? 'approve' : body.a === 'changes' ? 'changes' : '';
  if (!ans) return { error: 'Approve or ask for changes?' };
  const note = String(body.note || '').trim().slice(0, 3000);
  if (ans === 'changes' && !note) return { error: 'Say what should change.' };
  const b = await drBoard(env); if (!b || !b.col.Answers) return { error: 'Design Reviews isn’t set up yet.' };
  const it = await drItem(env, b, body.id); if (!it) return { error: 'This package isn’t there anymore.' };
  const r = drRow(b, it), rowId = String(me.row.rowId);
  if (!r.reviewers.some(x => x.id === rowId)) return { error: 'This package wasn’t sent to you, so your answer can’t be counted.' };
  r.answers[rowId] = { row: rowId, name: me.row.name, by: byName(me), a: ans, at: new Date().toISOString() };
  const ok = r.reviewers.every(x => (r.answers[x.id] || {}).a === 'approve'), ch = r.reviewers.some(x => (r.answers[x.id] || {}).a === 'changes');
  const v = {}; v[b.col.Answers] = { text: JSON.stringify(r.answers) }; if (b.col.Status) v[b.col.Status] = ok ? 'Approved' : ch ? 'Changes asked' : 'Open';
  await gql(env, 'mutation($b:ID!,$i:ID!,$v:JSON!){change_multiple_column_values(board_id:$b,item_id:$i,column_values:$v){id}}', { b: b.id, i: r.id, v: JSON.stringify(v) });
  await addUpdate(env, r.id, '<p><b>' + (ans === 'approve' ? 'Approved' : 'Asked for changes') + ' · ' + escHtml(byName(me)) + '</b></p>');
  if (note) await drPost(env, me, r.id, Number(body.slide) || 0, note);
  return { ok: true };
}
async function drPost(env, me, id, slide, text) {
  await addUpdate(env, id, '<p><b>' + (slide > 0 ? 'Slide ' + slide : 'Whole package') + ' · ' + escHtml(byName(me)) + '</b></p><p>' + escHtml(text) + '</p>');
}
async function drComment(env, me, body) {
  const text = String(body.text || '').trim().slice(0, 3000); if (!text) return { error: 'Type a comment first.' };
  const b = await drBoard(env); if (!b) return { error: 'Design Reviews isn’t set up yet.' };
  const it = await drItem(env, b, body.id); if (!it) return { error: 'This package isn’t there anymore.' };
  const r = drRow(b, it); if (!drMine(me, r)) return { error: 'This package wasn’t sent to you.' };
  await drPost(env, me, r.id, Math.max(0, Math.min(r.slides.length, Number(body.slide) || 0)), text);
  return { ok: true };
}
