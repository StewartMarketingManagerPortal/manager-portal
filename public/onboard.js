// Manager Portal · Full onboarding: a new hire's first 90 days as one checklist, step by step.
// Progress is saved to the "Manager Onboarding" board on monday.com. Email buttons open a ready-to-send email in Outlook.
'use strict';

// who: which contact an item's email goes to. ask: what the email asks them to do.
const ONB_ROLES = { it: 'IT Help Desk', mkt: 'West Marketing', prints: 'Marketing prints', hr: 'HR', lic: 'Licensing', reports: 'Reporting', resware: 'ResWare admin' };
// The standard steps. Each manager can change, add and remove steps for their own new hires (Edit steps);
// Marketing setup (k: 'mkt') is West Marketing's step and can't be changed.
// w = when: { x: 'before', n: days before day 1 } · { x: 'day', a: work day, b: last work day } · { x: 'after', n: days after day 1 } · { x: 'text', t }
const ONB_STD = [
  { k: 'before', t: 'Before day 1', w: { x: 'before', n: 14 }, items: [
    { k: 'email', t: 'Set up their Stewart email', who: 'it', ask: 'set up a Stewart email account' },
    { k: 'laptop', t: 'Order laptop', who: 'it', ask: 'order a laptop and get it set up' },
    { k: 'phone', t: 'Order phone', who: 'it', ask: 'order a phone' },
    { k: 'headshot', t: 'Request headshot', who: 'mkt', ask: 'schedule a headshot' },
    { k: 'gift', t: 'Order new hire gift' }] },
  { k: 'mkt', t: 'Marketing setup', w: { x: 'before', n: 7 }, mkt: true },
  { k: 'prints', t: 'Order marketing prints', w: { x: 'text', t: 'Once marketing setup is sent' }, items: [
    { k: 'cards', t: 'Business cards', who: 'prints', ask: 'order business cards' },
    { k: 'notepads', t: 'Notepads', who: 'prints', ask: 'order notepads', note: 'Can order after they start' }] },
  { k: 'd1', t: 'Day 1', w: { x: 'day', a: 1 }, items: [
    { k: 'orient', t: 'Office orientation and branch intro' }, { k: 'call', t: 'Onboarding call' },
    { k: 'i9', t: 'I-9 meeting', who: 'hr', ask: 'set up their I-9 meeting' }, { k: 'hailey', t: 'Intro to Hailey' },
    { k: 'hrsetup', t: 'HR setup (benefits and more)', who: 'hr', ask: 'get their HR setup started (benefits and more)' }] },
  { k: 'd2', t: 'Day 2', w: { x: 'day', a: 2 }, items: [{ k: 'hrhome', t: 'HR Home required courses' }] },
  { k: 'd34', t: 'Days 3–4 · Internal tools', w: { x: 'day', a: 3, b: 4 }, items: [
    { k: 'doi', t: 'Transfer DOI license', who: 'lic', ask: 'transfer their DOI license' },
    { k: 'benefits', t: 'Benefit selections' }, { k: 'videos', t: 'Learning and training videos' },
    { k: 'reports', t: 'Reporting emails (Open Order, House and No BDO, Daily Quick)', who: 'reports', ask: 'add them to the reporting emails (Open Order, House and No BDO, Daily Quick)' },
    { k: 'resware', t: 'Add to the ResWare dropdown', who: 'resware', ask: 'add them to the ResWare dropdown' },
    { k: 'mktsupport', t: 'Intro to marketing support (flyers)' }, { k: 'tracker', t: 'Sales Tracker' },
    { k: 'website', t: 'Add to the branch website', who: 'mkt', ask: 'add them to the branch website' },
    { k: 'pcard', t: 'P-Card, expenses and expense report training' }, { k: 'snow', t: 'Stewart Now and C3' },
    { k: 'sf', t: 'Salesforce' }, { k: 'marketo', t: 'Marketo' }, { k: 'star', t: 'STAR calls' }, { k: 'store', t: 'Stewart Marketing Storefront' }] },
  { k: 'd5', t: 'Day 5 · External tools', w: { x: 'day', a: 5 }, items: [
    { k: 'mymta', t: 'myMTA' }, { k: 'neal', t: 'Neal Berry emails', note: 'East Bay only' }, { k: 'tflex', t: 'TitleFlex' }, { k: 'brief', t: 'Agent Brief' },
    { k: 'farm', t: 'Forever Farm' }, { k: 'tp247', t: 'Title Pro 247' }, { k: 'bb', t: 'Breakthrough Broker' }, { k: 'ttb', t: 'Title Toolbox' },
    { k: 'altos', t: 'Altos Research' }, { k: 'board', t: 'Real estate board memberships' }, { k: 'train', t: 'Schedule trainings with each site’s rep' }] },
  { k: 'chk', t: 'Check-ins', w: { x: 'text', t: 'Week 1 · 30 · 60 · 90 days' }, items: [
    { k: 'w1', t: 'Week 1 check-in', day: 4 }, { k: 'c30', t: '30-day check-in', day: 30 }, { k: 'c60', t: '60-day check-in', day: 60 }, { k: 'c90', t: '90-day check-in', day: 90 }] },
];
const ONB_MKT = ONB_STD[1];
// the steps for this new hire: their manager's own list, or the standard one
function onbSteps(h) {
  const own = OB.steps && OB.steps[String((h && h.managerEmail) || S.me.email).toLowerCase()];
  return (own && own.length ? own : ONB_STD).map(s => s.k === 'mkt' ? ONB_MKT : s);
}
function onbWhen(h, w) {
  w = w || {};
  if (w.x === 'before') { const n = +w.n || 0; return !n ? 'Before they start' : n % 7 === 0 ? 'About ' + plural(n / 7, 'week') + ' before they start' : 'About ' + plural(n, 'day') + ' before they start'; }
  if (w.x === 'day') { const a = Math.max(1, +w.a || 1), b = +w.b > a ? +w.b : 0; return onbDay(h, a - 1) + (b ? ' – ' + onbDay(h, b - 1).replace(/^\w+, /, '') : ''); }
  if (w.x === 'after') { const d = onbAdd(h, +w.n || 0); return d ? nice(iso(d)) : plural(+w.n || 0, 'day') + ' after they start'; }
  return w.t || '';
}
const OB = { list: null, contacts: {}, steps: {}, err: '', saving: {}, timers: {}, mail: null, form: null };

