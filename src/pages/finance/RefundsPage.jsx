import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import FieldMark from '../../components/ui/FieldMark';
import { useCurrency } from '../../context/useAppearance';
import { extractError } from '../../utils/extractError';
import {
  listRefunds, approveRefund, rejectRefund, markRefundPaid,
} from '../../api/accountingApi';

/**
 * Giving back money a buyer paid beyond what they owed.
 *
 * ── Refusing is a decision, not a failure ───────────────────────────────────
 *
 * The alternative to sending a surplus back is leaving it on the payment plan
 * against the next instalment — which is frequently what the buyer wants and
 * always cheaper than two transfers. So "Leave it on the plan" sits beside
 * "Approve" as an equal choice rather than as a way of dismissing the queue,
 * and it needs a reason, because the buyer is entitled to know what was
 * decided about their money.
 *
 * ── Approving is not paying ─────────────────────────────────────────────────
 *
 * Approving says the company intends to repay; the credit balance only clears
 * when the transfer is recorded. Showing a buyer a balance of nothing while
 * the money had not yet reached them is the one misstatement a refund flow can
 * make that looks like theft.
 */

const TONE = {
  pending_approval: 'warning',
  approved: 'info',
  paid: 'success',
  rejected: 'muted',
  cancelled: 'muted',
};

export default function RefundsPage() {
  const fmt = useCurrency();
  const money = (minor) => fmt(Number(minor || 0) / 100);

  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [paying, setPaying] = useState(null);
  const [payRef, setPayRef] = useState('');
  const [refusing, setRefusing] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setRefunds(await listRefunds());
    } catch (error) {
      setFailed(extractError(error, 'Could not load the refunds.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, success) => {
    setBusy(true);
    setMessage('');
    setFailed('');
    try {
      await fn();
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setFailed(extractError(error, 'That could not be done.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const waiting = refunds.filter((r) => r.status === 'pending_approval').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Refunds</h1>
        <p className="text-sm text-slate-500">
          Money a buyer paid beyond what they owed. Sending it back and leaving it against their
          next instalment are both proper answers — the second is usually what the buyer wants.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {message && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{message}</div>}
      {waiting > 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {waiting} waiting for a decision. Until one is made the surplus stays on the buyer&apos;s plan.
        </div>
      )}

      <Table
        columns={[
          { key: 'reference', label: 'Refund' },
          { key: 'client_name', label: 'Buyer', render: (row) => row.client_name || `#${row.client_id}` },
          { key: 'invoice_reference', label: 'Overpaid on', render: (row) => row.invoice_reference || '—' },
          {
            key: 'amount_minor',
            label: 'Amount',
            render: (row) => <span className="font-semibold">{money(row.amount_minor)}</span>,
          },
          { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} tone={TONE[row.status]} /> },
          {
            key: 'reason',
            label: 'Why',
            render: (row) => (
              <span className="block max-w-[20rem] truncate" title={row.rejection_reason || row.reason || ''}>
                {row.rejection_reason || row.reason || '—'}
              </span>
            ),
          },
          {
            key: 'created_at',
            label: 'Raised',
            render: (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'),
          },
        ]}
        data={refunds}
        loading={loading}
        exportName="refunds"
        emptyMessage="No refunds. Nobody has overpaid."
        renderActions={(row) => (
          <div className="flex gap-1.5">
            {row.status === 'pending_approval' && (
              <>
                <Button size="sm" disabled={busy}
                  onClick={() => act(() => approveRefund(row.id), `${row.reference} approved — it can now be paid.`)}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" disabled={busy}
                  onClick={() => { setRefusing(row); setReason(''); }}>
                  Leave it on the plan
                </Button>
              </>
            )}
            {row.status === 'approved' && (
              <Button size="sm" disabled={busy} onClick={() => { setPaying(row); setPayRef(''); }}>
                Record payment
              </Button>
            )}
          </div>
        )}
      />

      <Modal open={paying !== null} onClose={() => !busy && setPaying(null)} title="Record the refund" size="sm">
        {paying && (
          <div className="space-y-3 text-sm">
            <p>
              Sending <strong>{money(paying.amount_minor)}</strong> back to{' '}
              {paying.client_name || `client #${paying.client_id}`}.
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Their credit balance clears when this is recorded, not before — so the figure they see
              matches the money they actually have.
            </p>
            <Input label="Transfer reference" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setPaying(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy}
                onClick={async () => {
                  const ok = await act(
                    () => markRefundPaid(paying.id, { reference: payRef }),
                    `${paying.reference} paid.`,
                  );
                  if (ok) setPaying(null);
                }}
              >
                {busy ? 'Recording…' : 'Record it'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={refusing !== null}
        onClose={() => !busy && setRefusing(null)}
        title="Leave it on the plan"
        size="sm"
      >
        {refusing && (
          <div className="space-y-3 text-sm">
            <p>
              {money(refusing.amount_minor)} stays as credit against{' '}
              {refusing.client_name || 'the buyer'}&apos;s next instalment rather than being sent back.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Why<FieldMark required /></span>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="They asked for it to come off the next instalment."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button type="button" variant="secondary" onClick={() => setRefusing(null)} disabled={busy}>Cancel</Button>
              <Button
                type="button" disabled={busy || !reason.trim()}
                onClick={async () => {
                  const ok = await act(
                    () => rejectRefund(refusing.id, reason.trim()),
                    `${refusing.reference} stays on the plan.`,
                  );
                  if (ok) setRefusing(null);
                }}
              >
                {busy ? 'Saving…' : 'Leave it on the plan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
