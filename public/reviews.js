// Design Reviews: design packages West Marketing sends from a brainstorm board in Stewart Marketing Tools.
// Each manager or president it was sent to looks through the slides, approves or asks for changes, and can comment on any slide.
// The marketing team sees the answers on the board in the app (and on monday.com).
(function () {
  const R = window.DR = { list: null, loading: false, err: '', det: {}, slide: {}, busy: false, full: false };
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = t => { const d = new Date(t); return isNaN(d) ? '' : MON[d.getMonth()] + ' ' + d.getDate(); };
  const ago = t => { const d = new Date(t); if (isNaN(d)) return ''; const m = Math.round((Date.now() - d) / 60000); return m < 2 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : day(t); };
  const sub = () => (location.hash.split('/')[1] || '');
  const COLORS = ['#1F4E79', '#6B3FA0', '#1B7A43', '#8A5A00', '#A30C33', '#4A4845'];
  const color = n => COLORS[String(n || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  async function load() {
    if (R.loading) return; R.loading = true;
    try { R.list = (await api('reviews')).reviews || []; R.err = ''; } catch (err) { R.err = err.message; R.list = R.list || []; }
    R.loading = false; render();
  }
  async function loadOne(id) {
    R.det[id] = R.det[id] || { loading: true };
    try { R.det[id] = await api('reviews/' + id); } catch (err) { R.det[id] = { error: err.message }; }
    render();
  }
  // nav: shown once someone has a package (or is a portal admin); the number is what still needs their answer
  window.drShow = () => !!(S.me && (S.me.admin || (R.list && R.list.length)));
  window.drWaiting = () => (R.list || []).filter(r => r.reviewer && !r.mine && r.status !== 'Approved').length;
  const pill = r => r.mine === 'approve' ? '<span class="status done">You approved</span>' : r.mine === 'changes' ? '<span class="status proof">You asked for changes</span>' : r.reviewer ? '<span class="status work">Needs your answer</span>' : '<span class="status">' + e(r.approved + ' of ' + r.total + ' approved') + '</span>';
  PAGES.reviews = () => {
    if (!R.list) { load(); return '<h1>Design reviews</h1><div class="empty"><span class="spin dark"></span></div>'; }
    return sub() ? detail(sub()) : listPage();
  };
  function listPage() {
    let h = '<div class="dr-head"><h1>Design reviews</h1><div class="muted2">Design packages from West Marketing. Look through the slides, then approve or ask for changes.</div></div>';
    if (R.err) h += '<div class="err">Design reviews couldn’t be loaded: ' + e(R.err) + '</div>';
    if (!R.list.length) return h + '<section class="card"><div class="empty">Nothing to look at right now. When West Marketing sends you a design package, it shows up here.</div></section>';
    const open = R.list.filter(r => r.reviewer && !r.mine && r.status !== 'Approved'), rest = R.list.filter(r => open.indexOf(r) < 0);
    const card = r => '<a class="dr-card" href="#reviews/' + e(r.id) + '"><span class="dr-cover">' + (r.cover ? '<img src="' + e(r.cover) + '" alt="" loading="lazy">' : '') + '</span><span class="grow"><b>' + e(r.name) + '</b>' +
      '<span class="meta">From ' + e(r.from) + ' · sent ' + e(day(r.sent)) + (r.market ? ' · ' + e(r.market) : '') + ' · ' + plural(r.count, 'slide') + '</span>' +
      '<span class="meta">' + e(r.approved + ' of ' + r.total + ' approved') + (r.changes ? ' · ' + e(r.changes) + ' asked for changes' : '') + '</span></span>' + pill(r) + '</a>';
    if (open.length) h += '<section class="card"><div class="cardlabel">Waiting for your answer</div>' + open.map(card).join('') + '</section>';
    if (rest.length) h += '<section class="card"><div class="cardlabel">' + (open.length ? 'Earlier' : 'Packages') + '</div>' + rest.map(card).join('') + '</section>';
    return h;
  }
  function detail(id) {
    const d = R.det[id];
    if (!d) { loadOne(id); return '<a class="dr-back" href="#reviews">‹ Design reviews</a><div class="empty"><span class="spin dark"></span></div>'; }
    if (d.loading) return '<a class="dr-back" href="#reviews">‹ Design reviews</a><div class="empty"><span class="spin dark"></span></div>';
    if (d.error) return '<a class="dr-back" href="#reviews">‹ Design reviews</a><section class="card"><div class="err">' + e(d.error) + '</div></section>';
    const n = d.slides.length, i = Math.min(R.slide[id] || 0, n - 1), s = d.slides[i] || {};
    let h = '<a class="dr-back" href="#reviews">‹ Design reviews</a><h1 class="dr-title">' + e(d.name) + '</h1>' +
      '<div class="muted2 dr-sub">From ' + e(d.from) + ' · sent ' + e(day(d.sent)) + (d.market ? ' · ' + e(d.market) : '') + ' · ' + plural(n, 'slide') + (d.project ? ' · for ' + e(d.project) : '') + '</div>';
    if (d.note) h += '<div class="dr-note"><b>A note from ' + e(d.from) + '</b>' + e(d.note) + '</div>';
    h += '<div class="dr-wrap"><div class="dr-main"><section class="card dr-stage"><div class="dr-lab">Slide ' + (i + 1) + ' of ' + n + ' · ' + e(s.title) + '</div>' +
      '<img class="dr-slide" src="' + e(s.url) + '" alt="' + e(s.title) + '" data-act="dr-full"></section>' +
      '<div class="dr-nav"><button class="btn small" data-act="dr-go" data-i="' + (i - 1) + '"' + (i ? '' : ' disabled') + ' aria-label="Previous slide">‹</button>' +
      '<span class="dr-tabs">' + d.slides.map((x, k) => '<a class="' + (k === i ? 'on' : '') + '" data-act="dr-go" data-i="' + k + '">' + (k + 1) + ' · ' + e(x.title) + '</a>').join('') + '</span>' +
      '<button class="btn small" data-act="dr-go" data-i="' + (i + 1) + '"' + (i < n - 1 ? '' : ' disabled') + ' aria-label="Next slide">›</button><span class="grow"></span><button class="btn small" data-act="dr-full">▶ Full screen</button></div></div>';
    const okN = d.people.filter(p => p.a === 'approve').length;
    h += '<aside class="card dr-side">';
    if (d.reviewer) h += '<div class="cardlabel">Your answer</div>' +
      (d.mine ? '<div class="dr-done ' + (d.mine === 'approve' ? 'ok' : 'ch') + '">' + (d.mine === 'approve' ? '✓ You approved this package.' : 'You asked for changes.') + ' <a data-act="dr-redo">Change your answer</a></div>' :
        '<div class="dr-ans"><button class="btn primary" data-act="dr-answer" data-a="approve"' + (R.busy ? ' disabled' : '') + '>✓ Approve</button><button class="btn" data-act="dr-answer" data-a="changes"' + (R.busy ? ' disabled' : '') + '>Ask for changes</button></div>');
    h += '<textarea id="dr-text" rows="3" placeholder="Add a comment for Marketing about slide ' + (i + 1) + '…">' + e(R.draft || '') + '</textarea>' +
      '<div class="dr-cbtn"><span class="muted small">Goes with slide ' + (i + 1) + '</span><button class="btn small" data-act="dr-comment"' + (R.busy ? ' disabled' : '') + '>Send comment</button></div>';
    h += '<div class="cardlabel">Who’s reviewing · ' + okN + ' of ' + d.people.length + ' approved</div><div class="dr-ppl">' +
      d.people.map(p => '<div class="dr-p"><span class="av" style="background:' + color(p.name) + '">' + e(initials(p.name)) + '</span><span class="grow">' + (p.you ? 'You' : e(p.name)) + '</span><span class="status ' + (p.a === 'approve' ? 'done' : p.a === 'changes' ? 'proof' : '') + '">' + (p.a === 'approve' ? 'Approved' : p.a === 'changes' ? 'Changes asked' : 'Waiting') + '</span></div>').join('') + '</div>';
    h += '<div class="cardlabel">Comments</div><div class="dr-cmts">' + (d.comments.length ? d.comments.map(c => '<div><b>' + e(c.name) + '</b> <span class="muted small">' + (c.slide ? '· slide ' + c.slide + ' ' : c.marketing ? '· reply ' : '') + '· ' + e(ago(c.at)) + '</span><div>' + e(c.text) + '</div></div>').join('') : '<div class="muted small">No comments yet.</div>') + '</div>';
    h += '</aside></div>';
    if (R.full) h += '<div class="dr-full" data-act="dr-close"><img src="' + e(s.url) + '" alt="' + e(s.title) + '"><div class="dr-fbar"><button class="btn small" data-act="dr-go" data-i="' + (i - 1) + '"' + (i ? '' : ' disabled') + '>‹</button><span>' + (i + 1) + ' of ' + n + ' · ' + e(s.title) + '</span><button class="btn small" data-act="dr-go" data-i="' + (i + 1) + '"' + (i < n - 1 ? '' : ' disabled') + '>›</button><button class="btn small" data-act="dr-close">Close</button></div></div>';
    return h;
  }
  const keep = () => { const t = document.getElementById('dr-text'); if (t) R.draft = t.value; };
  ACT['dr-go'] = (el, ev) => { if (ev) ev.stopPropagation(); const id = sub(), d = R.det[id]; if (!d || !d.slides) return; const k = +el.dataset.i; if (k < 0 || k >= d.slides.length) return; keep(); R.slide[id] = k; render(); };
  ACT['dr-full'] = () => { keep(); R.full = true; render(); };
  ACT['dr-close'] = (el, ev) => { if (ev && ev.target.closest('.dr-fbar') && !el.matches('button')) return; keep(); R.full = false; render(); };
  ACT['dr-redo'] = () => { const d = R.det[sub()]; if (d) { keep(); d.mine = ''; render(); } };
  ACT['dr-answer'] = async el => {
    const id = sub(), d = R.det[id]; if (!d || R.busy) return; keep();
    const a = el.dataset.a, note = (R.draft || '').trim();
    if (a === 'changes' && !note) { toast('Say what should change in the comment box first.'); const t = document.getElementById('dr-text'); if (t) t.focus(); return; }
    R.busy = true; render();
    try {
      await api('reviews/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, a, note, slide: (R.slide[id] || 0) + 1 }) });
      R.draft = ''; toast(a === 'approve' ? 'Approved. West Marketing will see it on the board.' : 'Sent. West Marketing will see what you asked for.', 6000);
    } catch (err) { toast(err.message, 7000); }
    R.busy = false; await loadOne(id); load();
  };
  ACT['dr-comment'] = async () => {
    const id = sub(), d = R.det[id]; if (!d || R.busy) return; keep();
    const text = (R.draft || '').trim(); if (!text) { toast('Type a comment first.'); return; }
    R.busy = true; render();
    try { await api('reviews/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, text, slide: (R.slide[id] || 0) + 1 }) }); R.draft = ''; toast('Comment sent.'); }
    catch (err) { toast(err.message, 7000); }
    R.busy = false; loadOne(id);
  };
  document.addEventListener('input', ev => { if (ev.target.id === 'dr-text') R.draft = ev.target.value; });
  document.addEventListener('keydown', ev => {
    if (route() !== 'reviews' || !sub() || /input|textarea|select/i.test((ev.target.tagName || ''))) return;
    const d = R.det[sub()]; if (!d || !d.slides) return; const i = R.slide[sub()] || 0;
    if (ev.key === 'ArrowRight' && i < d.slides.length - 1) { R.slide[sub()] = i + 1; render(); }
    else if (ev.key === 'ArrowLeft' && i > 0) { R.slide[sub()] = i - 1; render(); }
    else if (ev.key === 'Escape' && R.full) { R.full = false; render(); }
  });
  // find out early whether this person has packages, so the menu shows Design Reviews with its number
  const wait = setInterval(() => { if (S.me) { clearInterval(wait); load(); } }, 300);
})();
