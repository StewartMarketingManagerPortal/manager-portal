// My Marketing · Make a video: pick a script, set up, record on the front camera with a teleprompter, send it in.
// The background is softly blurred on the phone while recording (person cut-out by MediaPipe), so it arrives ready to build.
'use strict';
const V = { list: null, filmed: [], err: '', blob: null, url: '', sending: 0, sent: false, speed: 1, size: 1 };
const VTIPS = [
  ['q', 'Find a quiet room', 'Close the door. No TV, fans or open windows. Phone on Do Not Disturb.'],
  ['bg', 'Pick a nice background', 'An office, bookshelf or plant a few feet behind you. Not a blank wall, a mess, or a window. We’ll soften it.'],
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
  try { const r = await api('scripts'); V.list = r.scripts || []; V.filmed = (r.filmed || []).map(nk); V.err = ''; }
  catch (e) { V.err = e.message; V.list = V.list || []; }
  if (/^(make|film)$/.test(route().page)) render();
}

// ---------- 1 · scripts ----------
function makeHtml() {
  const t = tabs('make');
  if (!V.list) vLoad();
  let h = t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#home">' + I.back + 'Home</a>' +
    '<div><h1>Make a video</h1><p>Pick a script. Your phone becomes the teleprompter, and we turn it into a finished video with your name, captions and end card.</p></div></div></header><div class="body"><div class="wrap">';
  if (!V.list) h += '<div class="boot" style="min-height:30vh"><span class="spin"></span></div>';
  else if (V.err) h += '<div class="err">' + esc(V.err) + '</div>';
  else if (!V.list.length) h += '<div class="empty">No scripts yet. West Marketing will add them here.</div>';
  else h += '<div class="vlist">' + V.list.map(s => '<a class="vrow" href="#film/' + esc(s.id) + '"><span class="vic">' + I.film + '</span><span class="vtx"><b>' + esc(s.name) + '</b><small>' + esc(vLen(s.secs)) +
    (V.filmed.includes(nk(s.name)) ? '<span class="vpill">Sent</span>' : '') + '</small></span><span class="vchev">' + I.next + '</span></a>').join('') + '</div>';
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
    '<a class="btn primary block" href="#rec/' + esc(s.id) + '">Open the camera</a>' +
    (isComputer() ? '<p class="vlight" style="text-align:center">On a computer, raise it so the camera is at eye level. A phone gives the sharpest video.</p>' : '') +
    '</div></div>' + foot() + '</div>' + t.bottom;
}

