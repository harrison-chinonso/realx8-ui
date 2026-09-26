import { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../ui/Button';
import { requestCommissionPayout } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';

/** Earned and not yet asked for — the only two states a request may name. */
export const REQUESTABLE_STATUSES = ['created', 'approved'];

/** The commissions a payout request could cover, out of everything earned. */
export const requestableOf = (commissions = []) =>
  commissions.filter((row) => REQUESTABLE_STATUSES.includes(row.status));

/**
 * Asking to be paid, from the dashboard.
 *
 * ── What it lists ───────────────────────────────────────────────────────────
 *
 * Only commissions still to be asked for: `created` and `approved`, which is
 * exactly what summaryFor counts as `requestable` and exactly what the request
 * handler will accept. Anything already requested, paid or cancelled is absent
 * — this is a list of things to act on, and a row with no action on it is a
 * row that makes the person look for one.
 *
 * ── One at a time, deliberately ─────────────────────────────────────────────
 *
 * The API requests a single commission per call, and each is an individual
 * obligation an administrator approves on its own. Rather than hide that behind
 * one button that fires several requests and half-succeeds, each row asks for
 * itself and the list updates as they go.
 */
export default function RequestPayoutModal({ open, onClose, commissions = [], summary, onRequested }) {
  const fmt = useCurrency();
  const [busyId, setBusyId] = useState(null);
  const [done, setDone] = useState([]);
  const [error, setError] = useState('');

  const rows = requestableOf(commissions).filter((row) => !done.includes(row.id));
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const request = async (row) => {
    if (busyId) return;
    setBusyId(row.id);
    setError('');
    try {
      await requestCommissionPayout(row.id);
      setDone((current) => [...current, row.id]);
      onRequested?.();
    } catch (err) {
      // The server explains the refusals worth explaining — below the minimum,
      // not yet verified — so its wording is used rather than a generic one.
      setError(err?.response?.data?.message || 'Could not request payment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={() => !busyId && onClose()} title="Request payout">
      <div className="space-y-3">
        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>
        )}

        {!rows.length ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-slate-900">
              {done.length ? 'All done — every commission has been requested.' : 'Nothing to request right now.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {done.length
                ? 'An administrator will review and pay them.'
                : 'Commissions appear here once a sale you earned on is complete.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-slate-600">
                {rows.length} commission{rows.length === 1 ? '' : 's'} you can ask to be paid
              </p>
              <p className="text-base font-semibold text-slate-900">{fmt(total)}</p>
            </div>

            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{row.title}</p>
                    <p className="text-xs text-slate-500">{fmt(row.amount)}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => request(row)}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === row.id ? 'Requesting…' : 'Request'}
                  </Button>
                </li>
              ))}
            </ul>

            <p className="text-xs text-slate-500">
              Commissions are paid in full — there is no partial payout. An administrator
              reviews each request before it is paid.
            </p>
          </>
        )}

        {/* The dashboard shows what can be acted on; the full history, including
            what is already in flight, lives on its own page. */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link to="/commissions/mine" className="text-xs font-medium hover:underline" style={{ color: 'var(--primary)' }}>
            See all my commissions →
          </Link>
          <Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(busyId)}>
            {done.length ? 'Done' : 'Close'}
          </Button>
        </div>

        {summary?.in_progress > 0 && (
          <p className="text-xs text-slate-400">
            {fmt(summary.in_progress)} already requested and awaiting approval.
          </p>
        )}
      </div>
    </Modal>
  );
}
