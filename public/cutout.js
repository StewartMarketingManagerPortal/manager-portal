// Preview-only background removal for headshots, done in the browser (MediaPipe Selfie Segmentation, Apache-2.0,
// files in vendor/selfie). Marketing still makes the final cutout in Photoshop; this is just so the look samples
// show the person without their background.
'use strict';
const Cutout = (() => {
  let ready = null;
  function load() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/selfie/selfie_segmentation.js';
      s.onload = async () => {
        try {
          const seg = new SelfieSegmentation({ locateFile: f => 'vendor/selfie/' + f });
          seg.setOptions({ modelSelection: 0, selfieMode: false });
          await seg.initialize();
          resolve(seg);
        } catch (e) { reject(e); }
      };
      s.onerror = () => reject(new Error('could not load the cutout tool'));
      document.head.appendChild(s);
    });
    ready.catch(() => { ready = null; });
    return ready;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))]);

  // returns an object URL of a PNG with the background removed and trimmed to the person, or throws
  async function make(file) {
    const seg = await withTimeout(load(), 20000);
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    src.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const mask = await withTimeout(new Promise(res => { seg.onResults(r => res(r.segmentationMask)); seg.send({ image: src }); }), 15000);
    // soften the mask edge a little, then keep the photo only where the person is
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    ctx.filter = 'blur(1.5px)';
    ctx.drawImage(mask, 0, 0, w, h);
    ctx.filter = 'none';
    // sharpen the soft mask: push faint edges out, solid areas in
    const im = ctx.getImageData(0, 0, w, h), d = im.data;
    for (let i = 3; i < d.length; i += 4) { const a = d[i] / 255; const t = Math.min(1, Math.max(0, (a - 0.35) / 0.4)); d[i] = Math.round(255 * t * t * (3 - 2 * t)); }
    ctx.putImageData(im, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(src, 0, 0);
    // trim to the person
    const px = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 40) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (n < (w * h) / 4 / 50) throw new Error('no person found');
    const pad = 6; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = h - 1;
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const trim = document.createElement('canvas'); trim.width = tw; trim.height = th;
    trim.getContext('2d').drawImage(out, x0, y0, tw, th, 0, 0, tw, th);
    const blob = await new Promise(res => trim.toBlob(res, 'image/png'));
    return URL.createObjectURL(blob);
  }
  return { make, load };
})();
