import client from './client';
import useAuthStore from '../store/authStore';
import { API_BASE } from './apiBase';
import { signRequest, HEADER_NAME } from './frontendSignature';

export const getAssistantStatus = () => client.get('/assistant/status').then((r) => r.data);

export const listConversations = () => client.get('/assistant/conversations').then((r) => r.data);
export const getConversation = (id) => client.get(`/assistant/conversations/${id}`).then((r) => r.data);
export const deleteConversation = (id) => client.delete(`/assistant/conversations/${id}`).then((r) => r.data);

/**
 * Streams one assistant turn.
 *
 * Uses fetch rather than the axios client because axios buffers the whole
 * response, which would defeat streaming; and rather than EventSource because
 * that cannot send an Authorization header or a POST body.
 *
 * Calls back per event and resolves when the stream closes. Returns an abort
 * function so a closing widget does not leave a request running.
 */
export const streamAssistant = ({ message, conversationId, onEvent }) => {
  const controller = new AbortController();
  const base = API_BASE;
  const token = useAuthStore.getState().accessToken;

  const done = (async () => {
    /**
     * Signed by hand.
     *
     * This uses fetch rather than the axios client because it reads a streamed
     * response body, which axios cannot do — so it misses the request
     * interceptor and the frontend signature has to be attached here, or the
     * assistant is refused with 403.
     */
    const signature = await signRequest({
      method: 'POST',
      url: '/assistant/chat',
      baseURL: base,
    }).catch(() => null);

    const response = await fetch(`${base}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(signature ? { [HEADER_NAME]: signature } : {}),
      },
      body: JSON.stringify({ message, conversation_id: conversationId ?? undefined }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || `The assistant is unavailable (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let event = null;

    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      // The last element may be a partial line; keep it for the next chunk.
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try { onEvent?.(event || 'message', JSON.parse(raw)); } catch { /* ignore a malformed frame */ }
      }
    }
  })();

  return { done, abort: () => controller.abort() };
};