// ---------- 3 · camera + teleprompter ----------
const REC = { stream: null, video: null, canvas: null, ctx: null, seg: null, raf: 0, rec: null, chunks: [], recording: false, t0: 0, scroll: 0, last: 0, maskC: null, personC: null, ok: false, lined: false };
function recHtml(id) {
  const s = vScript(id);
  if (!V.list) { vLoad().then(() => render()); return '<div class="vcam"><div class="boot"><span class="spin"></span></div></div>'; }
  if (!s) return makeHtml();
  const words = esc(s.text).replace(/\n+/g, '<br><br>');
  return '<div class="vcam" id="vcam"><canvas id="vcanvas"></canvas>' +
    '<svg class="vguide" viewBox="0 0 300 450" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><ellipse cx="150" cy="118" rx="72" ry="90"/><path d="M0 450c8-150 70-205 150-205s142 55 150 205"/></svg>' +
    '<span class="vlens">▲ look here, at the camera</span><div class="vprompt" style="font-size:' + Math.round(21 * V.size) + 'px"><div class="vpin" id="vpin">' + words + '</div></div>' +
    '<div class="vchip" id="vchip">Getting the camera ready…</div><div class="vcount" id="vcount" hidden></div><div class="vtime" id="vtime" hidden>0:00</div>' +
    '<button class="vclose" data-vact="close" aria-label="Close">' + I.x.replace(/18/g, '22') + '</button>' +
    '<div class="vctl"><button class="vsm" data-vact="size"><span>Aa</span>Text size</button><button class="vrec" id="vrecbtn" data-vact="rec" aria-label="Start recording"><i></i></button>' +
    '<button class="vsm" data-vact="speed"><span id="vspd">' + V.speed + '×</span>Speed</button></div></div>';
}
async function recStart(id) {
  const chip = $('#vchip');
  try {
    REC.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    chip.textContent = 'Allow the camera and microphone for this site to record.'; chip.classList.add('bad'); return;
  }
  const v = REC.video = document.createElement('video'); v.playsInline = true; v.muted = true; v.srcObject = REC.stream; await v.play();
  const c = REC.canvas = $('#vcanvas'); c.width = 720; c.height = 1280; REC.ctx = c.getContext('2d');
  REC.personC = document.createElement('canvas'); REC.personC.width = 720; REC.personC.height = 1280;
  REC.maskC = document.createElement('canvas');
  chip.textContent = 'Loading the background blur…';
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
    let mask = null;
    if (REC.seg) {
      try {
        const res = REC.seg.segmentForVideo(v, performance.now());
        const m = res.confidenceMasks && res.confidenceMasks[0];
        if (m) {
          const mw = m.width, mh = m.height, f = m.getAsFloat32Array(), mc = REC.maskC;
          if (mc.width !== mw) { mc.width = mw; mc.height = mh; }
          const mx = mc.getContext('2d'), img = mx.createImageData(mw, mh), d = img.data;
          let top = -1, sx = 0, n = 0;
          for (let i = 0; i < f.length; i++) { const a = f[i]; d[i * 4 + 3] = a > 0.5 ? 255 : a * 400; if (a > 0.6) { const y = (i / mw) | 0; if (top < 0) top = y; sx += i % mw; n++; } }
          mx.putImageData(img, 0, 0); mask = mc;
          REC.lined = n > mw * mh * 0.12 && top / mh > 0.05 && top / mh < 0.3 && Math.abs(sx / n / mw - 0.5) < 0.1;
          m.close && m.close();
        }
      } catch (e) {}
    }
    if (mask) {
      c.filter = 'blur(9px)'; c.drawImage(v, r[0] - 20, r[1] - 20, r[2] + 40, r[3] + 40); c.filter = 'none';
      const p = REC.personC.getContext('2d');
      p.globalCompositeOperation = 'source-over'; p.clearRect(0, 0, W, H); p.drawImage(v, r[0], r[1], r[2], r[3]);
      p.globalCompositeOperation = 'destination-in'; p.filter = 'blur(3px)'; p.drawImage(mask, r[0], r[1], r[2], r[3]); p.filter = 'none';
      c.drawImage(REC.personC, 0, 0);
    } else c.drawImage(v, r[0], r[1], r[2], r[3]);
  }
  // teleprompter: scrolls while recording
  const now = performance.now(), dt = REC.last ? (now - REC.last) / 1000 : 0; REC.last = now;
  if (REC.recording) { REC.scroll += dt * 20 * V.speed * V.size; const pin = $('#vpin'); if (pin) pin.style.transform = 'translateY(' + (-REC.scroll) + 'px)'; const tm = $('#vtime'); if (tm) { const s = Math.floor((Date.now() - REC.t0) / 1000); tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); if (s >= 180) recStop(); } }
  else { const chip = $('#vchip'); if (chip && REC.ok && !chip.classList.contains('bad')) { chip.textContent = REC.seg ? (REC.lined ? '✓ Lined up' : 'Line yourself up with the outline') : 'Ready'; chip.classList.toggle('good', !!REC.lined); } }
  REC.raf = requestAnimationFrame(recLoop);
}
function recMime() {
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}
async function recGo() {
  if (!REC.ok || REC.recording) return;
  const cnt = $('#vcount'); cnt.hidden = false;
  for (const n of [3, 2, 1]) { cnt.textContent = n; await new Promise(r => setTimeout(r, 900)); }
  cnt.hidden = true;
  const cs = REC.canvas.captureStream(30);
  REC.stream.getAudioTracks().forEach(t => cs.addTrack(t));
  const mime = recMime();
  REC.rec = new MediaRecorder(cs, Object.assign({ videoBitsPerSecond: 5000000, audioBitsPerSecond: 128000 }, mime ? { mimeType: mime } : {}));
  REC.chunks = []; REC.rec.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  REC.rec.onstop = () => { V.blob = new Blob(REC.chunks, { type: (REC.rec.mimeType || mime || 'video/mp4').split(';')[0] }); if (V.url) URL.revokeObjectURL(V.url); V.url = URL.createObjectURL(V.blob); V.sent = false; V.sending = 0; recEnd(); go('review/' + route().arg); };
  REC.rec.start(1000); REC.recording = true; REC.t0 = Date.now(); REC.scroll = 0;
  $('#vtime').hidden = false; const b = $('#vrecbtn'); b.classList.add('on'); b.setAttribute('aria-label', 'Stop recording');
  const chip = $('#vchip'); chip.textContent = 'Recording'; chip.classList.add('rec');
}
function recStop() { if (REC.rec && REC.recording) { REC.recording = false; REC.rec.stop(); } }
function recEnd() {
  REC.ok = false; cancelAnimationFrame(REC.raf);
  if (REC.stream) REC.stream.getTracks().forEach(t => t.stop());
  REC.stream = null; if (REC.seg) { try { REC.seg.close(); } catch (e) {} REC.seg = null; }
  document.body.classList.remove('vcam-on');
}

