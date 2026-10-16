// SharedCache: one small store that every copy of the portal's server reads, so a board loaded from monday.com
// once is reused by everyone for a short while (see cached() in lib/monday.js). Values are kept in memory and
// saved to the object's own storage, so they survive the object going to sleep.
import { DurableObject } from 'cloudflare:workers';

const MAX = 1.9e6;   // storage holds up to 2 MB per value; bigger ones stay in memory only

export class SharedCache extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.mem = new Map();
  }
  async get(key) {
    if (this.mem.has(key)) return this.mem.get(key);
    const raw = this.ctx.storage.kv.get(key);
    if (raw == null) return null;
    let v = null; try { v = JSON.parse(raw); } catch (e) {}
    if (v) this.mem.set(key, v);
    return v;
  }
  async put(key, value, at) {
    const prev = this.mem.get(key);
    if (prev && prev.at > at) return;     // a newer answer is already here
    const v = { value, at };
    this.mem.set(key, v);
    const raw = JSON.stringify(v);
    if (raw.length < MAX) this.ctx.storage.kv.put(key, raw); else this.ctx.storage.kv.delete(key);
  }
  async forget(prefix) {
    for (const k of this.mem.keys()) if (k.startsWith(prefix)) this.mem.delete(k);
    for (const [k] of this.ctx.storage.kv.list({ prefix })) this.ctx.storage.kv.delete(k);
  }
}
