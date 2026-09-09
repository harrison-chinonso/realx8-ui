import { useEffect, useMemo, useState } from 'react';
import { listInvestments, listOpenPlans, subscribeToPlan } from '../../api/investmentApi';
import Badge from '../../components/common/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import MoneyInput from '../../components/ui/MoneyInput';
import { useCurrency } from '../../context/useAppearance';
import useAuthStore from '../../store/authStore';

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Expected return and total at maturity for one investment. */
const roiOf = (investment) => {
  const amount = num(investment.amount);
  const rate = num(investment.plan?.return_rate);
  const expectedReturn = (amount * rate) / 100;
  const paidOut = (investment.payouts || []).reduce((sum, p) => sum + num(p.amount), 0);
  return { amount, rate, expectedReturn, total: amount + expectedReturn, paidOut };
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

function Stat({ label, value, accent = false }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent ? '' : 'text-slate-900'}`} style={accent ? { color: 'var(--primary)' } : undefined}>
        {value}
      </div>
    </div>
  );
}

/**
 * Client-facing investment view: browse active plans, subscribe, and track
 * your own investments and their returns. Read-only beyond subscribing —
 * activation, payouts and cash-outs are administrative.
 */
export default function MyInvestmentsPage() {
  const fmt = useCurrency();
  // Clients and realtors both invest on their own behalf.
  const canSubscribe = ['client', 'realtor'].includes(useAuthStore((state) => state.effectiveType()));

  const [plans, setPlans] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribeFor, setSubscribeFor] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    // allSettled: a failure on one list should not blank the other.
    const [planRes, investmentRes] = await Promise.allSettled([listOpenPlans(), listInvestments({ limit: 100 })]);
    const items = (result) => (result.status === 'fulfilled' ? (result.value?.data ?? result.value ?? []) : []);
    setPlans(items(planRes));
    setInvestments(items(investmentRes));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => investments.reduce((acc, investment) => {
    const roi = roiOf(investment);
    return {
      invested: acc.invested + roi.amount,
      expected: acc.expected + roi.expectedReturn,
      paidOut: acc.paidOut + roi.paidOut,
      active: acc.active + (String(investment.status).toLowerCase() === 'active' ? 1 : 0),
    };
  }, { invested: 0, expected: 0, paidOut: 0, active: 0 }), [investments]);

  const openSubscribe = (plan) => {
    setSubscribeFor(plan);
    setAmount(String(num(plan.min_amount) || ''));
    setError('');
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await subscribeToPlan({ plan_id: subscribeFor.id, amount: Number(amount) });
      setSubscribeFor(null);
      setNotice('Subscription submitted. It will appear once an administrator activates it.');
      load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not subscribe to this plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Investments</h1>

      {notice && <div className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Invested" value={fmt(totals.invested)} accent />
        <Stat label="Expected Return" value={fmt(totals.expected)} />
        <Stat label="Paid Out So Far" value={fmt(totals.paidOut)} />
        <Stat label="Active Investments" value={String(totals.active)} />
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Available Plans</h2>
        <p className="mb-4 text-sm text-slate-500">Choose a plan to invest in. Subscriptions are reviewed before they go live.</p>

        {loading ? (
          <p className="text-slate-500">Loading plans...</p>
        ) : plans.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {num(plan.return_rate)}% ROI
                  </span>
                </div>
                {plan.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{plan.description}</p>}
                <dl className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><dt>Minimum</dt><dd>{fmt(plan.min_amount)}</dd></div>
                  <div className="flex justify-between">
                    <dt>Maximum</dt><dd>{num(plan.max_amount) ? fmt(plan.max_amount) : 'No limit'}</dd>
                  </div>
                  {plan.period?.name && <div className="flex justify-between"><dt>Duration</dt><dd>{plan.period.name}</dd></div>}
                </dl>
                {canSubscribe && (
                  <Button type="button" className="mt-4 w-full" onClick={() => openSubscribe(plan)}>Subscribe</Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No investment plans are open at the moment.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">My Investments</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Plan</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Invested</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Expected Return</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Value at Maturity</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Paid Out</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Matures</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {investments.map((investment) => {
                const roi = roiOf(investment);
                return (
                  <tr key={investment.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{investment.plan?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(roi.amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{roi.rate}%</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(roi.expectedReturn)}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--primary)' }}>{fmt(roi.total)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(roi.paidOut)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(investment.end_date)}</td>
                    <td className="px-4 py-3"><Badge value={investment.status} /></td>
                  </tr>
                );
              })}
              {!loading && !investments.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    You have no investments yet. Subscribe to a plan above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!subscribeFor}
        onClose={() => !saving && setSubscribeFor(null)}
        title={`Subscribe — ${subscribeFor?.name ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Return Rate</div>
              <div className="font-medium text-slate-900">{num(subscribeFor?.return_rate)}%</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">Minimum</div>
              <div className="font-medium text-slate-900">{fmt(subscribeFor?.min_amount)}</div>
            </div>
          </div>

          <MoneyInput label="Amount to invest" value={amount} onChange={setAmount} />

          {Number(amount) > 0 && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Expected return</span>
                <span>{fmt((Number(amount) * num(subscribeFor?.return_rate)) / 100)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold text-slate-900">
                <span>Value at maturity</span>
                <span>{fmt(Number(amount) + (Number(amount) * num(subscribeFor?.return_rate)) / 100)}</span>
              </div>
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

          <p className="text-xs text-slate-500">
            Your subscription starts as pending and becomes active once an administrator approves it.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setSubscribeFor(null)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={saving || !(Number(amount) > 0)}>
              {saving ? 'Submitting...' : 'Confirm Subscription'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
