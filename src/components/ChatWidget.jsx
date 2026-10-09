import { useEffect, useRef, useState } from 'react';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { afterSubmit, greet, initialState, respond } from '../assistant/engine.js';
import { sendRequest } from '../api.js';

/**
 * "Ask Realx8": answers questions about Realx8 only (assistant/knowledge.js)
 * and raises onboarding requests and enquiries through the same endpoint as
 * the form, marked as coming from the assistant.
 */
export default function ChatWidget({ open, onOpenChange }) {
  const [state, setState] = useState(initialState);
  const [messages, setMessages] = useState(() => greet().replies.map((text) => ({ from: 'bot', text })));
  const [chips, setChips] = useState(() => greet().chips);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const close = () => {
    onOpenChange(false);
    setTimeout(() => launcherRef.current?.focus(), 0);
  };

  const say = async (text) => {
    const said = String(text || '').trim();
    if (!said || busy) return;
    setDraft('');
    const result = respond(state, said);
    setState(result.state);
    setMessages((m) => [...m, { from: 'me', text: said }, ...result.replies.map((t) => ({ from: 'bot', text: t }))]);
    setChips(result.chips || []);

    if (result.submit) {
      setBusy(true);
      setMessages((m) => [...m, { from: 'bot', text: 'Sending your request…' }]);
      let outcome;
      try {
        const { reference } = await sendRequest(result.submit);
        outcome = afterSubmit(result.submit, reference);
      } catch (error) {
        outcome = afterSubmit(result.submit, null, error.message);
      }
      setMessages((m) => [...m.slice(0, -1), ...outcome.replies.map((t) => ({ from: 'bot', text: t }))]);
      setChips(outcome.chips || []);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button ref={launcherRef} type="button" className="chat-launcher" onClick={() => onOpenChange(true)}>
        <MessageCircle size={22} color="#E9D8C4" aria-hidden="true" />
        Ask Realx8
      </button>
    );
  }

  return (
    <section className="chat" role="dialog" aria-label="Ask Realx8">
      <div className="chat-head">
        <span className="avatar" aria-hidden="true">R</span>
        <div>
          <strong>Ask Realx8</strong>
          <small>Questions about Realx8 and its features</small>
        </div>
        <button type="button" className="close" onClick={close} aria-label="Close chat"><X size={20} aria-hidden="true" /></button>
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((m, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className={`msg ${m.from === 'me' ? 'msg-me' : 'msg-bot'}`}>{m.text}</div>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="chat-chips">
          {chips.map((c) => <button key={c} type="button" onClick={() => say(c)} disabled={busy}>{c}</button>)}
        </div>
      )}
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); say(draft); }}>
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <input
          id="chat-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={state.flow ? 'Type your answer…' : 'Ask about Realx8…'}
          autoComplete="off"
          maxLength={2000}
        />
        <button type="submit" aria-label="Send" disabled={busy || !draft.trim()}><SendHorizontal size={20} aria-hidden="true" /></button>
      </form>
    </section>
  );
}
