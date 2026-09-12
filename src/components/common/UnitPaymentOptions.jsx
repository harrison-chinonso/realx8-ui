import { useEffect, useState } from 'react';
import { getUnitPurchaseOptions } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';

const getData = (response) => response?.data ?? response ?? null;

/**
 * What one unit actually costs, outright and on each plan available for it.
 *
 * Shown on the property page rather than only inside the purchase modal, so a
 * buyer can compare the ways of paying before committing to the flow. Every
 * figure comes from the server's own pricing endpoint — the same one checkout
 * reprices against — so nothing here is computed in the browser and the plan
 * charge is stated as its own line rather than folded into a total.
 *
 * Only plans ASSIGNED to this unit are ever returned, so a unit with none shows
 * outright alone. That is the whole answer to "why is a plan I did not assign
 * being offered": it cannot be.
 */
export default function UnitPaymentOptions({ unitId, quantity = 1 }) {
  const fmt = useCurrency();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!unitId) return undefined;
    let cancelled = false;
    setState('loading');
    getUnitPurchaseOptions(unitId, quantity)
      .then((response) => {
        if (cancelled) return;
        setData(getData(response));
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [unitId, quantity]);

  if (state === 'loading') return <p className="text-xs text-slate-400">Loading payment options…</p>;
  // Quiet on failure: this is supplementary detail on a page that is useful
  // without it, and the purchase flow reprices anyway.
  if (state === 'error' || !data) return null;

  const plans = data.installment_plans || [];
  const outright = data.outright?.total?.amount ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          Outright {fmt(outright)}
        </span>
        {!plans.length && (
          <span className="text-xs text-slate-500">— the only option on this unit</span>
        )}
      </div>

      {plans.length > 0 && (
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          {/* A buyer chooses a plan on a phone. Four money columns do not fit
              a 375px screen, and without this the table widens the whole page
              instead of scrolling inside its own box. */}
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Plan</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Monthly</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Plan charge</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">Total payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.map((plan) => (
                <tr key={plan.installment_plan_id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{plan.name}</div>
                    <div className="text-slate-500">
                      {plan.duration_months} month{plan.duration_months === 1 ? '' : 's'}
                      {Number(plan.terms?.grace_period_days) > 0
                        && ` · ${plan.terms.grace_period_days}-day grace`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {fmt(plan.monthly.amount)}
                    {/* Rounding puts any remainder on the final installment. */}
                    {plan.final_month.minor !== plan.monthly.minor && (
                      <div className="font-normal text-slate-500">
                        final {fmt(plan.final_month.amount)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">
                    {plan.surcharge.amount > 0 ? (
                      <span className="text-amber-700">
                        +{fmt(plan.surcharge.amount)}
                        {plan.surcharge.type === 'percentage' && (
                          <span className="block font-normal text-slate-500">
                            {plan.surcharge.value}%
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">
                    {fmt(plan.total.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
