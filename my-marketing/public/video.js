// My Marketing · Make a video: pick a script, set up, record on the front camera with a teleprompter, send it in.
// A script split into parts (a line of "---" between them: Hook / The point / Call to action) is recorded one part at a time.
// Each part can be redone before sending; the parts go up together and Marketing Tools joins them.
// The camera records as-is (no background blur). MediaPipe finds the person only to show the "lined up" guide.
'use strict';
const V = { list: null, filmed: [], reshoot: [], asked: [], err: '', takes: [], cur: 0, forId: '', redoOne: false, sending: 0, sent: false, speed: 1, size: 1, upItem: '', upNext: 0 };
// ---------- script parts ----------
const vParts = t => { const out = [[]]; String(t || '').replace(/\r\n?/g, '\n').split('\n').forEach(l => { if (/^\s*-{3,}\s*$/.test(l)) out.push([]); else out[out.length - 1].push(l); }); return out.map(x => x.join('\n').trim()).filter(Boolean); };
const vPartName = (i, n) => n < 2 ? '' : i === 0 ? 'Hook' : i === n - 1 ? 'Call to action' : n > 3 ? 'The point ' + i : 'The point';
const vPartColor = (i, n) => n > 1 && i === n - 1 ? '#1B7A43' : ['#C98A00', '#1F4E79', '#6B4FA0'][Math.min(i, 2)];
const vSecs = s => Math.floor(s / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0');
// a reshoot request for just one part: only that part is recorded and sent
const vOnly = s => { const r = s && vRe(s.name); return r && r.part && r.part <= vParts(s.text).length ? r.part : 0; };
function vPrep(s) {
  if (V.forId === s.id && !V.sent) return;
  V.takes.forEach(t => t && t.url && URL.revokeObjectURL(t.url));
  Object.assign(V, { forId: s.id, takes: [], cur: Math.max(0, vOnly(s) - 1), redoOne: false, sent: false, sending: 0, err: '', upItem: '', upNext: 0 });
}
const VTIPS = [
  ['q', 'Find a quiet room', 'Close the door. No TV, fans or open windows. Phone on Do Not Disturb.'],
  ['bg', 'Pick a nice background', 'An office, bookshelf or plant a few feet behind you. Not a blank wall, a mess, or a window.'],
  ['sun', 'Face the light', 'Window or lamp in front of you, never behind.'],
  ['ph', 'Phone upright at eye level', 'Prop it or use a tripod, about an arm’s length away. Wipe the front camera.'],
  ['shirt', 'Dress for a client meeting', 'Solid colors work best. Avoid small stripes and logos.'],
];
const VI = {
  q: '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M19 5l-6 14"/>', bg: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 5 5 3-3 5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ph: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>', shirt: '<path d="M8 3l4 3 4-3 5 4-3 4-2-1v11H8V10l-2 1-3-4z"/>',
};
const vsvg = (p, s) => '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
const vScript = id => (V.list || []).find(x => x.id === id);
const vLen = s => s ? 'About ' + (s < 60 ? s + ' sec' : Math.floor(s / 60) + ' min ' + (s % 60 ? s % 60 + ' sec' : '')) : '';
async function vLoad(force) {
  if (V.list && !force) return;
  try { const r = await api('scripts'); V.list = r.scripts || []; V.filmed = (r.filmed || []).map(nk); V.reshoot = r.reshoot || []; V.asked = r.asked || []; V.err = ''; }
  catch (e) { V.err = e.message; V.list = V.list || []; }
  if (/^(make|film|home)$/.test(route().page)) render();
}

// West Marketing asked for these to be recorded again
const vRe = name => V.reshoot.find(x => nk(x.script) === nk(name));
const vAsk = name => V.asked.find(x => nk(x.script) === nk(name));
function vReshootHtml() {
  // West Marketing asked for these (new ones first), then the reshoots
  const ask = V.asked.filter(x => (V.list || []).some(y => nk(y.name) === nk(x.script))).map(x => { const s = V.list.find(y => nk(y.name) === nk(x.script));
    return '<a class="vre vask" href="#film/' + esc(s.id) + '"><span class="vic">' + I.film + '</span><span><b>Please record “' + esc(x.script) + '”</b>' +
      '<span>' + esc(x.note || 'West Marketing asked you for this video.') + '</span></span><span class="vchev">' + I.next + '</span></a>'; }).join('');
  if (!V.reshoot.length) return ask;
  return ask + V.reshoot.map(x => { const s = (V.list || []).find(y => nk(y.name) === nk(x.script));
    return '<a class="vre" href="' + (s ? '#film/' + esc(s.id) : '#make') + '"><span class="vic">' + I.film + '</span><span><b>Please record ' + (x.part ? 'part ' + x.part + ' of ' : '') + '“' + esc(x.script) + '” again</b>' +
      '<span>' + esc(x.note || 'West Marketing couldn’t use the last take.') + '</span></span><span class="vchev">' + I.next + '</span></a>'; }).join('');
}
// Home: one quiet line under the header until they've opened Make a video and seen the request
const vKey = x => nk(x.script) + '|' + (x.note || '') + (x.part != null ? '' : '|ask');
function vSeen() { try { return JSON.parse(localStorage.getItem('vseen') || '[]'); } catch (e) { return []; } }
function vHomeNote() {
  const seen = vSeen(), un = V.reshoot.filter(x => !seen.includes(vKey(x))), ua = V.asked.filter(x => !seen.includes(vKey(x)));
  if (!un.length && !ua.length) return '';
  const t = ua.length && !un.length ? (ua.length === 1 ? 'West Marketing asked you for a video' : 'West Marketing asked you for ' + ua.length + ' videos')
    : un.length && !ua.length ? (un.length === 1 ? 'West Marketing asked for a reshoot' : un.length + ' videos to reshoot') : (un.length + ua.length) + ' videos to record';
  return '<section class="blk vnblk"><div class="wrap"><a class="vnote" href="#make"><i></i><span>' + t + '</span><u>View ›</u></a></div></section>';
}
function vMarkSeen() { if (!V.reshoot.length && !V.asked.length) return; try { localStorage.setItem('vseen', JSON.stringify(V.reshoot.concat(V.asked).map(vKey))); } catch (e) {} }
// ---------- 1 · scripts ----------
function makeHtml() {
  const t = tabs('make');
  if (!V.list) vLoad();
  let h = t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#home">' + I.back + 'Home</a>' +
    '<div><h1>Make a video</h1><p>Pick a script. Your phone becomes the teleprompter, and we turn it into a finished video with your name, captions and end card.</p></div></div></header><div class="body"><div class="wrap">';
  if (!V.list) h += '<div class="boot" style="min-height:30vh"><span class="spin"></span></div>';
  else if (V.err) h += '<div class="err">' + esc(V.err) + '</div>';
  else if (!V.list.length) h += '<div class="empty">No scripts yet. West Marketing will add them here.</div>';
  else { vMarkSeen(); h += vReshootHtml() + '<div class="vlist">' + V.list.map(s => '<a class="vrow" href="#film/' + esc(s.id) + '"><span class="vic">' + I.film + '</span><span class="vtx"><b>' + esc(s.name) + '</b><small>' + esc(vLen(s.secs)) + (vParts(s.text).length > 1 ? ' · ' + vParts(s.text).length + ' parts' : '') +
    (s.testing ? '<span class="vpill test">Testing · only you see this</span>' : '') +
    (vRe(s.name) ? '<span class="vpill re">Please reshoot</span>' : vAsk(s.name) ? '<span class="vpill re">Asked for you</span>' : V.filmed.includes(nk(s.name)) ? '<span class="vpill">Sent</span>' : '') + '</small></span><span class="vchev">' + I.next + '</span></a>').join('') + '</div>'; }
  return h + '</div></div>' + foot() + '</div>' + t.bottom;
}
// ---------- 2 · before you film ----------
function filmHtml(id) {
  const t = tabs('make'), s = vScript(id);
  if (!V.list) { vLoad(); return t.top + '<div class="boot"><span class="spin"></span></div>'; }
  if (!s) return makeHtml();
  return t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#make">' + I.back + esc(s.name) + '</a>' +
    '<div><h1>Before you film</h1><p>A minute of setup makes the video look and sound great.</p></div></div></header><div class="body"><div class="wrap vnarrow">' +
    '<div class="vtips">' + VTIPS.map(([k, b, d]) => '<div class="vtip"><span class="vti">' + vsvg(VI[k]) + '</span><span><b>' + b + '</b><span>' + d + '</span></span></div>').join('') + '</div>' +
    '<p class="vlight">Suggested: a small phone tripod. It keeps the phone steady and at eye level, and frees up your hands.</p>' +
    '<div class="vtips"><div class="vtip"><span class="vti">' + vsvg(VI.web) + '</span><span><b>Use Safari, Chrome or Edge</b><span>On a phone or a computer with a webcam. Firefox saves the video in a format our editor can’t open.</span>' +
      '<span class="vbrows"><i>Safari</i><i>Chrome</i><i>Edge</i></span></span></div></div>' +
    (vOnly(s) ? '<div class="vre" style="margin:0"><span class="vic">' + I.film + '</span><span><b>Just part ' + vOnly(s) + ' (' + vPartName(vOnly(s) - 1, vParts(s.text).length) + ')</b><span>West Marketing asked for this part again' + (vRe(s.name).note ? ': ' + esc(vRe(s.name).note) : '.') + ' You only record this part.</span></span></div>'
      : vParts(s.text).length > 1 ? '<p class="vlight">You’ll record this in ' + vParts(s.text).length + ' short parts, one at a time, and can redo any part before you send.</p>' : '') +
    '<a class="btn primary block" href="#rec/' + esc(s.id) + '">Open the camera</a>' +
    (isComputer() ? '<p class="vlight" style="text-align:center">On a computer, raise it so the camera is at eye level. A phone gives the sharpest video.</p>' : '') +
    '</div></div>' + foot() + '</div>' + t.bottom;
}

// ---------- 3 · camera + teleprompter ----------
const REC = { stream: null, video: null, canvas: null, ctx: null, seg: null, raf: 0, rec: null, chunks: [], recording: false, t0: 0, scroll: 0, last: 0, ok: false, lined: false };
function recPromptHtml(s) {
  const P = vParts(s.text), n = P.length, i = Math.min(V.cur, n - 1);
  const head = n > 1 ? '<div class="vsegs">' + P.map((x, k) => '<i style="background:' + (V.takes[k] || k === i ? vPartColor(k, n) : 'rgba(255,255,255,.25)') + '"></i>').join('') + '</div>' +
    '<div class="vplab" style="color:' + vPartColor(i, n) + '">PART ' + (i + 1) + ' OF ' + n + ' · ' + vPartName(i, n).toUpperCase() + '</div>' : '';
  return head + '<div class="vpin" id="vpin">' + esc(P[i] || '').replace(/\n+/g, '<br><br>') + '</div>';
}
function recHtml(id) {
  const s = vScript(id);
  if (!V.list) { vLoad().then(() => render()); return '<div class="vcam"><div class="boot"><span class="spin"></span></div></div>'; }
  if (!s) return makeHtml();
  vPrep(s);
  const n = vParts(s.text).length;
  // from the script page: start at the first part not recorded yet (or the one part asked for again)
  if (!V.redoOne) { const only = vOnly(s); V.cur = only ? only - 1 : Math.max(0, vParts(s.text).findIndex((x, i) => !V.takes[i])); }
  return '<div class="vcam" id="vcam"><canvas id="vcanvas"></canvas>' +
    '<svg class="vguide" viewBox="0 0 300 450" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="150" cy="118" rx="72" ry="90"/><path d="M0 450c8-150 70-205 150-205s142 55 150 205"/></svg>' +
    '<span class="vlens">▲ look here, at the camera</span><div class="vprompt' + (n > 1 ? ' parts' : '') + '" id="vprompt" style="font-size:' + Math.round(21 * V.size) + 'px">' + recPromptHtml(s) + '</div>' +
    '<div class="vchip" id="vchip">Getting the camera ready…</div><div class="vcount" id="vcount" hidden></div><div class="vtime" id="vtime" hidden>0:00</div>' +
    '<button class="vclose" data-vact="close" aria-label="Close">' + I.x.replace(/18/g, '22') + '</button>' +
    '<div class="vctl"><button class="vsm" data-vact="size"><span>Aa</span>Text size</button><button class="vrec" id="vrecbtn" data-vact="rec" aria-label="Start recording"><i></i></button>' +
    '<button class="vsm" data-vact="speed"><span id="vspd">' + V.speed + '×</span>Speed</button></div></div>';
}
async function recStart(id) {
  const chip = $('#vchip');
  try {
    REC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: isComputer() ? 1920 : 1280 }, height: { ideal: isComputer() ? 1080 : 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    chip.textContent = 'Allow the camera and microphone for this site to record.'; chip.classList.add('bad'); return;
  }
  const v = REC.video = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = REC.stream; await v.play();
  const c = REC.canvas = $('#vcanvas'); c.width = 720; c.height = 1280; REC.ctx = c.getContext('2d');
  // MediaPipe finds the person only for the "lined up" check; the video itself is recorded as the camera sees it
  try {
    const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fs = await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    REC.seg = await vision.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'GPU' }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
  } catch (e) { REC.seg = null; }
  REC.ok = true; chip.textContent = 'Line yourself up with the outline';
  recLoop();
}
function coverRect(vw, vh, W, H) { const s = Math.max(W / vw, H / vh), w = vw * s, h = vh * s; return [(W - w) / 2, (H - h) / 2, w, h]; }
function recLoop() {
  if (!REC.ok) return;
  const v = REC.video, c = REC.ctx, W = 720, H = 1280;
  if (v.readyState >= 2 && v.videoWidth) {
    const r = coverRect(v.videoWidth, v.videoHeight, W, H);
    if (REC.seg) {
      try {
        const res = REC.seg.segmentForVideo(v, performance.now());
        const m = res.confidenceMasks && res.confidenceMasks[0];
        if (m) {
          const mw = m.width, mh = m.height, f = m.getAsFloat32Array();
          let top = -1, sx = 0, n = 0;
          for (let i = 0; i < f.length; i++) { if (f[i] > 0.6) { const y = (i / mw) | 0; if (top < 0) top = y; sx += i % mw; n++; } }
          REC.lined = n > mw * mh * 0.12 && top / mh > 0.05 && top / mh < 0.3 && Math.abs(sx / n / mw - 0.5) < 0.1;
          m.close && m.close();
        }
      } catch (e) {}
    }
    c.drawImage(v, r[0], r[1], r[2], r[3]);
  }
  // teleprompter: scrolls while recording
  const now = performance.now(), dt = REC.last ? (now - REC.last) / 1000 : 0; REC.last = now;
  if (REC.recording) { REC.scroll += dt * 20 * V.speed * V.size; const pin = $('#vpin'); if (pin) pin.style.transform = 'translateY(' + (-REC.scroll) + 'px)'; const tm = $('#vtime'); if (tm) { const s = Math.floor((Date.now() - REC.t0) / 1000); tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (s >= 180) recStop(); } }
  else { const chip = $('#vchip'); if (chip && REC.ok && !chip.classList.contains('bad') && !$('#vsheet')) { chip.textContent = REC.seg ? (REC.lined ? '✓ Lined up' : 'Line yourself up with the outline') : 'Ready'; chip.classList.toggle('good', !!REC.lined); } }
  REC.raf = requestAnimationFrame(recLoop);
}
function recMime() {
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}
async function recGo() {
  if (!REC.ok || REC.recording || $('#vsheet')) return;
  const cnt = $('#vcount'); cnt.hidden = false;
  for (const n of [3, 2, 1]) { cnt.textContent = n; await new Promise(r => setTimeout(r, 900)); }
  cnt.hidden = true;
  if (!REC.ok) return;
  const cs = REC.canvas.captureStream(30);
  REC.stream.getAudioTracks().forEach(t => cs.addTrack(t));
  const mime = recMime(), part = V.cur;
  REC.rec = new MediaRecorder(cs, Object.assign({ videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 }, mime ? { mimeType: mime } : {}));
  REC.chunks = []; REC.rec.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.rec.onstop = () => {
    const blob = new Blob(REC.chunks, { type: (REC.rec.mimeType || mime || 'video/mp4').split(';')[0] });
    const old = V.takes[part]; if (old && old.url) URL.revokeObjectURL(old.url);
    V.takes[part] = { blob: blob, url: URL.createObjectURL(blob), secs: (Date.now() - REC.t0) / 1000 };
    V.sent = false; V.sending = 0; V.upItem = ''; V.upNext = 0;
    recTook(part);
  };
  REC.rec.start(1000); REC.recording = true; REC.t0 = Date.now(); REC.scroll = 0;
  $('#vtime').hidden = false; const b = $('#vrecbtn'); b.classList.add('on'); b.setAttribute('aria-label', 'Stop recording');
  const chip = $('#vchip'); chip.textContent = 'Recording · tap when you finish' + (vParts((vScript(route().arg) || {}).text).length > 1 ? ' this part' : ''); chip.classList.remove('good'); chip.classList.add('rec');
}
function recStop() { if (REC.rec && REC.recording) { REC.recording = false; REC.rec.stop(); } }
// a part was just recorded: one-take scripts go straight to the review; parts get "Good take?" over the camera
function recTook(i) {
  const id = route().arg, s = vScript(id), n = vParts(s && s.text).length;
  const b = $('#vrecbtn'); if (b) { b.classList.remove('on'); b.setAttribute('aria-label', 'Start recording'); }
  const tm = $('#vtime'); if (tm) tm.hidden = true;
  const chip = $('#vchip'); if (chip) { chip.classList.remove('rec'); chip.textContent = ''; }
  if (n < 2) { recEnd(); go('review/' + id); return; }
  const only = vOnly(s), allDone = V.takes.filter(Boolean).length >= n;
  const nextLabel = only || V.redoOne ? 'Use this take' : i < n - 1 ? 'Next: Part ' + (i + 2) + ' · ' + vPartName(i + 1, n) : 'Watch all ' + n + ' parts';
  const sh = document.createElement('div'); sh.className = 'vsheet'; sh.id = 'vsheet';
  sh.innerHTML = '<div class="vsh-top"><video src="' + V.takes[i].url + '" playsinline muted data-vact="peek"></video><div><div class="vplab" style="color:' + vPartColor(i, n) + '">PART ' + (i + 1) + ' · ' + vPartName(i, n).toUpperCase() + '</div>' +
    '<b>Good take? ' + vSecs(V.takes[i].secs) + '</b><span>Tap the picture to watch it.</span></div></div>' +
    '<button class="btn primary block" data-vact="' + (only || V.redoOne || i === n - 1 || allDone && V.redoOne ? 'done' : 'next') + '">' + esc(nextLabel) + '</button>' +
    '<button class="btn block" data-vact="redo">Redo part ' + (i + 1) + '</button>' +
    (i < n - 1 && !only && !V.redoOne ? '<p class="vlight" style="text-align:center">Stay right where you are so the parts match.</p>' : '');
  $('#vcam').appendChild(sh);
}
function recPart(i) {
  const s = vScript(route().arg); if (!s) return;
  V.cur = i; REC.scroll = 0;
  const p = $('#vprompt'); if (p) p.innerHTML = recPromptHtml(s);
  const sh = $('#vsheet'); if (sh) sh.remove();
}
function recEnd() {
  REC.ok = false; cancelAnimationFrame(REC.raf);
  if (REC.stream) REC.stream.getTracks().forEach(t => t.stop());
  REC.stream = null; if (REC.seg) { try { REC.seg.close(); } catch (e) {} REC.seg = null; }
  document.body.classList.remove('vcam-on');
}

