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

/**
 * The headers the application itself is served with.
 *
 * Kept identical in vercel.json and nginx.conf.template — whichever of the
 * three actually fronts a deployment, the app gets the same policy. There is no
 * shared file the three can read, so they are duplicated deliberately; change
 * one and change all three.
 *
 * The CSP was verified against a production build in a real browser across the
 * sign-in pages and eight authenticated screens, with zero violations. The
 * allowances are what the app genuinely loads and nothing more: Cloudinary for
 * uploaded documents, OpenStreetMap tiles for the property map, Google Fonts
 * and Fontshare for the theme's font picker, and the video hosts the training
 * and media panels embed.
 *
 * `frame-ancestors 'none'` is the one worth naming: without it this app could
 * be framed invisibly over an attacker's page, and the buttons a finance
 * administrator clicks are payment approvals.
 */
const CSP = (apiOrigin) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com",
  `img-src 'self' data: blob: https://res.cloudinary.com https://*.tile.openstreetmap.org https://images.unsplash.com https://img.youtube.com https://i.ytimg.com${apiOrigin}`,
  `media-src 'self' blob: https://res.cloudinary.com${apiOrigin}`,
  `connect-src 'self' https://res.cloudinary.com${apiOrigin}`,
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.loom.com https://drive.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * The backend's origin, when the browser talks to it directly.
 *
 * This worker proxies /api, so normally everything is same-origin and 'self'
 * covers it. But a build can set VITE_API_BASE_URL to an absolute URL and go
 * straight to the backend instead — and then `connect-src 'self'` blocks every
 * request the application makes, which is a white screen and a console full of
 * CSP errors rather than anything that looks like a policy decision.
 *
 * Derived from API_TARGET so the two cannot disagree: the host this worker is
 * willing to proxy to is the host the page may call.
 */
const apiOrigin = (env) => {
  try {
    return ` ${new URL(env.API_TARGET).origin}`;
  } catch {
    return '';
  }
};

const withSecurityHeaders = (response, env) => {
  const headers = new Headers(response.headers);
  Object.entries({
    'Content-Security-Policy': CSP(apiOrigin(env)),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Permissions-Policy': 'camera=(), microphone=(), payment=(), geolocation=(self)',
  }).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!PROXIED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
      return withSecurityHeaders(await env.ASSETS.fetch(request), env);
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
