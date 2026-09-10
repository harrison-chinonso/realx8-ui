/**
 * Signs each request so the API can tell this application's UI from a script.
 *
 * ── READ THIS BEFORE RELYING ON IT ───────────────────────────────────────────
 *
 * The key is in this bundle. Anyone can open the network tab, read it, and mint
 * the same header — that is inherent to signing in a browser, not a gap in the
 * implementation. So this is OBFUSCATION, not authentication:
 *
 *   - a script that sends no header at all is refused, which is the common case
 *   - the timestamp bounds replay to a few minutes
 *   - the signature covers the method and path, so a header captured from one
 *     request cannot authorise a different one
 *
 * It must never be the only thing protecting an endpoint. Authorisation is the
 * JWT and the permissions behind it; removing this header changes nothing about
 * who may do what.
 */

const VERSION = 'v1';
const SEPARATOR = '|';

const APP_ID = import.meta.env.VITE_FRONTEND_APP_ID || 'realx8-ui';
const SECRET = import.meta.env.VITE_FRONTEND_SECRET || '';
export const HEADER_NAME = import.meta.env.VITE_FRONTEND_HEADER_NAME || 'X-Realx8-Auth';

const encoder = new TextEncoder();
let keyPromise = null;

/** The HMAC key, imported once — importKey is not free and this runs per request. */
const hmacKey = () => {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
  return keyPromise;
};

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const randomNonce = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * The path the server will sign over.
 *
 * The API is reached at `/api/...` but every service knows the route without
 * that prefix, and the server strips it before validating — so it is stripped
 * here too. A query string is excluded: it is not part of the signed payload,
 * so including it would make every signature fail.
 */
const signedPath = (url) => {
  const path = String(url || '').split('?')[0];
  const absolute = path.startsWith('http');
  const pathname = absolute ? new URL(path).pathname : path;
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.startsWith('/api/') ? withSlash.slice(4) : withSlash;
};

/**
 * Mints the header for one request, or null when no key is configured — in
 * which case the server logs that it is not verifying and lets the request
 * through, rather than the UI silently failing every call.
 */
export const signRequest = async ({ method, url, baseURL }) => {
  if (!SECRET || !crypto?.subtle) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomNonce();
  // baseURL may itself carry the /api prefix, so the two are joined before the
  // prefix is stripped once.
  const path = signedPath(`${baseURL || ''}${url || ''}`);

  const payload = [
    APP_ID,
    String(timestamp),
    nonce,
    String(method || 'GET').toUpperCase(),
    path,
  ].join(SEPARATOR);

  const signature = toBase64(await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(payload)));
  return [VERSION, APP_ID, String(timestamp), nonce, signature].join(SEPARATOR);
};

export default signRequest;
