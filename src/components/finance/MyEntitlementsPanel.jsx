import { useCallback, useEffect, useMemo, useState } from 'react';
import { myCommissionStatement, requestMyCommissionPayout } from '../../api/commissionApi';
import { useCurrency } from '../../context/useAppearance';
import Button from '../ui/Button';

/**
 * What a realtor has earned under the commission engine, and how they ask to be
 * paid for particular ones.
 *
 * ── A commission appears the moment it is earned ────────────────────────────
 *
 * The line shows up as soon as the sale is attributed, because silence for
 * weeks after a sale reads as "nothing happened" and produces a support call
 * per deal. What it does NOT show yet is the amount.
 *
 * ── Why the amount is absent rather than blurred ────────────────────────────
 *
 * Until a commission is released the figure is provisional: a cap can
 * re-prorate it when another line lands on the same deal, a revision can reduce
 * it, a clawback can remove it. A realtor who sees a provisional number
 * remembers THAT number and reads every later correction as being short-changed.
 *
 * So the server does not send it, and this panel has nothing to reveal. A CSS
 * blur would leave the figure sitting in the network tab, which is worse than
 * not hiding it at all — it looks like concealment and fails at it.
 */

const STATUS_WORDS = {
  ACCRUED: 'Being calculated',
  PARTIALLY_RELEASED: 'Part released',
  RELEASED: 'Ready to be paid',
  PAID: 'Paid',
  FORFEITED: 'Forfeited',
  REVERSED: 'Reversed',
};

const roleWord = (line) => (line.role === 'UPLINE'
  ? `Generation ${line.generation}`
  : line.role === 'DIRECT' ? 'Your sale'
    : line.role === 'REFERRER' ? 'Referral' : line.role);

export default function MyEntitlementsPanel() {
  const fmt = useCurrency();
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    myCommissionStatement()
      .then((data) => { setStatement(data); setFailed(false); })
      // "We could not look" is a different thing from "there is nothing here",
      // and a panel that renders them the same way tells a realtor their
      // commissions are gone.
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const lines = statement?.entitlements || [];
  const requestable = useMemo(() => lines.filter((line) => line.can_request_payout), [lines]);

  const toggle = (id) => setChosen((current) => (
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
  ));

  const request = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await requestMyCommissionPayout(chosen);
      setNotice({
        tone: 'success',
        text: result.not_payable
          // Said plainly. Quietly requesting fewer than were chosen leaves the
          // realtor waiting on something nobody was ever asked for.
          ? `${result.requested} requested. ${result.not_payable} of the ones you chose are not ready yet.`
          : `${result.requested} commission${result.requested === 1 ? '' : 's'} requested — `
            + `${fmt((result.amount_minor || 0) / 100)} in total. An administrator will review it.`,
      });
      setChosen([]);
      load();
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error?.response?.data?.message || 'That request did not go through. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading your commissions…</p>;

  if (failed) {
    return (
      <p className="rounded-lg bg-warning-surface px-3 py-2 text-sm text-warning">
        Your commissions could not be loaded just now. They have not gone anywhere — try again in a moment.
      </p>
    );
  }

  if (!lines.length) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Commissions on your sales</h2>
          <p className="text-sm text-slate-500">
            A commission appears here as soon as a sale is attributed to you.
            The amount is confirmed once it has been approved.
          </p>
        </div>
        {requestable.length > 0 && (
          <Button type="button" onClick={request} disabled={busy || !chosen.length}>
            {busy ? 'Requesting…' : chosen.length
              ? `Request payment for ${chosen.length}`
              : 'Select some to request payment'}
          </Button>
        )}
      </div>

      {notice && (
        <p className={`rounded-lg px-3 py-2 text-sm ${
          notice.tone === 'success'
            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
            : 'bg-rose-50 text-rose-800 ring-1 ring-rose-200'
        }`}>
          {notice.text}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-8 py-2" />
              <th className="py-2 pr-3">Deal</th>
              <th className="py-2 pr-3">Your part</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="py-2">
                  {line.can_request_payout && (
                    <input
                      type="checkbox"
                      checked={chosen.includes(line.id)}
                      onChange={() => toggle(line.id)}
                      aria-label={`Request payment for ${line.deal_ref}`}
                    />
                  )}
                </td>
                <td className="py-2 pr-3 font-medium text-slate-700">{line.deal_ref}</td>
                <td className="py-2 pr-3 text-slate-600">{roleWord(line)}</td>
                <td className="py-2 pr-3">
                  <span className="text-slate-600">
                    {STATUS_WORDS[line.status] || line.status}
                  </span>
                  {line.payout_requested_at && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      payment requested
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {line.amount_visible === false ? (
                    /*
                      Not a blur over a real number — there is no number here to
                      blur. Said as a sentence so it reads as a stage in a
                      process rather than as a value that failed to load.
                    */
                    <span className="text-xs italic text-slate-400">
                      confirmed once approved
                    </span>
                  ) : (
                    <span className="font-semibold text-slate-900">
                      {fmt((line.constrained_minor || 0) / 100)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
