// The pages, built on the server so they load fast and show up properly when shared.
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export const prettyPhone = s => { const d = digits(s); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : String(s || ''); };
const first = n => String(n || '').trim().split(/\s+/)[0];
const initials = n => String(n || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const ASSET_V = '4';

const I = {
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 21h14"/></svg>',
  app: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>',
  search: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  menu: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function shell({ title, desc, body, bodyClass, url, image }) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '">' +
    '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '"><meta property="og:type" content="website">' +
    (url ? '<meta property="og:url" content="' + esc(url) + '">' : '') + (image ? '<meta property="og:image" content="' + esc(image) + '">' : '') +
    '<meta name="theme-color" content="#1A1A1C"><link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/apple-touch-icon.png">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/site.css?v=' + ASSET_V + '"></head><body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>' + body +
    '<script src="/site.js?v=' + ASSET_V + '" defer></script></body></html>';
}

function header(p, base, links, current, hasTeam) {
  const nav = links.filter(Boolean).map(([href, label]) => '<a href="' + href + '"' + (label === current ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>').join('') +
    (hasTeam ? '<a href="' + base + '/team"' + (current === 'Meet my team' ? ' aria-current="page"' : '') + '>Meet my team</a>' : '');
  return '<header class="top"><div class="wrap">' +
    '<a class="logo" href="' + base + '"><img src="/logo-dark.png" alt="Stewart Title" width="150" height="33"></a>' +
    '<button class="menu" type="button" aria-label="Menu" aria-expanded="false">' + I.menu + '</button>' +
    '<nav aria-label="Page">' + nav + '</nav>' +
    '<a class="btn sm cta" href="' + base + '#contact">Contact ' + esc(first(p.name)) + '</a>' +
    '</div></header>';
}

function popout(p, cls) {
  if (p.photo) return '<div class="pop' + (cls ? ' ' + cls : '') + '"><div class="circle"><img src="' + p.photo + '" alt=""></div><img src="' + p.photo + '" alt="' + esc(p.name) + '"></div>';
  return '<div class="pop' + (cls ? ' ' + cls : '') + '"><div class="circle"><span class="initials">' + esc(initials(p.name)) + '</span></div></div>';
}

function footer(p, base, hasTeam) {
  return '<footer><div class="wrap"><img src="/logo-dark.png" alt="Stewart Title" width="120" height="27">' +
    '<span>' + esc(p.company || 'Stewart Title') + (hasTeam ? ' · <a href="' + base + '/team">Meet my team</a>' : '') + '</span>' +
    '<span>© ' + new Date().getFullYear() + ' Stewart Information Services Corporation</span></div></footer>';
}

const fileUrl = (base, f, dl) => base + '/file/' + f.id + (dl ? '?dl=1' : '');
const dlBtn = (base, f, label) => '<a class="btn sm full" href="' + fileUrl(base, f, true) + '" download>' + I.down + (label || 'Download') + '</a>';
function preview(base, f, alt, cls) {
  if (f.kind === 'image') return '<a class="' + cls + '" href="' + fileUrl(base, f) + '" target="_blank" rel="noopener"><img src="' + fileUrl(base, f) + '" alt="' + esc(alt) + '" loading="lazy"></a>';
  return '<a class="' + cls + '" href="' + fileUrl(base, f) + '" target="_blank" rel="noopener" data-pdf="' + fileUrl(base, f) + '" aria-label="' + esc(alt) + ' (PDF)">' +
    '<span class="blank"><span></span><span style="width:40%"></span><span></span><span style="width:92%"></span><span style="width:70%"></span><span></span><span style="width:88%"></span></span><span class="tag">PDF</span></a>';
}
const fmtWeek = d => { const t = Date.parse(d + 'T12:00:00'); return t ? new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : ''; };

export function sitePage(site, data, origin, sent) {
  const { person: p, portal, web, team } = data;
  const base = '/' + site.slug, fn = first(p.name), hasTeam = team.length > 0;
  const tel = digits(p.phone);
  const areas = portal.market.filter(m => m.kind === 'image').map(m => m.title).filter(t => t && t.length < 30);
  const links = [
    portal.market.length && ['#market', 'Market updates'], web.tools.length && ['#tools', 'Tools'], web.docs.length && ['#documents', 'Forms & documents'],
    portal.flyers.length && ['#flyers', 'Flyers'], portal.tips.length && ['#tips', 'Title tips'],
  ].map(x => x && [base + x[0], x[1]]);

  let s = header(p, base, links, '', hasTeam);
  s += '<main><section class="hero"><div class="wrap"><div class="words">' +
    (p.company ? '<div class="eyebrow">' + esc(p.company) + '</div>' : '') +
    '<h1>' + esc(p.name) + '</h1>' + (p.title ? '<div class="role">' + esc(p.title) + '</div>' : '') +
    (areas.length ? '<div class="chips">' + areas.map(a => '<span>' + esc(a) + '</span>').join('') + '</div>' : '') +
    '<div class="actions">' +
    (tel ? '<a class="btn" href="tel:' + tel + '">' + I.phone + esc(prettyPhone(p.phone)) + '</a>' : '') +
    (p.email ? '<a class="btn ghost" href="mailto:' + esc(p.email) + '">' + I.mail + 'Email me</a>' : '') +
    '<a class="btn ghost dim" href="' + base + '/contact.vcf">' + I.user + 'Save my contact</a>' +
    '</div></div><div class="pic">' + popout(p) + '</div></div></section>';

  if (portal.market.length) {
    s += '<section class="sec" id="market"><div class="wrap"><div class="head"><div><div class="kicker">Weekly market snapshot</div><h2>What’s happening in your market</h2></div>' +
      (portal.marketDate ? '<div class="note">Updated every week · Week of ' + esc(fmtWeek(portal.marketDate)) + '</div>' : '') + '</div><div class="row c4">' +
      portal.market.map(m => '<div class="card">' +
        (m.kind === 'video'
          ? '<div class="shot"><video controls playsinline preload="metadata" src="' + fileUrl(base, m) + '#t=0.1"></video></div>'
          : '<a class="shot" href="' + fileUrl(base, m) + '" target="_blank" rel="noopener"><img src="' + fileUrl(base, m) + '" alt="' + esc(m.title) + ' market snapshot" loading="lazy"></a>') +
        '<span class="name" style="min-height:0">' + esc(m.title) + '</span>' + dlBtn(base, m) + '</div>').join('') +
      '</div></div></section>';
  }
  if (web.tools.length) {
    s += '<section class="sec" id="tools"><div class="wrap"><div><div class="kicker">For real estate agents</div><h2>Stewart tools</h2></div><div class="row c2">' +
      web.tools.map(t => '<div class="tool"><span class="ico">' + (t.app ? I.app : I.search) + '</span><div class="txt"><h3>' + esc(t.title) + '</h3>' +
        (t.desc ? '<p>' + esc(t.desc) + '</p>' : '') + '</div>' + (t.url ? '<a class="btn sm" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + (t.app ? 'Get the app' : 'Open') + '</a>' : '<a class="btn sm" href="#contact">Ask ' + esc(fn) + '</a>') + '</div>').join('') +
      '</div></div></section>';
  }
  if (web.docs.length) {
    s += '<section class="sec" id="documents"><div class="wrap"><div><div class="kicker">Free to download</div><h2>Forms &amp; documents</h2></div><div class="row c5">' +
      web.docs.map(d => '<div class="card">' + preview(base, d.file, d.title, 'page doc') + '<span class="name">' + esc(d.title) + '</span>' + dlBtn(base, d.file) + '</div>').join('') +
      '</div><div class="note after" style="font-size:15px">Need a specific form or a property report? <a href="#contact" style="font-weight:700">Ask ' + esc(fn) + '</a></div></div></section>';
  }
  if (portal.flyers.length) {
    const n = portal.flyers.length;
    s += '<section class="sec" id="flyers"><div class="wrap"><div class="head"><div><div class="kicker">Share with your clients</div><h2>Flyers</h2></div>' +
      (n > 6 ? '<button class="more-link see-all" type="button" data-more="flyers-row">See all ' + n + ' flyers →</button>' : '') + '</div><div class="row c3" id="flyers-row">' +
      portal.flyers.map((f, i) => '<div class="card' + (i >= 6 ? ' hidden' : '') + '">' + preview(base, f.show, f.title, 'page') + '<span class="name" style="font-size:16px">' + esc(f.title) + '</span>' + dlBtn(base, f.dl) + '</div>').join('') +
      '</div></div></section>';
  }
  if (portal.tips.length) {
    s += '<section class="sec" id="tips"><div class="wrap"><div><div class="kicker">Learn something new</div><h2>Title tips</h2></div><div class="row c4">' +
      portal.tips.slice(0, 4).map(t => '<div class="card">' + (t.show.kind === 'image'
        ? '<a class="shot" href="' + fileUrl(base, t.show) + '" target="_blank" rel="noopener"><img src="' + fileUrl(base, t.show) + '" alt="Title tip: ' + esc(t.title) + '" loading="lazy"></a>'
        : preview(base, t.show, t.title, 'page')) + '<span class="name">' + esc(t.title) + '</span>' + dlBtn(base, t.dl) + '</div>').join('') +
      '</div></div></section>';
  }

  const addr = [p.address1, p.address2].filter(Boolean).map(esc).join('<br>');
  s += '<section class="contact" id="contact"><div class="wrap"><div class="about"><div class="eyebrow">Let’s work together</div>' +
    '<h2>Send ' + esc(fn) + ' a message</h2><p>Questions about a transaction, a rate quote or a farm report? ' + esc(fn) + ' will get back to you.</p>' +
    '<div class="lines">' + (tel ? '<a href="tel:' + tel + '">' + esc(prettyPhone(p.phone)) + '</a>' : '') + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '') +
    (addr ? '<span>' + addr + '</span>' : '') + '</div></div>' +
    '<form class="msg" method="post" action="' + base + '/contact" novalidate>' +
    '<div class="status ' + (sent === 'ok' ? 'ok' : sent ? 'bad' : '') + '" role="status" aria-live="polite">' + (sent === 'ok' ? 'Thanks! Your message is on its way to ' + esc(fn) + '.' : sent ? 'Sorry, that didn’t send. Please call or email instead.' : '') + '</div>' +
    '<label>Name<input name="name" type="text" autocomplete="name" required maxlength="120"></label>' +
    '<label>Phone<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label>' +
    '<label class="wide">Email<input name="email" type="email" autocomplete="email" maxlength="200"></label>' +
    '<label class="wide">How can ' + esc(fn) + ' help?<textarea name="message" rows="4" required maxlength="3000"></textarea></label>' +
    '<label class="hp" aria-hidden="true">Leave this empty<input name="website" type="text" tabindex="-1" autocomplete="off"></label>' +
    '<input type="hidden" name="t" value="' + Date.now() + '">' +
    '<div class="foot"><span class="fine">Your details go only to ' + esc(fn) + ' and Stewart Title. We never sell or share them.</span>' +
    '<button class="btn" type="submit">Send message</button></div></form></div></section></main>';
  s += footer(p, base, hasTeam);

  return shell({
    title: p.name + ' · ' + (p.title || 'Stewart Title'),
    desc: (p.title ? p.title + ' at ' : '') + (p.company || 'Stewart Title') + '. Market updates, forms, flyers and title tips for real estate agents.',
    body: s, url: origin + base, image: p.photo ? origin + p.photo : '',
  });
}

export function teamPage(site, data, origin) {
  const { person: p, team } = data;
  const base = '/' + site.slug, fn = first(p.name);
  const links = [['#market', 'Market updates'], ['#tools', 'Tools'], ['#documents', 'Forms & documents'], ['#flyers', 'Flyers'], ['#tips', 'Title tips']]
    .filter(([h]) => ({ '#market': data.portal.market, '#tools': data.web.tools, '#documents': data.web.docs, '#flyers': data.portal.flyers, '#tips': data.portal.tips }[h] || []).length)
    .map(([h, l]) => [base + h, l]);
  let s = header(p, base, links, 'Meet my team', true);
  s += '<main><section class="team-hero"><div class="wrap"><div class="words">' +
    '<div class="eyebrow">' + esc(p.name) + (p.title ? ' · ' + esc(p.title) : '') + '</div><h1>Meet my team</h1>' +
    '<p>The people behind every closing. Reach any of us directly — we’re here to help you and your clients.</p></div>' +
    '<div class="side">' + popout(p, 'sm') + '</div></div></section>';
  // only people with a headshot, at most 8 (two rows of four)
  const shown = team.filter(m => m.photo).slice(0, 8);
  s += '<section class="people"><div class="wrap"><div class="row">' + shown.map(m => {
    const tel = digits(m.phone);
    return '<div class="member"><span class="ph">' + (m.photo ? '<img src="' + m.photo + '" alt="" loading="lazy">' : '<span class="initials">' + esc(initials(m.name)) + '</span>') + '</span>' +
      '<div class="body"><b>' + esc(m.name) + '</b>' + (m.title ? '<span class="t">' + esc(m.title) + '</span>' : '') +
      '<div class="btns">' + (tel ? '<a class="btn xs" href="tel:' + tel + '" aria-label="Call ' + esc(m.name) + '">Call</a>' : '') +
      (m.email ? '<a class="btn xs line" href="mailto:' + esc(m.email) + '" aria-label="Email ' + esc(m.name) + '">Email</a>' : '') + '</div></div></div>';
  }).join('') +
    (shown.length >= 8 ? '' : '<div class="member ask"><b>Not sure who to call?</b>Reach out to ' + esc(fn) + ' and ' + 'they’ll connect you with the right person.<a class="btn xs" href="' + base + '#contact" style="margin-top:4px">Contact ' + esc(fn) + '</a></div>') +
    '</div></div></section></main>';
  s += footer(p, base, true);
  return shell({ title: 'Meet my team · ' + p.name, desc: 'Meet ' + p.name + '’s team at ' + (p.company || 'Stewart Title') + '.', body: s, bodyClass: 'team', url: origin + base + '/team' });
}

export function homePage(people) {
  const body = '<header class="top"><div class="wrap"><a class="logo" href="/"><img src="/logo-dark.png" alt="Stewart Title" width="150" height="33"></a></div></header>' +
    '<main class="sec" style="padding-bottom:80px"><div class="wrap"><div><div class="kicker">Stewart Title West</div><h2>Find your Stewart Title rep</h2></div>' +
    '<div class="row c3">' + people.map(x => '<a class="tool" href="/' + x.slug + '" style="text-decoration:none;color:inherit"><span class="ico">' + I.user.replace(/18/g, '32') + '</span><div class="txt"><h3>' + esc(x.name) + '</h3></div></a>').join('') + '</div></div></main>';
  return shell({ title: 'Stewart Title West', desc: 'Stewart Title West sales team.', body });
}

export function messagePage(title, text) {
  const body = '<header class="top"><div class="wrap"><a class="logo" href="/"><img src="/logo-dark.png" alt="Stewart Title" width="150" height="33"></a></div></header>' +
    '<main class="empty"><div class="box"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p><a class="btn" href="/">Go to the home page</a></div></main>';
  return shell({ title: title + ' · Stewart Title', desc: text, body });
}

export function vcard(site, p, origin) {
  const e = s => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const parts = String(p.name).trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const m = String(p.address2 || '').match(/^(.*?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + e(last) + ';' + e(parts[0]) + ';;;', 'FN:' + e(p.name), 'ORG:' + e(p.company || 'Stewart Title')];
  if (p.title) lines.push('TITLE:' + e(p.title));
  if (p.phone) lines.push('TEL;TYPE=WORK,VOICE:' + prettyPhone(p.phone));
  if (p.email) lines.push('EMAIL;TYPE=WORK:' + p.email);
  if (p.address1 || p.address2) lines.push('ADR;TYPE=WORK:;;' + e(p.address1) + ';' + e(m ? m[1] : p.address2) + ';' + e(m ? m[2] : '') + ';' + e(m ? m[3] || '' : '') + ';USA');
  lines.push('URL:' + origin + '/' + site.slug, 'END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
