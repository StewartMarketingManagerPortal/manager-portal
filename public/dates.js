// Birthday + Stewart start date (work anniversary) on My Team: two small pills under the address, each with a little calendar.
// Saved to the Main Employee Sheet ("Birthday" = MM-DD, no year; "Start Date" = YYYY-MM-DD).
(function () {
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const IC = {
    cal: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    cake: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0"/><path d="M12 11V7"/><path d="M12 4.5c.8 0 1.2-.8 1.2-1.5L12 1.5 10.8 3c0 .7.4 1.5 1.2 1.5z"/></svg>',
    star: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  };
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  function years(v) {
    const [y, m, d] = v.split('-').map(Number), now = new Date();
    let n = now.getFullYear() - y; if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) n--;
    return n;
  }
  function show(kind, v) {
    if (!v) return '';
    if (kind === 'birthday') { const [m, d] = v.split('-').map(Number); return MON3[m - 1] + ' ' + d; }
    const [y, m, d] = v.split('-').map(Number), n = years(v);
    return (n >= 1 ? n + (n === 1 ? ' yr' : ' yrs') + ' · ' : '') + MON3[m - 1] + ' ' + d + ', ' + y;
  }
  // open calendar: { id, kind, y, m (0-11), sel: 'YYYY-MM-DD' | 'MM-DD' }
  let OPEN = null, BUSY = false;
  function grid() {
    const o = OPEN, y = o.kind === 'birthday' ? 2024 : o.y;   // a leap year so Feb 29 is there for birthdays
    const first = new Date(y, o.m, 1).getDay(), days = new Date(y, o.m + 1, 0).getDate(), prevDays = new Date(y, o.m, 0).getDate();
    const want = o.kind === 'birthday' ? pad(o.m + 1) + '-' : o.y + '-' + pad(o.m + 1) + '-';
    let h = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => '<span class="dw">' + d + '</span>').join('');
    for (let i = 0; i < first; i++) h += '<span class="o">' + (prevDays - first + i + 1) + '</span>';
    for (let d = 1; d <= days; d++) h += '<button type="button" data-act="dt-day" data-d="' + d + '"' + (o.sel === want + pad(d) ? ' class="on"' : '') + '>' + d + '</button>';
    return h;
  }
  function pop() {
    const o = OPEN, now = new Date().getFullYear();
    const ys = []; for (let y = now; y >= 1960; y--) ys.push('<option' + (y === o.y ? ' selected' : '') + '>' + y + '</option>');
    return '<div class="dt-pop" role="dialog"><div class="hd"><button type="button" class="nav" data-act="dt-nav" data-n="-1" aria-label="Previous month">‹</button><b>' + MONF[o.m] +
      (o.kind === 'start' ? ' <select data-dt-year aria-label="Year">' + ys.join('') + '</select>' : '') + '</b><button type="button" class="nav" data-act="dt-nav" data-n="1" aria-label="Next month">›</button></div>' +
      '<div class="g">' + grid() + '</div><div class="ft"><span>' + (o.kind === 'birthday' ? 'Year not needed' : 'First day at Stewart') + '</span><span>' +
      '<button type="button" class="lnk" data-act="dt-clear">Clear</button><button type="button" class="lnk go" data-act="dt-save"' + (o.sel && !BUSY ? '' : ' disabled') + '>' + (BUSY ? 'Saving…' : 'Save') + '</button></span></div></div>';
  }
  function pill(p, kind) {
    const v = kind === 'birthday' ? p.birthday : p.start, label = kind === 'birthday' ? 'Birthday' : 'Started at Stewart';
    const open = OPEN && OPEN.id === p.id && OPEN.kind === kind;
    return '<span class="dt-wrap"><button type="button" class="dt' + (v ? '' : ' empty') + (open ? ' open' : '') + '" data-act="dt-open" data-id="' + e(p.id) + '" data-kind="' + kind + '" title="' + label + (v ? '' : ' - add the date') + '">' +
      '<span class="ic">' + (kind === 'birthday' ? IC.cake : IC.star) + '</span><b>' + (v ? e(show(kind, v)) : (kind === 'birthday' ? 'Birthday' : 'Anniversary')) + '</b>' +
      (p.posts && p.posts[kind] ? '<span class="soon">Post ready</span>' : '') + '<span class="cal">' + IC.cal + '</span></button>' + (open ? pop() : '') + '</span>';
  }
  window.dtPills = p => '<div class="dts">' + pill(p, 'birthday') + pill(p, 'start') + '</div>';
  const person = id => { const t = window.tmState && tmState(); return t && t.data ? t.data.team.find(x => String(x.id) === String(id)) : null; };
  ACT['dt-open'] = el => {
    const p = person(el.dataset.id), kind = el.dataset.kind;
    if (OPEN && OPEN.id === p.id && OPEN.kind === kind) { OPEN = null; return render(); }
    const v = kind === 'birthday' ? p.birthday : p.start, now = new Date();
    if (kind === 'birthday') { const m = v ? Number(v.split('-')[0]) - 1 : now.getMonth(); OPEN = { id: p.id, kind, y: 2024, m, sel: v || '' }; }
    else { const [y, m] = v ? v.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1]; OPEN = { id: p.id, kind, y, m: m - 1, sel: v || '' }; }
    render();
  };
  ACT['dt-nav'] = el => { const o = OPEN; if (!o) return; o.m += Number(el.dataset.n); if (o.m < 0) { o.m = 11; o.y--; } if (o.m > 11) { o.m = 0; o.y++; } render(); };
  ACT['dt-day'] = el => { const o = OPEN; if (!o) return; const d = pad(el.dataset.d); o.sel = o.kind === 'birthday' ? pad(o.m + 1) + '-' + d : o.y + '-' + pad(o.m + 1) + '-' + d; render(); };
  async function save(value) {
    const o = OPEN; if (!o || BUSY) return;
    BUSY = true; render();
    try {
      await api('dates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, kind: o.kind, value }) });
      const p = person(o.id); if (p) p[o.kind === 'birthday' ? 'birthday' : 'start'] = value;
      OPEN = null; toast(value ? 'Saved' : 'Date cleared');
    } catch (err) { toast(err.message, 7000); }
    BUSY = false; render();
  }
  ACT['dt-save'] = () => save(OPEN && OPEN.sel);
  ACT['dt-clear'] = () => save('');
  document.addEventListener('change', ev => { if (ev.target.matches('[data-dt-year]') && OPEN) { OPEN.y = Number(ev.target.value); render(); } });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && OPEN) { OPEN = null; render(); } });
  document.addEventListener('click', ev => { if (OPEN && !ev.target.closest('.dt-wrap')) { OPEN = null; render(); } });
})();
