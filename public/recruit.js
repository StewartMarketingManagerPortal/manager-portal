// Manager Portal · Recruiting: show a candidate sample marketing with their own photo and contact details.
// Candidates are kept on the private "Recruiting" board. The pieces are drawn on screen by samples.js; nothing goes to the marketing team.
'use strict';

const RC = { list: null, days: 60, err: '', form: null, busy: false, confirm: null, opening: false, log: {}, note: {}, edit: null, meet: null, mail: null, called: null, saving: false };
const rcFresh = () => ({ firstName: '', lastName: '', company: '', title: 'Sales Representative', area: '', phone: '', email: '', file: null, cut: '', cutting: false, cutFail: false });
async function rcLoad() {
  try { const r = await api('recruiting'); RC.list = r.candidates || []; RC.days = r.days || 60; RC.board = r.board || null; RC.err = ''; }
  catch (e) { RC.list = []; RC.err = e.message; }
  if (route() === 'recruit') render();
}
const rcHash = () => (location.hash.slice(1).split('/')[1] || '');
const rcGet = id => (RC.list || []).find(c => c.id === id);
const rcPhoto = c => c.photo ? '/api/recphoto/' + encodeURIComponent(c.id) : '';
const rcAge = c => { const d = Math.round((new Date(iso(new Date()) + 'T12:00:00') - new Date(String(c.added).slice(0, 10) + 'T12:00:00')) / 864e5); return isNaN(d) ? 0 : d; };
const RC_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