// ---------- 4 · review and send ----------
function reviewHtml(id) {
  const t = tabs('make'), s = vScript(id);
  if (!s || !V.url) return filmHtml(id);
  let h = t.top + '<div class="frame"><header class="pagehead"><div class="wrap"><a class="back" href="#film/' + esc(id) + '">' + I.back + esc(s.name) + '</a>';
  if (V.sent) return h + '<div><h1>Sent!</h1><p>Thanks. West Marketing turns it into your finished video, and it shows up in My Marketing when it’s ready.</p></div></div></header>' +
    '<div class="body"><div class="wrap vnarrow"><a class="btn primary block" href="#make">Record another video</a><a class="btn block" href="#home">Back to home</a></div></div>' + foot() + '</div>' + t.bottom;
  const mb = (V.blob.size / 1048576).toFixed(0);
  h += '<div><h1>Looks good?</h1><p>Watch it back. If you stumbled, just record again.</p></div></div></header><div class="body"><div class="wrap vnarrow">' +
    '<video class="vreview" src="' + esc(V.url) + '" controls playsinline></video>';
  if (V.sending) h += '<div class="vsend"><span>Sending… ' + Math.round(V.sending) + '%</span><div class="vbar"><i style="width:' + V.sending + '%"></i></div><p class="vlight">Keep this screen open until it’s sent.</p></div>';
  else h += (V.err ? '<div class="err">' + esc(V.err) + '</div>' : '') + '<button class="btn primary block" data-vact="send">Send to Stewart Marketing</button><a class="btn block" href="#rec/' + esc(id) + '">Record again</a><p class="vlight" style="text-align:center">' + mb + ' MB</p>';
  return h + '</div></div>' + foot() + '</div>' + t.bottom;
}
function vSend() {
  const s = vScript(route().arg); if (!s || !V.blob || V.sending) return;
  V.err = ''; V.sending = 1; render();
  const x = new XMLHttpRequest();
  x.open('POST', '/api/video?script=' + encodeURIComponent(s.name));
  x.setRequestHeader('Content-Type', V.blob.type || 'video/mp4');
  x.upload.onprogress = e => { if (e.lengthComputable) { V.sending = Math.max(1, Math.min(97, e.loaded / e.total * 97)); const bar = document.querySelector('.vbar i'), lab = document.querySelector('.vsend span'); if (bar) bar.style.width = V.sending + '%'; if (lab) lab.textContent = 'Sending… ' + Math.round(V.sending) + '%'; } };
  x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
    if (x.status >= 200 && x.status < 300 && j.ok) { V.sent = true; V.sending = 0; if (!V.filmed.includes(nk(s.name))) V.filmed.push(nk(s.name)); }
    else { V.sending = 0; V.err = j.error || 'It didn’t send. Check your connection and try again.'; }
    render(); };
  x.onerror = () => { V.sending = 0; V.err = 'It didn’t send. Check your connection and try again.'; render(); };
  x.send(V.blob);
}

// ---------- wiring ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-vact]'); if (!el) return;
  const a = el.dataset.vact;
  if (a === 'rec') { REC.recording ? recStop() : recGo(); }
  if (a === 'close') { recStop(); recEnd(); go('film/' + route().arg); }
  if (a === 'speed') { V.speed = V.speed >= 1.5 ? 0.75 : Math.round((V.speed + 0.25) * 100) / 100; $('#vspd').textContent = V.speed + '×'; }
  if (a === 'size') { V.size = V.size >= 1.3 ? 0.85 : Math.round((V.size + 0.15) * 100) / 100; const p = document.querySelector('.vprompt'); if (p) p.style.fontSize = Math.round(21 * V.size) + 'px'; }
  if (a === 'send') vSend();
});
window.addEventListener('hashchange', () => { if (route().page !== 'rec' && REC.stream) { recStop(); recEnd(); } });
function vAfterRender() {
  if (route().page === 'rec' && $('#vcam') && !REC.stream) { document.body.classList.add('vcam-on'); recStart(route().arg); }
}
if (/^(make|film|rec|review)$/.test(route().page) && S.data) render();