// ---------- 4 · review and send ----------
function reviewHtml(id) {
  const t = tabs('make'), s = vScript(id);
  const P = s ? vParts(s.text) : [], n = P.length, only = vOnly(s);
  const mine = only ? [only - 1] : P.map((x, i) => i);
  if (!s || !mine.length || mine.some(i => !V.takes[i])) return filmHtml(id);
  let h = t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#film/' + esc(id) + '">' + I.back + esc(s.name) + '</a>';
  if (V.sent) return h + '<div><h1>Sent!</h1><p>Thanks. West Marketing turns it into your finished video, and it shows up in My Marketing when it’s ready.</p></div></div></header>' +
    '<div class="body"><div class="wrap vnarrow"><a class="btn primary block" href="#make">Record another video</a><a class="btn block" href="#home">Back to home</a></div></div>' + foot() + '</div>' + t.bottom;
  const mb = (mine.reduce((a, i) => a + V.takes[i].blob.size, 0) / 1048576).toFixed(0), secs = mine.reduce((a, i) => a + V.takes[i].secs, 0);
  h += '<div><h1>Looks good?</h1><p>' + (n > 1 && !only ? 'Watch it back. If you stumbled in a part, just redo that part.' : 'Watch it back. If you stumbled, just record again.') + '</p></div></div></header><div class="body"><div class="wrap vnarrow">';
  if (n < 2) h += '<video class="vreview" src="' + esc(V.takes[0].url) + '" controls playsinline></video>';
  else {
    h += '<video class="vreview" id="vall" src="' + esc(V.takes[mine[0]].url) + '" controls playsinline></video>';
    h += mine.map(i => '<div class="vpart" style="border-left-color:' + vPartColor(i, n) + '"><video src="' + esc(V.takes[i].url) + '#t=0.1" playsinline muted preload="metadata"></video>' +
      '<span class="vtx"><b>Part ' + (i + 1) + ' · ' + vPartName(i, n) + '</b><small><em>✓</em> ' + vSecs(V.takes[i].secs) + '</small></span>' +
      (V.sending ? '' : '<button class="vredo" data-vact="redopart" data-i="' + i + '">Redo</button>') + '</div>').join('');
    if (mine.length > 1) h += '<button class="btn block" data-vact="playall">▶ Watch all ' + mine.length + ' parts</button>';
  }
  if (V.sending) h += '<div class="vsend"><span>Sending… ' + Math.round(V.sending) + '%</span><div class="vbar"><i style="width:' + V.sending + '%"></i></div><p class="vlight">Keep this screen open until it’s sent.</p></div>';
  else h += (V.err ? '<div class="err">' + esc(V.err) + '</div>' : '') + '<button class="btn primary block" data-vact="send">Send to Stewart Marketing</button>' +
    (n < 2 ? '<a class="btn block" href="#rec/' + esc(id) + '">Record again</a>' : '') + '<p class="vlight" style="text-align:center">' + vSecs(secs) + ' · ' + mb + ' MB</p>';
  return h + '</div></div>' + foot() + '</div>' + t.bottom;
}
// play the parts back to back in the big player
function vPlayAll() {
  const s = vScript(route().arg), v = $('#vall'); if (!s || !v) return;
  const only = vOnly(s), list = only ? [only - 1] : vParts(s.text).map((x, i) => i);
  let k = 0; v.src = V.takes[list[0]].url; v.play().catch(() => {});
  v.onended = () => { k++; if (k < list.length) { v.src = V.takes[list[k]].url; v.play().catch(() => {}); } else v.onended = null; };
}
function vUpload(qs, blob, onp) {
  return new Promise(res => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/video?' + qs);
    x.setRequestHeader('Content-Type', blob.type || 'video/mp4');
    x.upload.onprogress = e => { if (e.lengthComputable) onp(e.loaded / e.total); };
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} res(x.status >= 200 && x.status < 300 && j.ok ? j : { error: j.error || 'It didn’t send. Check your connection and try again.' }); };
    x.onerror = () => res({ error: 'It didn’t send. Check your connection and try again.' });
    x.send(blob);
  });
}
async function vSend() {
  const s = vScript(route().arg); if (!s || V.sending) return;
  const n = vParts(s.text).length, only = vOnly(s), re = vRe(s.name);
  const list = only ? [only - 1] : n > 1 ? vParts(s.text).map((x, i) => i) : [0];
  if (list.some(i => !V.takes[i])) return;
  V.err = ''; V.sending = 1; render();
  const total = list.reduce((a, i) => a + V.takes[i].blob.size, 0); let done = list.slice(0, V.upNext).reduce((a, i) => a + V.takes[i].blob.size, 0);
  const show = () => { const bar = document.querySelector('.vbar i'), lab = document.querySelector('.vsend span'); if (bar) bar.style.width = V.sending + '%'; if (lab) lab.textContent = 'Sending… ' + Math.round(V.sending) + '%'; };
  // one request per part (picks up where it stopped if a part didn't go through)
  for (let k = V.upNext; k < list.length; k++) {
    const i = list[k], b = V.takes[i].blob;
    let qs = 'script=' + encodeURIComponent(s.name);
    if (n > 1) qs += '&part=' + (i + 1) + '&of=' + n + (only && re ? '&redo=' + encodeURIComponent(re.id) : V.upItem ? '&item=' + encodeURIComponent(V.upItem) : '');
    const r = await vUpload(qs, b, f => { V.sending = Math.max(1, Math.min(97, (done + f * b.size) / total * 97)); show(); });
    if (r.error) { V.sending = 0; V.err = r.error; render(); return; }
    if (r.item) V.upItem = r.item;
    done += b.size; V.upNext = k + 1;
  }
  V.sent = true; V.sending = 0; V.upItem = ''; V.upNext = 0;
  if (!V.filmed.includes(nk(s.name))) V.filmed.push(nk(s.name));
  V.reshoot = V.reshoot.filter(x => nk(x.script) !== nk(s.name));
  V.asked = V.asked.filter(x => nk(x.script) !== nk(s.name));
  render();
}

