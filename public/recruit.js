// Manager Portal · Recruiting: show a candidate sample marketing with their own photo and contact details.
// Candidates are kept on the private "Recruiting" board. The pieces are drawn on screen by samples.js; nothing goes to the marketing team.
'use strict';

const RC = { list: null, days: 60, err: '', form: null, busy: false, confirm: null, opening: false };
const rcFresh = () => ({ firstName: '', lastName: '', title: 'Sales Representative', area: '', phone: '', email: '', file: null, cut: '', cutting: false, cutFail: false });
async function rcLoad() {
  try { const r = await api('recruiting'); RC.list = r.candidates || []; RC.days = r.days || 60; RC.err = ''; }
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
    const av = c.photo ? '<span class="av tm-ph"><img src="' + esc(rcPhoto(c)) + '" alt="" loading="lazy"></span>' : '<span class="av">' + esc(initials(c.name)) + '</span>';
    return '<div class="rq">' + av + '<div class="grow"><b>' + esc(c.name) + '</b><span class="meta">' +
      esc(['Added ' + nice(c.added), many && c.manager ? 'for ' + c.manager : '', left <= 20 ? 'removed automatically in ' + plural(Math.max(0, left), 'day') : ''].filter(Boolean).join(' · ')) +
      '</span></div><a class="btn small" href="#recruit/' + esc(c.id) + '">Show samples</a></div>';
  }).join('') + '</div>' : '<div class="empty">No candidates yet. Add one to make their samples.</div>';
  h += '<div class="small muted row" style="gap:8px;flex-wrap:nowrap;align-items:flex-start">' + RC_LOCK + '<span>Only you' + (S.me.president ? ', your managers' : ', your assistant and your president') + ' see these. Candidates left for ' + RC.days + ' days are removed automatically.</span></div></section>';
  h += rcForm(RC.form) + '</div>';
  return h;
};
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
function rcSample(c) {
  const first = c.name.split(' ')[0];
  let h = '<div class="head"><div><a href="#recruit" style="font-weight:600;font-size:14px">‹ Recruiting</a><h1 style="margin-top:6px">' + esc(first) + '’s sample marketing</h1>' +
    '<div class="sub">What ' + esc(first) + ' would get in My Marketing as a Stewart sales rep. Every piece is a sample. “Show on My Marketing” opens the real site, read only.</div></div>' +
    '<div class="row"><button type="button" class="btn primary" data-act="rc-open" data-id="' + esc(c.id) + '"' + (RC.opening ? ' disabled' : '') + '>' + (RC.opening ? '<span class="spin"></span> Opening…' : 'Show on My Marketing ›') + '</button>' +
    '<button type="button" class="btn" data-act="rc-ask" data-id="' + esc(c.id) + '">Not hiring · remove</button></div></div>';
  h += '<div class="rc-mm"><div class="rc-mm-hd"><img src="logo-light.png" alt="Stewart Title"><span class="rc-tag">SAMPLE PREVIEW</span></div>' +
    '<div class="rc-mm-hi"><h3>Hi ' + esc(first) + '</h3><p>Here’s what would be waiting for you, ready to share.</p></div>' +
    '<div class="rc-mm-body">' + Samples.html(c, rcPhoto(c), 'brand/stewart-logo.png') + '</div></div>';
  if (RC.confirm === c.id) h += '<div class="inst-wrap" data-act="rc-x"><div class="inst" role="dialog" aria-modal="true" aria-labelledby="rc-t"><h2 id="rc-t">Remove ' + esc(first) + '’s samples?</h2>' +
    '<div class="muted2" style="font-size:15px;line-height:1.5">Use this if you’re not hiring ' + esc(first) + '. This removes:</div>' +
    '<ul style="margin:0;padding-left:20px;line-height:1.8;color:var(--muted2)"><li>' + esc(first) + ' from your Recruiting list</li><li>Their photo, phone and email</li><li>Their sample page here and on My Marketing</li></ul>' +
    '<div class="small muted">If you hire them later, start their onboarding as usual and the marketing team makes their real package.</div>' +
    '<div class="row" style="justify-content:flex-end;align-self:stretch"><button type="button" class="btn" data-act="rc-keep">Keep</button><button type="button" class="btn primary" data-act="rc-remove" data-id="' + esc(c.id) + '"' + (RC.busy ? ' disabled' : '') + '>' + (RC.busy ? '<span class="spin"></span> Removing…' : 'Remove everything') + '</button></div></div></div>';
  return h;
}

ACT['rc-focus'] = () => { const el = document.querySelector('[data-rc=firstName]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } };
ACT['rc-clear'] = () => { RC.form = rcFresh(); render(); };
ACT['rc-add'] = async el => {
  const f = RC.form;
  if (!f.firstName.trim() || !f.lastName.trim()) { toast('Add their first and last name.'); return; }
  RC.busy = true; render();
  try {
    const fd = new FormData();
    fd.append('fields', JSON.stringify({ firstName: f.firstName, lastName: f.lastName, title: f.title, area: f.area, phone: f.phone, email: f.email }));
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
ACT['rc-ask'] = el => { RC.confirm = el.dataset.id; render(); };
ACT['rc-keep'] = () => { RC.confirm = null; render(); };
ACT['rc-x'] = (el, e) => { if (e.target === el) { RC.confirm = null; render(); } };
ACT['rc-remove'] = async el => {
  RC.busy = true; render();
  try { await api('recruiting/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: el.dataset.id }) });
    RC.list = (RC.list || []).filter(c => c.id !== el.dataset.id); RC.confirm = null; RC.busy = false; location.hash = 'recruit'; toast('Removed.'); }
  catch (e) { RC.busy = false; render(); toast(e.message, 7000); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && RC.confirm) { RC.confirm = null; render(); } });
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.rc; if (k && RC.form) { RC.form[k] = e.target.value; const pv = document.getElementById('rc-cblock'); if (pv) pv.innerHTML = rcBlock(RC.form); if (k === 'firstName') { const b = document.querySelector('[data-act=rc-add]'); if (b && !RC.busy) b.textContent = 'Make ' + (RC.form.firstName.trim() ? RC.form.firstName.trim() + '’s' : 'their') + ' samples ›'; } } });
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset && t.dataset.rc && t.tagName === 'SELECT' && RC.form) { RC.form[t.dataset.rc] = t.value; const pv = document.getElementById('rc-cblock'); if (pv) pv.innerHTML = rcBlock(RC.form); return; }
  if (!(t.dataset && t.dataset.rcPhoto) || !t.files || !t.files[0] || !RC.form) return;
  const f = RC.form, file = t.files[0];
  if (!/^image\//.test(file.type)) { toast('Pick a photo (JPG or PNG).'); return; }
  if (f.cut) URL.revokeObjectURL(f.cut); if (f.raw) URL.revokeObjectURL(f.raw);
  Object.assign(f, { file, raw: URL.createObjectURL(file), cut: '', cutting: true, cutFail: false }); render();
  try { const u = await Cutout.make(file); if (RC.form === f && f.file === file) f.cut = u; }
  catch (x) { f.cutFail = true; }
  f.cutting = false; if (route() === 'recruit') render();
});
