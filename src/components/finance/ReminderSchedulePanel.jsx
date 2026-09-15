import { useEffect, useMemo, useState } from 'react';
import {
  getReminderDefault, saveReminderDefault, listReminderSchedules,
  createReminderSchedule, updateReminderSchedule, assignReminderSchedule, listInvoices,
} from '../../api/financeApi';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../common/Modal';

/**
 * When buyers get chased about an installment.
 *
 * ── Why the offsets are shown as sentences ──────────────────────────────────
 *
 * The data is a list of integers relative to the due date — -7, -2, 0, 2 — and
 * an admin should never have to know that. A negative number meaning "before"
 * is a storage decision, so the screen asks "how many days" and "before or
 * after" separately and does the arithmetic itself.
 *
 * ── Saying where the current setting came from ──────────────────────────────
 *
 * Until a company saves once, what it sees is the platform's default and
 * editing it creates a copy rather than changing the platform's. That is
 * genuinely surprising if it is not said, so the panel says it — an admin who
 * thinks they are editing a shared setting behaves differently from one who
 * knows they are about to get their own.
 */

const getItems = (response) => response?.data ?? response ?? [];

/** A stored offset, split into the two things a person actually chooses. */
const toRow = (days) => ({
  days: Math.abs(Number(days) || 0),
  when: Number(days) < 0 ? 'before' : Number(days) === 0 ? 'on' : 'after',
});

const toOffset = (row) => {
  const days = Math.abs(Number(row.days) || 0);
  if (row.when === 'on') return 0;
  return row.when === 'before' ? -days : days;
};

const describe = (row) => {
  const days = Math.abs(Number(row.days) || 0);
  if (row.when === 'on') return 'On the due date';
  const unit = days === 1 ? 'day' : 'days';
  return row.when === 'before'
    ? `${days} ${unit} before it is due`
    : `${days} ${unit} after it is due, if still unpaid`;
};

/** The default a company starts from — a week out, two days out, the day, two days late. */
const STARTING_ROWS = [
  { days: 7, when: 'before' },
  { days: 2, when: 'before' },
  { days: 0, when: 'on' },
  { days: 2, when: 'after' },
];