// ---------- dates and counts ----------
function onbAdd(h, n) { if (!h.start) return null; const d = new Date(h.start + 'T12:00:00'); if (isNaN(d)) return null; if (n) { d.setDate(d.getDate() + n); /* working days for the first week */ } return d; }
// first-week days skip the weekend: day 0 = start date, then the next working days
function onbWork(h, n) { const d = onbAdd(h, 0); if (!d) return null; let left = n; while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) left--; } return d; }
function onbDay(h, n) { const d = onbWork(h, n); return d ? nice(iso(d)) : (n ? 'Day ' + (n + 1) : 'Start date'); }
const onbToday = () => { const d = new Date(); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const onbNice = s => s ? nice('20' + s.slice(0, 2) + '-' + s.slice(2, 4) + '-' + s.slice(4, 6)).replace(/^\w+, /, '') : '';
function onbSent(h) { // marketing setup counts as done once the New Hire form went in for them
  const D = h.data || {};
  if (D.d && D.d.mkt) return D.d.mkt;
  const nh = S.reqs && S.reqs.newHires ? S.reqs.newHires.find(x => nk(x.name) === nk(h.name)) : null;
  return nh ? 'sent' : '';
}
function onbCount(h, s) {
  const D = (h.data || {}).d || {};
  if (s.mkt) return { done: onbSent(h) ? 1 : 0, total: 1 };
  return { done: s.items.filter(i => D[s.k + '.' + i.k]).length, total: s.items.length };
}
function onbTotals(h) { return onbSteps(h).reduce((a, s) => { const c = onbCount(h, s); a.done += c.done; a.total += c.total; return a; }, { done: 0, total: 0 }); }
const nk = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------- loading + saving ----------
async function onbLoad(force) {
  if (OB.loading || (OB.list && !force)) return;
  OB.loading = true;
  try { const r = await api('onboarding'); OB.list = r.hires || []; OB.contacts = r.contacts || {}; OB.steps = r.steps || {}; OB.err = ''; }
  catch (e) { OB.err = e.message; OB.list = OB.list || []; }
  OB.loading = false;
  if (!S.reqs) loadRequests();
  if (route() === 'onboard' || route() === 'team' || route() === 'home') render();
}
const onbPost = body => api('onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
function onbSave(h) {
  OB.editedAt = Date.now();   // the background refresh leaves the list alone for a minute after a tick
  clearTimeout(OB.timers[h.id]);
  OB.timers[h.id] = setTimeout(async () => {
    const t = onbTotals(h);
    try { await onbPost({ op: 'save', id: h.id, data: h.data, progress: (h.data && h.data.fin ? 'Completed ' : '') + t.done + '/' + t.total }); }
    catch (e) { toast('Couldn’t save that: ' + e.message, 7000); }
  }, 500);
}
const onbHire = id => (OB.list || []).find(x => x.id === id);
function onbHash() { const p = (location.hash || '').slice(1).split('/'); return { id: p[1] || '', step: p[2] || '' }; }

// ---------- page ----------
const OB_CK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const OB_MAIL = c => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + (c || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
PAGES.onboard = () => {
  if (!OB.list) { onbLoad(); return '<div class="head"><div><h1>Onboarding</h1></div></div><div class="card"><span class="spin dark"></span></div>'; }
  const { id, step } = onbHash(), h = id ? onbHire(id) : null;
  if (!h) return onbPick();
  if (OB.edit) return onbEditPage(h);
  const S8 = onbSteps(h), s = S8.find(x => x.k === step) || onbFirstOpen(h);
  const t = onbTotals(h), first = h.name.split(' ')[0];
  const days = h.start ? Math.round((new Date(h.start + 'T12:00:00') - new Date(iso(new Date()) + 'T12:00:00')) / 864e5) : null;
  let out = '<div class="head"><div><a class="ob-back" href="#onboard">‹ All new hires</a><h1>Onboarding</h1><div class="sub">Everything for a new hire’s first 90 days, in order. Jump to any step, tick things off as you go. Your progress is saved.</div></div>' +
    '<div class="ob-who"><span class="ob-av">' + esc(initials(h.name)) + '</span><span><b>' + esc(h.name) + '</b><small>' + esc([h.title, h.start ? 'starts ' + nice(h.start) : ''].filter(Boolean).join(' · ')) + ((S.me.admin || S.me.president) && h.managerEmail !== S.me.email ? ' · ' + esc(h.manager) : '') + '</small></span><a class="btn" href="#onboard">All new hires</a></div></div>';
  out += onbTabs(h);
  const fin = (h.data || {}).fin;
  if (fin) out += '<div class="banner ok ob-fin"><span class="av" style="background:var(--green);color:#fff">✓</span><div class="grow"><b>Onboarding completed ' + onbNice(fin) + '</b><div class="small">Kept on ' + esc(first) + '’s page in My Team. You can still tick things here.</div></div><button class="btn" data-act="ob-reopen">Reopen</button></div>';
  else if (t.done === t.total) out += '<div class="banner ok ob-fin"><span class="av" style="background:var(--green);color:#fff">✓</span><div class="grow"><b>Everything’s done for ' + esc(first) + '!</b><div class="small">Complete the onboarding to move it off your list. It stays on their page in My Team.</div></div><button class="btn primary" data-act="ob-complete">Complete onboarding</button></div>';
  out += '<div class="ob-wrap"><aside class="card ob-rail"><div><div class="ob-bar"><i style="width:' + Math.round(t.done / Math.max(1, t.total) * 100) + '%"></i></div><div class="small"><b>' + t.done + ' of ' + t.total + '</b> done' +
    (days != null ? ' · ' + (days > 0 ? plural(days, 'day') + ' until day 1' : days === 0 ? 'starts today' : 'day ' + (1 - days)) : '') + '</div></div>' + (onbCanEdit(h) ? '<button class="ob-editbtn" data-act="ob-edit">' + OB_PEN + 'Edit steps</button>' : '') + '<ol class="ob-steps">' +
    S8.map((x, i) => {
      const c = onbCount(h, x), all = c.done === c.total, left = c.total - c.done;
      return '<li class="' + (x === s ? 'on ' : '') + (all ? 'done ' : '') + (x.mkt ? 'mkt' : '') + '"><a ' + onbHref(h, x.k) + '><span class="ob-n">' + (all ? OB_CK : i + 1) + '</span><span class="ob-tx"><b>' + esc(x.t) + '</b><small>' + esc(onbWhen(h, x.w)) + '</small></span>' +
        '<span class="ob-cc">' + (all ? '<i class="ok" title="All done">' + OB_CK + '</i>' : (c.done ? '<i class="ok" title="' + c.done + ' done">' + c.done + '</i>' : '') + '<i class="left" title="' + left + ' to go">' + left + '</i>') + '</span></a></li>';
    }).join('') + '</ol>' + (fin ? '' : '<div class="ob-rail-foot"><button class="btn" data-act="ob-complete">' + OB_CK.replace('#fff', 'currentColor') + 'Complete onboarding</button><button class="ob-cancel" data-act="ob-cancel">Cancel this onboarding</button></div>') + '</aside><section class="ob-main">' + onbStep(h, s) + '</section></div>';
  if (OB.mail) out += onbMailBox(h);
  return out;
};
// Marketing setup goes straight to the New Hire form (filled in) until it's been sent
function onbHref(h, k) { return k === 'mkt' && !onbSent(h) ? 'href="#" data-act="ob-nh"' : 'href="#onboard/' + esc(h.id) + '/' + k + '"'; }
function onbFirstOpen(h) { const L = onbSteps(h); return L.find(x => { const c = onbCount(h, x); return c.done < c.total; }) || L[0]; }
function onbStep(h, s) {
  const L = onbSteps(h), i = L.indexOf(s), nx = L[i + 1], first = h.name.split(' ')[0];
  const D = (h.data = h.data || {}), done = D.d || {}, mailed = D.m || {};
  const foot = '<div class="row ob-foot">' + (i ? '<a class="btn" ' + onbHref(h, L[i - 1].k) + '>‹ ' + esc(L[i - 1].t) + '</a>' : '<span></span>') +
    (nx ? '<a class="btn" ' + onbHref(h, nx.k) + '>Next: ' + esc(nx.t) + ' ›</a>' : '<span class="small muted">That’s the last step.</span>') + '</div>';
  if (s.mkt) {
    const sent = onbSent(h);
    return '<div class="card ob-mkt"><div class="ob-eyebrow">Step ' + (i + 1) + ' of ' + L.length + ' · West Marketing</div><h2>Set ' + esc(first) + ' up with marketing</h2>' +
      '<p>Send ' + esc(first) + '’s details and photo to West Marketing. We make their announcement and email signature, add them to the branch website, and build their personal flyers on the Employee Marketing Portal.</p>' +
      '<div class="ob-what">' + [['Announcement', 'Dark and light'], ['Email signature', 'Ready for day 1'], ['Branch website', 'Their own page'], ['Personal flyers', 'On their portal']].map(([a, b]) => '<div><b>' + a + '</b><small>' + b + '</small></div>').join('') + '</div>' +
      (sent ? '<div class="banner ok" style="margin:0"><span class="av" style="background:var(--green);color:#fff">✓</span><div class="grow"><b>Sent to West Marketing</b>' + (sent !== 'sent' ? ' · ' + onbNice(sent) : '') + '</div><a class="btn" href="#mine">See it in My Requests</a></div>'
        : '<div class="row" style="gap:12px;align-items:center;flex-wrap:wrap"><button class="btn primary" data-act="ob-nh">Open the New Hire form ›</button><span class="small muted">About 3 minutes. ' + esc(first) + '’s name, title and start date are filled in for you.</span></div>' +
          '<label class="row small muted" style="gap:8px;cursor:pointer"><input type="checkbox" data-act="ob-mkt-done"> Already sent it some other way</label>') +
      foot + '</div>';
  }
  let out = '<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px"><div><div class="ob-eyebrow">Step ' + (i + 1) + ' of ' + L.length + ' · ' + esc(onbWhen(h, s.w)) + '</div><h2>' + esc(s.t) + '</h2></div>' +
    '<button class="btn ob-all" data-act="ob-mail" data-k="list:' + s.k + '">' + OB_MAIL() + 'Email this list</button></div><ul class="ob-list">';
  s.items.forEach(it => {
    const key = s.k + '.' + it.k, on = done[key], m = mailed[key];
    const due = it.day != null && h.start ? nice(iso(onbAdd(h, it.day))) : '';
    const c = it.who ? (OB.contacts[it.who] || {}) : null, whoName = it.who ? (c.name || ONB_ROLES[it.who]) : '';
    out += '<li class="' + (on ? 'on' : '') + '"><button class="ob-box" data-act="ob-tick" data-k="' + key + '" aria-label="' + (on ? 'Mark not done' : 'Mark done') + ': ' + esc(it.t) + '">' + (on ? OB_CK : '') + '</button>' +
      '<span class="grow"><span class="ob-t">' + esc(it.t) + '</span>' + (it.note || due ? '<small>' + esc([it.note, due].filter(Boolean).join(' · ')) + '</small>' : '') + '</span>' +
      (on || m ? '<span class="ob-by">' + [m ? 'Emailed ' + esc(whoName) + ' ' + onbNice(m) : '', on ? 'Done ' + onbNice(on) : ''].filter(Boolean).join(' · ') + '</span>' : '') +
      (it.who && !on ? '<button class="ob-mailbtn" data-act="ob-mail" data-k="' + key + '">' + OB_MAIL() + 'Email ' + esc(whoName) + '</button>' : '') + '</li>';
  });
  out += '</ul>' + foot + '</div>';
  if (s.k === 'before' && !onbSent(h)) out += '<div class="ob-tip"><b>Heads up</b> Marketing setup is next. Send it about a week before day 1 so business cards and the announcement are ready when ' + esc(first) + ' starts.</div>';
  return out;
}

// ---------- pick or start an onboarding ----------
function onbPick() {
  const f = OB.form || (OB.form = { name: '', title: '', start: '' });
  const all = OB.list || [], list = all.filter(x => !(x.data || {}).fin), doneList = all.filter(x => (x.data || {}).fin);
  const taken = new Set(list.map(x => nk(x.name)));
  const recent = ((S.reqs && S.reqs.newHires) || []).filter(x => !taken.has(nk(x.name))).slice(0, 6);
  const titles = (S.me.titles || []).map(t => '<option ' + (t === f.title ? 'selected' : '') + '>' + esc(t) + '</option>').join('');
  if (OB.edit) return onbEditPage(null);
  let out = '<div class="head"><div><h1>Onboarding</h1><div class="sub">Everything for a new hire’s first 90 days, in order: supplies, marketing, day 1, tools and check-ins.</div></div><button class="btn" data-act="ob-edit">' + OB_PEN + 'Edit your steps</button></div>';
  if (OB.err) out += '<div class="banner bad">' + esc(OB.err) + '</div>';
  out += '<div class="ob-pick">';
  if (list.length) {
    out += '<section class="card"><h2>' + (S.me.admin || S.me.president ? 'Onboardings' : 'Your onboardings') + '</h2><div class="ob-hires">' + list.map(h => {
      const t = onbTotals(h), pct = Math.round(t.done / Math.max(1, t.total) * 100);
      return '<div class="ob-hire"><a href="#onboard/' + esc(h.id) + '"><span class="ob-av">' + esc(initials(h.name)) + '</span><span class="grow"><b>' + esc(h.name) + '</b><small>' + esc([h.title, h.start ? 'starts ' + nice(h.start) : '', (S.me.admin || S.me.president) && h.managerEmail !== S.me.email ? h.manager : ''].filter(Boolean).join(' · ')) + '</small>' +
        '<span class="ob-bar sm"><i style="width:' + pct + '%"></i></span></span><span class="small"><b>' + t.done + '</b>/' + t.total + '</span></a><button class="ob-x" data-act="ob-remove" data-id="' + esc(h.id) + '" title="Cancel this onboarding" aria-label="Cancel ' + esc(h.name) + '’s onboarding">×</button></div>';
    }).join('') + '</div></section>';
  }
  const doneHtml = doneList.length ? '<details class="card ob-done"><summary><b>Completed</b> <span class="muted">· ' + doneList.length + '</span></summary><div class="ob-hires">' + doneList.map(h =>
    '<div class="ob-hire"><a href="#onboard/' + esc(h.id) + '"><span class="ob-av done">' + OB_CK + '</span><span class="grow"><b>' + esc(h.name) + '</b><small>Completed ' + onbNice(h.data.fin) + (h.title ? ' · ' + esc(h.title) : '') + '</small></span></a></div>').join('') + '</div></details>' : '';
  out += '<section class="card"><h2>Start a new onboarding</h2>' +
    (recent.length ? '<div class="small muted">New hires you sent to marketing: ' + recent.map(x => '<button class="chip" data-act="ob-quick" data-name="' + esc(x.name) + '">' + esc(x.name) + '</button>').join(' ') + '</div>' : '') +
    '<div class="ob-form"><label class="field">Their full name<input type="text" data-ob="name" value="' + esc(f.name) + '" placeholder="First and last name"></label>' +
    '<label class="field">Title<select data-ob="title"><option value="">Choose…</option>' + titles + '</select></label>' +
    '<label class="field">Start date<input type="date" data-ob="start" value="' + esc(f.start) + '"></label></div>' +
    '<div><button class="btn primary" data-act="ob-create" ' + (OB.creating ? 'disabled' : '') + '>' + (OB.creating ? 'Starting…' : 'Start onboarding ›') + '</button></div></section>' + doneHtml + '</div>';
  return out;
}
ACT['ob-quick'] = el => { OB.form = Object.assign(OB.form || {}, { name: el.dataset.name }); render(); };
ACT['ob-create'] = async () => {
  const f = OB.form || {};
  if (!String(f.name || '').trim().includes(' ')) return toast('Add their first and last name.');
  OB.creating = true; render();
  try { const r = await onbPost({ op: 'create', name: f.name.trim(), title: f.title || '', start: f.start || '' }); OB.list.unshift(r.hire); OB.form = null; OB.creating = false; go('onboard/' + r.hire.id); }
  catch (e) { OB.creating = false; render(); toast(e.message, 7000); }
};
async function onbCancel(h) {
  if (!h || !confirm('Cancel ' + h.name + '’s onboarding?\n\nUse this if they aren’t starting after all. Their checklist is removed from the portal.')) return;
  try { await onbPost({ op: 'remove', id: h.id }); OB.list = OB.list.filter(x => x !== h); toast(h.name + '’s onboarding was canceled'); go('onboard'); }
  catch (e) { toast(e.message, 7000); }
}
ACT['ob-remove'] = el => onbCancel(onbHire(el.dataset.id));
ACT['ob-cancel'] = () => onbCancel(onbCur());
ACT['ob-complete'] = () => {
  const h = onbCur(); if (!h) return; const t = onbTotals(h), left = t.total - t.done;
  if (left && !confirm(plural(left, 'item') + ' still open. Complete ' + h.name + '’s onboarding anyway?')) return;
  h.data = h.data || {}; h.data.fin = onbToday(); onbSave(h); render(); toast(h.name.split(' ')[0] + '’s onboarding is complete. It’s kept on their page in My Team.', 6000);
};
ACT['ob-reopen'] = () => { const h = onbCur(); if (!h) return; delete h.data.fin; onbSave(h); render(); };
// switch between everyone being onboarded right now
function onbTabs(cur) {
  const act = (OB.list || []).filter(x => !(x.data || {}).fin || x === cur);
  if (act.length < 2) return '';
  return '<div class="ob-tabs">' + act.map(x => { const t = onbTotals(x);
    return '<a class="ob-tab' + (x === cur ? ' on' : '') + '" href="#onboard/' + esc(x.id) + '"><b>' + esc(x.name) + '</b><span>' + t.done + '/' + t.total + '</span></a>'; }).join('') +
    '</div>';
}
// My Team: their onboarding, in progress or completed
function onbTeamCard(p) {
  if (!OB.list) { onbLoad(); return ''; }
  const h = OB.list.find(x => nk(x.name) === nk(p.name)); if (!h) return '';
  const t = onbTotals(h), fin = (h.data || {}).fin, pct = Math.round(t.done / Math.max(1, t.total) * 100);
  return '<section class="card ob-team"><div class="row" style="justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h2>Onboarding</h2><div class="sub" style="font-size:14px">' +
    (fin ? 'Completed ' + onbNice(fin) + ' · ' + t.done + ' of ' + t.total + ' items done' : 'In progress · ' + t.done + ' of ' + t.total + ' done') + (h.start ? ' · started ' + nice(h.start) : '') + '</div></div>' +
    '<a class="btn' + (fin ? '' : ' primary') + '" href="#onboard/' + esc(h.id) + '">' + (fin ? 'View checklist' : 'Open checklist ›') + '</a></div>' +
    '<span class="ob-bar"><i style="width:' + pct + '%"></i></span></section>';
}
window.onbTeamCard = onbTeamCard;
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.ob; if (k && OB.form) OB.form[k] = e.target.value; });
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.ob; if (k && OB.form) OB.form[k] = e.target.value; });

