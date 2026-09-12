import { useCallback, useEffect, useState } from 'react';
import { listReceipts, cancelOwnReceipt } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';
import EditSubmittedPaymentModal from './EditSubmittedPaymentModal';

/**
 * The payments a buyer has submitted, and what has become of them.
 *
 * This is the half of "My Payments" that was missing. The page next to it lists
 * payments RECORDED against an invoice — which only happens once an admin
 * approves one — so a buyer who had uploaded proof saw nothing at all until
 * somebody acted on it, and nothing ever if it was refused.
 */

/**
 * Four states, and what the buyer can do in each.
 *
 * `verified` is the approved one — the database name is kept, the label is not,
 * because "verified" describes the admin's action and "Approved" describes the
 * outcome the buyer is waiting on.
 */
const STATES = {
  pending: {
    label: 'Under review',
    tone: 'bg-amber-100 text-amber-800',
    hint: 'Submitted. An admin will confirm it.',
  },
  verified: {
    label: 'Approved',
    tone: 'bg-emerald-100 text-emerald-800',
    hint: 'Confirmed and applied to your invoice.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'bg-rose-100 text-rose-700',
    hint: 'Not accepted. Correct it and send it back.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-slate-100 text-slate-600',
    hint: 'Withdrawn. It does not count toward your invoice.',
  },
};

const EDITABLE = ['pending', 'rejected'];

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
};

export default function MySubmittedPaymentsPanel() {
  const fmt = useCurrency();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setError('');
    // The endpoint scopes a buyer to their own receipts, so no filter is needed
    // here — and none should be trusted from here either.
    listReceipts({ limit: 100, sort: '-id' })
      .then((res) => setRows(res?.data ?? []))
      .catch((err) => setError(err?.response?.data?.message || err?.userMessage || 'Could not load your payments.'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmCancel = async () => {
    if (!cancelling) return;
    setBusyId(cancelling.id);
    try {
      await cancelOwnReceipt(cancelling.id);
      setCancelling(null);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not cancel that payment.');
      setCancelling(null);
    } finally {
      setBusyId(null);
    }
  };

  if (error && rows === null) {
    return <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>;
  }
  if (rows === null) {
    return <div className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">Loading your payments…</div>;
  }

  return (
    <div className="space-y-3">
      {error && <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{error}</div>}

      {rows.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-700">You have not submitted any payments yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            When you pay an invoice and upload your proof, it will appear here with its status.
          </p>
        </div>
      )}

      {rows.map((row) => {
        const state = STATES[row.status] || STATES.pending;
        const canAct = EDITABLE.includes(row.status);
        return (
          <div key={row.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 sm:flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{fmt(row.amount)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${state.tone}`}>
                    {state.label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.receipt_number}
                  {row.reference ? ` · Ref ${row.reference}` : ''}
                  {formatDate(row.created_at) ? ` · ${formatDate(row.created_at)}` : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">{state.hint}</p>
                {row.notes && (
                  <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Your note:</span> {row.notes}</p>
                )}
                {/*
                  * The admin's reason, verbatim. It is the only thing that tells
                  * the buyer what to change, so it is shown plainly rather than
                  * folded into a tooltip or a details drawer.
                  */}
                {row.status === 'rejected' && row.rejection_reason && (
                  <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    <span className="font-semibold">Reason: </span>{row.rejection_reason}
                  </p>
                )}
                {row.document_url && (
                  <a
                    href={row.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    View proof of payment
                  </a>
                )}
              </div>

              {canAct && (
                <div className="flex flex-wrap items-center gap-2 self-start">
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(row)}>
                    {row.status === 'rejected' ? 'Correct & resend' : 'Edit'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busyId === row.id}
                    onClick={() => setCancelling(row)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <EditSubmittedPaymentModal
        receipt={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      {/* Cancelling is not undoable, so it asks — and says what it does and does
          not mean, because "cancel" reads as "cancel the transfer". */}
      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl">
            <h3 className="text-base font-semibold text-slate-900">Cancel this payment?</h3>
            <p className="mt-2 text-sm text-slate-600">
              {fmt(cancelling.amount)} will be withdrawn from review. It does not count toward your
              invoice, and this does not reverse any money you have already transferred.
            </p>
            <p className="mt-2 text-sm text-slate-500">You can submit a new payment afterwards.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCancelling(null)}>Keep it</Button>
              <Button type="button" variant="danger" disabled={busyId === cancelling.id} onClick={confirmCancel}>
                {busyId === cancelling.id ? 'Cancelling…' : 'Cancel payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
