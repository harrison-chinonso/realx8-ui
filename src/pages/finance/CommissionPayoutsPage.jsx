import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { plural } from '../../utils/plural';
import {
  listCommissionPayouts, buildCommissionPayouts,
  approveCommissionPayout, payCommissionPayout, cancelCommissionPayout,
  listPayoutRequests,
} from '../../api/commissionApi';

/**
 * Payout runs — building a batch, approving it, and recording that it was paid.
 *
 * ── Three steps, and the separation is the control ──────────────────────────
 *
 * Building a batch is a calculation: it gathers everything released, matured
 * and unpaid, applies each line's own deduction profile, and writes a DRAFT.
 * Nothing has moved. Approving is somebody signing it. Paying records that the
 * transfer happened, which is the step that makes the money irrecoverable
 * except through a clawback.
 *
 * Collapsing them into one button would mean the figures could not be reviewed
 * before the money went, which is the only moment review is worth anything.
 *
 * ── Why the advice is shown in full ─────────────────────────────────────────
 *
 * A realtor who receives less than they earned assumes an error, and support
 * cannot answer without recomputing. The gross → deductions → recovery → net
 * breakdown comes back on the payout itself, computed by the same code that
 * produced the net, so the two cannot disagree.
 */

const money = (minor) => (Number(minor || 0) / 100)
  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CommissionPayoutsPage() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState([]);

  const [viewing, setViewing] = useState(null);
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setPayouts(await listCommissionPayouts());
    } catch (error) {
      setPayouts([]);
      setFailed(error?.response?.data?.message || 'Could not load payout runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Who is waiting. Read separately from the payouts list because it is a
   * different question — the list says what has been batched, this says what
   * somebody has asked for and nobody has batched yet.
   */
  useEffect(() => {
    listPayoutRequests().then((rows) => setRequests(rows || [])).catch(() => setRequests([]));
  }, [payouts]);

  /**
   * @param {boolean} requestedOnly  build only for realtors who have asked.
   *   The ordinary run pays everybody what they are owed whether or not they
   *   asked — nobody should have to chase to be paid — so this is the narrower
   *   action, for an admin working through the request queue.
   */
  const build = async (requestedOnly = false) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      const result = await buildCommissionPayouts(requestedOnly ? { requested_only: true } : {});
      /**
       * "Nothing payable" is an outcome, not a failure, and saying so plainly
       * saves the next question. It usually means either nothing has vested
       * yet or everything vested is still inside its maturity window.
       */
      if (result?.skipped) {
        setMessage(result.skipped === 'nothing_matured'
          ? `Nothing has matured yet${result.immature ? ` — ${plural(result.immature, 'line is', 'lines are')} still inside the cooling-off period.` : '.'}`
          : 'Nothing is payable at the moment.');
      } else {
        setMessage(`${plural(result.payouts.length, 'draft payout')} built. Review and approve before paying.`);
      }
      await load();
    } catch (error) {
      setFailed(error?.response?.data?.message || 'Could not build the payout run.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (row, action) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      if (action === 'cancel') {
        await cancelCommissionPayout(row.id);
        setMessage(`Batch ${row.batch_ref} cancelled. Its commission is available to batch again.`);
      } else if (action === 'approve') {
        await approveCommissionPayout(row.id);
        setMessage(`Batch ${row.batch_ref} approved. It is now ready to pay.`);
      } else {
        await payCommissionPayout(row.id, reference || null);
        setMessage(`Batch ${row.batch_ref} recorded as paid.`);
        setViewing(null);
        setReference('');
      }
      await load();
    } catch (error) {
      setFailed(error?.response?.data?.message || 'That could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'batch_ref', label: 'Batch' },
    { key: 'realtor_id', label: 'Realtor' },
    { key: 'gross_minor', label: 'Gross', render: (row) => money(row.gross_minor) },
    { key: 'deductions_minor', label: 'Deductions', render: (row) => money(row.deductions_minor) },
    { key: 'recovered_minor', label: 'Recovered', render: (row) => money(row.recovered_minor) },
    { key: 'net_minor', label: 'Net', render: (row) => <span className="font-semibold">{money(row.net_minor)}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge value={row.status} />,
    },
    {
      key: 'paid_at',
      label: 'Paid',
      render: (row) => (row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'),
    },
  ];

  const advice = viewing?.advice
    ? (typeof viewing.advice === 'string' ? JSON.parse(viewing.advice) : viewing.advice)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Commission Payouts</h1>
          <p className="text-sm text-slate-500">
            Commission that is due, batched one payment per realtor. Building a run creates drafts —
            nothing moves until a batch is approved and paid.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/*
            Shown only when somebody is actually waiting. A request nobody
            knows about is the same as no request — the realtor believes they
            have asked and the admin has nothing telling them so.
          */}
          {requests.length > 0 && (
            <Button variant="secondary" onClick={() => build(true)} disabled={busy}>
              Pay the {plural(requests.length, 'realtor')} who asked
            </Button>
          )}
          <Button onClick={() => build(false)} disabled={busy}>{busy ? 'Working…' : 'Build payout run'}</Button>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="rounded-lg bg-info-surface px-4 py-3 text-sm text-info">
          <span className="font-semibold">
            {plural(requests.length, 'realtor has', 'realtors have')} asked to be paid.
          </span>{' '}
          {requests.slice(0, 4).map((row) => row.realtor_name || `#${row.realtor_id}`).join(', ')}
          {requests.length > 4 && ` and ${requests.length - 4} more`}.
        </div>
      )}

      {message && <div className="rounded-lg bg-info-surface px-4 py-2 text-sm text-info">{message}</div>}
      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}

      <Table
        columns={columns}
        data={payouts}
        loading={loading}
        exportName="commission-payouts"
        /**
         * "We looked and there is nothing" and "we could not look" are
         * different answers, and an empty table shows them identically. A 403
         * here used to read as "no payout runs yet" — which tells the reader
         * the run is unnecessary rather than that they cannot see it.
         */
        emptyMessage={failed
          ? 'Could not be loaded — this list is not evidence that there are none.'
          : 'No payout runs yet. Build one once commission has been released.'}
        renderActions={(row) => (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setViewing(row)}>
              Advice
            </Button>
            {row.status === 'DRAFT' && (
              <Button type="button" size="sm" disabled={busy} onClick={() => act(row, 'approve')}>
                Approve
              </Button>
            )}
            {(row.status === 'DRAFT' || row.status === 'APPROVED') && (
              <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => act(row, 'cancel')}>
                Cancel
              </Button>
            )}
            {row.status === 'APPROVED' && (
              <Button type="button" size="sm" disabled={busy} onClick={() => setViewing(row)}>
                Record payment
              </Button>
            )}
          </div>
        )}
      />

      <Modal
        open={viewing !== null}
        onClose={() => { setViewing(null); setReference(''); }}
        title={viewing ? `Payout advice — ${viewing.batch_ref}` : ''}
      >
        {viewing && (
          <div className="space-y-4 text-sm">
            {!advice && (
              <p className="text-slate-500">
                No advice was stored for this batch, so the breakdown cannot be shown.
              </p>
            )}
            {advice && (
              <>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span>Gross commission</span>
              <span className="font-medium">{money(advice.gross_minor)}</span>
            </div>

            {(advice.deductions || []).map((line) => (
              <div key={line.code} className="flex justify-between text-slate-600">
                <span>
                  {line.label}
                  {line.type === 'PERCENTAGE' && (
                    <span className="text-slate-400"> — {line.value}% of {line.basis === 'RUNNING' ? 'the running balance' : 'the gross'}</span>
                  )}
                </span>
                <span>−{money(line.amount_minor)}</span>
              </div>
            ))}

            {Number(advice.recovered_minor) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  Recovered against an earlier clawback
                  <span className="block text-xs text-slate-400">
                    Capped at the plan&apos;s share of a payout, so a receivable is never recovered all at once.
                  </span>
                </span>
                <span>−{money(advice.recovered_minor)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <span>Net payable</span>
              <span>{money(advice.net_minor)}</span>
            </div>

            {(advice.entitlements || []).length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  What it is made of
                </p>
                {advice.entitlements.map((line) => (
                  <div key={line.entitlement_id} className="flex justify-between py-0.5 text-slate-600">
                    <span>{line.deal_ref}</span>
                    <span>{money(line.amount_minor)}</span>
                  </div>
                ))}
              </div>
            )}

              </>
            )}

            {viewing?.status === 'APPROVED' && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <Input
                  label="Payment reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Bank transfer reference"
                />
                <p className="text-xs text-slate-500">
                  Recording payment is what makes this money paid rather than payable. A later
                  revision can only reclaim it through a clawback.
                </p>
                <Button type="button" disabled={busy} onClick={() => act(viewing, 'pay')}>
                  {busy ? 'Recording…' : 'Record as paid'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
