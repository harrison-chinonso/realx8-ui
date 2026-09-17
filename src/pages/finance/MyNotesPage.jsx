import { useCallback, useEffect, useState } from 'react';
import { FileMinus, FilePlus, BellRing } from 'lucide-react';
import { listMyNotes, remindAboutNote } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import NotePaymentModal from '../../components/finance/NotePaymentModal';
import Button from '../../components/ui/Button';
import Badge from '../../components/common/Badge';

/**
 * The two documents a client or realtor is party to, from their side.
 *
 * ── Why both kinds are on one page ─────────────────────────────────────────
 *
 * Staff keep them apart because the two are raised by different people for
 * different reasons. The party does not care: they have things they owe and
 * things they are owed, and asking them to learn which of "credit" and "debit"
 * means money coming towards them is asking them to learn an accounting
 * convention to read their own balance. So the headings say what each column
 * is in their terms, and the document names appear only as references.
 *
 * ── The one thing each side can do ─────────────────────────────────────────
 *
 * On what they owe: pay it, and show the proof. On what they are owed: ask
 * about it — and only while it is genuinely outstanding, because a reminder
 * button on a refund that has already been paid produces a complaint that
 * takes somebody an afternoon to work out was never a complaint at all.
 */

/**
 * The state, in the party's words.
 *
 * Deliberately different wording per side of the ledger for the same stored
 * value: `approved` on something you owe means the bill stands, and on
 * something you are owed it means the refund is agreed. One phrase for both
 * would be wrong for one of them.
 */
const OWED_BY_ME = {
  pending_approval: 'Being checked',
  approved: 'Awaiting your payment',
  used: 'Paid',
  rejected: 'Cancelled',
  cancelled: 'Cancelled',
  sent: 'Awaiting your payment',
  partial: 'Part paid',
};

const OWED_TO_ME = {
  pending_approval: 'Waiting for approval',
  approved: 'Approved — awaiting payment',
  paid: 'Paid to you',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  sent: 'Approved — awaiting payment',
  partial: 'Part paid',
};

/** What raised it, where the system did. Free text in `reason` covers the rest. */
const SOURCE_LABELS = {
  realtor_verification: 'Verification fee',
  realtor_levelup: 'Upgrade fee',
};

const longDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

const SETTLED = { credit: 'used', debit: 'paid' };
const CLOSED = ['cancelled', 'rejected'];

export default function MyNotesPage() {
  const fmt = useCurrency();
  const [notes, setNotes] = useState({ credit: [], debit: [], payment: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);
  const [reminding, setReminding] = useState(null);
  const [said, setSaid] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    listMyNotes()
      .then((res) => { setNotes(res?.data ?? { credit: [], debit: [] }); setError(''); })
      .catch((err) => setError(err?.userMessage || err?.response?.data?.message || 'Could not load your notes.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendReminder = async (note) => {
    setReminding(note.id);
    setSaid('');
    try {
      await remindAboutNote(note.id);
      setSaid(`Your company has been told you are still waiting on ${note.reference}.`);
      load();
    } catch (err) {
      // The throttle reply says when the next one may be sent, so it is shown
      // as-is rather than flattened into "something went wrong".
      setError(err?.response?.data?.message || err?.userMessage || 'Could not send that reminder.');
    } finally {
      setReminding(null);
    }
  };

  if (loading) {
    return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading…</div>;
  }

  const owed = notes.credit || [];
  const due = notes.debit || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Credit &amp; Debit Notes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Charges raised against you, and refunds your company owes you.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {said && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{said}</div>}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <FileMinus size={15} /> What you owe
        </h2>

        {!owed.length && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            You have nothing outstanding.
          </div>
        )}

        {owed.map((note) => {
          const settled = note.status === SETTLED.credit;
          const closed = CLOSED.includes(note.status);
          const submitted = Boolean(note.payment_submitted_at);
          return (
            <article key={note.id} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    {SOURCE_LABELS[note.source_type] || note.reason || 'Charge'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {note.reference} · raised {longDate(note.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{fmt(note.amount)}</p>
                  <Badge value={OWED_BY_ME[note.status] || note.status} />
                </div>
              </div>

              {note.rejection_reason && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{note.rejection_reason}</p>
              )}

              {/*
                Shown while it is being checked, so somebody who paid on Friday
                is not left wondering on Monday whether the upload worked.
              */}
              {submitted && !settled && !closed && (
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  You submitted payment on {longDate(note.payment_submitted_at)}
                  {note.payment_reference ? ` (ref ${note.payment_reference})` : ''}. Waiting for your
                  company to confirm it.
                  {note.payment_proof_url && (
                    <>
                      {' '}
                      <a href={note.payment_proof_url} target="_blank" rel="noreferrer" className="font-medium underline">
                        View what you sent
                      </a>
                    </>
                  )}
                </div>
              )}

              {!settled && !closed && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setPaying(note)}>
                    {submitted ? 'Send different proof' : 'Pay this'}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <FilePlus size={15} /> What you are owed
        </h2>

        {!due.length && (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            Nothing is owed to you.
          </div>
        )}

        {due.map((note) => {
          const settled = note.status === SETTLED.debit;
          const closed = CLOSED.includes(note.status);
          return (
            <article key={note.id} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">{note.reason || 'Refund'}</h3>
                  <p className="text-sm text-slate-500">
                    {note.reference} · raised {longDate(note.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-emerald-700">{fmt(note.amount)}</p>
                  <Badge value={OWED_TO_ME[note.status] || note.status} />
                </div>
              </div>

              {note.rejection_reason && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{note.rejection_reason}</p>
              )}

              {/*
                Only while it is actually outstanding. Chasing a refund that has
                already been paid is the request most likely to be made and the
                one most certain to waste everybody's time.
              */}
              {!settled && !closed && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={reminding === note.id}
                    onClick={() => sendReminder(note)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <BellRing size={14} />
                      {reminding === note.id ? 'Sending…' : 'Send a reminder'}
                    </span>
                  </Button>
                  {note.reminder_sent_at && (
                    <span className="text-xs text-slate-500">
                      Last reminder {longDate(note.reminder_sent_at)}.
                    </span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <NotePaymentModal
        note={paying}
        payment={notes.payment}
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        onSubmitted={() => { setPaying(null); setSaid('Your payment has been sent for review.'); load(); }}
      />
    </div>
  );
}