// ---------- wiring ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-vact]'); if (!el) return;
  const a = el.dataset.vact;
  if (a === 'rec') { REC.recording ? recStop() : recGo(); }
  if (a === 'close') { const id = route().arg, back = V.redoOne && V.takes.filter(Boolean).length; recStop(); recEnd(); V.redoOne = false; go((back ? 'review/' : 'film/') + id); }
  if (a === 'next') recPart(V.cur + 1);
  if (a === 'redo') recPart(V.cur);
  if (a === 'done') { V.redoOne = false; recEnd(); go('review/' + route().arg); }
  if (a === 'peek') { el.muted = false; el.currentTime = 0; el.play().catch(() => {}); }
  if (a === 'redopart') { V.cur = +el.dataset.i; V.redoOne = true; go('rec/' + route().arg); }
  if (a === 'playall') vPlayAll();
  if (a === 'speed') { V.speed = V.speed >= 1.5 ? 0.75 : Math.round((V.speed + 0.25) * 100) / 100; $('#vspd').textContent = V.speed + '×'; }
  if (a === 'size') { V.size = V.size >= 1.3 ? 0.85 : Math.round((V.size + 0.15) * 100) / 100; const p = document.querySelector('.vprompt'); if (p) p.style.fontSize = Math.round(21 * V.size) + 'px'; }
  if (a === 'send') vSend();
});
window.addEventListener('hashchange', () => { if (route().page !== 'rec' && REC.stream) { recStop(); recEnd(); } });
function vAfterRender() {
  if (route().page === 'rec' && $('#vcam') && !REC.stream) { document.body.classList.add('vcam-on'); recStart(route().arg); }
}
if (/^(make|film|rec|review)$/.test(route().page) && S.data) render();
