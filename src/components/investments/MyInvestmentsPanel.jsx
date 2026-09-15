import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyInvestments, getExitQuote } from '../../api/investmentApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';
import Modal from '../common/Modal';
import Badge from '../common/Badge';

/**
 * What an investor has, in the order they want to know it.
 *
 * ── Four numbers, and why each is separate ──────────────────────────────────
 *
 * Committed, funded, earned, paid. They are routinely different and collapsing
 * any pair of them hides something the investor needs:
 *
 *   committed ≠ funded   a subscription is a promise until the money arrives,
 *                        and a part payment earns on what landed;
 *   earned ≠ paid        a monthly plan earns every day and releases monthly,
 *                        so between releases there is always a gap — and an
 *                        investor who cannot see it thinks they are being
 *                        short-changed;
 *   funded ≠ earned      the obvious one, and the one they check.
 *
 * Every figure comes from the server, computed from the terms stored on the
 * subscription. Nothing here does arithmetic: a screen that computed its own
 * total would eventually disagree with the payment, and the investor would be
 * right to believe the screen.
 */

const STATUS_COPY = {
  pending: 'Waiting for your payment',
  active: 'Earning',
  completed: 'Finished and paid out',
  exited: 'Withdrawn early',
  cancelled: 'Cancelled',
};

const shortDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

export default function MyInvestmentsPanel() {
  const fmt = useCurrency();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    listMyInvestments()
      .then((data) => { setRows(Array.isArray(data) ? data : []); setFailed(''); })
      .catch((error) => setFailed(error?.userMessage || 'Could not load your investments.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const askToExit = async (row) => {
    setQuoting(row.id);
    try {
      setQuote({ row, ...(await getExitQuote(row.id)) });
    } catch (error) {
      setFailed(error?.userMessage || 'Could not work out what leaving early would cost.');
    } finally {
      setQuoting(null);
    }
  };

  if (loading) {
    return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading your investments…</div>;
  }

  if (failed) {
    return <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">{failed}</div>;
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-700">You have no investments yet.</p>
        <p className="mt-1 text-sm text-slate-500">
          Open opportunities appear here once your company publishes them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <section key={row.id} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{row.plan || 'Investment'}</h3>
              <p className="text-sm text-slate-500">{STATUS_COPY[row.status] || row.status}</p>
            </div>
            <Badge value={row.status} />
          </div>

          {/*
            An unfunded subscription is not a failure, it is a bill. Saying so
            — with the way to pay it — is more use than an empty row of zeroes.
          */}
          {row.status === 'pending' && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              This starts earning once your payment is approved.{' '}
              {row.invoice_id && (
                <Link to={`/finance/invoices/${row.invoice_id}`} className="font-medium underline">
                  Pay the invoice
                </Link>
              )}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Invested</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">{fmt(row.funded)}</dd>
              {/* Shown only when they differ — otherwise it is noise. */}
              {row.funded !== row.committed && (
                <dd className="text-[11px] text-slate-400">of {fmt(row.committed)} committed</dd>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Earned</dt>
              <dd className="mt-0.5 font-semibold text-emerald-700 tabular-nums">{fmt(row.earned)}</dd>
              <dd className="text-[11px] text-slate-400">to date</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">Paid to you</dt>
              <dd className="mt-0.5 font-semibold text-slate-900 tabular-nums">{fmt(row.paid)}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                {row.matured ? 'Matured' : 'Next payout'}
              </dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {shortDate(row.matured ? row.maturity_date : row.next_payout_date)}
              </dd>
              {!row.matured && row.maturity_date && (
                <dd className="text-[11px] text-slate-400">matures {shortDate(row.maturity_date)}</dd>
              )}
            </div>
          </dl>

          {/*
            The agreement, in the same sentences shown before they committed —
            generated from the terms the arithmetic uses, so the disclosure and
            the money cannot drift apart.
          */}
          {row.terms?.length > 0 && (
            <ul className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {row.terms.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}

          {row.status === 'active' && (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => askToExit(row)} disabled={quoting === row.id}>
                {quoting === row.id ? 'Working it out…' : 'What if I withdraw early?'}
              </Button>
              {row.capital_outstanding > 0 && row.matured && (
                <span className="text-xs text-slate-500">
                  {fmt(row.capital_outstanding)} capital still to be returned.
                </span>
              )}
            </div>
          )}
        </section>
      ))}

      {/*
        The quotation is shown BEFORE anything is agreed to. An early exit is
        the one moment an investor loses money they can see on their own screen,
        and they are entitled to the arithmetic first rather than after, when
        the only remedy is a reversal.
      */}
      <Modal open={Boolean(quote)} onClose={() => setQuote(null)} title="Withdrawing early" size="sm">
        {quote && !quote.allowed && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{quote.message}</p>
            <Button variant="secondary" onClick={() => setQuote(null)}>Close</Button>
          </div>
        )}
        {quote && quote.allowed && (
          <div className="space-y-4">
            <ul className="space-y-2">
              {(quote.lines || []).map((line) => (
                <li key={line.label} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-slate-600">{line.label}</span>
                  <span className={`font-medium tabular-nums ${line.amount_minor < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                    {fmt(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-medium text-slate-700">You would receive</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{fmt(quote.net)}</span>
            </div>
            <p className="text-xs text-slate-500">
              This is a quotation. Nothing has been withdrawn — ask your company to proceed if you want to go ahead.
            </p>
            <Button variant="secondary" onClick={() => setQuote(null)}>Close</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
