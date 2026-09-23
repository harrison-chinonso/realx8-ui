import { useCallback, useEffect, useState } from 'react';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import { myCommissionStatement, requestMyCommissionPayout } from '../../api/commissionApi';
import { requestCommissionPayout } from '../../api/financeApi';
import { plural } from '../../utils/plural';

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
  PARTIALLY_RELEASED: 'Partly available — the rest follows the buyer’s remaining installments.',
  RELEASED: 'Available — ask to be paid, or wait for the next payout run.',
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
  /*
   * Asking to be paid for an engine line, from the statement itself.
   *
   * The control used to live only on a second screen that a realtor's menu
   * does not offer them — so the statement showed vested money with no way to
   * ask for it, which is the same dead end the old approval gate produced and
   * for a sillier reason.
   */
  const [asking, setAsking] = useState(null);
  const [asked, setAsked] = useState('');

  const requestOne = async (row) => {
    setBusy(true);
    setFailed('');
    setAsked('');
    try {
      const result = await requestMyCommissionPayout([row.id]);
      setAsked(result?.requested
        ? `Requested ${money(result.amount_minor)}. It goes into the next payout run.`
        : 'That one is not ready to be paid yet.');
      setAsking(null);
      await load();
    } catch (error) {
      setFailed(error?.response?.data?.message || 'That request did not go through.');
    } finally {
      setBusy(false);
    }
  };

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
  const payable = statement?.payable;
  const threshold = statement?.payout_threshold;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Commission</h1>
        <p className="text-sm text-slate-500">
          What you have earned, and where each part of it has got to.
        </p>
      </div>

      {failed && <div className="rounded-lg bg-danger-surface px-4 py-2 text-sm text-danger">{failed}</div>}
      {asked && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{asked}</div>}

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
            note={payable && payable.deductions_minor > 0
              ? `Before deductions — ${money(payable.net_minor)} would reach you`
              : 'Vested — due in the next payout run'}
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

      {/*
        Gross and net, side by side.

        Deductions are taken when a payout run is built, not when commission is
        released, so "Available" above is the figure BEFORE withholding. Showing
        only that number means the amount a realtor watches is larger than the
        amount that reaches their bank, and the difference is discovered on the
        payment. Both are shown instead, with the arithmetic between them —
        computed by the same function the payout run uses, so the estimate and
        the payment cannot disagree.
      */}
      {payable && payable.gross_minor > 0 && payable.deductions_minor > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">If you were paid out today</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Available (gross)</dt>
              <dd className="tabular-nums font-medium text-slate-800">{money(payable.gross_minor)}</dd>
            </div>
            {payable.deductions.map((line, index) => (
              <div key={`${line.code}-${index}`} className="flex justify-between gap-4">
                <dt className="text-slate-500">
                  {line.label}
                  {line.type === 'PERCENTAGE' && <span className="text-slate-400"> ({line.value}%)</span>}
                </dt>
                <dd className="tabular-nums text-slate-600">−{money(line.amount_minor)}</dd>
              </div>
            ))}
            {payable.recovered_minor > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Recovered against what you owe back</dt>
                <dd className="tabular-nums text-slate-600">−{money(payable.recovered_minor)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-1.5">
              <dt className="font-semibold text-slate-800">You would receive</dt>
              <dd className="tabular-nums font-semibold text-emerald-600">{money(payable.net_minor)}</dd>
            </div>
          </dl>
          {payable.immature_lines > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {plural(payable.immature_lines, 'commission')} in this total {payable.immature_lines === 1 ? 'is' : 'are'} still
              inside its holding period and would not be included in a payout run today.
            </p>
          )}
        </div>
      )}

      {/*
        The minimum, said before it is hit rather than as a refusal afterwards.
        Shown only when the company has configured one — with no minimum there
        is nothing to report and a line saying so would be noise.
      */}
      {threshold?.enforced && (
        <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${threshold.met
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
          : 'bg-amber-50 text-amber-800 ring-amber-200'}`}
        >
          {threshold.met
            ? `Your available balance is over the ${money(threshold.threshold_minor)} minimum. You can request a payout.`
            : `You need ${money(threshold.shortfall_minor)} more in your available balance to request a payout. `
              + `The minimum is ${money(threshold.threshold_minor)}.`}
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Earnings by deal</h2>
        <Table
          columns={[
            {
              /*
               * The buyer and the property, not the deal reference.
               *
               * `INV-412` identifies the row to the system and to nobody else.
               * The reference is kept on hover for anyone matching a line
               * against an invoice, which is a support question rather than
               * the everyday one.
               */
              key: 'label',
              label: 'What for',
              render: (row) => (
                <span className="block max-w-[22rem] truncate" title={`${row.label || row.deal_ref} · ${row.deal_ref}`}>
                  {row.label || row.deal_ref}
                </span>
              ),
            },
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
          /*
           * Vested, unpaid, not already asked for and not already in a payout
           * run — the server works that out and says so per line, so the
           * button and the endpoint cannot disagree about what is askable.
           */
          renderActions={(row) => (row.can_request_payout ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => setAsking(row)}>
              Request payment
            </Button>
          ) : row.payout_requested_at ? (
            <span className="text-xs text-slate-500">Requested</span>
          ) : null)}
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
            Earned at your company&apos;s flat rate rather than under a commission plan. Ask to be
            paid whenever you are ready.
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
            /*
             * Earned is enough. A commission used to sit in `created` waiting
             * for somebody at the company to agree it was owed, and the button
             * appeared only afterwards; there is no such wait now, and the two
             * states that can still be asked for are the two that offer it.
             */
            renderActions={(row) => (['created', 'approved'].includes(row.status) ? (
              <Button type="button" size="sm" onClick={() => setRequesting(row)}>Request payment</Button>
            ) : row.status === 'payment_requested' ? (
              <span className="text-xs text-slate-500">Requested</span>
            ) : null)}
          />
        </div>
      )}

      {/*
        Asked for in full, and confirmed first — the same shape as the
        flat-rate request below it, because they are the same act to the person
        doing it whichever system the commission came from.
      */}
      <Modal open={asking !== null} onClose={() => !busy && setAsking(null)} title="Request payment" size="sm">
        {asking && (
          <div className="space-y-4 text-sm">
            <p>
              Ask to be paid <strong>{money(asking.released_minor - asking.paid_minor)}</strong> for
              {' '}&ldquo;{asking.label || asking.deal_ref}&rdquo;?
            </p>
            <p className="text-xs text-slate-500">
              It joins the next payout run. Nobody has to approve the commission itself — what is
              approved is the payment.
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setAsking(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" onClick={() => requestOne(asking)} disabled={busy}>
                {busy ? 'Requesting…' : 'Request payment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
              {
                /*
                 * What the payment was for.
                 *
                 * A batch reference tells a realtor that they were paid and
                 * nothing about which of their sales it covered — and a batch
                 * gathers everything owed, so it is usually several. The names
                 * come off the stored advice, so they read as they did when
                 * the payment was made.
                 */
                key: 'for',
                label: 'What for',
                render: (row) => {
                  const lines = row.advice?.entitlements || [];
                  if (!lines.length) return <span className="text-slate-400">—</span>;
                  const [first, ...rest] = lines.map((line) => line.label || line.deal_ref);
                  return (
                    <span className="block max-w-[18rem] truncate" title={lines.map((line) => line.label || line.deal_ref).join('\n')}>
                      {first}
                      {rest.length > 0 && <span className="text-slate-400"> +{rest.length} more</span>}
                    </span>
                  );
                },
              },
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
            against an earlier clawback. Hover over &ldquo;What for&rdquo; to see every sale a
            payment covered.
          </p>
        </div>
      )}
    </div>
  );
}