function OffsetEditor({ rows, onChange }) {
  const set = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(rows.filter((unused, i) => i !== index));

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
          {row.when !== 'on' && (
            <input
              type="number"
              min="0"
              max="365"
              value={row.days}
              onChange={(event) => set(index, { days: event.target.value })}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
          <select
            value={row.when}
            onChange={(event) => set(index, { when: event.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="before">days before it is due</option>
            <option value="on">on the due date</option>
            <option value="after">days after it is due</option>
          </select>
          <span className="flex-1 text-sm text-slate-500">{describe(row)}</span>
          <button
            type="button"
            onClick={() => remove(index)}
            className="text-sm text-slate-400 hover:text-rose-600"
          >
            Remove
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...rows, { days: 1, when: 'after' }])}>
        + Add a reminder
      </Button>
      {!rows.length && (
        <p className="text-sm text-slate-500">
          No reminders configured — nobody will be chased about an installment.
        </p>
      )}
    </div>
  );
}

export default function ReminderSchedulePanel() {
  const [schedule, setSchedule] = useState(null);
  const [rows, setRows] = useState(STARTING_ROWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [named, setNamed] = useState([]);
  const [assigning, setAssigning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getReminderDefault();
      const data = result?.data;
      setSchedule(data);
      setRows((data?.offsets || []).map(toRow));
    } catch {
      setSchedule(null);
    } finally {
      setLoading(false);
    }
    listReminderSchedules().then((r) => setNamed(getItems(r).filter((s) => !s.is_default))).catch(() => setNamed([]));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveReminderDefault({
        name: schedule?.name || 'Payment reminders',
        offsets: rows.map(toOffset),
      });
      setSchedule(result?.data);
      setMessage({
        tone: 'success',
        text: result?.data?.source === 'company'
          ? 'Saved. These are now your company’s reminders, and they apply to every invoice from here on.'
          : 'Saved. This is the default every company starts from.',
      });
      load();
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error?.response?.data?.message || 'That did not save. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const inherited = schedule?.source === 'platform' || schedule?.source === 'built-in';

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Loading the reminder schedule…</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-base font-semibold text-slate-800">When buyers are reminded</h2>
        <p className="mt-1 text-sm text-slate-500">
          These apply to every invoice unless one has been given a schedule of its own.
          A reminder is only sent if the installment is still unpaid.
        </p>
      </div>

      {/*
        An admin editing what turns out to be somebody else's default needs to
        know that before they save, not after.
      */}
      {inherited && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800 ring-1 ring-blue-200">
          You are looking at the platform default. Saving gives your company its own copy —
          the platform’s is left as it is.
        </p>
      )}

      <OffsetEditor rows={rows} onChange={setRows} />

      {message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          message.tone === 'success'
            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
            : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
        }`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save reminders'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setRows(STARTING_ROWS)}>
          Reset to the standard four
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAssigning(true)}>
          Different reminders for particular invoices
        </Button>
      </div>

      <InvoiceOverrides
        open={assigning}
        onClose={() => setAssigning(false)}
        schedules={named}
        onChanged={load}
      />
    </section>
  );
}

/**
 * Putting particular invoices on something other than the company default.
 *
 * Chosen from a list rather than typed, and applied to a selection rather than
 * one at a time, because the case this exists for is a corporate client with
 * several invoices on different terms — handled together or not at all.
 */
function InvoiceOverrides({ open, onClose, schedules, onChanged }) {
  const [invoices, setInvoices] = useState([]);
  const [chosen, setChosen] = useState([]);
  const [scheduleId, setScheduleId] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRows, setNewRows] = useState(STARTING_ROWS);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    listInvoices().then((r) => setInvoices(getItems(r))).catch(() => setInvoices([]));
    setResult(null);
  }, [open]);

  const toggle = (id) => setChosen((current) => (
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  ));

  const saveNamed = async () => {
    setSaving(true);
    try {
      const created = await createReminderSchedule({
        name: newName.trim() || 'Custom reminders',
        offsets: newRows.map(toOffset),
      });
      setScheduleId(String(created?.data?.id || ''));
      setCreating(false);
      await onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    setSaving(true);
    setResult(null);
    try {
      const response = await assignReminderSchedule({
        invoice_ids: chosen,
        schedule_id: scheduleId ? Number(scheduleId) : null,
      });
      const { updated, requested } = response?.data || {};
      setResult(updated === requested
        ? `Done — ${updated} invoice${updated === 1 ? '' : 's'} updated.`
        // Said plainly rather than reported as success: the difference is
        // invoices the caller cannot act on, and silently dropping them would
        // leave somebody believing a schedule applies where it does not.
        : `${updated} of ${requested} updated. The rest are not yours to change.`);
      setChosen([]);
      await onChanged?.();
    } catch (error) {
      setResult(error?.response?.data?.message || 'That did not apply. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reminders for particular invoices">
      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Send these invoices</span>
          <select
            value={scheduleId}
            onChange={(event) => setScheduleId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">the company default</option>
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--primary)' }}
          >
            {creating ? 'Cancel' : '+ Set up a different schedule'}
          </button>
        </div>

        {creating && (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <Input label="Name it" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Corporate clients" />
            <OffsetEditor rows={newRows} onChange={setNewRows} />
            <Button type="button" size="sm" onClick={saveNamed} disabled={saving}>
              {saving ? 'Saving…' : 'Save this schedule'}
            </Button>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-sm font-medium text-slate-700">
            Which invoices {chosen.length ? `(${chosen.length} chosen)` : ''}
          </span>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {invoices.map((invoice) => (
              <label key={invoice.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={chosen.includes(invoice.id)}
                  onChange={() => toggle(invoice.id)}
                />
                <span className="font-medium text-slate-700">{invoice.invoice_id}</span>
                <span className="text-slate-500">{invoice.client_name || ''}</span>
              </label>
            ))}
            {!invoices.length && <p className="px-2 py-3 text-sm text-slate-500">No invoices to choose from.</p>}
          </div>
        </div>

        {result && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{result}</p>}

        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={apply} disabled={saving || !chosen.length}>
            {saving ? 'Applying…' : 'Apply'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
