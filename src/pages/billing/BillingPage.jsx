import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Check, Users } from 'lucide-react';
import {
  confirmPayment, listBillingPayments, listBillingPlans, listHeldAccounts, startCheckout,
} from '../../api/billingApi';
import useBillingStatus from '../../hooks/useBillingStatus';
import useBillingStore from '../../store/billingStore';
import useAuthStore from '../../store/authStore';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { enumTitle } from '../../utils/enumLabel';
import { plural } from '../../utils/plural';
import {
  INTERVAL_LABELS, STATUS_LABELS, STATUS_STYLE, daysUntil, formatBillingDate, formatPlanMoney, userLimitLabel,
} from '../../utils/billing';

/**
 * Company administrators: the company's subscription — what it is on, until
 * when, how many of its seats are used, and paying for the next period.
 *
 * Payment happens on Paystack's page, not here. Choosing a plan starts a
 * checkout and sends the browser there; Paystack sends it back to
 * /billing?reference=…, which is the cue to ask the server whether the money
 * arrived. The server checks with Paystack itself — the query string is only
 * which payment to ask about, never proof that it was made.
 *
 * Other company users get a short notice instead: paying is the owner's job,
 * and the price list is not something they can act on.
 */

const PAYMENT_STATUS_STYLE = {
  success: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700',
};
const PROVIDER_LABEL = { paystack: 'Card (Paystack)', manual: 'Bank transfer' };

/** What a ?reference= turned out to be, in words. */
const outcomeOf = (result, reference) => {
  const status = result?.status;
  if (status === 'success') {
    const released = result.released?.length || 0;
    const until = formatBillingDate(result.billing?.endsAt);
    return {
      tone: 'success',
      text: `Payment received, your plan is active until ${until}.${released
        ? ` ${plural(released, 'waiting account was', 'waiting accounts were')} added to your company.` : ''}`,
    };
  }
  if (status === 'failed') {
    return { tone: 'danger', text: 'The payment was not completed. You can try again below.' };
  }
  if (status === 'amount_mismatch') {
    return {
      tone: 'danger',
      text: `The amount paid did not match the plan’s price, so the plan was not changed. Contact support with reference ${reference}.`,
    };
  }
  return {
    tone: 'warning',
    text: `We could not confirm this payment yet. If you were charged, contact support with reference ${reference}.`,
  };
};