// ---------- ticking things off ----------
function onbCur() { return onbHire(onbHash().id); }
ACT['ob-tick'] = el => {
  const h = onbCur(); if (!h) return; const D = h.data = h.data || {}; D.d = D.d || {};
  if (D.d[el.dataset.k]) delete D.d[el.dataset.k]; else D.d[el.dataset.k] = onbToday();
  render(); onbSave(h);
};
ACT['ob-mkt-done'] = () => { const h = onbCur(); if (!h) return; const D = h.data = h.data || {}; D.d = D.d || {}; D.d.mkt = onbToday(); render(); onbSave(h); };
ACT['ob-nh'] = () => {
  const h = onbCur(); if (!h) return;
  const parts = h.name.trim().split(/\s+/), n = freshNewHire();
  n.firstName = parts[0]; n.lastName = parts.slice(1).join(' '); n.startDate = h.start || '';
  if (h.title) { if ((S.me.titles || []).includes(h.title)) n.title = h.title; else { n.title = '__other'; n.titleOther = h.title; } }
  S.nh = n; S.onbFrom = h.id; go('newhire');
};

// ---------- emails (open in the manager's own Outlook) ----------
function onbMailFor(h, key) {
  const first = h.name.split(' ')[0], me = S.me.name.split(' ')[0];
  const facts = [h.name, h.title, h.start ? 'Starts ' + DAYS[new Date(h.start + 'T12:00:00').getDay()] + ', ' + nice(h.start).replace(/^\w+, /, '') : ''].filter(Boolean).join('\n');
  if (key.startsWith('list:')) {
    const s = onbSteps(h).find(x => x.k === key.slice(5)), done = ((h.data || {}).d) || {};
    return { role: '', to: '', name: '', subject: s.t + ' checklist for ' + h.name,
      body: 'Hi,\n\nHere’s the ' + s.t.toLowerCase() + ' checklist for ' + h.name + (h.title ? ', our new ' + h.title : '') + ':\n\n' +
        s.items.map(i => (done[s.k + '.' + i.k] ? '[x] ' : '[ ] ') + i.t + (i.note ? ' (' + i.note + ')' : '')).join('\n') + '\n\n' + facts + '\n\nThanks,\n' + me };
  }
  const [sk, ik] = key.split('.'), s = onbSteps(h).find(x => x.k === sk), it = s.items.find(x => x.k === ik), c = OB.contacts[it.who] || {};
  return { role: it.who, to: c.email || '', name: c.name || '', subject: it.t + ' for ' + h.name + (h.start ? ', starting ' + nice(h.start).replace(/^\w+, /, '') : ''),
    body: 'Hi' + (c.name ? ' ' + c.name.split(' ')[0] : '') + ',\n\nCould you ' + (it.ask || 'help with “' + it.t + '”') + ' for our new hire?\n\n' + facts + '\n\nThanks,\n' + me };
}
ACT['ob-mail'] = el => { const h = onbCur(); if (!h) return; OB.mail = Object.assign({ key: el.dataset.k, remember: true, tick: !el.dataset.k.startsWith('list:') }, onbMailFor(h, el.dataset.k)); render(); const t = document.querySelector('[data-obm=to]'); if (t && !t.value) t.focus(); };
function onbMailBox(h) {
  const M = OB.mail, role = M.role ? ONB_ROLES[M.role] : '';
  return '<div class="ob-modal" data-act="ob-mail-x"><div class="ob-mbox" role="dialog" aria-modal="true" aria-label="Email preview"><div class="ob-eyebrow">Email preview' + (role ? ' · ' + esc(role) : '') + '</div>' +
    '<label class="ob-mf"><span>To</span><input type="email" data-obm="to" value="' + esc(M.to) + '" placeholder="' + (role ? esc(role) + ' email address' : 'Their email address') + '"></label>' +
    (M.role ? '<label class="ob-mf"><span>Name</span><input type="text" data-obm="name" value="' + esc(M.name) + '" placeholder="Their first name, for the greeting (optional)"></label>' : '') +
    '<label class="ob-mf"><span>Subject</span><input type="text" data-obm="subject" value="' + esc(M.subject) + '"></label>' +
    '<textarea class="ob-mbody" data-obm="body" rows="11">' + esc(M.body) + '</textarea>' +
    '<div class="row ob-mfoot"><div class="ob-checks">' + (M.role ? '<label><input type="checkbox" data-obm="remember" ' + (M.remember ? 'checked' : '') + '> Use this address for ' + esc(role) + ' next time</label>' : '') +
    (M.tick ? '<label><input type="checkbox" data-obm="tick" ' + (M.tick ? 'checked' : '') + '> Tick it off too</label>' : '') + '</div>' +
    '<div class="row" style="gap:10px"><button class="btn" data-act="ob-mail-cancel">Cancel</button><button class="btn primary" data-act="ob-mail-go">' + OB_MAIL('#fff') + ' Open in Outlook</button></div></div></div></div>';
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.obm; if (!k || !OB.mail) return;
  OB.mail[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (k === 'name' && OB.mail.role) OB.mail.body = OB.mail.body.replace(/^Hi[^,\n]*,/, 'Hi' + (e.target.value.trim() ? ' ' + e.target.value.trim().split(' ')[0] : '') + ','), (document.querySelector('[data-obm=body]') || {}).value = OB.mail.body;
});
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.obm; if (k && OB.mail && e.target.type === 'checkbox') OB.mail[k] = e.target.checked; });
ACT['ob-mail-x'] = (el, e) => { if (e.target === el) { OB.mail = null; render(); } };
ACT['ob-mail-cancel'] = () => { OB.mail = null; render(); };
ACT['ob-mail-go'] = async () => {
  const h = onbCur(), M = OB.mail; if (!h || !M) return;
  const to = M.to.trim();
  if (to && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) { toast('That email address doesn’t look right.'); return; }
  location.href = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@') + '?subject=' + encodeURIComponent(M.subject) + '&body=' + encodeURIComponent(M.body);
  const D = h.data = h.data || {};
  if (!M.key.startsWith('list:')) { D.m = D.m || {}; D.m[M.key] = onbToday(); if (M.tick) { D.d = D.d || {}; D.d[M.key] = onbToday(); } onbSave(h); }
  const was = OB.contacts[M.role] || {};
  if (M.role && M.remember && to && (was.email !== to || (was.name || '') !== (M.name || '').trim())) {
    OB.contacts[M.role] = { name: (M.name || '').trim(), email: to };
    onbPost({ op: 'contacts', contacts: OB.contacts }).catch(e => toast('Couldn’t save that contact: ' + e.message, 7000));
  }
  OB.mail = null; render();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && OB.mail) { OB.mail = null; render(); } });

