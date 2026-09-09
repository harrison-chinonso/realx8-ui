/**
 * Where Realx8-Core is.
 *
 * `/api` (the default) is a RELATIVE base: calls go to the origin serving this
 * app, and whatever fronts it — the Vite dev proxy, nginx, Vercel — forwards
 * them to the backend. That keeps the browser same-origin, so there is no CORS
 * preflight and no cookie/origin surprises.
 *
 * Set VITE_API_BASE_URL to an absolute URL (https://api.example.com/api) to
 * call the backend cross-origin instead. If you do, that origin must appear in
 * Realx8-Core's CORS_ORIGIN or the browser will block every request.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/** Absolute-or-relative URL for a path under the API, e.g. '/auth/google'. */
export const apiUrl = (path) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
