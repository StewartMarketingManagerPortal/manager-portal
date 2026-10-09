// Manager Portal on Cloudflare Workers: /api/... runs the server code, everything else is the website in /public.
import { onRequest } from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return onRequest({ request, env, params: { route: url.pathname.slice(5).split('/').filter(Boolean) } });
    }
    return env.ASSETS.fetch(request);
  },
};