// called by the New Hire form after it's sent from an onboarding
function onbMarkSent(id) { const h = onbHire(id); if (!h) return; const D = h.data = h.data || {}; D.d = D.d || {}; D.d.mkt = onbToday(); onbSave(h); }
window.onbMarkSent = onbMarkSent;

// Home page: everyone being onboarded right now
function onbHomeCard() {
  if (!OB.list) { onbLoad(); return ''; }
  const act = OB.list.filter(h => !(h.data || {}).fin);
  if (!act.length) return '';
  const today = new Date(iso(new Date()) + 'T12:00:00');
  return '<section class="card hob"><div class="row" style="justify-content:space-between;align-items:center"><h2>Onboarding</h2><span class="row" style="gap:14px"><a href="#onboard" style="font-size:14px;font-weight:600">See all</a><a class="btn hob-add" href="#onboard">+ Onboard a new hire</a></span></div><div>' +
    act.map(h => {
      const t = onbTotals(h), nx = onbSteps(h).find(x => { const c = onbCount(h, x); return c.done < c.total; });
      const d = h.start ? Math.round((new Date(h.start + 'T12:00:00') - today) / 864e5) : null;
      const when = d == null ? '' : d > 0 ? plural(d, 'day') + ' to day 1' : d === 0 ? 'Starts today' : 'Day ' + (1 - d);
      return '<a class="hob-row" href="#onboard/' + esc(h.id) + '"><span class="ob-av">' + esc(initials(h.name)) + '</span><span class="grow"><b>' + esc(h.name) + '</b><small>' +
        esc([h.title, h.start ? (d != null && d < 0 ? 'started ' : 'starts ') + nice(h.start) : '', (S.me.admin || S.me.president) && h.managerEmail !== S.me.email ? h.manager : ''].filter(Boolean).join(' · ')) + '</small></span>' +
        (nx ? '<span class="hob-next">Next: ' + esc(nx.t) + '</span>' : '<span class="hob-next ok">Ready to complete</span>') +
        '<span class="hob-p"><span class="ob-bar"><i style="width:' + Math.round(t.done / Math.max(1, t.total) * 100) + '%"></i></span><small><b>' + t.done + '</b> of ' + t.total + ' done</small></span>' +
        '<span class="hob-days' + (d != null && d >= 0 && d <= 10 ? ' soon' : '') + '">' + esc(when) + '</span><span class="hob-go">›</span></a>';
    }).join('') + '</div></section>';
}
window.onbHomeCard = onbHomeCard;

