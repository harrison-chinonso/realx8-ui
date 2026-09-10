/**
 * AES-GCM for request and response bodies, the browser half.
 *
 * ── READ THIS BEFORE RELYING ON IT ───────────────────────────────────────────
 *
 * This is not what keeps the traffic private — HTTPS is. What this adds:
 *
 *   payloads are not readable in a proxy, a browser extension, a screen share
 *   or a network tab someone happens to be looking at
 *
 *   a script cannot usefully call the API without first completing a real
 *   sign-in, because the key for authenticated calls is minted per session by
 *   the server rather than shipped in this bundle
 *
 * What it cannot do is hide anything from the signed-in user: their own browser
 * must hold the key to use it, so anyone willing to open devtools can read
 * their own traffic. That is inherent to encrypting inside a page.
 *
 * Authorisation is still the JWT and the permissions behind it. Turning this
 * off changes what is readable, never who may do what.
 */

const ENABLED = String(import.meta.env.VITE_PAYLOAD_ENCRYPTION || 'off').toLowerCase() === 'on';
/**
 * The pre-login key, for the handful of calls made before a session exists.
 *
 * It ships in this bundle, so it is obfuscation and nothing more — anyone can
 * read it. It is used ONLY where there is no session yet; every authenticated
 * call uses the server-minted session key instead, which is the whole reason
 * this file distinguishes the two.
 */
const BOOTSTRAP_KEY_HEX = import.meta.env.VITE_PAYLOAD_BOOTSTRAP_KEY || '';

export const CLIENT_HEADER = 'X-Payload-Encryption';
export const SERVER_HEADER = 'x-payload-encrypted';

const IV_BYTES = 12;

/**
 * The session key, in memory only.
 *
 * Never localStorage: a key that outlives the tab is a key sitting in storage
 * for any script with DOM access to read, which would give away the one
 * property this design has over a bundle-wide key. A reload drops it and
 * client.js re-fetches it from /auth/session-key.
 */
let sessionKeyHex = null;
let sessionKeyPromise = null;

const keyCache = new Map();

const hexToBytes = (hex) => {
  const clean = String(hex || '').trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
};

const toBase64 = (bytes) => {
  let binary = '';
  const view = new Uint8Array(bytes);
  // Chunked: String.fromCharCode(...bigArray) overflows the call stack on
  // payloads of any size.
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

/** importKey is not free, and this runs per request — so each key is imported once. */
const importKey = async (hex) => {
  if (keyCache.has(hex)) return keyCache.get(hex);
  const promise = crypto.subtle.importKey(
    'raw', hexToBytes(hex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
  );
  keyCache.set(hex, promise);
  return promise;
};

export const isEncryptionEnabled = () => ENABLED && Boolean(BOOTSTRAP_KEY_HEX) && Boolean(crypto?.subtle);

export const setSessionKey = (hex) => {
  sessionKeyHex = hex || null;
  sessionKeyPromise = null;
};

export const clearSessionKey = () => {
  sessionKeyHex = null;
  sessionKeyPromise = null;
};

export const hasSessionKey = () => Boolean(sessionKeyHex);

/**
 * Recovers the session key after a reload, once.
 *
 * `sessionKeyPromise` collapses concurrent callers onto one request: the app
 * fires several calls the moment it mounts, and without this each would
 * separately fetch the key.
 */
export const ensureSessionKey = async (fetcher) => {
  if (sessionKeyHex) return sessionKeyHex;
  if (!sessionKeyPromise) {
    sessionKeyPromise = fetcher()
      .then((hex) => { sessionKeyHex = hex || null; return sessionKeyHex; })
      .catch(() => { sessionKeyPromise = null; return null; });
  }
  return sessionKeyPromise;
};

/**
 * Which key a request uses.
 *
 * The rule mirrors the server exactly: a request carrying an Authorization
 * header is encrypted with the session key, anything else with the bootstrap
 * key. Matching the server's rule rather than inventing a parallel one is what
 * keeps the refresh call working — it deliberately sends no Authorization
 * header, so both sides independently choose bootstrap for it.
 */
export const keyForRequest = (hasAuthHeader) => (
  hasAuthHeader && sessionKeyHex ? sessionKeyHex : BOOTSTRAP_KEY_HEX
);

export const encryptBody = async (value, keyHex) => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await importKey(keyHex);
  const plaintext = new TextEncoder().encode(JSON.stringify(value === undefined ? null : value));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  // WebCrypto appends the 16-byte GCM tag to the ciphertext; Node's crypto
  // keeps it separate. Splitting it here is what makes the two interoperate.
  const tagStart = sealed.length - 16;
  return {
    v: 1,
    iv: toBase64(iv),
    tag: toBase64(sealed.subarray(tagStart)),
    data: toBase64(sealed.subarray(0, tagStart)),
  };
};

export const decryptBody = async (envelope, keyHex) => {
  const key = await importKey(keyHex);
  const data = fromBase64(envelope.data);
  const tag = fromBase64(envelope.tag);
  // Re-joined, because WebCrypto expects the tag appended to the ciphertext.
  const sealed = new Uint8Array(data.length + tag.length);
  sealed.set(data, 0);
  sealed.set(tag, data.length);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, sealed,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
};

export const isEnvelope = (body) => Boolean(
  body && typeof body === 'object' && !Array.isArray(body)
  && typeof body.iv === 'string' && typeof body.tag === 'string' && typeof body.data === 'string',
);
