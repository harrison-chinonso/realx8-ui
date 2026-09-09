/**
 * Serves Realx8-Ui and reverse-proxies the API to Realx8-Core.
 *
 * Same division of labour as this repo's nginx config: anything under /api or
 * /uploads goes to the backend, everything else is a static asset with unknown
 * paths falling through to index.html for client-side routing.
 *
 * Proxying rather than calling the backend cross-origin keeps the browser
 * same-origin, so there is no preflight and nothing to add to Realx8-Core's
 * CORS_ORIGIN. API_TARGET is set in wrangler.toml, per environment.
 */

const PROXIED_PREFIXES = ['/api/', '/uploads/'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!PROXIED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return env.ASSETS.fetch(request);
    }

    if (!env.API_TARGET) {
      return Response.json({ message: 'API_TARGET is not configured for this worker.' }, { status: 500 });
    }

    // Path and query pass through unchanged — Realx8-Core serves every route
    // under /api itself, so there is no prefix to strip.
    const target = new URL(url.pathname + url.search, env.API_TARGET);

    // Cloning the original Request carries the method, headers and body over
    // without re-plumbing the body stream by hand. `redirect: manual` keeps a
    // backend 302 (the Google OAuth callback issues one) as a 302 the browser
    // sees, instead of the worker quietly following it server-side.
    return fetch(new Request(target, request), { redirect: 'manual' });
  },
};
