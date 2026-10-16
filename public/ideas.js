// Ideas for marketing: a manager suggests a topic for West Marketing's posts, title tips or newsletter.
// The marketing team goes through new ideas at its monthly planning meeting (Stewart Marketing Tools › Projects › Plan),
// and the manager sees here what happened to each one.
(function () {
  const I = window.IDEAS = { data: null, loading: false, err: '', busy: false, open: false, draft: { idea: '' } };
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const nice = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? MON[Number(m[2]) - 1] + ' ' + Number(m[3]) : ''; };
  const todayIso = () => new Date().toLocaleDateString('en-CA');
  async function load() {
    if (I.loading) return; I.loading = true;
    try { I.data = await api('ideas'); I.err = ''; } catch (err) { I.err = err.message; I.data = I.data || { ideas: [] }; }
    I.loading = false;
    if (route() === 'home') render();
  }
  I.load = load;
  // what happened to an idea, in the manager's words
  function state(i) {
    if (i.status === 'Planned') return i.plannedFor && i.plannedFor < todayIso() ? ['done', 'Used ' + nice(i.plannedFor)] : ['done', 'Planned for ' + (nice(i.plannedFor) || 'an upcoming month')];
    if (i.status === 'In library') return ['lib', 'Saved for a future month'];
    if (i.status === 'Passed') return ['', 'Not this time'];
    return ['new', 'Waiting for the next meeting'];
  }
  window.ideasHomeCard = function () {
    if (!I.data) { load(); return ''; }
    const list = (I.data.ideas || []).slice(0, 5);
    return '<section class="card id-card"><div class="row"><div class="grow"><h2>Ideas for marketing</h2><div class="hl-sub">Something your team or clients keep asking about? Suggest it for a post, title tip or the newsletter. West Marketing looks at every idea when they plan each month.</div></div></div>' +
      '<form class="id-form" data-form="idea-add"><input type="text" name="idea" maxlength="200" placeholder="Your idea, for example: How to read a preliminary title report" aria-label="Your idea" value="' + e(I.draft.idea) + '" required>' +
      '<select name="market" aria-label="Market"><option value="Both">California and Tucson</option><option value="California">California</option><option value="Tucson">Tucson</option></select>' +
      (I.open ? '<textarea name="note" maxlength="2000" placeholder="Anything that helps (optional)" aria-label="Note"></textarea>' : '') +
      '<div class="id-btns"><button type="submit" class="btn primary"' + (I.busy ? ' disabled' : '') + '>' + (I.busy ? 'Sending…' : 'Send idea') + '</button>' + (I.open ? '' : '<button type="button" class="lnk" data-act="idea-note">Add a note</button>') + '</div></form>' +
      (I.err ? '<div class="id-err">Your ideas couldn’t be loaded: ' + e(I.err) + '</div>' : '') +
      (list.length ? '<div class="id-list"><div class="cardlabel">Your ideas</div>' + list.map(i => { const [c, t] = state(i); return '<div class="id-row"><span class="grow"><b>' + e(i.idea) + '</b><span class="meta">' + e(nice(i.added)) + (i.market && i.market !== 'Both' ? ' · ' + e(i.market) : '') + (i.from ? ' · ' + e(i.from) : '') + '</span></span><span class="status id-' + c + '">' + e(t) + '</span></div>'; }).join('') + '</div>' : '') +
      '</section>';
  };
  ACT['idea-note'] = () => { I.open = true; render(); const f = document.querySelector('.id-form textarea'); if (f) f.focus(); };
  document.addEventListener('submit', async ev => {
    const f = ev.target.closest && ev.target.closest('form[data-form="idea-add"]'); if (!f) return;
    ev.preventDefault();
    if (I.busy) return;
    const idea = f.idea.value.trim(); if (idea.length < 4) { toast('Type your idea first.'); return; }
    const body = { idea: idea, market: f.market.value, note: f.note ? f.note.value.trim() : '' };
    I.busy = true; I.draft = { idea: idea }; render();
    try {
      await api('ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      I.open = false; I.draft = { idea: '' }; toast('Thanks! West Marketing will look at it at their next planning meeting.', 6000);
      I.data = I.data || { ideas: [] }; I.data.ideas.unshift({ id: 'new', idea: body.idea, market: body.market, status: 'New', added: todayIso(), from: S.me.assistant || S.me.name });
    } catch (err) { toast(err.message, 7000); }
    I.busy = false; render(); load();
  });
})();