// ---------- editing the steps (each manager's own list; Marketing setup stays as it is) ----------
const OB_PEN = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const OB_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const OB_WHENS = [['before', 'Days before start'], ['day', 'Work days'], ['after', 'Days after start'], ['text', 'Write my own']];
const onbCanEdit = h => !h || String(h.managerEmail || '').toLowerCase() === String(S.me.email || '').toLowerCase();
const onbKey = p => p + Math.random().toString(36).slice(2, 8);
const onbCopy = L => JSON.parse(JSON.stringify(L.map(s => s.k === 'mkt' ? { k: 'mkt' } : s)));
ACT['ob-edit'] = () => {
  const h = onbCur(), L = onbSteps(h && onbCanEdit(h) ? h : null);
  const s = L.find(x => x.k === onbHash().step && !x.mkt) || L.find(x => !x.mkt);
  OB.edit = { steps: onbCopy(L), cur: s ? s.k : 'mkt', changed: false }; render(); scrollTo(0, 0);
};
function onbEditPage(h) {
  const E = OB.edit, L = E.steps, cur = L.find(x => x.k === E.cur) || L[0], ci = L.indexOf(cur), last = L.length - 1;
  const hh = h || { name: 'New Hire', start: '' }, first = h ? h.name.split(' ')[0] : '';
  let out = '<div class="head"><div>' + (h ? '<a class="ob-back" href="#" data-act="ob-edit-cancel">‹ Back to ' + esc(first) + '’s checklist</a>' : '<a class="ob-back" href="#" data-act="ob-edit-cancel">‹ All new hires</a>') +
    '<h1>Edit your steps</h1><div class="sub">Rename steps, change when they happen, and add or remove checklist items. Your steps are used for all your new hires.</div></div></div>';
  out += '<div class="ob-banner ob-editbar"><span><b>Changes apply to all your new hires,</b> including onboardings already under way. Anything already ticked stays ticked.</span>' +
    '<span class="row" style="gap:10px;align-items:center"><button class="ob-cancel" data-act="ob-edit-reset">Go back to the standard steps</button><button class="btn" data-act="ob-edit-cancel">Cancel</button>' +
    '<button class="btn primary" data-act="ob-edit-save" ' + (E.saving ? 'disabled' : '') + '>' + (E.saving ? 'Saving…' : 'Save changes') + '</button></span></div>';
  out += '<div class="ob-wrap"><aside class="card ob-rail"><ol class="ob-steps ob-esteps">' + L.map((x, i) => {
    const mk = x.k === 'mkt', st = mk ? ONB_MKT : x;
    return '<li class="' + (x === cur ? 'on ' : '') + (mk ? 'mkt lock' : '') + '"><a href="#" data-act="ob-e-pick" data-k="' + esc(x.k) + '"><span class="ob-n">' + (i + 1) + '</span><span class="ob-tx"><b>' + esc(st.t || 'New step') + '</b><small>' +
      (mk ? OB_LOCK + ' Set by West Marketing' : esc(onbWhen(hh, st.w)) + ' · ' + plural((st.items || []).length, 'item')) + '</small></span></a>' +
      (mk ? '' : '<span class="ob-mv"><button data-act="ob-e-move" data-k="' + esc(x.k) + '" data-d="-1" ' + (i ? '' : 'disabled') + ' aria-label="Move up">↑</button><button data-act="ob-e-move" data-k="' + esc(x.k) + '" data-d="1" ' + (i < last ? '' : 'disabled') + ' aria-label="Move down">↓</button></span>') + '</li>';
  }).join('') + '</ol><div class="ob-rail-foot"><button class="btn" data-act="ob-e-addstep">+ Add a step</button></div></aside><section class="ob-main">';
  if (cur.k === 'mkt') {
    out += '<div class="card ob-mkt"><div class="ob-eyebrow">Step ' + (ci + 1) + ' of ' + L.length + ' · West Marketing</div><h2>Marketing setup</h2>' +
      '<p>This is West Marketing’s step, so it stays the same for every manager. You can move your other steps before or after it.</p></div>';
  } else {
    const w = cur.w || { x: 'text', t: '' };
    const roles = it => '<select data-obe="who" data-i="#" aria-label="Who to email">' + [['', 'No email']].concat(Object.entries(ONB_ROLES)).map(([k, l]) => '<option value="' + k + '" ' + ((it.who || '') === k ? 'selected' : '') + '>' + (k ? 'Email ' + esc(l) : l) + '</option>').join('') + '</select>';
    out += '<div class="card ob-ed"><div class="ob-eyebrow">Step ' + (ci + 1) + ' of ' + L.length + '</div>' +
      '<div class="ob-ed-top"><label class="field">Step name<input type="text" data-obe="t" value="' + esc(cur.t || '') + '" placeholder="For example: Week 2 · Shadowing" maxlength="60"></label>' +
      '<div class="field">When<div class="ob-when"><select data-obe="wx">' + OB_WHENS.map(([k, l]) => '<option value="' + k + '" ' + (w.x === k ? 'selected' : '') + '>' + l + '</option>').join('') + '</select>' +
      (w.x === 'before' || w.x === 'after' ? '<input type="number" min="0" max="365" data-obe="wn" value="' + esc(w.n || 0) + '" aria-label="Days"><span class="small muted">days</span>'
        : w.x === 'day' ? '<span class="small muted">Day</span><input type="number" min="1" max="60" data-obe="wa" value="' + esc(w.a || 1) + '" aria-label="First day"><span class="small muted">to</span><input type="number" min="0" max="60" data-obe="wb" value="' + esc(w.b || '') + '" placeholder="–" aria-label="Last day (optional)">'
        : '<input type="text" data-obe="wt" value="' + esc(w.t || '') + '" placeholder="For example: Once their license transfers" maxlength="60" class="ob-wt">') + '</div>' +
      '<small class="muted ob-whenshow">Shows as: <b>' + esc(onbWhen(hh, w) || '—') + '</b>' + (h && h.start ? ' for ' + esc(first) : '') + '</small></div></div>' +
      '<div class="ob-ed-h"><b>Checklist</b><span class="small muted">' + plural(cur.items.length, 'item') + '</span></div><ol class="ob-eitems">' +
      cur.items.map((it, j) => '<li><span class="ob-mv"><button data-act="ob-e-imove" data-i="' + j + '" data-d="-1" ' + (j ? '' : 'disabled') + ' aria-label="Move up">↑</button><button data-act="ob-e-imove" data-i="' + j + '" data-d="1" ' + (j < cur.items.length - 1 ? '' : 'disabled') + ' aria-label="Move down">↓</button></span>' +
        '<div class="ob-ei"><div class="ob-ei-row"><input type="text" data-obe="it" data-i="' + j + '" value="' + esc(it.t) + '" placeholder="What needs doing" maxlength="90">' + roles(it).replace('data-i="#"', 'data-i="' + j + '"') + '</div>' +
        '<div class="ob-ei-row sm"><label class="ob-sl"><span>Note</span><input type="text" data-obe="note" data-i="' + j + '" value="' + esc(it.note || '') + '" placeholder="Optional, like “East Bay only”" maxlength="60"></label>' +
        (it.who ? '<label class="ob-sl"><span>Email asks them to</span><input type="text" data-obe="ask" data-i="' + j + '" value="' + esc(it.ask || '') + '" placeholder="like “order a laptop”" maxlength="120"></label>' : '') + '</div></div>' +
        '<button class="ob-x" data-act="ob-e-idel" data-i="' + j + '" title="Remove this item" aria-label="Remove ' + esc(it.t || 'this item') + '">×</button></li>').join('') + '</ol>' +
      '<div><button class="btn" data-act="ob-e-iadd">+ Add an item</button></div>' +
      '<div class="row ob-foot"><button class="ob-del" data-act="ob-e-delstep">Delete this step</button><span class="small muted">Saved when you click Save changes.</span></div></div>';
  }
  return out + '</section></div>';
}
const onbECur = () => OB.edit.steps.find(x => x.k === OB.edit.cur);
const onbEDirty = () => { OB.edit.changed = true; };
ACT['ob-e-pick'] = el => { OB.edit.cur = el.dataset.k; render(); };
ACT['ob-e-move'] = el => {
  const L = OB.edit.steps, i = L.findIndex(x => x.k === el.dataset.k), j = i + +el.dataset.d;
  if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; onbEDirty(); render();
};
ACT['ob-e-addstep'] = () => {
  const s = { k: onbKey('s'), t: '', w: { x: 'text', t: '' }, items: [{ k: onbKey('i'), t: '' }] };
  OB.edit.steps.push(s); OB.edit.cur = s.k; onbEDirty(); render();
  const t = document.querySelector('[data-obe=t]'); if (t) t.focus();
};
ACT['ob-e-delstep'] = () => {
  const L = OB.edit.steps, s = onbECur(); if (!s || s.k === 'mkt') return;
  if (!confirm('Delete the “' + (s.t || 'new') + '” step and its ' + plural(s.items.length, 'item') + '?')) return;
  const i = L.indexOf(s); L.splice(i, 1); OB.edit.cur = (L[Math.max(0, i - 1)] || {}).k; onbEDirty(); render();
};
ACT['ob-e-iadd'] = () => {
  const s = onbECur(); s.items.push({ k: onbKey('i'), t: '' }); onbEDirty(); render();
  const all = document.querySelectorAll('[data-obe=it]'); if (all.length) all[all.length - 1].focus();
};
ACT['ob-e-idel'] = el => { onbECur().items.splice(+el.dataset.i, 1); onbEDirty(); render(); };
ACT['ob-e-imove'] = el => {
  const I = onbECur().items, i = +el.dataset.i, j = i + +el.dataset.d;
  if (j < 0 || j >= I.length) return; [I[i], I[j]] = [I[j], I[i]]; onbEDirty(); render();
};
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.obe; if (!k || !OB.edit) return;
  const s = onbECur(), v = e.target.value, it = s.items[+e.target.dataset.i];
  if (k === 't') s.t = v; else if (k === 'it') it.t = v; else if (k === 'note') it.note = v; else if (k === 'ask') it.ask = v;
  else if (k === 'wn') s.w.n = Math.max(0, parseInt(v, 10) || 0); else if (k === 'wa') s.w.a = Math.max(1, parseInt(v, 10) || 1); else if (k === 'wb') s.w.b = parseInt(v, 10) || 0; else if (k === 'wt') s.w.t = v;
  onbEDirty();
  if (k[0] === 'w') {   // show the new timing here and in the step list without redrawing (so the next box keeps focus)
    const wh = onbWhen(onbCur() || { name: '', start: '' }, s.w), show = document.querySelector('.ob-whenshow b'), r = document.querySelector('.ob-esteps li.on small');
    if (show) show.textContent = wh || '—'; if (r) r.textContent = wh + ' · ' + plural(s.items.length, 'item');
  }
  if (k === 't') { const r = document.querySelector('.ob-esteps li.on b'); if (r) r.textContent = v || 'New step'; }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.obe; if (!k || !OB.edit) return;
  const s = onbECur(), v = e.target.value;
  if (k === 'wx') { s.w = v === 'before' ? { x: v, n: 7 } : v === 'after' ? { x: v, n: 30 } : v === 'day' ? { x: v, a: 1 } : { x: 'text', t: '' }; onbEDirty(); render(); }
  else if (k === 'who') { const it = s.items[+e.target.dataset.i]; it.who = v || undefined; if (!v) delete it.ask; onbEDirty(); render(); }
});
ACT['ob-edit-cancel'] = () => { if (OB.edit.changed && !confirm('Leave without saving your changes?')) return; OB.edit = null; render(); };
ACT['ob-edit-reset'] = () => {
  if (!confirm('Go back to the standard onboarding steps?\n\nYour own steps and items are removed for all your new hires. Ticks on standard items stay.')) return;
  OB.edit.steps = onbCopy(ONB_STD); OB.edit.cur = 'before'; OB.edit.changed = true; OB.edit.reset = true; render();
};
ACT['ob-edit-save'] = async () => {
  const E = OB.edit, L = E.steps;
  L.forEach(s => { if (s.items) s.items = s.items.filter(it => String(it.t || '').trim()); });
  const bad = L.find(s => s.k !== 'mkt' && (!String(s.t || '').trim() || !s.items.length));
  if (bad) { E.cur = bad.k; render(); return toast(!String(bad.t || '').trim() ? 'Give this step a name.' : 'Add at least one item to “' + bad.t + '”, or delete the step.'); }
  const std = JSON.stringify(onbCopy(ONB_STD)) === JSON.stringify(L);
  E.saving = true; render();
  try {
    const r = await onbPost({ op: 'steps', steps: std ? null : L });
    OB.steps[String(S.me.email).toLowerCase()] = r.steps || null;
    OB.edit = null; render(); toast('Your onboarding steps are saved.');
  } catch (e) { E.saving = false; render(); toast('Couldn’t save your steps: ' + e.message, 7000); }
};
// leaving the Onboarding page drops an unsaved edit
window.addEventListener('hashchange', () => { if (OB.edit && route() !== 'onboard') OB.edit = null; });
