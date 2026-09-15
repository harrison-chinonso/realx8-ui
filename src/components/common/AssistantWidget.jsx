import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, History, Trash2, Plus, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  getAssistantStatus, streamAssistant, listConversations, getConversation, deleteConversation,
} from '../../api/assistantApi';
import useAuthStore from '../../store/authStore';
import useDraggable from '../../hooks/useDraggable';
import { getEngine } from '../../assistant/index.js';
import { respond } from '../../assistant/converse.js';
import AssistantMessage from './AssistantMessage';

/**
 * The in-app assistant.
 *
 * Replaces a keyword-matching bot that returned fixed paragraphs regardless of
 * the question and could not see any of the user's data. This one answers from
 * live data via server-side tools, scoped to whoever is signed in.
 *
 * ── Local first, server for data ───────────────────────────────────────────
 *
 * Two things answer here. A local engine, built from a map GENERATED out of the
 * router and a set of hand-written walkthroughs, handles "where is", "how do I"
 * and the executable actions — instantly, offline, and with no API key. The
 * server assistant handles questions about the tenant's own figures, which the
 * local engine cannot see.
 *
 * Every message tries local first. Only a question the local engine does not
 * recognise is streamed to the server. This is why the widget now renders for
 * everyone rather than only for companies with a key configured: navigation and
 * how-to help costs nothing and works regardless, and the old behaviour — no
 * button at all — left those tenants with no assistant of any kind.
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
  const location = useLocation();
  const permissions = useAuthStore((s) => s.permissions);
  const isAdmin = ['admin', 'super_admin', 'superior_admin'].includes(useAuthStore((s) => s.effectiveType()));
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);

  /**
   * The launcher can be dragged out of the way.
   *
   * It floats above the page at z-60, so wherever it sits it is on top of
   * something — and the report that prompted this was it covering the Pay link
   * on an invoice card. Moving it is the direct remedy; the cards underneath
   * were widened too, because a fix that depends on the user rearranging their
   * UI is not much of a fix.
   *
   * Only the LAUNCHER moves. The open panel is a 24rem window that is sized and
   * cornered by its own classes at two breakpoints, and dragging it would mean
   * reimplementing all of that — while the panel is open the widget is the
   * thing you are using, not the thing in the way.
   */
  const drag = useDraggable({ storageKey: 'realx8-assistant-position' });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activity, setActivity] = useState('');   // e.g. "checking your invoices…"
  /**
   * An action part-way through collecting what it needs.
   *
   * Held here rather than derived from the transcript because it is a live
   * object — the action, the values so far, the slot being asked about — and
   * reconstructing it by re-reading the messages would mean re-running
   * extraction on every render.
   */
  const [pending, setPending] = useState(null);
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
  /*
   * Whether the SERVER half is available. The local half always is, so this
   * decides only one thing: what happens to a question the local engine does
   * not recognise.
   */
  const serverEnabled = Boolean(status?.enabled);
  const appName = status?.app_name || 'Realx8';
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

  useEffect(() => { if (open && serverEnabled) loadHistory(); }, [open, serverEnabled]);

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
    // A new chat abandons a half-collected action; carrying it over would have
    // the assistant ask for an email nobody remembers requesting.
    setPending(null);
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

  /**
   * Ask the local engine, and only fall through to the server if it shrugs.
   *
   * Returns true when it handled the message. The route and the person's
   * permissions go with the question: being on the invoices page makes an
   * invoice walkthrough likelier, and permissions decide whether an action is
   * offered or explained.
   */
  const answerLocally = (text) => {
    const result = respond({
      engine: getEngine(),
      text,
      pending,
      context: { route: location.pathname, permissions },
    });

    setPending(result.pending ?? null);

    if (result.messages.length) {
      setMessages((prev) => [...prev, ...result.messages]);
      return true;
    }

    /*
     * Deferred, but the server is not configured for this company. Rather than
     * say nothing, offer whatever came nearest — usually what they meant,
     * phrased differently.
     */
    if (result.defer && !serverEnabled) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: result.options?.length
          ? 'I am not sure about that one. These are the closest things I know:'
          : 'I do not know that one. I can help you find a screen, walk you through a task, or start one for you.',
        options: result.options,
      }]);
      return true;
    }

    return false;
  };

  const send = async (event, override) => {
    event?.preventDefault();
    const text = (override ?? draft).trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setDraft('');
    setError('');
    setActivity('');

    // Local answers are synchronous — no spinner, no round trip, no cost.
    if (answerLocally(text)) return;

    // Nothing local fit: this is a question about the data, so the server gets
    // it. An empty reply bubble is appended for the deltas to fill.
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
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

  // Signed out is the only reason to render nothing. The local engine works
  // without a key, so a company that has not configured one still gets
  // navigation, walkthroughs and actions rather than no assistant at all.
  if (!token) return null;

  const name = status?.name || 'Assistant';
  /*
   * Openers that show what it can do, not just what it can say. The first two
   * are answered locally and instantly; the third is only offered when the
   * server half is configured, so nobody is invited to ask a question that will
   * come back "I do not know".
   */
  const openers = [
    'How do I approve a payment?',
    'Create a user',
    ...(serverEnabled ? ['What can I afford on ₦2,000,000?'] : ['Where do I find payment approvals?']),
  ];

  return (
    <>
      {!open && (
        <button
          ref={drag.ref}
          type="button"
          {...drag.handlers}
          onClick={() => {
            // The pointerup that ended a drag is followed by a click. Opening
            // the assistant every time somebody repositions it would make the
            // widget effectively undraggable.
            if (drag.wasDragged()) return;
            setOpen(true);
          }}
          // Right-click to put it back, for anyone who drags it somewhere
          // unhelpful and cannot find the corner again.
          onContextMenu={(event) => {
            if (!drag.moved) return;
            event.preventDefault();
            drag.reset();
          }}
          aria-label={`Chat with ${name} — drag to move`}
          title={drag.moved ? 'Drag to move · right-click to reset' : 'Drag to move'}
          className={`fixed bottom-5 right-5 z-[60] flex h-14 w-14 touch-none select-none
            items-center justify-center rounded-full text-white shadow-lg transition
            hover:brightness-95 ${drag.dragging ? 'scale-105 cursor-grabbing shadow-2xl' : 'cursor-grab'}`}
          style={{ backgroundColor: 'var(--primary, #2563eb)', ...drag.style }}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-0 right-0 z-[60] flex h-[min(34rem,85vh)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:bottom-5 sm:right-5 sm:w-[24rem] sm:rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px] opacity-80">{appName} assistant</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={startNew} aria-label="New chat" title="New chat" className="rounded p-1 hover:bg-white/20">
                <Plus size={17} />
              </button>
              {/* Past chats live on the server. With no key there are none. */}
              {serverEnabled && (
                <button type="button" onClick={() => setShowHistory((v) => !v)} aria-label="History" title="Past chats" className="rounded p-1 hover:bg-white/20">
                  <History size={17} />
                </button>
              )}
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
                  Hi — I can help you find a property, work out what an installment
                  would cost, or walk you through anything in {appName}.
                </p>
                <div className="space-y-1.5">
                  {openers.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(null, q)}
                      className="block w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              // The empty placeholder a server stream fills in — nothing to show yet.
              if (m.role === 'assistant' && !m.content && !m.steps && !m.options && !m.links) return null;

              if (m.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <p
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm text-white"
                      style={{ backgroundColor: 'var(--primary, #2563eb)' }}
                    >
                      {m.content}
                    </p>
                  </div>
                );
              }

              return (
                <AssistantMessage
                  key={i}
                  message={m}
                  onOption={(query) => send(null, query)}
                  // Following a link means they have arrived — the panel would
                  // otherwise sit over the page they were sent to.
                  onNavigate={() => setOpen(false)}
                />
              );
            })}

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
