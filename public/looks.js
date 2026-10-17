// New hire looks: live previews on Onboarding › Choose a look, drawn with the new hire's own photo, name, contacts and bio
// (the saved preview images show sample people). Same layouts as the InDesign templates in 2_Templates/0_New Hire/Announcements;
// a look with no live layout here keeps its saved preview images.
(function () {
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // the script first name uses the approved script font, served from the New Hire Packages board (never from this public repo)
  let fontState = '';
  function loadFont() {
    if (fontState || !window.FontFace) return; fontState = 'loading';
    new FontFace('NHScript', 'url(api/pkgfont)').load().then(f => { document.fonts.add(f); fontState = 'ok'; fit(); }).catch(() => { fontState = 'none'; });
  }
  const CR = '© ' + new Date().getFullYear() + ' Stewart. All rights reserved. Trademarks are the property of their respective owners.';
  const ic = {
    ph: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    em: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
  };
  function person(n) {
    const a = nhAddress(n), bio = nhBioText(n).replace(/\s+/g, ' ').trim();
    let b = bio.length > 300 ? bio.slice(0, 300).replace(/\s+\S*$/, '') + '…' : bio;
    return { f: (n.firstName || 'First').trim(), l: (n.lastName || 'Last').trim(), t: nhTitle(n) || 'Title', ph: fmtPhone(n.phone) || '(000) 000-0000', em: n.email || 'name@stewart.com',
      a1: a.address1 || 'Office address', a2: a.address2 || 'City, CA 00000', bio: b, noBio: !b, pic: n.cutUrl || n.photoUrl || '', cut: !!n.cutUrl };
  }
  function build(P) {
    const bio = P.noBio ? '<span style="opacity:.55">Their About Me goes here.</span>' : e(P.bio);
    const rows = (x, y, color, fs) => '<div class="lk-abs lk-rows" style="left:' + x + 'px;top:' + y + 'px;color:' + (color || 'var(--lk-ink)') + ';font-size:' + (fs || 28) + 'px"><div>' + ic.ph + e(P.ph) + '</div><div>' + ic.em + e(P.em) + '</div><div>' + ic.pin + e(P.a1) + '</div><div style="padding-left:50px;margin-top:-8px">' + e(P.a2) + '</div></div>';
    const line = (y, color, sub) => '<div class="lk-abs" style="left:0;right:0;top:' + y + 'px;text-align:center;font-size:26px;font-weight:600;color:' + color + '">' + e(P.ph) + '  ·  ' + e(P.em) + '</div><div class="lk-abs" style="left:0;right:0;top:' + (y + 42) + 'px;text-align:center;font-size:22px;font-weight:600;color:' + sub + '">' + e(P.a1) + ', ' + e(P.a2) + '</div>';
    const logo = (x, y, w, white) => '<img class="lk-abs" src="brand/stewart-logo' + (white ? '-white' : '') + '.png" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px" alt="">';
    const cr = c => '<div class="lk-abs" style="left:40px;right:40px;top:1300px;text-align:center;font-size:15px;font-weight:500;color:' + c + '">' + CR + '</div>';
    // y = top of the script's tall capitals (the font's letters rise well above its box)
    const name = (x, y, o) => { o = o || {}; const fs = o.fs || 120, dx = o.dx == null ? 70 : o.dx, dy = o.dy == null ? 150 : o.dy, ls = o.ls || 50; y += fs * 0.45;
      return '<div class="lk-abs lk-fn" style="left:' + x + 'px;top:' + y + 'px;font-size:' + fs + 'px;color:' + (o.fc || 'var(--lk-ink)') + '">' + e(P.f) + '</div>' +
        '<div class="lk-abs lk-ln" style="left:' + (x + dx) + 'px;top:' + (y + dy) + 'px;font-size:' + ls + 'px;color:' + (o.lc || 'var(--lk-red)') + '">' + e(P.l) + '</div>' +
        '<div class="lk-abs lk-tt" style="left:' + (x + dx + 3) + 'px;top:' + (y + dy + ls * 1.45) + 'px;font-size:' + (o.ts || 20) + 'px;color:' + (o.tc || 'var(--lk-ink)') + '">' + e(P.t) + '</div>'; };
    const photo = () => P.pic ? '<img class="' + (P.cut ? 'lk-cut' : 'lk-raw') + '" src="' + e(P.pic) + '" alt="">' : '<span class="lk-nophoto">Photo</span>';
    const circ = (x, y, d, gap, bg) => { gap = gap == null ? 14 : gap; return '<div class="lk-abs lk-circ" style="left:' + x + 'px;top:' + y + 'px;width:' + d + 'px;height:' + d + 'px;background:' + (bg || 'var(--lk-paper)') + '">' + photo() + '</div>' +
      '<div class="lk-abs lk-ring" style="left:' + (x - gap) + 'px;top:' + (y - gap) + 'px;width:' + (d + 2 * gap) + 'px;height:' + (d + 2 * gap) + 'px"></div>'; };
    const rr = (x, y, w, h) => '<div class="lk-abs lk-circ" style="left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:40px;background:#EFE8DF;box-shadow:-14px 0 0 var(--lk-red)">' + photo() + '</div>';
    const plain = (x, y, d) => '<div class="lk-abs lk-circ" style="left:' + x + 'px;top:' + y + 'px;width:' + d + 'px;height:' + d + 'px;background:var(--lk-paper)">' + photo() + '</div>';
    const edge = '<div class="lk-abs" style="left:0;top:0;width:26px;height:1350px;background:var(--lk-red)"></div>';
    const mew = (x, y) => '<div class="lk-abs" style="left:' + x + 'px;top:' + y + 'px;font-size:28px;font-weight:600;line-height:1.75">' +
      [['M', P.ph], ['E', P.em], ['O', P.a1 + ', ' + P.a2]].map(r => '<div><span style="display:inline-block;width:44px;color:var(--lk-red);font-weight:800">' + r[0] + '</span>' + e(r[1]) + '</div>').join('') + '</div>';
    const post = (bg, inner, color) => '<div class="lk-post" style="background:' + bg + (color ? ';color:' + color : '') + '">' + inner + '</div>';
    return {
      'soft paper': [
        post('#F4F2EE', logo(70, 70, 280) + circ(560, 170, 430) + '<div class="lk-abs lk-kick" style="left:70px;top:210px">Please welcome</div>' + name(66, 275, { fs: 130, dy: 175 }) + rows(70, 630) +
          '<div class="lk-abs" style="left:70px;top:860px;width:940px;height:400px;background:#fff;border-radius:28px;border-left:12px solid var(--lk-red);padding:44px 52px"><div class="lk-lbl">About ' + e(P.f) + '</div><div class="lk-bio">' + bio + '</div></div>' + cr('var(--lk-muted)')),
        post('#F4F2EE', logo(70, 70, 280) + '<div class="lk-abs lk-kick" style="left:70px;top:230px">Big news</div><div class="lk-abs lk-hd" style="left:70px;top:290px;font-size:96px;width:900px">I’ve joined<br><span style="color:var(--lk-red)">Stewart Title</span></div>' +
          circ(620, 620, 380) + name(66, 560, { fs: 120, dy: 160, dx: 40 }) + rows(70, 920) + cr('var(--lk-muted)'))],
      'ink': [
        post('var(--lk-ink)', logo(70, 70, 220, true) + circ(370, 60, 340, 14, '#2A2A2D') + '<div class="lk-abs lk-kick" style="left:0;right:0;top:470px;text-align:center;color:var(--lk-line)">Welcome to the team</div>' +
          '<div class="lk-abs" style="left:0;right:0;top:650px;text-align:center"><span class="lk-fn" style="display:inline-block;font-size:130px;color:#fff">' + e(P.f) + '</span></div>' +
          '<div class="lk-abs lk-ln" style="left:0;right:0;top:805px;text-align:center;font-size:48px;color:var(--lk-line)">' + e(P.l) + '</div>' +
          '<div class="lk-abs lk-tt" style="left:0;right:0;top:877px;text-align:center;font-size:20px;color:var(--lk-line)">' + e(P.t) + '</div>' +
          '<div class="lk-abs" style="left:490px;top:928px;width:100px;height:6px;background:var(--lk-red)"></div>' +
          '<div class="lk-abs lk-bio" style="left:120px;right:120px;top:960px;text-align:center;color:#E8E6E2;font-size:28px">' + bio + '</div>' + line(1215, '#fff', 'var(--lk-line)') + cr('var(--lk-line)'), '#fff'),
        post('var(--lk-ink)', logo(70, 70, 260, true) + '<div class="lk-abs lk-kick" style="left:70px;top:230px;color:var(--lk-line)">A new chapter</div>' +
          '<div class="lk-abs lk-hd" style="left:70px;top:290px;font-size:84px;width:940px">I’m excited to share that I’ve joined <span style="color:var(--lk-line)">Stewart Title</span></div>' +
          circ(620, 700, 380, 14, '#2A2A2D') + name(66, 650, { fs: 120, fc: '#fff', lc: 'var(--lk-line)', tc: 'var(--lk-line)', dx: 40, dy: 160 }) + rows(70, 1000, '#fff') + cr('var(--lk-line)'), '#fff')],
      'welcome': [
        post('var(--lk-paper)', logo(70, 70, 260) + '<div class="lk-abs lk-hd" style="left:70px;top:190px;font-size:98px">Welcome</div>' + name(80, 330, { fs: 140, dx: 90, dy: 190, ls: 40, ts: 19 }) + rr(620, 160, 390, 500) +
          '<div class="lk-abs" style="left:70px;top:700px;width:940px;height:400px;background:#fff;border-radius:28px;padding:56px 60px 0 150px"><div class="lk-abs" style="left:44px;top:0;font-size:170px;font-weight:800;color:var(--lk-red);line-height:1">“</div>' +
          '<div class="lk-lbl">Get to know ' + e(P.f) + '</div><div class="lk-bio" style="font-size:29px">' + bio + '</div></div>' + line(1160, 'var(--lk-ink)', 'var(--lk-muted)') +
          '<div class="lk-abs" style="left:0;right:0;top:1250px;text-align:center;font-size:20px;font-weight:700;letter-spacing:.25em;color:var(--lk-red)">SAY HELLO</div>' + cr('var(--lk-muted)')),
        post('var(--lk-paper)', logo(70, 70, 260) + '<div class="lk-abs lk-hd" style="left:70px;top:190px;font-size:96px;width:940px">Hello from<br><span style="color:var(--lk-red)">Stewart Title</span></div>' + rr(70, 450, 440, 600) +
          name(570, 470, { fs: 120, dx: 40, dy: 160, ls: 44 }) + '<div class="lk-abs" style="left:590px;top:800px;width:420px;font-size:30px;font-weight:500;line-height:1.5;color:var(--lk-muted)">I’d love to help with your next closing. Let’s connect!</div>' + rows(70, 1100) + cr('var(--lk-muted)'))],
      'left edge': [
        post('#fff', edge + logo(90, 70, 260) + plain(600, 150, 410) + '<div class="lk-abs lk-kick" style="left:90px;top:220px">Say hello to</div>' +
          '<div class="lk-abs lk-hd" style="left:90px;top:275px;font-size:84px;width:500px">' + e(P.f) + '<br>' + e(P.l) + '</div><div class="lk-abs lk-tt" style="left:92px;top:470px;font-size:22px;color:var(--lk-red)">' + e(P.t) + '</div>' +
          '<div class="lk-abs" style="left:92px;top:520px;font-size:26px;font-weight:600;color:var(--lk-muted);width:470px;line-height:1.45">Our newest team member</div>' +
          '<div class="lk-abs" style="left:90px;top:640px;width:920px;height:2px;background:var(--lk-line)"></div><div class="lk-abs" style="left:90px;top:690px;width:920px"><div class="lk-lbl">About ' + e(P.f) + '</div><div class="lk-bio">' + bio + '</div></div>' +
          '<div class="lk-abs" style="left:90px;top:1010px;width:920px;height:2px;background:var(--lk-line)"></div>' + mew(90, 1050) + cr('var(--lk-muted)')),
        post('#fff', edge + logo(90, 70, 260) + '<div class="lk-abs lk-kick" style="left:90px;top:230px">Exciting news</div><div class="lk-abs lk-hd" style="left:90px;top:290px;font-size:80px;width:920px">I’ve joined the team<br>at <span style="color:var(--lk-red)">Stewart Title</span></div>' +
          plain(600, 540, 410) + '<div class="lk-abs lk-hd" style="left:90px;top:580px;font-size:64px;width:500px">' + e(P.f) + '<br>' + e(P.l) + '</div><div class="lk-abs lk-tt" style="left:92px;top:740px;font-size:20px;color:var(--lk-red)">' + e(P.t) + '</div>' +
          '<div class="lk-abs" style="left:92px;top:790px;font-size:26px;font-weight:500;color:var(--lk-muted);width:470px;line-height:1.45">I’d love to help with your next closing.</div>' + mew(90, 1040) + cr('var(--lk-muted)'))],
    };
  }
  const key = name => String(name || '').toLowerCase().replace(/^\d+\s*/, '').replace(/\s+/g, ' ').trim();
  // the look's two posts drawn for this new hire, or null when the look has no live layout (it keeps its saved previews)
  window.nhLive = function (name, n) {
    const k = key(name), all = build(person(n)), posts = all[k];
    if (!posts) return null;
    loadFont(); setTimeout(fit, 0);
    return posts.map(p => '<span class="pk-live">' + p + '</span>');
  };
  // scale each 1080 × 1350 post to the width of its box
  function fit() { document.querySelectorAll('.pk-live').forEach(el => { const p = el.firstElementChild; if (p) p.style.transform = 'scale(' + (el.clientWidth / 1080) + ')'; }); }
  window.addEventListener('resize', fit);
})();
