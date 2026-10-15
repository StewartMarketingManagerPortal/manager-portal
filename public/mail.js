// Reads an email dropped from Outlook: .eml (Outlook for Mac, saved emails) or .msg (Outlook for Windows).
// MailFile.read(file) -> { subject, from: { name, email }, to: [{ name, email }], date (ISO or ''), text, attachments: [{ name, type, size, inline, file }] }
'use strict';
const MailFile = (() => {
  const td = (bytes, cs) => { try { return new TextDecoder(cs || 'utf-8').decode(bytes); } catch (e) { return new TextDecoder('utf-8').decode(bytes); } };
  const latin = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
  const b64 = s => { try { return latin(atob(s.replace(/[^A-Za-z0-9+/=]/g, ''))); } catch (e) { return new Uint8Array(0); } };
  const qp = s => latin(s.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16))));
  // =?utf-8?B?...?= and =?utf-8?Q?...?= in headers
  const words = s => String(s || '').replace(/\?=\s+=\?/g, '?==?').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (m, cs, enc, t) =>
    td(/b/i.test(enc) ? b64(t) : qp(t.replace(/_/g, ' ')), cs));
  const addr = s => { s = words(s).trim(); const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m ? { name: m[1].trim(), email: m[2].trim().toLowerCase() } : { name: '', email: s.replace(/[<>]/g, '').trim().toLowerCase() }; };
  const addrs = s => String(s || '').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(addr).filter(a => a.email);
  const strip = h => { const d = new DOMParser().parseFromString(String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n'), 'text/html'); return (d.body ? d.body.textContent : '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); };
  const param = (h, k) => { const m = String(h || '').match(new RegExp(k + '\\*?=(?:"([^"]*)"|([^;\\s]*))', 'i')); if (!m) return ''; let v = m[1] != null ? m[1] : m[2]; const x = v.match(/^([^']*)'[^']*'(.*)$/); if (x) { try { v = decodeURIComponent(x[2]); } catch (e) {} } return words(v); };

  // ---------- .eml ----------
  function headers(raw) {
    const i = raw.search(/\r?\n\r?\n/), head = i < 0 ? raw : raw.slice(0, i), body = i < 0 ? '' : raw.slice(i).replace(/^\r?\n\r?\n/, '');
    const h = {}; head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => { const c = l.indexOf(':'); if (c > 0) { const k = l.slice(0, c).trim().toLowerCase(); if (!(k in h)) h[k] = l.slice(c + 1).trim(); } });
    return { h, body };
  }
  function part(raw, out) {
    const { h, body } = headers(raw), ct = h['content-type'] || 'text/plain', type = ct.split(';')[0].trim().toLowerCase();
    if (type.startsWith('multipart/')) {
      const bd = param(ct, 'boundary'); if (!bd) return;
      body.split('--' + bd).slice(1).forEach(p => { if (!/^--/.test(p)) part(p.replace(/^\r?\n/, ''), out); });
      return;
    }
    if (type === 'message/rfc822') { out.attachments.push(attach(param(h['content-disposition'], 'filename') || 'Forwarded email.eml', 'message/rfc822', latin(body), false)); return; }
    const enc = (h['content-transfer-encoding'] || '').toLowerCase(), disp = h['content-disposition'] || '';
    const bytes = enc === 'base64' ? b64(body) : enc === 'quoted-printable' ? qp(body) : latin(body);
    const name = param(disp, 'filename') || param(ct, 'name');
    if (name || /^attachment/i.test(disp) || !/^text\//.test(type)) { out.attachments.push(attach(name || 'attachment', type, bytes, /^inline/i.test(disp) || !!h['content-id'])); return; }
    const text = td(bytes, param(ct, 'charset') || 'utf-8');
    if (type === 'text/plain' && !out.plain) out.plain = text;
    if (type === 'text/html' && !out.html) out.html = text;
  }
  function eml(buf) {
    const raw = new TextDecoder('latin1').decode(buf), { h } = headers(raw), out = { plain: '', html: '', attachments: [] };
    part(raw, out);
    const d = new Date(h.date || '');
    return { subject: words(h.subject || ''), from: addr(h.from || ''), to: addrs(h.to).concat(addrs(h.cc)), date: isNaN(d) ? '' : d.toISOString(), text: (out.plain || strip(out.html)).replace(/\r\n/g, '\n').trim(), attachments: out.attachments };
  }
  function attach(name, type, bytes, inline) { name = String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || 'attachment'; return { name, type: type || 'application/octet-stream', size: bytes.length, inline, file: new File([bytes], name, { type: type || 'application/octet-stream' }) }; }

  // ---------- .msg (an OLE compound file) ----------
  function cfb(buf) {
    const dv = new DataView(buf), u32 = o => dv.getUint32(o, true), ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true);
    const off = n => (n + 1) * ss;
    const difat = []; for (let i = 0; i < 109; i++) { const v = u32(76 + i * 4); if (v < 0xFFFFFFFA) difat.push(v); }
    let dn = u32(68), guard = 0; while (dn < 0xFFFFFFFA && guard++ < 1000) { for (let i = 0; i < ss / 4 - 1; i++) { const v = u32(off(dn) + i * 4); if (v < 0xFFFFFFFA) difat.push(v); } dn = u32(off(dn) + ss - 4); }
    const fat = []; difat.forEach(s => { for (let i = 0; i < ss / 4; i++) fat.push(u32(off(s) + i * 4)); });
    const chain = (s, t) => { const r = []; let g = 0; while (s < 0xFFFFFFFA && g++ < 1e6) { r.push(s); s = t[s]; } return r; };
    const read = (s, size) => { const out = new Uint8Array(chain(s, fat).length * ss); chain(s, fat).forEach((n, i) => out.set(new Uint8Array(buf, off(n), Math.min(ss, buf.byteLength - off(n))), i * ss)); return size != null ? out.subarray(0, size) : out; };
    const dir = read(u32(48)), ents = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const d = new DataView(dir.buffer, dir.byteOffset + o, 128), nl = d.getUint16(64, true);
      ents.push({ name: td(dir.subarray(o, o + Math.max(0, nl - 2)), 'utf-16le'), type: d.getUint8(66), left: d.getUint32(68, true), right: d.getUint32(72, true), child: d.getUint32(76, true), start: d.getUint32(116, true), size: d.getUint32(120, true) });
    }
    const minifat = []; if (u32(60) < 0xFFFFFFFA) { const m = read(u32(60)); for (let i = 0; i + 4 <= m.length; i += 4) minifat.push(new DataView(m.buffer, m.byteOffset + i, 4).getUint32(0, true)); }
    const ministream = ents[0] ? read(ents[0].start) : new Uint8Array(0);
    const data = e => { if (e.size < 4096) { const c = chain(e.start, minifat), out = new Uint8Array(c.length * mss); c.forEach((n, i) => out.set(ministream.subarray(n * mss, n * mss + mss), i * mss)); return out.subarray(0, e.size); } return read(e.start, e.size); };
    // children of a storage: walk its red-black tree
    const kids = e => { const r = {}, walk = i => { if (i >= ents.length || i === 0xFFFFFFFF) return; const k = ents[i]; walk(k.left); r[k.name] = k; walk(k.right); }; walk(e.child); return r; };
    return { root: ents[0], kids, data };
  }
  function msg(buf) {
    const f = cfb(buf), top = f.kids(f.root);
    const str = (kids, tag) => { const u = kids['__substg1.0_' + tag + '001F'], a = kids['__substg1.0_' + tag + '001E']; return u ? td(f.data(u), 'utf-16le').replace(/\0+$/, '') : a ? td(f.data(a), 'windows-1252').replace(/\0+$/, '') : ''; };
    const bin = (kids, tag) => { const b = kids['__substg1.0_' + tag + '0102']; return b ? f.data(b) : null; };
    // fixed-size properties: 16-byte rows after a 32-byte header (24 inside attachments)
    const props = (kids, head) => { const p = kids['__properties_version1.0'], out = {}; if (!p) return out; const b = f.data(p); for (let o = head; o + 16 <= b.length; o += 16) { const dv = new DataView(b.buffer, b.byteOffset + o, 16); out[dv.getUint32(0, true).toString(16).padStart(8, '0')] = dv; } return out; };
    const time = dv => { if (!dv) return ''; const t = Number((BigInt(dv.getUint32(12, true)) << 32n) | BigInt(dv.getUint32(8, true))); const ms = t / 1e4 - 11644473600000; const d = new Date(ms); return isNaN(d) || ms < 0 ? '' : d.toISOString(); };
    const p = props(top, 32);
    let text = str(top, '1000');
    if (!text) { const h = bin(top, '1013') || null; const hs = str(top, '1013'); text = h ? strip(td(h, 'utf-8')) : hs ? strip(hs) : ''; }
    const fromEmail = (str(top, '5D01') || str(top, '0C1F') || str(top, '0065')).toLowerCase();
    const to = []; Object.keys(top).filter(k => k.startsWith('__recip_version1.0_')).forEach(k => { const r = f.kids(top[k]); const e = (str(r, '39FE') || str(r, '3003')).toLowerCase(); if (/@/.test(e)) to.push({ name: str(r, '3001'), email: e }); });
    const attachments = [];
    Object.keys(top).filter(k => k.startsWith('__attach_version1.0_')).forEach(k => {
      const a = f.kids(top[k]), ap = props(a, 8), data = bin(a, '3701');
      if (!data) return;
      const hidden = ap['7ffe000b'] && ap['7ffe000b'].getUint8(8) === 1;
      attachments.push(attach(str(a, '3707') || str(a, '3704') || 'attachment', str(a, '370E') || '', data, hidden || !!str(a, '3712')));
    });
    return { subject: str(top, '0037'), from: { name: str(top, '0C1A') || str(top, '0042'), email: /@/.test(fromEmail) ? fromEmail : '' }, to,
      date: time(p['0e060040']) || time(p['00390040']), text: text.replace(/\r\n/g, '\n').trim(), attachments };
  }
  async function read(file) {
    const buf = await file.arrayBuffer(), head = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
    const ole = head.length === 8 && head[0] === 0xD0 && head[1] === 0xCF && head[2] === 0x11 && head[3] === 0xE0;
    const m = ole ? msg(buf) : eml(buf);
    // only the newest message: stop at the quoted reply
    const cut = m.text.search(/\n\s*(-{2,}\s*Original Message\s*-{2,}|From:\s.+\n\s*(Sent|Date):|On .{6,120}wrote:|_{20,})/i);
    m.latest = (cut > 0 ? m.text.slice(0, cut) : m.text).trim();
    return m;
  }
  return { read };
})();
