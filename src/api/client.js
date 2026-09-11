import axios from 'axios';
import useAuthStore from '../store/authStore';
import { API_BASE } from './apiBase';
import { extractError } from '../utils/extractError';
import { signRequest, HEADER_NAME } from './frontendSignature';
import { refreshLooping } from './refreshBudget';
import {
  isEncryptionEnabled, keyForRequest, encryptBody, decryptBody, isEnvelope,
  ensureSessionKey, setSessionKey, clearSessionKey, hasSessionKey,
  CLIENT_HEADER, SERVER_HEADER,
} from './payloadCrypto';

const client = axios.create({
  baseURL: API_BASE,
});

let isRefreshing = false;
let queue = [];


const processQueue = (error, token = null) => {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
};

/**
 * Async on purpose: the request signature is computed with WebCrypto, which is
 * promise-based. Axios awaits a request interceptor, so every call carries the
 * header without any call site knowing about it.
 */
client.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * The signature covers the METHOD and PATH, so it has to be minted per
   * request rather than once per session. Failure is swallowed: an unsigned
   * request gets a clear 403 from the API, which is a better failure than the
   * UI refusing to make the call at all.
   */
  try {
    const signature = await signRequest({
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
    });
    if (signature) config.headers[HEADER_NAME] = signature;
  } catch {
    // Leave the header off; the server decides.
  }

  /**
   * Encrypt the body, when encryption is switched on.
   *
   * The key is chosen by whether this request carries an Authorization header,
   * which is exactly the rule the server applies — so the refresh call, which
   * deliberately sends none, lands on the bootstrap key at both ends without
   * either side special-casing it.
   *
   * Multipart is skipped: FormData is a stream of file parts, not JSON, and
   * there is nothing here to encrypt without buffering whole uploads into
   * memory. The server skips the same requests by content type.
   */
  if (isEncryptionEnabled() && !(config.data instanceof FormData)) {
    try {
      // A reload keeps the token but drops the in-memory key, so recover it
      // before the first authenticated call rather than falling back to
      // plaintext for the rest of the session.
      if (token && !hasSessionKey()) {
        await ensureSessionKey(async () => {
          const signature = await signRequest({
            method: 'GET', url: '/auth/session-key', baseURL: API_BASE,
          }).catch(() => null);
          const res = await axios.get(`${API_BASE}/auth/session-key`, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(signature ? { [HEADER_NAME]: signature } : {}),
            },
          });
          return res.data?.data?.payloadKey || null;
        });
      }

      const keyHex = keyForRequest(Boolean(token));
      if (keyHex) {
        config.headers[CLIENT_HEADER] = 'on';
        if (config.data !== undefined && config.data !== null) {
          config.data = await encryptBody(config.data, keyHex);
        }
      }
    } catch {
      /**
       * Send it in the clear rather than failing the call.
       *
       * In permissive mode the server accepts it and the user notices nothing;
       * in strict mode they get a clear refusal from the API. Either beats the
       * UI refusing to make the request itself over a crypto error.
       */
    }
  }

  return config;
});

/**
 * Decrypts a response in place, if it is an envelope.
 *
 * Applied to errors as well as successes: a 400 body is written with res.json
 * too, so it arrives encrypted, and without this every failure would surface
 * as an unreadable object instead of its message.
 */
const decryptResponse = async (response) => {
  if (!response || String(response.headers?.[SERVER_HEADER] || '') !== '1') return response;
  if (!isEnvelope(response.data)) return response;
  try {
    const hasAuth = Boolean(response.config?.headers?.Authorization);
    response.data = await decryptBody(response.data, keyForRequest(hasAuth));
  } catch {
    // Leave the envelope in place; extractError will report a generic failure
    // rather than the UI crashing on an unexpected shape.
  }
  return response;
};

client.interceptors.response.use(
  (response) => decryptResponse(response),
  async (error) => {
    await decryptResponse(error.response);
    const originalRequest = error.config;
    const refreshToken = useAuthStore.getState().refreshToken;

    /**
     * Signed in elsewhere: sign out here, do not try to refresh.
     *
     * Refreshing would be the wrong response to this particular 401 — the
     * session is gone on purpose, and retrying just produces a second refusal
     * while leaving the user on a page whose data will not load.
     */
    if (error.response?.status === 401 && error.response?.data?.reason === 'session_superseded') {
      clearSessionKey();
      useAuthStore.getState().logout();
      error.userMessage = extractError(error);
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && refreshToken && !originalRequest._retry && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      if (refreshLooping()) {
        /**
         * The loop-breaker. Ending the session here is what makes the failure
         * recoverable: the user lands on the sign-in page instead of a screen
         * whose every request fails silently.
         */
        console.warn('[auth] too many token refreshes in a short window — ending the session');
        isRefreshing = false;
        clearSessionKey();
        useAuthStore.getState().logout();
        error.userMessage = 'Your session could not be renewed. Please sign in again.';
        return Promise.reject(error);
      }

      try {
        const activeRoleId = useAuthStore.getState().activeRole?.id || null;
        /**
         * Signed explicitly.
         *
         * This deliberately uses bare axios rather than `client`, so that a 401
         * on the refresh itself cannot re-enter this interceptor and loop. The
         * cost is that it also skips the REQUEST interceptor — so the frontend
         * signature has to be attached by hand, or refresh is refused with 403
         * and every user is signed out the moment their access token expires.
         */
        const refreshSignature = await signRequest({
          method: 'POST',
          url: '/auth/refresh',
          baseURL: API_BASE,
        }).catch(() => null);

        /**
         * Encrypted by hand, with the bootstrap key.
         *
         * This call bypasses the request interceptor, so nothing else would do
         * it — and in strict mode an unencrypted body is refused, which would
         * mean every session ending at the first token expiry instead of
         * refreshing.
         */
        const refreshBody = {
          refreshToken,
          ...(activeRoleId ? { roleId: activeRoleId } : {}),
        };
        const response = await axios.post(
          `${API_BASE}/auth/refresh`,
          isEncryptionEnabled()
            ? await encryptBody(refreshBody, keyForRequest(false)).catch(() => refreshBody)
            : refreshBody,
          {
          headers: {
            ...(refreshSignature ? { [HEADER_NAME]: refreshSignature } : {}),
            ...(isEncryptionEnabled() ? { [CLIENT_HEADER]: 'on' } : {}),
          },
        },
        );
        /**
         * The refresh reply is encrypted with the BOOTSTRAP key, because the
         * request carried no Authorization header — so it is decrypted here by
         * hand, for the same reason the signature is minted by hand: this call
         * bypasses the interceptors to avoid re-entering them on a 401.
         */
        if (String(response.headers?.[SERVER_HEADER] || '') === '1' && isEnvelope(response.data)) {
          try {
            response.data = await decryptBody(response.data, keyForRequest(false));
          } catch {
            // Falls through; the missing accessToken below triggers a logout.
          }
        }
        const nextToken = response.data.accessToken;
        // A new token means a new session id, so the old key no longer matches.
        setSessionKey(response.data.payloadKey || null);
        useAuthStore.getState().setSession({
          user: response.data.user || useAuthStore.getState().user,
          accessToken: nextToken,
          refreshToken,
          roles: response.data.roles,
          activeRole: response.data.activeRole,
          activeRoleId: response.data.activeRoleId,
        });
        processQueue(null, nextToken);
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearSessionKey();
        useAuthStore.getState().logout();
      } finally {
        isRefreshing = false;
      }
    }

    // Attach human-readable message so components can use err.userMessage
    error.userMessage = extractError(error);
    return Promise.reject(error);
  }
);

export default client;
