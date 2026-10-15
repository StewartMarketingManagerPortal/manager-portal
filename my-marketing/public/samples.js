// Recruiting samples: a candidate's photo, name and contact details drawn onto one set of sample pieces, on screen only.
// The same file is in manager-portal/public and my-marketing/public - change both together.
// Stand-in designs for now; once the team saves the real sample set, each piece can take its background from samples/<key>.png.
'use strict';
const Samples = (() => {
  const CSS = `
.sp{--b:#A30C33;--bd:#7E0A28;--k:#1A1A1C;--m:#6B6966;--ln:#E4E1DC;font-family:Montserrat,-apple-system,sans-serif;color:var(--k)}
.sp-sec{padding:20px 0 6px}.sp-sec h3{margin:0 0 4px;font-size:18px;font-weight:700}.sp-sec .s{font-size:13px;color:var(--m);margin-bottom:12px}
.sp-row{display:grid;gap:14px}.sp-row.a{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr) minmax(0,1.15fr)}.sp-row.b{grid-template-columns:repeat(5,minmax(0,1fr))}
.sp-stack{display:flex;flex-direction:column;gap:14px}
@media (max-width:1180px){.sp-row.a{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-row.b{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:560px){.sp-row.a{grid-template-columns:minmax(0,1fr)}.sp-row.b{grid-template-columns:repeat(2,minmax(0,1fr))}}
.sp-pc{position:relative;overflow:hidden;border-radius:12px;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.sp-pc img{pointer-events:none}
.sp-rib{position:absolute;top:14px;right:-34px;transform:rotate(35deg);background:var(--b);color:#fff;font-size:10px;font-weight:800;letter-spacing:.14em;padding:4px 40px;z-index:3}
.sp-cap{font-size:12.5px;font-weight:600;margin-top:6px}
.sp-ph{width:100%;height:100%;object-fit:contain;object-position:bottom;display:block}
.sp-in{width:100%;height:100%;display:block}
.sp-ann{background:var(--b);color:#fff;aspect-ratio:1;padding:16px;display:flex;flex-direction:column}
.sp-ann .w{font-size:9px;font-weight:700;letter-spacing:.16em;color:#F6DCE3;padding-right:40px}.sp-ann .n{font-size:24px;font-weight:800;line-height:1.05;margin-top:8px;position:relative;z-index:2}.sp-ann .n em{color:#E9B949;font-style:normal}
.sp-ann .who{margin-top:auto;font-size:10px;line-height:1.4;max-width:50%;position:relative;z-index:2}.sp-ann .who span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sp-ann .who b{font-size:12px;display:block}
.sp-ann .c{position:absolute;right:-30px;bottom:-40px;width:72%;aspect-ratio:1;border-radius:50%;background:var(--bd)}
.sp-ann .p{position:absolute;right:0;bottom:0;width:58%;height:76%}
.sp-ann.l{background:#F7F5F2;color:var(--k);border:1px solid var(--ln)}.sp-ann.l .w{color:var(--b)}.sp-ann.l .c{background:var(--b)}
.sp-sig{background:#fff;border:1px solid var(--ln);padding:14px 44px 14px 14px;display:flex;gap:14px;align-items:center;font-size:11px;line-height:1.45;min-height:110px}
.sp-sig .hs,.sp-fl .hs,.sp-mu .hs,.sp-tip .hs{border-radius:50%;background:#ECEAE6;overflow:hidden;flex:none}
.sp-sig .hs{width:64px;height:64px}.sp-sig b{font-size:14px;display:block}.sp-sig .t{color:var(--b);font-weight:700}.sp-sig .v{width:3px;align-self:stretch;background:var(--b);flex:none}.sp-sig .lg{width:84px;margin-top:6px;display:block}
.sp-hdr{background:var(--k);color:#fff;height:110px;display:flex;align-items:center;padding:0 130px 0 18px;border-left:6px solid var(--b)}
.sp-hdr .p{position:absolute;right:24px;bottom:0;height:100px;width:90px}.sp-hdr b{font-size:17px;display:block}.sp-hdr span{font-size:11px;color:#D8D6D2}
.sp-mu{background:#fff;border:1px solid var(--ln);padding:14px;display:flex;flex-direction:column;gap:6px;aspect-ratio:1}
.sp-mu .w{font-size:9px;font-weight:800;letter-spacing:.14em;color:var(--b);padding-right:44px}.sp-mu .big{font-size:22px;font-weight:800}.sp-mu .sm{font-size:12px;color:var(--m)}
.sp-mu .bars{display:flex;align-items:flex-end;gap:5px;height:34%;margin-top:auto}.sp-mu .bars i{flex:1;background:var(--ln);border-radius:3px 3px 0 0}.sp-mu .bars i:last-child{background:var(--b)}
.sp-mu .f{display:flex;gap:6px;align-items:center;font-size:9px;border-top:1px solid var(--ln);padding-top:6px}.sp-mu .hs{width:26px;height:26px}
.sp-fl{background:#fff;border:1px solid var(--ln);aspect-ratio:.77;display:flex;flex-direction:column}
.sp-fl .top{background:var(--k);color:#fff;padding:12px 46px 12px 12px;font-size:15px;font-weight:800;line-height:1.15}.sp-fl .top span{display:block;font-size:8px;letter-spacing:.16em;color:#A9A6A1;margin-bottom:4px}
.sp-fl .top.r{background:var(--b)}.sp-fl .top.r span{color:#F6DCE3}
.sp-fl .body{flex:1;padding:12px;display:flex;flex-direction:column;gap:6px}.sp-fl .ln{height:5px;border-radius:3px;background:var(--ln)}
.sp-fl .f{display:flex;align-items:center;gap:8px;border-top:3px solid var(--b);padding:8px 10px}.sp-fl .hs{width:38px;height:38px}
.sp-fl .f .t{font-size:8px;line-height:1.35;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sp-fl .f .t b{font-size:9.5px;display:block}.sp-fl .f .lg{width:56px;margin-left:auto}
.sp-tip{background:var(--k);color:#fff;aspect-ratio:1;padding:14px;display:flex;flex-direction:column;gap:6px}.sp-tip.r{background:var(--b)}
.sp-tip .w{font-size:8px;letter-spacing:.16em;color:#A9A6A1;font-weight:700}.sp-tip.r .w{color:#F6DCE3}.sp-tip .q{font-size:16px;font-weight:800;line-height:1.15;padding-right:30px}
.sp-tip .f{margin-top:auto;display:flex;gap:6px;align-items:center;font-size:9px}.sp-tip .hs{width:28px;height:28px;background:#4A4845}`;
  let styled = false;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // c: { name, title, area, phone, email }, photo: image URL (background already removed) or ''. logo: dark Stewart logo URL.
  function html(c, photo, logo) {
    if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
    const name = c.name || 'Candidate', first = esc(name.split(' ')[0]), N = esc(name);
    const title = esc(c.title || 'Sales Representative'), area = esc(c.area || ''), phone = esc(c.phone || ''), email = esc(c.email || '');
    // no photo: a plain silhouette, so the pieces still read as "your photo goes here"
    const P = photo ? '<img class="sp-ph" src="' + esc(photo) + '" alt="" draggable="false">' : '<svg class="sp-in" viewBox="0 0 100 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><circle cx="50" cy="42" r="22" fill="#B9B5AF"/><path d="M8 120c2-30 18-48 42-48s40 18 42 48z" fill="#B9B5AF"/></svg>';
    const L = '<img class="lg" src="' + esc(logo) + '" alt="Stewart Title" draggable="false">';
    const R = '<span class="sp-rib">SAMPLE</span>';
    const reach = [phone, email].filter(Boolean);
    const piece = (inner, cap) => '<div>' + inner + '<div class="sp-cap">' + cap + '</div></div>';
    const lines = ws => '<div class="body">' + ws.map(w => '<div class="ln" style="width:' + w + '%"></div>').join('') + '</div>';
    const flyer = (kicker, head, red, contact) => '<div class="sp-pc sp-fl">' + R + '<div class="top' + (red ? ' r' : '') + '"><span>' + kicker + '</span>' + head + '</div>' + lines([100, 80, 100, 60, 90]) +
      '<div class="f"><div class="hs">' + P + '</div><div class="t"><b>' + N + '</b>' + contact + '</div>' + L + '</div></div>';
    const tip = (q, red) => '<div class="sp-pc sp-tip' + (red ? ' r' : '') + '">' + R + '<div class="w">TITLE TIP</div><div class="q">' + q + '</div><div class="f"><div class="hs">' + P + '</div>' + N + '</div></div>';
    const month = MONTHS[new Date().getMonth()].toUpperCase();
    return '<div class="sp">' +
      '<section class="sp-sec"><h3>Your welcome announcement and branding</h3><div class="s">Made for you the week you join</div><div class="sp-row a">' +
      piece('<div class="sp-pc sp-ann">' + R + '<div class="c"></div><div class="w">— WELCOME TO THE TEAM</div><div class="n">Welcome,<br><em>' + first + '!</em></div><div class="who"><b>' + N + '</b>' + title + (area ? '<br>' + area : '') + '</div><div class="p">' + P + '</div></div>', 'Welcome post') +
      piece('<div class="sp-pc sp-ann l">' + R + '<div class="c"></div><div class="w">— NOW ON OUR TEAM</div><div class="n">Meet<br>' + first + '</div><div class="who"><b>' + N + '</b>' + reach.map(x => '<span>' + x + '</span>').join('') + '</div><div class="p">' + P + '</div></div>', 'Introduction post') +
      '<div class="sp-stack">' + piece('<div class="sp-pc sp-sig">' + R + '<div class="hs">' + P + '</div><div class="v"></div><div><b>' + N + '</b><span class="t">' + title + '</span><br>' + reach.join(' · ') + L + '</div></div>', 'Email signature') +
      piece('<div class="sp-pc sp-hdr">' + R + '<div><b>' + N + '</b><span>' + title + (area ? ' · ' + area : '') + '</span></div><div class="p">' + P + '</div></div>', 'LinkedIn and Facebook header') + '</div>' +
      piece('<div class="sp-pc sp-mu">' + R + '<div class="w">' + (area ? area.toUpperCase() + ' · ' : '') + 'SAMPLE MARKET UPDATE</div><div class="big">Median price $1.12M</div><div class="sm">Up 3.2% from last month</div>' +
        '<div class="bars"><i style="height:50%"></i><i style="height:62%"></i><i style="height:58%"></i><i style="height:70%"></i><i style="height:76%"></i><i style="height:84%"></i></div><div class="f"><div class="hs">' + P + '</div><b>' + N + '</b>' + (phone ? ' · ' + phone : '') + '</div></div>', 'Weekly market update · sample area') +
      '</div></section>' +
      '<section class="sp-sec"><h3>Flyers, title tips and newsletter</h3><div class="s">New ones every month, with your photo and contact details</div><div class="sp-row b">' +
      piece(flyer('FOR HOMEBUYERS', 'Closing costs, explained', false, phone || email), 'Buyer flyer') +
      piece(flyer('FOR SELLERS', 'What to expect at closing', false, phone || email), 'Seller flyer') +
      piece(tip('What is title insurance, and why do I need it?'), 'Title tip') +
      piece(tip('Wire fraud: call before you send', true), 'Safety tip') +
      piece(flyer(month + ' · SAMPLE AREA', 'Your monthly newsletter', true, email || phone), 'Newsletter · sample events') +
      '</div></section></div>';
  }
  return { html };
})();
