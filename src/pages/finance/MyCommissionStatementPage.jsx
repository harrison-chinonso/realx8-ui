import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import { myCommissionStatement } from '../../api/commissionApi';
import { requestCommissionPayout } from '../../api/financeApi';

/**
 * A realtor's own statement: what they have earned and where it has got to.
 *
 * ── Why this shows accrued money the realtor cannot draw ────────────────────
 *
 * The obvious design shows a balance and a list of payments. It is also the
 * design that generates the most support tickets, because a realtor who closed
 * a ₦50m sale in March and sees nothing in their wallet concludes the
 * commission was lost. It was not — it is accrued and vests as the buyer pays.
 *
 * So the four states are shown separately and named: accruing, available, paid,
 * and owed back. A realtor who can see that ₦2.4m is accruing against a buyer
 * who is 40% through their plan does not need to ask anybody.
 */

const money = (minor) => (Number(minor || 0) / 100)
  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EXPLAIN = {
  ACCRUED: 'Earned on the sale. It becomes available as the buyer pays.',
  PARTIALLY_RELEASED: 'Partly available — the rest follows the buyer’s remaining instalments.',
  RELEASED: 'Available, and included in the next payout run.',
  PAID: 'Paid out.',
  FORFEITED: 'Not paid — you were not active at a release checkpoint.',
  HELD: 'Suspended pending reinstatement.',
  REVERSED: 'The deal was revised or cancelled.',
};

function Figure({ label, value, note, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

export default function MyCommissionStatementPage() {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  /**
   * The flat-rate commissions, which carry an action the engine's lines do not:
   * the realtor asks for payment, rather than waiting for a payout run.
   */
  const [requesting, setRequesting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed('');
    try {
      setStatement(await myCommissionStatement());
    } catch (error) {
      setStatement(null);
      setFailed(error?.response?.data?.message || 'Could not load your statement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitRequest = async () => {
    setBusy(true);
    try {
      await requestCommissionPayout(requesting.id);
      setRequesting(null);
      await load();
    } catch (error) {
      setFailed(error?.response?.data?.message || 'That request could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const wallet = statement?.wallet;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Commission</h1>
        <p className="text-sm text-slate-500">
          What you have earned, and where each part of it has got to.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}

      {wallet && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Accruing"
            value={money(wallet.accrued_minor)}
            note="Earned on sales that are still being paid for"
          />
          <Figure
            label="Available"
            value={money(wallet.available_minor)}
            note="Vested — due in the next payout run"
            tone="text-emerald-600"
          />
          <Figure label="Paid to you" value={money(wallet.paid_minor)} />
          {Number(statement.owed_minor) > 0 ? (
            <Figure
              label="Owed back"
              value={money(statement.owed_minor)}
              note="From a deal that was cancelled or revised down. Recovered a share at a time from future payouts, never all at once."
              tone="text-rose-600"
            />
          ) : (
            <Figure
              label="Forfeited"
              value={money(wallet.forfeited_minor)}
              note="Not paid, because you were not active at a release checkpoint"
            />
          )}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Earnings by deal</h2>
        <Table
          columns={[
            { key: 'deal_ref', label: 'Deal' },
            {
              key: 'role',
              label: 'How',
              render: (row) => (row.role === 'DIRECT'
                ? 'Your sale'
                : `${row.role === 'UPLINE' ? `Generation ${row.generation}` : row.role.toLowerCase()}`),
            },
            { key: 'constrained_minor', label: 'Earned', render: (row) => money(row.constrained_minor) },
            { key: 'released_minor', label: 'Vested', render: (row) => money(row.released_minor) },
            { key: 'paid_minor', label: 'Paid', render: (row) => money(row.paid_minor) },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (
                <span title={EXPLAIN[row.status] || ''}>
                  <Badge value={row.status} />
                </span>
              ),
            },
            {
              key: 'attribution_date',
              label: 'Sold',
              render: (row) => (row.attribution_date ? new Date(row.attribution_date).toLocaleDateString() : '—'),
            },
          ]}
          data={statement?.entitlements ?? []}
          loading={loading}
          exportName="my-commission"
          emptyMessage={statement?.legacy?.length
            ? 'Nothing here yet — your commission so far is on the flat rate, below.'
            : 'You have not earned commission yet.'}
        />
      </div>

      {statement?.legacy?.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Flat-rate commissions</h2>
          <p className="mb-2 text-xs text-slate-500">
            Earned at your company&apos;s flat rate rather than under a commission plan. Ask for
            payment when you are ready.
          </p>
          <Table
            columns={[
              { key: 'title', label: 'What for', render: (row) => row.title || '—' },
              { key: 'amount', label: 'Amount', render: (row) => money(Number(row.amount || 0) * 100) },
              { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
              {
                key: 'created_at',
                label: 'Earned',
                render: (row) => (row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'),
              },
            ]}
            data={statement.legacy}
            loading={false}
            exportName="my-flat-rate-commissions"
            emptyMessage="Nothing here."
            renderActions={(row) => (row.status === 'created' ? (
              <Button type="button" size="sm" onClick={() => setRequesting(row)}>Request payment</Button>
            ) : null)}
          />
        </div>
      )}

      <Modal open={requesting !== null} onClose={() => !busy && setRequesting(null)} title="Request payment" size="sm">
        {requesting && (
          <div className="space-y-4 text-sm">
            <p>
              Request payment of <strong>{money(Number(requesting.amount || 0) * 100)}</strong> for
              {' '}&ldquo;{requesting.title}&rdquo;?
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setRequesting(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={submitRequest} disabled={busy}>
                {busy ? 'Requesting…' : 'Request payment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {statement?.payouts?.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Payments to you</h2>
          <Table
            columns={[
              { key: 'batch_ref', label: 'Batch' },
              { key: 'gross_minor', label: 'Gross', render: (row) => money(row.gross_minor) },
              { key: 'deductions_minor', label: 'Deductions', render: (row) => money(row.deductions_minor) },
              { key: 'recovered_minor', label: 'Recovered', render: (row) => money(row.recovered_minor) },
              { key: 'net_minor', label: 'Net', render: (row) => <span className="font-semibold">{money(row.net_minor)}</span> },
              { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
              {
                key: 'paid_at',
                label: 'Paid',
                render: (row) => (row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'),
              },
            ]}
            data={statement.payouts}
            loading={false}
            exportName="my-commission-payments"
            emptyMessage="No payments yet."
          />
          <p className="mt-2 text-xs text-slate-400">
            Where a payment is less than the gross, the difference is withholding and any recovery
            against an earlier clawback. Both are itemised on the advice your finance team holds.
          </p>
        </div>
      )}
    </div>
  );
}