/** "Save ₦100,000 — 2 months free", or nothing when annual is not cheaper. */
const annualSaving = (plan) => {
  const saving = Number(plan.monthly_price) * 12 - Number(plan.annual_price);
  if (!(saving > 0)) return null;
  const months = Math.round(saving / Number(plan.monthly_price));
  return `Save ${formatPlanMoney(saving, plan.currency)}${months >= 1 ? ` — ${plural(months, 'month')} free` : ''}`;
};

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.none}`}>
      {STATUS_LABELS[status] || enumTitle(status)}
    </span>
  );
}

function StatusCard({ billing }) {
  const { status } = billing;
  const users = billing.users || { used: 0, limit: null, held: 0 };
  const limit = users.limit;
  const percent = limit ? Math.min(100, Math.round((Number(users.used) / Number(limit)) * 100)) : 0;

  // The date that matters for each state, and what it means.
  let dateLine = null;
  if (status === 'trialing') {
    const days = daysUntil(billing.endsAt);
    dateLine = `Trial ends ${formatBillingDate(billing.endsAt)}${days !== null ? ` · ${plural(days, 'day')} left` : ''}`;
  } else if (status === 'active') {
    const days = daysUntil(billing.endsAt);
    dateLine = `${billing.autoRenew ? 'Renews' : 'Paid until'} ${formatBillingDate(billing.endsAt)}${days !== null ? ` · ${plural(days, 'day')} left` : ''}`;
  } else if (status === 'grace') {
    const days = daysUntil(billing.graceEndsAt);
    dateLine = `Ended ${formatBillingDate(billing.endsAt)} · renew by ${formatBillingDate(billing.graceEndsAt)}${days !== null ? ` (${plural(days, 'day')} left)` : ''} to avoid read-only`;
  } else if (status === 'lapsed') {
    dateLine = `Ended ${formatBillingDate(billing.endsAt)}. Your company is read-only until it is renewed.`;
  }

  return (
    <div className="grid gap-4 rounded-xl bg-white p-5 ring-1 ring-slate-200 md:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current plan</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-bold text-slate-900">
            {status === 'trialing' ? 'Free trial' : (billing.planName || 'No plan')}
          </span>
          {billing.interval && status !== 'trialing' && <span className="text-sm text-slate-500">{INTERVAL_LABELS[billing.interval]}</span>}
          <StatusBadge status={status} />
        </div>
        {dateLine && <p className="text-sm text-slate-600">{dateLine}</p>}
        {billing.hasCard && status === 'active' && billing.autoRenew && (
          <p className="text-xs text-slate-500">Renews automatically on the card used for the last payment.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Users</p>
        <p className="text-sm text-slate-700">
          <strong className="text-lg text-slate-900">{Number(users.used || 0).toLocaleString()}</strong>
          {' '}of {limit == null ? 'unlimited' : Number(limit).toLocaleString()}
          {status === 'trialing' && limit == null && <span className="text-slate-500"> — no limit during the trial</span>}
        </p>
        {limit != null && (
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={Number(limit)}
            aria-valuenow={Number(users.used || 0)}
            aria-label="Users on your plan"
          >
            <div className={`h-full rounded-full ${percent >= 100 ? 'bg-red-500' : percent >= 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} />
          </div>
        )}
        <p className="text-xs text-slate-500">
          Every account in your company counts — staff, realtors and clients.
          {users.held > 0 && <> <strong className="text-slate-700">{plural(users.held, 'person is', 'people are')} waiting to join.</strong></>}
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan, interval, billing, busy, onChoose }) {
  const price = interval === 'annual' ? plan.annual_price : plan.monthly_price;
  const saving = interval === 'annual' ? annualSaving(plan) : null;
  const paying = ['active', 'grace', 'lapsed'].includes(billing.status) && billing.planCode;
  const current = paying && billing.planCode === plan.code;

  /*
   * Renew only for exactly what they are on; any other plan or interval is a
   * switch. During the trial, or with nothing to renew, every plan is a choice.
   */
  let label = 'Choose';
  if (paying) label = current && billing.interval === interval ? 'Renew' : 'Switch';
  // Fewer seats than the company already uses would put it straight over.
  const tooSmall = plan.user_limit != null && Number(billing.users?.used || 0) > Number(plan.user_limit);

  return (
    <div className={`flex flex-col rounded-xl bg-white p-5 ring-1 ${current ? 'ring-2 ring-emerald-500' : 'ring-slate-200'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
        {current && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Current</span>}
      </div>
      {plan.description && <p className="mt-1 text-sm text-slate-500">{plan.description}</p>}
      <p className="mt-4">
        <span className="text-2xl font-bold text-slate-900">{formatPlanMoney(price, plan.currency)}</span>
        <span className="text-sm text-slate-500"> / {interval === 'annual' ? 'year' : 'month'}</span>
      </p>
      <p className="h-5 text-xs font-medium text-emerald-700">{saving}</p>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
        <Check size={15} className="text-emerald-600" aria-hidden="true" /> {userLimitLabel(plan.user_limit)}
      </p>
      <div className="mt-auto pt-5">
        <Button
          type="button"
          className="w-full"
          variant={current ? 'primary' : 'secondary'}
          disabled={Boolean(busy) || tooSmall}
          onClick={() => onChoose(plan)}
          aria-label={`${label} ${plan.name}, ${INTERVAL_LABELS[interval].toLowerCase()}`}
        >
          {busy === plan.code ? 'Opening payment…' : label}
        </Button>
        {tooSmall && (
          <p className="mt-1.5 text-xs text-slate-500">Your company already has more users than this plan allows.</p>
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const billing = useBillingStatus();
  const setStatus = useBillingStore((state) => state.setStatus);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const [params, setParams] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');

  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [held, setHeld] = useState([]);
  const [interval, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // The plans sit below the fold; a failure from their buttons is shown at the
  // top, so bring it into view rather than leave the click looking ignored.
  const errorRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [error]);
  const [busy, setBusy] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // StrictMode mounts twice in development; a payment is confirmed once.
  const confirmedRef = useRef(null);

  const isAdmin = billing.isBillingAdmin;

  const loadLists = () => Promise.all([
    listBillingPlans().then((res) => setPlans((res?.data || [])
      .filter((plan) => plan.active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))),
    listBillingPayments().then(setPayments),
    listHeldAccounts().then(setHeld),
  ])
    .then(() => setError(''))
    .catch((err) => setError(err.userMessage || 'Could not load your billing details.'))
    .finally(() => setLoading(false));

  useEffect(() => {
    if (!isAdmin) return;
    loadLists();
  }, [isAdmin]);

  // Start the toggle on whatever they pay for now, so Renew is one click.
  useEffect(() => {
    if (billing.interval) setPeriod(billing.interval);
  }, [billing.interval]);

  /*
   * Back from Paystack. The query string is cleared once the answer is in, so
   * a reload or a bookmark does not confirm the same payment again — the
   * server would treat it as a duplicate, but the screen would show the
   * outcome as if it were new.
   */
  useEffect(() => {
    if (!reference || !isAdmin || confirmedRef.current === reference) return;
    confirmedRef.current = reference;
    setConfirming(true);
    confirmPayment(reference)
      .then((result) => {
        setOutcome(outcomeOf(result, reference));
        if (result?.billing) setStatus(result.billing);
        // Released accounts leave the queue; the payment joins the history.
        loadLists();
      })
      .catch((err) => setOutcome({ tone: 'danger', text: err.userMessage || `Could not confirm payment ${reference}.` }))
      .finally(() => {
        setConfirming(false);
        setParams({}, { replace: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, isAdmin]);

  const choose = async (plan) => {
    setBusy(plan.code);
    setError('');
    try {
      const { authorization_url: url } = await startCheckout({ plan_code: plan.code, interval });
      if (!url) throw new Error('No payment page was returned.');
      // Left 'busy' on purpose: the page is about to unload.
      window.location.href = url;
    } catch (err) {
      setError(err.userMessage || err.message || 'Could not start the payment.');
      setBusy(null);
    }
  };

  if (isSuperiorAdmin) return <Navigate to="/superior/billing" replace />;
  if (billing.loading) return <p className="text-sm text-slate-500">Loading…</p>;
  // Billing switched off: the page does not exist.
  if (!billing.enabled || !billing.isCompanyUser) return <Navigate to="/" replace />;

  if (!isAdmin) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Billing &amp; plan</h1>
        <Alert tone="neutral">
          Your company’s subscription is managed by its administrators.
          {billing.status === 'lapsed' && ' It is currently inactive, so some actions are unavailable until they renew it.'}
        </Alert>
      </div>
    );
  }

  const planName = (code) => plans.find((plan) => plan.code === code)?.name || enumTitle(code);
  const anySaving = plans.some((plan) => annualSaving(plan));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Billing &amp; plan</h1>
        <p className="mt-1 text-sm text-slate-500">Your company’s subscription, the users it covers, and payments made for it.</p>
      </div>

      {confirming && <Alert tone="info">Confirming your payment…</Alert>}
      {outcome && <Alert tone={outcome.tone} role="status">{outcome.text}</Alert>}
      {error && <div ref={errorRef}><Alert tone="danger">{error}</Alert></div>}

      <StatusCard billing={billing} />

      <section className="space-y-3" aria-labelledby="plans-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans-heading" className="text-base font-semibold text-slate-800">Plans</h2>
          <div role="tablist" aria-label="Billing period" className="inline-flex rounded-lg bg-slate-100 p-1">
            {['monthly', 'annual'].map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={interval === value}
                onClick={() => setPeriod(value)}
                className={`min-h-0 rounded-md px-3 py-1.5 text-sm font-medium ${interval === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {INTERVAL_LABELS[value]}
                {value === 'annual' && anySaving && <span className="ml-1 text-xs text-emerald-700">· save</span>}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading plans…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.code} plan={plan} interval={interval} billing={billing} busy={busy} onChoose={choose} />
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">
          Payment is taken securely by Paystack. A new period starts when the current one ends, or straight away if it already has.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="held-heading">
        <h2 id="held-heading" className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Users size={17} aria-hidden="true" /> Waiting to join
          {held.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{held.length}</span>}
        </h2>
        <p className="text-sm text-slate-500">
          These people signed up while your subscription was inactive or full. They will be added
          automatically as soon as you renew or upgrade.
        </p>
        {/* No approve buttons, deliberately: the only way in is a plan with room for them. */}
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Joining as</th>
                <th className="px-4 py-2.5">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!loading && !held.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nobody is waiting.</td></tr>}
              {!loading && held.map((person) => (
                <tr key={person.id}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{person.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="block">{person.email}</span>
                    {person.phone && <span className="block text-xs text-slate-500">{person.phone}</span>}
                  </td>
                  <td className="px-4 py-2.5">{enumTitle(person.type)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{formatBillingDate(person.created_at || person.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-base font-semibold text-slate-800">Payment history</h2>
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Reference</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
              {!loading && !payments.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No payments yet.</td></tr>}
              {!loading && payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap px-4 py-2.5">{formatBillingDate(payment.paid_at || payment.createdAt || payment.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {planName(payment.plan_code)}
                    <span className="block text-xs text-slate-500">{INTERVAL_LABELS[payment.billing_interval] || ''}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                    {payment.period_start ? `${formatBillingDate(payment.period_start)} – ${formatBillingDate(payment.period_end)}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">{formatPlanMoney(payment.amount, payment.currency)}</td>
                  <td className="px-4 py-2.5">{PROVIDER_LABEL[payment.provider] || enumTitle(payment.provider)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{payment.reference || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYMENT_STATUS_STYLE[payment.status] || 'bg-slate-100 text-slate-600'}`}>
                      {enumTitle(payment.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
