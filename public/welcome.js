// Welcome posts: Stewart's announcement for each new hire on your team, made by West Marketing.
// It shows on the home page until you mark it posted. (The new hire's own "I've Made a Move" post goes to their portal.)
(function () {
  const W = window.WP = { data: null, loading: false, err: '', cap: {}, busy: {} };
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = n => String(n || '').trim().split(/\s+/)[0];
  const CAPTIONS = [
    'Please join us in welcoming {name} to Stewart Title! {first} joins our team as our new {title}. We’re thrilled to have you, {first} - welcome aboard! 🎉',
    'Big news! {name} is now part of the Stewart Title family as our new {title}. Reach out and say hello - {first} is ready to help with your next transaction.',
    'Welcome to the team, {first}! We’re proud to introduce {name}, our new {title}. #StewartTitle #Welcome'
  ];
  const caption = (w, i) => CAPTIONS[i].replace(/\{name\}/g, w.name).replace(/\{first\}/g, first(w.name)).replace(/\{title\}/g, w.title || 'team member');
  async function load() {
    if (W.loading) return; W.loading = true;
    try { W.data = await api('welcome'); W.err = ''; } catch (err) { W.err = err.message; W.data = W.data || { items: [] }; }
    W.loading = false;
    if (route() === 'home') render();
  }
  W.load = load;
  const find = id => ((W.data && W.data.items) || []).find(x => String(x.id) === String(id));
  window.wpHomeCard = function () {
    if (!W.data) { load(); return ''; }
    const items = (W.data.items || []).filter(w => !w.posted || W.cap[w.id + ':kept']);
    if (!items.length) return '';
    return '<section class="card hl-card"><div><h2>Welcome posts ready</h2><div class="hl-sub">Stewart’s announcement for your new hire, ready to share. Their own “I’ve Made a Move” post is waiting on their My Marketing page.</div></div><div class="hl-grid">' +
      items.map(w => {
        const c = W.cap[w.id] || 0;
        return '<div class="hl' + (w.posted ? ' done' : '') + '"><div class="hl-pic wp-pic"><img src="' + e(w.img) + '" alt="' + e('Welcome post for ' + w.name) + '"></div>' +
          '<div class="r"><div class="who">' + e(w.name) + '</div><div class="when">👋 New hire' + (w.title ? ' · ' + e(w.title) : '') + '</div>' +
          '<div class="chips">Caption ' + [0, 1, 2].map(i => '<button type="button" class="' + (c === i ? 'on' : '') + '" data-act="wp-cap" data-id="' + e(w.id) + '" data-c="' + i + '">' + (i + 1) + '</button>').join('') + '</div>' +
          '<div class="cap">' + e(caption(w, c)) + '</div>' +
          '<div class="btns"><a class="btn primary" href="' + e(w.img) + '" download="' + e('Welcome - ' + w.name + '.png') + '">Download image</a><button type="button" class="btn" data-act="wp-copy" data-id="' + e(w.id) + '">Copy caption</button>' +
          (w.posted ? '<span class="hl-ok">✓ Posted</span><button type="button" class="lnk" data-act="wp-post" data-id="' + e(w.id) + '" data-v="0"' + (W.busy[w.id] ? ' disabled' : '') + '>Undo</button>'
            : '<button type="button" class="lnk" data-act="wp-post" data-id="' + e(w.id) + '" data-v="1"' + (W.busy[w.id] ? ' disabled' : '') + '>' + (W.busy[w.id] ? 'Saving…' : 'Mark as posted') + '</button>') +
          '</div></div></div>';
      }).join('') + '</div></section>';
  };
  ACT['wp-cap'] = el => { W.cap[el.dataset.id] = Number(el.dataset.c); render(); };
  ACT['wp-copy'] = async el => {
    const w = find(el.dataset.id); if (!w) return;
    const t = caption(w, W.cap[w.id] || 0);
    try { await navigator.clipboard.writeText(t); toast('Caption copied'); }
    catch (err) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Caption copied'); } catch (x) { toast('Couldn’t copy. Select the caption and copy it.'); } ta.remove(); }
  };
  ACT['wp-post'] = async el => {
    const w = find(el.dataset.id); if (!w || W.busy[w.id]) return;
    const v = el.dataset.v === '1';
    W.busy[w.id] = true; W.cap[w.id + ':kept'] = true; render();
    try { const r = await api('welcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: w.id, posted: v }) }); w.posted = r.posted || ''; }
    catch (err) { toast(err.message, 7000); }
    W.busy[w.id] = false; render();
  };
})();
