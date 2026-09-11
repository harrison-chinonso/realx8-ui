import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, History, Trash2, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getAssistantStatus, streamAssistant, listConversations, getConversation, deleteConversation,
} from '../../api/assistantApi';
import useAuthStore from '../../store/authStore';

/**
 * The in-app assistant.
 *
 * Replaces a keyword-matching bot that returned fixed paragraphs regardless of
 * the question and could not see any of the user's data. This one answers from
 * live data via server-side tools, scoped to whoever is signed in.
 *
 * It renders nothing unless the company has configured a key, so a tenant that
 * has not set one up sees no dead button.
 */
/** What to show while a tool runs — never the raw tool name. */
const TOOL_ACTIVITY = {
  search_properties: 'looking through properties…',
  get_property: 'opening the property…',
  list_my_invoices: 'checking your invoices…',
  get_invoice_payment_options: 'fetching payment details…',
  calculate_payment_plan: 'working out the numbers…',
  hand_off_to_human: 'raising a ticket…',
};

export default function AssistantWidget() {
  const token = useAuthStore((s) => s.accessToken);
  const isAdmin = ['admin', 'super_admin', 'superior_admin'].includes(useAuthStore((s) => s.effectiveType()));
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activity, setActivity] = useState('');   // e.g. "checking your invoices…"
  const [dismissed, setDismissed] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);

  /**
   * Asked once per sign-in, not once per token.
   *
   * This used to depend on `token`, which turns a single 401 into an unbounded
   * loop: the request fails, the client refreshes, the new token lands in the
   * store, `token` changes, the effect re-runs, and the cycle repeats for as
   * long as the request keeps failing. Observed in production as hundreds of
   * `GET /assistant/status 401` interleaved with `POST /auth/refresh 200`.
   *
   * Whether the assistant is available does not change when a token rotates —
   * only when somebody signs in or out — so the dependency is the BOOLEAN. A
   * refresh no longer re-fetches anything, and a failure stays a single failed
   * request.
   */
  const isAuthenticated = Boolean(token);
  useEffect(() => {
    if (!isAuthenticated) { setStatus(null); return; }
    getAssistantStatus()
      .then((res) => setStatus(res?.data ?? null))
      .catch((error) => {

        const status = error?.response?.status;
        const reason = error?.response?.data?.reason || error?.response?.data?.message;
        console.warn(
          `[assistant] hidden: status check failed`
          + `${status ? ` (HTTP ${status}${reason ? ` — ${reason}` : ''})` : ` — ${error?.message || 'network error'}`}`,
        );
        setStatus(null);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Never leave a stream running behind a closed widget.
  useEffect(() => () => streamRef.current?.abort(), []);

  const loadHistory = async () => {
    try { setHistory((await listConversations())?.data ?? []); }
    catch { setHistory([]); }
  };

  useEffect(() => { if (open && status?.enabled) loadHistory(); }, [open, status?.enabled]);

  const openConversation = async (id) => {
    try {
      const res = await getConversation(id);
      setMessages(res?.data?.messages ?? []);
      setConversationId(id);
      setShowHistory(false);
      setError('');
    } catch {
      setError('Could not open that conversation.');
    }
  };

  const startNew = () => {
    streamRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    setError('');
  };

  const removeConversation = async (id, event) => {
    event.stopPropagation();
    try {
      await deleteConversation(id);
      if (id === conversationId) startNew();
      loadHistory();
    } catch {
      setError('Could not delete that conversation.');
    }
  };

  const send = async (event) => {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    // Show the question and an empty reply that fills in as deltas arrive.
    setMessages((prev) => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setDraft('');
    setError('');
    setActivity('');
    setSending(true);

    const appendToReply = (chunk) => setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + chunk };
      return next;
    });

    const stream = streamAssistant({
      message: text,
      conversationId,
      onEvent: (name, data) => {
        if (name === 'start') setConversationId(data.conversation_id);
        else if (name === 'delta') { setActivity(''); appendToReply(data.text); }
        else if (name === 'tool') setActivity(TOOL_ACTIVITY[data.name] || 'checking…');
        else if (name === 'error') setError(data.message);
      },
    });
    streamRef.current = stream;

    try {
      await stream.done;
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'I could not reach the assistant.');
    } finally {
      setSending(false);
      setActivity('');
      streamRef.current = null;
      // Drop the placeholder if nothing ever arrived, so no empty bubble is left.
      setMessages((prev) => (prev[prev.length - 1]?.role === 'assistant' && !prev[prev.length - 1].content
        ? prev.slice(0, -1) : prev));
      loadHistory();
    }
  };

  if (!token || !status) return null;

  // Switched off for this company is the only reason to render nothing.
  if (!status.enabled) return null;

  const name = status.name || 'Assistant';
  const openers = [
    'What can I afford on ₦2,000,000?',
    'How do I pay my invoice?',
    'What does Certificate of Occupancy mean?',
  ];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Chat with ${name}`}
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:brightness-95"
          style={{ backgroundColor: 'var(--primary, #2563eb)' }}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 z-[60] flex h-[min(34rem,85vh)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:bottom-5 sm:right-5 sm:w-[24rem] sm:rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px] opacity-80">{status.app_name} assistant</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={startNew} aria-label="New chat" title="New chat" className="rounded p-1 hover:bg-white/20">
                <Plus size={17} />
              </button>
              <button type="button" onClick={() => setShowHistory((v) => !v)} aria-label="History" title="Past chats" className="rounded p-1 hover:bg-white/20">
                <History size={17} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 hover:bg-white/20">
                <X size={18} />
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="max-h-48 overflow-y-auto border-b border-slate-200 bg-white">
              {history.length ? history.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 ${c.id === conversationId ? 'bg-slate-50 font-medium' : ''}`}
                >
                  <span className="min-w-0 flex-1 truncate text-slate-700">{c.title || 'Untitled'}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => removeConversation(c.id, e)}
                    onKeyDown={(e) => e.key === 'Enter' && removeConversation(c.id, e)}
                    aria-label="Delete conversation"
                    className="shrink-0 text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              )) : <p className="px-3 py-3 text-xs text-slate-400">No past chats yet.</p>}
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {!messages.length && (
              <div className="space-y-3">
                <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
                  Hi — I can help you find a property, work out what an instalment
                  would cost, or walk you through anything in {status.app_name}.
                </p>
                <div className="space-y-1.5">
                  {openers.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setDraft(q)}
                      className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (m.role === 'assistant' && !m.content ? null : (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'text-white' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: 'var(--primary, #2563eb)' } : undefined}
                >
                  {m.content}
                </p>
              </div>
            )))}

            {/* Only until the first token lands — after that the reply itself
                is the progress indicator. */}
            {sending && !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <p className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <Loader2 size={14} className="animate-spin" /> {activity || 'thinking…'}
                </p>
              </div>
            )}

            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 bg-white p-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Ask ${name}…`}
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary, #2563eb)' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
