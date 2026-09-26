import { useEffect, useState, useCallback } from 'react';
import { getReplies, listTickets, createTicket, addReply, updateTicketStatus } from '../../api/supportApi';
import { listClients } from '../../api/userApi';
import useAuthStore from '../../store/authStore';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import EntitySearchSelect from '../../components/common/EntitySearchSelect';
import FieldMark from '../../components/ui/FieldMark';

// Matches the support_tickets.priority ENUM exactly. 'urgent' was offered here
// and does not exist in the column, so choosing it failed the write.
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];
const EMPTY_FORM = { subject: '', description: '', priority: 'medium', user_id: '' };

export default function SupportPage() {
  /*
   * A client or realtor raising a ticket IS the person it is about, so they are
   * never asked to name one. Only staff working the queue may file on somebody
   * else's behalf.
   *
   * This form used to send `client_id`, which is not a column on
   * support_tickets — the field it needed was `user_id`, and nothing supplied
   * it. Every ticket raised here came back "Validation failed" with every
   * visible field filled in.
   */
  const currentUser  = useAuthStore((state) => state.user);
  const effectiveType = useAuthStore((state) => state.effectiveType());
  const raisingForSelf = ['client', 'realtor'].includes(effectiveType)
    || ['client', 'realtor'].includes(currentUser?.type);

  const [tickets,    setTickets]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [replies,    setReplies]    = useState([]);
  const [replyText,  setReplyText]  = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const loadTickets = useCallback(() =>
    listTickets().then((res) => {
      const rows = res.data || [];
      setTickets(rows);
      if (!selected && rows[0]) setSelected(rows[0]);
    }), [selected]);

  useEffect(() => { loadTickets(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected?.id) {
      getReplies(selected.id).then((res) => setReplies(res.data || [])).catch(() => setReplies([]));
    }
  }, [selected?.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        subject:     form.subject.trim(),
        description: form.description.trim(),
        priority:    form.priority,
        // Staff only. Left out, the server attributes the ticket to the caller,
        // which is what a customer raising their own ticket wants.
        ...(!raisingForSelf && form.user_id ? { user_id: Number(form.user_id) } : {}),
      };
      await createTicket(payload);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      loadTickets();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selected) return;
    await addReply(selected.id, { message: replyText });
    setReplyText('');
    getReplies(selected.id).then((res) => setReplies(res.data || []));
  };

  const handleStatus = async (status) => {
    await updateTicketStatus(selected.id, status);
    const updated = { ...selected, status };
    setSelected(updated);
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Ticket list */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tickets</h2>
          <Button onClick={() => { setShowCreate(true); setError(''); }}>+ New</Button>
        </div>
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => setSelected(ticket)}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selected?.id === ticket.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
          >
            <div className="font-medium text-slate-800">{ticket.subject}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span className="capitalize">{ticket.priority}</span>
              <Badge value={ticket.status} />
            </div>
          </button>
        ))}
        {!tickets.length && <p className="text-sm text-slate-500">No tickets yet.</p>}
      </div>

      {/* Ticket detail */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">{selected.subject}</h1>
                <div className="mt-1 flex gap-2">
                  <Badge value={selected.status} />
                  <Badge value={selected.priority} />
                </div>
              </div>
              <Select value={selected.status} onChange={(e) => handleStatus(e.target.value)} className="text-sm">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </Select>
            </div>
            <p className="text-slate-600">{selected.description}</p>
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Replies</h3>
              {replies.map((reply) => (
                <div key={reply.id} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-sm text-slate-700">{reply.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(reply.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {!replies.length && <p className="text-sm text-slate-400">No replies yet.</p>}
            </div>
            <form onSubmit={handleReply} className="flex gap-2 pt-2">
              <Input placeholder="Write a reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1" />
              <Button type="submit" disabled={!replyText.trim()}>Send</Button>
            </form>
          </>
        ) : (
          <p className="text-slate-500">Select a ticket to view its discussion.</p>
        )}
      </div>

      {/* Create ticket modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="New Support Ticket">
        <form onSubmit={handleCreate} className="space-y-3">
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Subject<FieldMark required /></label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description<FieldMark required /></label>
            <textarea
              className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Priority<FieldMark /></label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          {/* Raising your own ticket: you are the customer, so there is nobody
              to pick. Staff filing on a customer's behalf still name them. */}
          {!raisingForSelf && (
            <EntitySearchSelect
              label="Raise on behalf of (optional)"
              placeholder="Search client by name…"
              value={form.user_id}
              onChange={(id) => setForm((f) => ({ ...f, user_id: id }))}
              fetchItems={() => listClients({ limit: 1000 })}
              getLabel={(c) => c.name || c.email || `Client #${c.id}`}
            />
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Create Ticket'}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowCreate(false); setError(''); }}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