PAGES.recruit = () => {
  if (!RC.list) { rcLoad(); return '<div class="head"><div><h1>Recruiting</h1></div></div><div class="card"><span class="spin dark"></span></div>'; }
  after.push(() => Samples.fix(document.getElementById('main')));
  const id = rcHash();
  if (id) { const c = rcGet(id); return c ? rcSample(c) : '<div class="head"><div><a href="#recruit" style="font-weight:600;font-size:14px">‹ Recruiting</a><h1>Not found</h1><div class="sub">This candidate was removed.</div></div></div>'; }
  if (!RC.form) RC.form = rcFresh();
  let h = '<div class="head"><div><h1>Recruiting</h1><div class="sub">Show a candidate the marketing they’d get at Stewart. Samples only, made in seconds, and gone when you remove them.</div></div>' +
    '<a class="btn primary" href="#" data-act="rc-focus">+ Add a candidate</a></div>';
  if (RC.err) h += '<div class="err">' + esc(RC.err) + '</div>';
  h += '<div class="cols"><section class="card col2"><h2>Your candidates</h2>';
  const many = S.me.admin || S.me.president;
  h += RC.list.length ? '<div>' + RC.list.map(c => {
    const left = RC.days - rcAge(c);
    const av = c.photo ? '<span class="av tm-ph rc-av"><img data-center="1" src="' + esc(rcPhoto(c)) + '" alt=""></span>' : '<span class="av">' + esc(initials(c.name)) + '</span>';
    return '<div class="rq">' + av + '<div class="grow"><b>' + esc(c.name) + '</b><span class="meta">' +
      esc([c.company ? 'From ' + c.company : '', 'Added ' + nice(c.added), many && c.manager ? 'for ' + c.manager : '', left <= 20 ? 'removed automatically in ' + plural(Math.max(0, left), 'day') : ''].filter(Boolean).join(' · ')) +
      '</span></div><a class="btn small" href="#recruit/' + esc(c.id) + '">Show samples</a></div>';
  }).join('') + '</div>' : '<div class="empty">No candidates yet. Add one to make their samples.</div>';
  h += '<div class="small muted row" style="gap:8px;flex-wrap:nowrap;align-items:flex-start">' + RC_LOCK + '<span>Only you' + (S.me.president ? ', your managers' : ', your assistant and your president') + ' see these. Candidates left for ' + RC.days + ' days are removed automatically.</span></div>' + rcBoardLine() + '</section>';
  h += rcForm(RC.form) + '</div>';
  return h;
};
function rcBoardLine() {
  if (!RC.board) return '';
  const bd = RC.board;
  return '<div class="small muted rc-board"><b>Portal admins:</b> candidates are kept on the private board “' + esc(bd.name) + '” in ' + esc(bd.workspace) + '. ' +
      (bd.url ? '<a href="' + esc(bd.url) + '" target="_blank" rel="noopener">Open it in monday.com ›</a>' : '') + (bd.inWest ? '' : ' <span class="rc-warn">It should be in Stewart West Marketing. In monday.com, open the board’s menu and use Move to workspace.</span>') + '</div>';
}
function rcForm(f) {
  const titles = Array.from(new Set(['Sales Representative'].concat(S.me.titles || [])));
  const pic = f.cut ? '<img src="' + esc(f.cut) + '" alt="" style="width:100%;height:100%;object-fit:contain;object-position:bottom">' :
    f.cutting ? '<span class="spin dark"></span>' : f.file ? '<img src="' + esc(f.raw) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : '<span class="small muted" style="padding:10px;text-align:center">Add a photo</span>';
  return '<section class="card col3" id="rc-add"><div class="row"><h2 class="grow">Add a candidate</h2><span class="muted small">Nothing goes to the marketing team</span></div>' +
    '<div class="row" style="align-items:flex-start;gap:20px">' +
    '<div style="display:flex;flex-direction:column;gap:8px;align-items:center;width:150px"><label class="rc-photo" style="width:150px;height:170px;border-radius:14px;overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      (f.cut ? 'background:repeating-conic-gradient(#E4E1DC 0 25%,#fff 0 50%) 0 0/16px 16px' : 'background:var(--pill)') + '">' + pic + '<input type="file" accept="image/*" data-rc-photo="1" hidden></label>' +
    '<span class="muted small" style="text-align:center">' + (f.cutting ? 'Removing the background…' : f.cut ? 'Background removed for you' : f.cutFail ? 'Couldn’t remove the background, so the photo is used as is' : 'Shoulders up, facing the camera') + '</span>' +
    (f.file ? '<label class="btn small" style="cursor:pointer">Change photo<input type="file" accept="image/*" data-rc-photo="1" hidden></label>' : '') + '</div>' +
    '<div class="grid2 grow">' +
    '<label class="field">First name<input type="text" data-rc="firstName" value="' + esc(f.firstName) + '" autocomplete="off"></label>' +
    '<label class="field">Last name<input type="text" data-rc="lastName" value="' + esc(f.lastName) + '" autocomplete="off"></label>' +
    '<label class="field" style="grid-column:1/-1">Current company<input type="text" data-rc="company" value="' + esc(f.company) + '" placeholder="Where they work now" autocomplete="off"></label>' +
    '<label class="field">Title they’d have<select data-rc="title">' + titles.map(t => '<option' + (t === f.title ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>' +
    '<label class="field">Area<input type="text" data-rc="area" value="' + esc(f.area) + '" placeholder="e.g. East Bay"></label>' +
    '<label class="field">Their phone<input type="tel" data-rc="phone" value="' + esc(f.phone) + '"></label>' +
    '<label class="field">Their email<input type="email" data-rc="email" value="' + esc(f.email) + '"></label>' +
    '</div></div>' +
    '<div class="preview rc-prev"><div class="cardlabel" style="color:var(--navmuted)">Live preview · contact block</div><div class="cblock" id="rc-cblock">' + rcBlock(f) + '</div>' +
    '<div class="small" style="color:var(--border)">How their details will look on the sample flyers and email signature.</div></div>' +
    '<div class="rc-note"><b>Samples use their own phone and email.</b> Stewart email and phone are never on them, and there are no downloads, so they can’t be used as real marketing.</div>' +
    '<div class="row" style="justify-content:space-between"><a href="#" data-act="rc-clear" style="font-weight:600">Clear</a><button type="button" class="btn primary" data-act="rc-add"' + (RC.busy || f.cutting ? ' disabled' : '') + '>' +
    (RC.busy ? '<span class="spin"></span> Saving…' : 'Make ' + esc(f.firstName.trim() ? f.firstName.trim() + '’s' : 'their') + ' samples ›') + '</button></div></section>';
}
// the same contact block the new hire form previews, with the candidate's own phone and email
function rcBlock(f) {
  const name = (f.firstName + ' ' + f.lastName).trim();
  const pic = f.cut ? '<img src="' + esc(f.cut) + '" alt="">' : f.raw ? '<img class="raw" src="' + esc(f.raw) + '" alt="">' : '<span class="cblk-ini">' + esc(initials(name) || '?') + '</span>';
  return '<div class="cblk mini"><div class="cblk-pic">' + pic + '</div><div class="cblk-txt">' +
    '<div class="cblk-name">' + esc(name || 'Their name') + '</div><div class="cblk-title">' + esc(f.title || 'Title') + (f.area.trim() ? ' · ' + esc(f.area.trim()) : '') + '</div><div class="cblk-lines">' +
    (f.phone.trim() ? '<div>' + CB_ICONS.phone + '<span>' + esc(fmtPhone(f.phone)) + '</span></div>' : '') +
    (f.email.trim() ? '<div>' + CB_ICONS.mail + '<span>' + esc(f.email.trim()) + '</span></div>' : '') + '</div>' +
    '<img class="cblk-logo" src="logo-dark.png" alt="Stewart Title"></div></div>';
}
const RC_ICON = {
  call: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  text: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>'
};
const RC_TYPES = ['Coffee', 'Lunch', 'Office visit', 'Phone call', 'Video call'];
const rcMe = () => S.me.assistant || S.me.name;
const rcNow = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const rcTime = t => { const m = /^(\d{2}):(\d{2})$/.exec(t || ''); if (!m) return ''; const h = +m[1]; return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM'); };
// ready-made emails; they open in the manager's own email app (Outlook) to change and send
function rcMails(c) {
  const f = esc0(c.name.split(' ')[0]), me = rcMe().split(' ')[0], sign = '\n\nThanks,\n' + me;
  return [
    { t: 'Nice to meet you', d: 'Thanks for the talk, next steps', s: 'Great to meet you, ' + f, b: 'Hi ' + f + ',\n\nThanks for taking the time to talk. I enjoyed hearing about your work, and I think you’d be a great fit at Stewart Title.\n\nI’d love to keep the conversation going. Let me know a good time to connect again.' + sign },
    { t: 'Let’s grab coffee', d: 'Suggests a time to meet', s: 'Coffee this week?', b: 'Hi ' + f + ',\n\nWould you have time for a coffee this week or next? I’d like to tell you more about Stewart Title and hear what you’re looking for.\n\nLet me know a day and time that works and I’ll find a spot near you.' + sign },
    { t: 'Your Stewart marketing', d: 'What you’d get from the marketing team', s: 'The marketing you’d have at Stewart', b: 'Hi ' + f + ',\n\nI wanted to share what our marketing team would do for you at Stewart. Your first week, they make your welcome announcement, introduction post, email signature and social media headers. After that you get a market update for your area every week, and new flyers, title tips and a newsletter every month, all with your photo and contact details.\n\nHappy to walk you through it anytime.' + sign },
    { t: 'Checking in', d: 'A short follow-up', s: 'Checking in', b: 'Hi ' + f + ',\n\nJust checking in to see how you’re doing, and whether you’ve had a chance to think more about Stewart Title. I’m happy to answer any questions.' + sign },
    { t: 'Blank email', d: '', s: '', b: '' }
  ].map(m => Object.assign(m, { href: 'mailto:' + encodeURIComponent(c.email || '') + (m.s ? '?subject=' + encodeURIComponent(m.s) + '&body=' + encodeURIComponent(m.b) : '') }));
}
const esc0 = s => String(s || '');
function rcSample(c) {
  const first = c.name.split(' ')[0], left = RC.days - rcAge(c), log = RC.log[c.id];
  if (!log) rcLogLoad(c.id);
  let h = '<div class="head"><div><a href="#recruit" style="font-weight:600;font-size:14px">‹ Recruiting</a><h1 style="margin-top:6px">' + esc(c.name) + '</h1>' +
    '<div class="sub">' + esc(['Candidate for ' + (c.title || 'Sales Representative'), c.added ? 'added ' + nice(c.added) : '', 'removed automatically in ' + plural(Math.max(0, left), 'day')].filter(Boolean).join(' · ')) + '</div></div></div>';
  h += '<div class="cd-grid"><aside class="cd-side">' + rcDetails(c, first) + rcMeetings(c, log) + rcNotes(c, first, log) + '</aside>' + rcRight(c, first) + '</div>';
  if (RC.confirm === c.id) h += '<div class="inst-wrap" data-act="rc-x"><div class="inst" role="dialog" aria-modal="true" aria-labelledby="rc-t"><h2 id="rc-t">Remove ' + esc(first) + '?</h2>' +
    '<div class="muted2" style="font-size:15px;line-height:1.5">Use this if you’re not hiring ' + esc(first) + '. This removes:</div>' +
    '<ul style="margin:0;padding-left:20px;line-height:1.8;color:var(--muted2)"><li>' + esc(first) + ' from your Recruiting list</li><li>Their photo, details, meetings and notes</li><li>Their sample page here and on My Marketing</li></ul>' +
    '<div class="small muted">If you hire them later, start their onboarding as usual and the marketing team makes their real package.</div>' +
    '<div class="row" style="justify-content:flex-end;align-self:stretch"><button type="button" class="btn" data-act="rc-keep">Keep</button><button type="button" class="btn primary" data-act="rc-remove" data-id="' + esc(c.id) + '"' + (RC.busy ? ' disabled' : '') + '>' + (RC.busy ? '<span class="spin"></span> Removing…' : 'Remove everything') + '</button></div></div></div>';
  return h;
}
function rcDetails(c, first) {
  const id = esc(c.id), e = RC.edit && RC.edit.id === c.id ? RC.edit : null;
  let h = '<section class="card"' + (e ? '' : ' data-rc-drop="' + id + '"') + '><div class="cd-hd"><span class="cardlabel">Details</span>' + (e ? '' : '<span class="cd-btns"><button type="button" class="btn small" data-act="rc-edit" data-id="' + id + '">Edit</button><button type="button" class="btn small cd-rm" data-act="rc-ask" data-id="' + id + '">Remove</button></span>') + '</div>';
  const ph = c.photo ? '<img data-center="1" src="' + esc(rcPhoto(c)) + '" alt="">' : '<span class="cd-ini">' + esc(initials(c.name)) + '</span>';
  h += '<div class="cd-top"><div class="cd-ph' + (c.photo ? '' : ' none') + '">' + ph + '</div><div style="min-width:0"><div class="cd-nm">' + esc(c.name) + '</div>' + (c.company ? '<div class="cd-sub">Now at ' + esc(c.company) + '</div>' : '') +
    '<a href="#" class="cd-link" data-act="rc-open" data-id="' + id + '">' + (RC.opening ? 'Opening…' : 'Show on My Marketing ›') + '</a></div></div>';
  if (e) {
    const titles = Array.from(new Set(['Sales Representative', e.title].concat(S.me.titles || []).filter(Boolean)));
    const fld = (k, l, t, full) => '<label' + (full ? ' class="full"' : '') + '>' + l + '<input type="' + (t || 'text') + '" data-rce="' + k + '" value="' + esc(e[k]) + '" autocomplete="off"></label>';
    return h + '<div class="cd-form">' + fld('firstName', 'First name') + fld('lastName', 'Last name') + fld('company', 'Current company', '', true) +
      '<label class="full">Title they’d have<select data-rce="title">' + titles.map(t => '<option' + (t === e.title ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>' +
      fld('area', 'Area', '', true) + fld('phone', 'Phone', 'tel') + fld('email', 'Email', 'email') + fld('workPhone', 'Work phone', 'tel') + fld('workEmail', 'Work email', 'email') +
      '<div class="full cd-row"><button type="button" class="btn small" data-act="rc-edit-x">Cancel</button><button type="button" class="btn small primary" data-act="rc-edit-save" data-id="' + id + '"' + (RC.saving ? ' disabled' : '') + '>' + (RC.saving ? 'Saving…' : 'Save') + '</button></div></div></section>';
  }
  const tel = String(c.phone || '').replace(/[^\d+]/g, '');
  const dis = (on, label, icon, attrs) => on ? '<a class="cd-a" ' + attrs + '>' + icon + label + '</a>' : '<span class="cd-a off" title="Add their ' + (label === 'Email' ? 'email' : 'phone') + ' first">' + icon + label + '</span>';
  h += '<div class="cd-act">' + dis(tel, 'Call', RC_ICON.call, 'href="tel:' + esc(tel) + '" data-act="rc-call" data-id="' + id + '"') + dis(tel, 'Text', RC_ICON.text, 'href="sms:' + esc(tel) + '"') +
    (c.email ? '<button type="button" class="cd-a' + (RC.mail === c.id ? ' on' : '') + '" data-act="rc-mail" data-id="' + id + '" aria-expanded="' + (RC.mail === c.id) + '">' + RC_ICON.mail + 'Email</button>' : dis('', 'Email', RC_ICON.mail)) + '</div>';
  if (RC.mail === c.id) h += '<div class="cd-menu"><div class="hd">Opens in Outlook, ready to change and send</div>' + rcMails(c).map(m => '<a class="i" href="' + esc(m.href) + '" data-act="rc-mail-x">' + esc(m.t) + (m.d ? '<small>' + esc(m.d) + '</small>' : '') + '</a>').join('') + '</div>';
  if (RC.called === c.id) h += '<div class="cd-log"><span>Called ' + esc(first) + ' just now. Add it to Meetings?</span><span class="cd-btns"><button type="button" class="btn small" data-act="rc-call-x">No</button><button type="button" class="btn small primary" data-act="rc-call-log" data-id="' + id + '">Log the call</button></span></div>';
  h += RC.mailIn && RC.mailIn.id === c.id ? rcMailReview(c, first) :
    '<div class="cd-dz">' + RC_ICON.mail + '<span><b>Drag an email here</b>From Outlook, to save it to ' + esc(first) + '’s notes. <label class="cd-pick">Or choose a file<input type="file" accept=".eml,.msg,message/rfc822,application/vnd.ms-outlook,application/pdf,image/*,.doc,.docx" data-rc-mailfile="' + id + '" hidden></label></span></div>';
  const row = (l, v) => v ? '<dt>' + l + '</dt><dd>' + esc(v) + '</dd>' : '';
  h += '<dl class="cd-dl">' + row('Title they’d have', c.title) + row('Area', c.area) + row('Current company', c.company) + row('Phone', fmtPhone(c.phone)) + row('Email', c.email) + row('Work phone', fmtPhone(c.workPhone)) + row('Work email', c.workEmail) + row('Added by', c.manager) + row('Added', nice(c.added)) + '</dl>';
  const files = (RC.log[c.id] && RC.log[c.id].files) || [];
  if (files.length) h += '<div class="cd-sec">Files</div><div class="cd-files">' + files.map(f => '<a class="cd-file" href="/api/recfile/' + id + '/' + esc(f.id) + '" target="_blank" rel="noopener"><span class="t">' + esc((f.ext || 'file').slice(0, 4).toUpperCase()) + '</span>' +
    '<span class="grow" style="min-width:0"><b>' + esc(f.name) + '</b><small>' + esc([rcSize(f.size), rcDay(f.at)].filter(Boolean).join(' · ')) + '</small></span><span class="btn small">Open</span></a>').join('') + '</div>';
  return h + '</section>';
}
const rcDay = s => { const d = new Date(s || ''); return isNaN(d) ? '' : nice(iso(d)); };
const rcSize = n => !n ? '' : n < 1e6 ? Math.max(1, Math.round(n / 1e3)) + ' KB' : (n / 1e6).toFixed(1) + ' MB';
const rcOurs = e => /@stewart\.com$/i.test(e || '') || (S.me.email && String(e).toLowerCase() === String(S.me.email).toLowerCase());
const rcDigits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
// what an email adds to Details: their address (from them, or to them when it's one the manager sent) and the last phone in their signature
function rcMailDetails(c, m) {
  const det = {};
  if (!m) return det;
  const them = rcOurs(m.from.email) ? (m.to || []).find(t => !rcOurs(t.email)) : m.from;
  const known = [c.email, c.workEmail].map(x => String(x || '').toLowerCase());
  if (them && them.email && !known.includes(them.email)) det[c.email ? 'workEmail' : 'email'] = them.email;
  if (them === m.from) {
    const ph = (m.latest.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []).map(rcDigits).filter(d => d.length === 10);
    const p = ph.reverse().find(d => d !== rcDigits(c.phone) && d !== rcDigits(c.workPhone));
    if (p) det[c.phone ? 'workPhone' : 'phone'] = fmtPhone(p);
  }
  return det;
}
const RC_DET = { phone: 'Phone', email: 'Email', workPhone: 'Work phone', workEmail: 'Work email' };
function rcMailReview(c, first) {
  const x = RC.mailIn, m = x.m, id = esc(c.id);
  let h = '<div class="cd-em">';
  if (x.reading) return h + '<span class="spin dark"></span> <span class="small muted">Reading the email…</span></div>';
  if (m) h += '<div class="h"><span class="ic">' + RC_ICON.mail + '</span><div style="min-width:0"><div class="s">' + esc(m.subject || '(no subject)') + '</div><div class="f">' +
    esc(['From ' + ([m.from.name, m.from.email ? '<' + m.from.email + '>' : ''].filter(Boolean).join(' ') || 'unknown'), rcDay(m.date)].filter(Boolean).join(' · ')) + '</div></div></div>' +
    (m.latest ? '<div class="q">' + esc(m.latest.slice(0, 400)) + '</div>' : '') +
    '<label><input type="checkbox" data-rc-mi="note"' + (x.note ? ' checked' : '') + '><span>Save the email to Notes<small>Subject, date and the message</small></span></label>';
  else h += '<div class="s">Save ' + (x.files.length === 1 ? 'this file' : 'these files') + ' to ' + esc(first) + '?</div>';
  x.files.forEach((f, i) => { h += '<label><input type="checkbox" data-rc-mi="f' + i + '"' + (f.keep ? ' checked' : '') + (f.size > 25e6 ? ' disabled' : '') + '><span>' + (m ? 'Save the attachment' : 'Save the file') +
    '<small><span class="att">' + esc(f.name) + ' · ' + rcSize(f.size) + '</span>' + (f.size > 25e6 ? ' Too big to save (25 MB at most)' : f.inline ? ' A picture in the email' : '') + '</small></span></label>'; });
  const dk = Object.keys(x.det);
  if (dk.length) h += '<label><input type="checkbox" data-rc-mi="det"' + (x.detKeep ? ' checked' : '') + '><span>Add what’s new to Details<small>' + esc(dk.map(k => RC_DET[k] + ' ' + x.det[k]).join(' · ')) + '</small></span></label>';
  return h + '<div class="cd-row"><button type="button" class="btn small" data-act="rc-mail-cancel">Cancel</button><button type="button" class="btn small primary" data-act="rc-mail-save" data-id="' + id + '"' + (x.busy ? ' disabled' : '') + '>' +
    (x.busy ? '<span class="spin"></span> Saving…' : 'Save to ' + esc(first)) + '</button></div></div>';
}
const rcIsMail = f => /\.(eml|msg)$/i.test(f.name || '') || /^message\/rfc822$|ms-outlook/i.test(f.type || '');
async function rcTakeFiles(id, list) {
  const c = rcGet(id); list = [...(list || [])].filter(f => f && f.size != null);
  if (!c || !list.length) return;
  const mail = list.find(rcIsMail);
  RC.mailIn = { id, reading: true, files: [], det: {} }; render();
  let m = null;
  if (mail) { try { m = await MailFile.read(mail); } catch (e) { RC.mailIn = null; render(); toast('Couldn’t read that email. Try saving it from Outlook as a file, then choose it here.', 8000); return; } }
  const atts = m ? m.attachments.filter(a => !a.inline || a.size >= 20e3) : list.map(f => ({ name: f.name, type: f.type, size: f.size, inline: false, file: f }));
  RC.mailIn = { id, m, note: !!m, files: atts.slice(0, 10).map(a => Object.assign(a, { keep: !a.inline && a.size <= 25e6 })), det: rcMailDetails(c, m), detKeep: true };
  if (!m && !RC.mailIn.files.length) RC.mailIn = null;
  render();
}
function rcMeetings(c, log) {
  const id = esc(c.id), f = RC.meet && RC.meet.id === c.id ? RC.meet : null;
  let h = '<section class="card"><div class="cd-hd"><span class="cardlabel">Meetings</span>' + (f ? '' : '<button type="button" class="btn small" data-act="rc-meet" data-id="' + id + '">+ Add a meeting</button>') + '</div>';
  if (f) h += '<div class="cd-form"><div class="full cd-chips">' + RC_TYPES.map(t => '<button type="button" class="' + (t === f.type ? 'on' : '') + '" data-act="rc-mtype" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') + '</div>' +
    '<label>Date<input type="date" data-rcm="date" value="' + esc(f.date) + '"></label><label>Time<input type="time" data-rcm="time" value="' + esc(f.time) + '"></label>' +
    '<label class="full">Where<input type="text" data-rcm="where" value="' + esc(f.where) + '" placeholder="Office, coffee shop, video link"></label>' +
    '<label class="full">Who’s going<input type="text" data-rcm="who" value="' + esc(f.who) + '"></label>' +
    '<label class="full">Notes<input type="text" data-rcm="notes" value="' + esc(f.notes) + '" placeholder="What to cover"></label>' +
    '<div class="full cd-row"><button type="button" class="btn small" data-act="rc-meet-x">Cancel</button><button type="button" class="btn small primary" data-act="rc-meet-save" data-id="' + id + '"' + (RC.saving ? ' disabled' : '') + '>' + (RC.saving ? 'Saving…' : 'Save meeting') + '</button></div></div>';
  if (!log) return h + '<span class="spin dark"></span></section>';
  if (log.err) return h + '<div class="small muted">Couldn’t load meetings: ' + esc(log.err) + '</div></section>';
  const td = iso(new Date()), done = m => m.done || m.date < td;
  const up = log.meetings.filter(m => !done(m)), past = log.meetings.filter(done).reverse();
  const one = (m, p) => { const d = new Date(m.date + 'T12:00:00');
    return '<div class="cd-mt' + (p ? ' past' : '') + '"><div class="cd-dt"><span>' + MONTHS[d.getMonth()].slice(0, 3).toUpperCase() + '</span><b>' + d.getDate() + '</b></div><div class="grow" style="min-width:0"><div class="t">' + esc(m.type) +
      '<span class="cd-tag">' + (p ? 'Done' : esc([DAYS[d.getDay()].slice(0, 3), rcTime(m.time)].filter(Boolean).join(' · '))) + '</span></div>' +
      ((m.where || m.who) ? '<div class="w">' + esc([m.where, m.who ? 'with ' + m.who : ''].filter(Boolean).join(' · ')) + '</div>' : '') + (m.notes ? '<div class="n">' + esc(m.notes) + '</div>' : '') + '</div>' +
      '<button type="button" class="cd-x" data-act="rc-log-del" data-id="' + id + '" data-u="' + esc(m.id) + '" title="Remove this meeting" aria-label="Remove this meeting">×</button></div>'; };
  if (!up.length && !past.length && !f) h += '<div class="small muted">No meetings yet.</div>';
  if (up.length) h += '<div class="cd-sec">Coming up</div>' + up.map(m => one(m)).join('');
  if (past.length) h += '<div class="cd-sec">Done</div>' + past.map(m => one(m, true)).join('');
  return h + '</section>';
}
function rcNotes(c, first, log) {
  const id = esc(c.id);
  let h = '<section class="card"><div class="cd-hd"><span class="cardlabel">Notes</span></div>' +
    '<textarea class="cd-ta" data-rcn="1" placeholder="Add a note about ' + esc(first) + '…">' + esc(RC.note[c.id] || '') + '</textarea>' +
    '<div class="cd-row"><button type="button" class="btn small primary" data-act="rc-note" data-id="' + id + '"' + (RC.saving ? ' disabled' : '') + '>Save note</button></div>';
  if (log && log.notes) h += log.notes.map(n => '<div class="cd-note"><div class="by"><span class="grow">' + esc([n.by, rcDay(n.at)].filter(Boolean).join(' · ')) + '</span>' +
    '<button type="button" class="cd-x" data-act="rc-log-del" data-id="' + id + '" data-u="' + esc(n.id) + '" title="Remove this note" aria-label="Remove this note">×</button></div>' +
    (n.mail ? '<div class="cd-mail">' + RC_ICON.mail + '<span>' + esc(n.mail.subject || '(no subject)') + '</span></div><div class="cd-from">' + esc(['From ' + (n.mail.from || 'unknown'), rcDay(n.mail.date)].filter(Boolean).join(' · ')) + '</div>' : '') +
    esc(n.text) + (n.files && n.files.length ? '<div class="cd-from">Attached: ' + esc(n.files.join(', ')) + '</div>' : '') + '</div>').join('');
  return h + '</section>';
}
// right side: the phone view and what they'd get, then every piece grouped by when it comes
function rcRight(c, first) {
  const all = Samples.html(c, rcPhoto(c), 'brand/stewart-logo.png');
  const tmp = document.createElement('div'); tmp.innerHTML = all;
  const P = [...tmp.querySelectorAll('.sp-cap')].map(x => x.parentElement.outerHTML);
  const pc = (i, wide) => P[i] ? '<div class="cd-pc' + (wide ? ' wide' : '') + '">' + P[i] + '</div>' : '';
  const when = (ic, t, d) => '<div class="cd-when"><span class="ic">' + ic + '</span><div><b>' + t + '</b><div>' + d + '</div></div></div>';
  return '<div class="cd-right"><section class="card cd-b"><div class="cd-phone"><div class="notch"></div><div class="scr"><div class="rc-mm-hd"><img src="logo-light.png" alt="Stewart Title"><span class="rc-tag">SAMPLE</span></div>' +
    '<div class="rc-mm-hi"><h3>Hi ' + esc(first) + '</h3><p>Here’s what would be waiting for you, ready to share.</p></div><div class="rc-mm-body">' + all + '</div></div></div>' +
    '<div class="cd-get"><h2>What ' + esc(first) + ' would get</h2>' +
    when('WK 1', 'The week ' + esc(first) + ' joins', 'Welcome post, introduction post, email signature, and LinkedIn and Facebook headers, all made for them.') +
    when('WK', 'Every week', 'A market update for their area, with their photo and contact details.') +
    when('MO', 'Every month', 'Buyer and seller flyers, title tips, a safety tip and a newsletter for their farm area.') +
    when('+', 'Anytime', 'Custom pieces on request from the marketing team.') +
    '<div class="small muted">The phone shows how My Marketing looks on their phone. Scroll it to see every piece.</div></div></section>' +
    '<section class="card"><h2 style="margin:0">Every piece, by when it comes</h2><div class="sp">' +
    '<div class="cd-band"><div class="lb"><b>Week one</b><span>Made for them when they join</span></div><div class="cd-row2">' + pc(0) + pc(1) + pc(2, 1) + pc(3, 1) + '</div></div>' +
    '<div class="cd-band"><div class="lb"><b>Every week</b><span>For their area</span></div><div class="cd-row2">' + pc(4) + '</div></div>' +
    '<div class="cd-band"><div class="lb"><b>Every month</b><span>New each month</span></div><div class="cd-row2">' + pc(5) + pc(6) + pc(7) + pc(8) + pc(9) + '</div></div></div></section></div>';
}
async function rcLogLoad(id) {
  RC.log[id] = { meetings: [], notes: [], loading: true };
  try { const r = await api('recruiting/log/' + encodeURIComponent(id)); RC.log[id] = { meetings: r.meetings || [], notes: r.notes || [] }; }
  catch (e) { RC.log[id] = { meetings: [], notes: [], err: e.message }; }
  if (route() === 'recruit' && rcHash() === id) render();
}
async function rcLogAdd(id, kind, data) {
  RC.saving = true; render();
  try {
    const r = await api('recruiting/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, kind, data }) });
    const log = RC.log[id] || (RC.log[id] = { meetings: [], notes: [] });
    if (kind === 'note') log.notes.unshift(r.entry); else { log.meetings.push(r.entry); log.meetings.sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time))); }
    RC.saving = false; return true;
  } catch (e) { RC.saving = false; render(); toast(e.message, 7000); return false; }
}
ACT['rc-focus'] = () => { const el = document.querySelector('[data-rc=firstName]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } };
ACT['rc-clear'] = () => { RC.form = rcFresh(); render(); };
ACT['rc-add'] = async el => {
  const f = RC.form;
  if (!f.firstName.trim() || !f.lastName.trim()) { toast('Add their first and last name.'); return; }
  RC.busy = true; render();
  try {
    const fd = new FormData();
    fd.append('fields', JSON.stringify({ firstName: f.firstName, lastName: f.lastName, company: f.company, title: f.title, area: f.area, phone: f.phone, email: f.email }));
    if (f.cut) fd.append('photo', new File([await (await fetch(f.cut)).blob()], 'photo.png', { type: 'image/png' }));
    else if (f.file) fd.append('photo', f.file, f.file.name || 'photo.jpg');
    const r = await api('recruiting', { method: 'POST', body: fd });
    if (r.warn) toast(r.warn, 7000);
    RC.form = null; RC.busy = false; RC.list = null;
    location.hash = 'recruit/' + r.id;
  } catch (e) { RC.busy = false; render(); toast(e.message, 7000); }
};
ACT['rc-open'] = async el => {
  RC.opening = true; render();
  const w = window.open('', '_blank');
  try { const r = await api('recview/' + el.dataset.id); if (w) w.location = r.url; else location.href = r.url; }
  catch (e) { if (w) w.close(); toast(e.message, 7000); }
  RC.opening = false; render();
};
ACT['rc-edit'] = el => { const c = rcGet(el.dataset.id); if (!c) return; const [fn, ...ln] = c.name.split(' ');
  RC.edit = { id: c.id, firstName: fn, lastName: ln.join(' '), company: c.company || '', title: c.title || 'Sales Representative', area: c.area || '', phone: c.phone || '', email: c.email || '', workPhone: c.workPhone || '', workEmail: c.workEmail || '' }; RC.mail = null; render(); };
ACT['rc-edit-x'] = () => { RC.edit = null; render(); };
ACT['rc-edit-save'] = async el => {
  const e = RC.edit; if (!e) return;
  if (!e.firstName.trim() || !e.lastName.trim()) { toast('Add their first and last name.'); return; }
  RC.saving = true; render();
  try {
    await api('recruiting/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, fields: e }) });
    const c = rcGet(e.id); if (c) Object.assign(c, { name: (e.firstName.trim() + ' ' + e.lastName.trim()), company: e.company.trim(), title: e.title, area: e.area.trim(), phone: e.phone.trim(), email: e.email.trim(), workPhone: e.workPhone.trim(), workEmail: e.workEmail.trim() });
    RC.edit = null; RC.saving = false; render(); toast('Saved.');
  } catch (x) { RC.saving = false; render(); toast(x.message, 7000); }
};
ACT['rc-mail'] = el => { RC.mail = RC.mail === el.dataset.id ? null : el.dataset.id; render(); };
ACT['rc-mail-x'] = () => { setTimeout(() => { RC.mail = null; render(); }, 300); };
// tel: links open the phone app (or Teams/FaceTime on a computer); afterwards offer to log the call
ACT['rc-call'] = el => { const id = el.dataset.id; setTimeout(() => { RC.called = id; render(); }, 300); };
ACT['rc-call-x'] = () => { RC.called = null; render(); };
ACT['rc-call-log'] = async el => { if (await rcLogAdd(el.dataset.id, 'meeting', { type: 'Phone call', date: iso(new Date()), time: rcNow(), who: rcMe(), done: true })) { RC.called = null; render(); toast('Call logged.'); } };
ACT['rc-meet'] = el => { const c = rcGet(el.dataset.id); RC.meet = { id: el.dataset.id, type: 'Coffee', date: '', time: '', where: '', who: [rcMe(), c ? c.name : ''].filter(Boolean).join(', '), notes: '' }; render(); };
ACT['rc-meet-x'] = () => { RC.meet = null; render(); };
ACT['rc-mtype'] = el => { if (RC.meet) { RC.meet.type = el.dataset.t; render(); } };
ACT['rc-meet-save'] = async el => {
  const f = RC.meet; if (!f) return;
  if (!f.date) { toast('Pick a date for the meeting.'); return; }
  if (await rcLogAdd(el.dataset.id, 'meeting', f)) { RC.meet = null; render(); toast('Meeting added.'); }
};
ACT['rc-note'] = async el => {
  const id = el.dataset.id, t = String(RC.note[id] || '').trim();
  if (!t) { toast('Write a note first.'); return; }
  if (await rcLogAdd(id, 'note', { text: t })) { RC.note[id] = ''; render(); }
};
ACT['rc-log-del'] = async el => {
  const id = el.dataset.id, u = el.dataset.u, log = RC.log[id];
  if (!confirm('Remove this ' + (log && log.notes.some(n => n.id === u) ? 'note' : 'meeting') + '?')) return;
  try { await api('recruiting/log/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, uid: u }) });
    if (log) { log.notes = log.notes.filter(n => n.id !== u); log.meetings = log.meetings.filter(m => m.id !== u); } render(); }
  catch (e) { toast(e.message, 7000); }
};
ACT['rc-mail-cancel'] = () => { RC.mailIn = null; render(); };
ACT['rc-mail-save'] = async el => {
  const x = RC.mailIn, id = el.dataset.id; if (!x || x.busy) return;
  const m = x.m, files = x.files.filter(f => f.keep), det = x.detKeep ? x.det : {};
  if (!(m && x.note) && !files.length && !Object.keys(det).length) { toast('Tick something to save.'); return; }
  x.busy = true; render();
  try {
    const fd = new FormData();
    fd.append('fields', JSON.stringify({ id, details: det, note: m && x.note ? { subject: m.subject, from: [m.from.name, m.from.email ? '<' + m.from.email + '>' : ''].filter(Boolean).join(' '), date: m.date, text: m.latest || m.text } : null }));
    files.forEach(f => fd.append('file', f.file, f.name));
    const r = await api('recruiting/email', { method: 'POST', body: fd });
    const c = rcGet(id); if (c) Object.assign(c, det);
    const log = RC.log[id] || (RC.log[id] = { meetings: [], notes: [], files: [] });
    if (r.entry) log.notes.unshift(r.entry); log.files = r.files || log.files;
    RC.mailIn = null; render(); toast(r.warn ? 'Saved, but ' + r.warn + '.' : 'Saved to ' + (c ? c.name.split(' ')[0] : 'the candidate') + '.', r.warn ? 8000 : 3000);
  } catch (e) { x.busy = false; render(); toast(e.message, 7000); }
};
ACT['rc-ask'] = el => { RC.confirm = el.dataset.id; render(); };
ACT['rc-keep'] = () => { RC.confirm = null; render(); };
ACT['rc-x'] = (el, e) => { if (e.target === el) { RC.confirm = null; render(); } };
ACT['rc-remove'] = async el => {
  RC.busy = true; render();
  try { await api('recruiting/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: el.dataset.id }) });
    RC.list = (RC.list || []).filter(c => c.id !== el.dataset.id); RC.confirm = null; RC.busy = false; location.hash = 'recruit'; toast('Removed.'); }
  catch (e) { RC.busy = false; render(); toast(e.message, 7000); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (RC.confirm || RC.mail)) { RC.confirm = null; RC.mail = null; render(); } });
document.addEventListener('input', e => { const d = e.target.dataset || {};
  if (d.rce && RC.edit) { RC.edit[d.rce] = e.target.value; return; }
  if (d.rcm && RC.meet) { RC.meet[d.rcm] = e.target.value; return; }
  if (d.rcn) { const id = rcHash(); if (id) RC.note[id] = e.target.value; return; }
  const k = d.rc; if (k && RC.form) { RC.form[k] = e.target.value; const pv = document.getElementById('rc-cblock'); if (pv) pv.innerHTML = rcBlock(RC.form); if (k === 'firstName') { const b = document.querySelector('[data-act=rc-add]'); if (b && !RC.busy) b.textContent = 'Make ' + (RC.form.firstName.trim() ? RC.form.firstName.trim() + '’s' : 'their') + ' samples ›'; } } });
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset && t.dataset.rcMi && RC.mailIn) { const k = t.dataset.rcMi; if (k === 'note') RC.mailIn.note = t.checked; else if (k === 'det') RC.mailIn.detKeep = t.checked; else RC.mailIn.files[+k.slice(1)].keep = t.checked; return; }
  if (t.dataset && t.dataset.rcMailfile) { rcTakeFiles(t.dataset.rcMailfile, t.files); return; }
  if (t.dataset && t.dataset.rc && t.tagName === 'SELECT' && RC.form) { RC.form[t.dataset.rc] = t.value; const pv = document.getElementById('rc-cblock'); if (pv) pv.innerHTML = rcBlock(RC.form); return; }
  if (!(t.dataset && t.dataset.rcPhoto) || !t.files || !t.files[0] || !RC.form) return;
  const f = RC.form, file = t.files[0];
  if (!/^image\//.test(file.type)) { toast('Pick a photo (JPG or PNG).'); return; }
  if (f.cut) URL.revokeObjectURL(f.cut); if (f.raw) URL.revokeObjectURL(f.raw);
  Object.assign(f, { file, raw: URL.createObjectURL(file), cut: '', cutting: true, cutFail: false }); render();
  try { const u = await Samples.center(await Cutout.make(file)); if (RC.form === f && f.file === file) f.cut = u; }
  catch (x) { f.cutFail = true; }
  f.cutting = false; if (route() === 'recruit') render();
});

// drag an email (or a file) from Outlook or Finder onto a candidate's Details card
const rcDropAt = e => e.target && e.target.closest && e.target.closest('[data-rc-drop]');
const rcHasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].some(t => t === 'Files' || /FileGroupDescriptor|x-moz-file|filepromise/i.test(t));
document.addEventListener('dragover', e => { const z = rcDropAt(e); if (!z || !rcHasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; z.classList.add('hot'); });
document.addEventListener('dragleave', e => { const z = rcDropAt(e); if (z && !z.contains(e.relatedTarget)) z.classList.remove('hot'); });
document.addEventListener('drop', e => {
  const z = rcDropAt(e); if (!z) return;
  e.preventDefault(); z.classList.remove('hot');
  const files = e.dataTransfer && e.dataTransfer.files;
  if (!files || !files.length) { toast('That didn’t come through as an email. In Outlook, drag the email to your desktop first, then drag that file here.', 9000); return; }
  rcTakeFiles(z.dataset.rcDrop, files);
});
