import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  adminChangePlan, adminExtendTrial, adminListPlans, adminListSubscriptions, adminMarkPaid,
} from '../../api/billingApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/common/Modal';
import { enumTitle } from '../../utils/enumLabel';
import { plural } from '../../utils/plural';
import {
  INTERVAL_LABELS, STATUS_LABELS, STATUS_STYLE, formatBillingDate, formatPlanMoney,
} from '../../utils/billing';

/**
 * Platform admins: every company's subscription, and the three things that
 * cannot be done from the company's own billing page.
 *
 *   Mark paid     a bank transfer arrived. Paystack never saw it, so nothing
 *                 else would ever activate the plan or release the queue.
 *   Extend trial  a prospect needs longer to decide.
 *   Change plan   a negotiated deal, or putting right a wrong choice, without
 *                 charging anybody.
 *
 * Every one of them releases held sign-ups when the result has room, which is
 * why each says how many were let in.
 */
const STATUSES = [
  { value: '', label: 'All' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'grace', label: 'Grace' },
  { value: 'lapsed', label: 'Lapsed' },
  { value: 'none', label: 'None' },
];
const ACTIONS = [
  { value: 'paid', label: 'Mark paid' },
  { value: 'trial', label: 'Extend trial' },
  { value: 'plan', label: 'Change plan' },
];
const INTERVAL_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

const priceFor = (plans, code, interval) => {
  const plan = plans.find((p) => p.code === code);
  if (!plan) return '';
  return String(interval === 'annual' ? plan.annual_price : plan.monthly_price);
};

function ManageModal({ row, plans, onClose, onDone }) {
  const firstPlan = row?.plan_code || plans.find((p) => p.active !== false)?.code || '';
  const firstInterval = row?.interval || 'monthly';
  const [action, setAction] = useState('paid');
  const [form, setForm] = useState({
    plan_code: firstPlan,
    interval: firstInterval,
    amount: priceFor(plans, firstPlan, firstInterval),
    reference: '',
    note: '',
    days: '7',
    period_end: '',
  });
  // Once the amount is typed over it is theirs — a part payment or a
  // negotiated price must not be reset by changing the interval afterwards.
  const [amountEdited, setAmountEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => {
    const next = { ...f, ...patch };
    if (!amountEdited && ('plan_code' in patch || 'interval' in patch)) {
      next.amount = priceFor(plans, next.plan_code, next.interval);
    }
    return next;
  });

  const planOptions = plans.map((p) => ({
    value: p.code,
    label: `${p.name}${p.active === false ? ' (inactive)' : ''}`,
  }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    let request;
    if (action === 'paid') {
      if (!form.plan_code) { setError('Choose the plan that was paid for.'); return; }
      const amount = form.amount === '' ? undefined : Number(form.amount);
      if (amount !== undefined && !(amount >= 0)) { setError('Enter the amount received, or leave it blank for the plan price.'); return; }
      request = () => adminMarkPaid(row.company_id, {
        plan_code: form.plan_code,
        interval: form.interval,
        ...(amount !== undefined ? { amount } : {}),
        ...(form.reference.trim() ? { reference: form.reference.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      });
    } else if (action === 'trial') {
      const days = Number(form.days);
      if (!Number.isInteger(days) || days < 1 || days > 90) { setError('Extend by 1 to 90 days.'); return; }
      request = () => adminExtendTrial(row.company_id, days);
    } else {
      if (!form.plan_code) { setError('Choose a plan.'); return; }
      request = () => adminChangePlan(row.company_id, {
        plan_code: form.plan_code,
        interval: form.interval,
        ...(form.period_end ? { period_end: form.period_end } : {}),
      });
    }

    setSaving(true);
    try {
      const result = await request();
      onDone(result);
    } catch (err) {
      setError(err.userMessage || 'That did not work.');
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(row)} onClose={onClose} title={row ? row.company_name : ''} size="lg">
      {row && (
        <form onSubmit={submit} className="space-y-4 text-sm">
          <p className="text-slate-600">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status] || STATUS_STYLE.none}`}>
              {STATUS_LABELS[row.status] || enumTitle(row.status)}
            </span>
            {row.plan_name ? `${row.plan_name} · ${INTERVAL_LABELS[row.interval] || ''}` : 'No plan'}
            {row.ends_at && ` · ends ${formatBillingDate(row.ends_at)}`}
          </p>

          <div role="tablist" aria-label="Action" className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
            {ACTIONS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="tab"
                aria-selected={action === a.value}
                onClick={() => { setAction(a.value); setError(''); }}
                className={`min-h-0 rounded-md px-3 py-1.5 text-sm font-medium ${action === a.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {action === 'paid' && (
            <>
              <p className="text-slate-500">
                Records a payment made outside Paystack (usually a bank transfer), starts the paid
                period and lets in anyone waiting to join.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Plan" value={form.plan_code} onChange={(e) => set({ plan_code: e.target.value })} options={planOptions} />
                <Select label="Billing period" value={form.interval} onChange={(e) => set({ interval: e.target.value })} options={INTERVAL_OPTIONS} />
                <Input
                  label="Amount received (NGN)"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => { setAmountEdited(true); set({ amount: e.target.value.replace(/[^\d.]/g, '') }); }}
                />
                <Input label="Bank reference" value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="Optional" />
              </div>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Note</span>
                <textarea rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Optional — who paid, how it was checked" className="w-full rounded-lg border border-slate-200 px-3 py-2" />
              </label>
            </>
          )}

          {action === 'trial' && (
            <>
              <p className="text-slate-500">Adds days to the free trial. While on trial there is no user limit.</p>
              <Input label="Days to add (1–90)" type="number" min={1} max={90} value={form.days} onChange={(e) => set({ days: e.target.value })} className="w-40" />
            </>
          )}

          {action === 'plan' && (
            <>
              <p className="text-slate-500">
                Moves the company to another plan without taking a payment. Leave the end date blank to
                keep the current one.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Plan" value={form.plan_code} onChange={(e) => set({ plan_code: e.target.value })} options={planOptions} />
                <Select label="Billing period" value={form.interval} onChange={(e) => set({ interval: e.target.value })} options={INTERVAL_OPTIONS} />
                <Input label="Period ends (optional)" type="date" value={form.period_end} onChange={(e) => set({ period_end: e.target.value })} />
              </div>
            </>
          )}

          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : ACTIONS.find((a) => a.value === action).label}</Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function BillingSubscriptionsPage() {
  const [params, setParams] = useSearchParams();
  const filters = { status: params.get('status') || '', search: params.get('search') || '' };
  const [search, setSearch] = useState(filters.search);
  const [rows, setRows] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(null);

  const setFilter = (patch) => {
    const next = { ...filters, ...patch };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '')), { replace: true });
  };

  const load = () => {
    setLoading(true);
    adminListSubscriptions({ status: filters.status || undefined, search: filters.search || undefined })
      .then((res) => { setRows(res?.data || []); setEnabled(res?.enabled !== false); setError(''); })
      .catch((err) => setError(err.userMessage || 'Could not load subscriptions.'))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [params.toString()]);

  useEffect(() => {
    adminListPlans()
      .then((list) => setPlans([...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .catch(() => { /* the modal says there is nothing to choose */ });
  }, []);

  const done = (result) => {
    const released = result?.released?.length || 0;
    setNotice(`${open.company_name} updated.${released ? ` ${plural(released, 'waiting account was', 'waiting accounts were')} let in.` : ''}`);
    setOpen(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-500">Every company’s plan, when it ends, and who is waiting to join.</p>
        </div>
        <Link to="/superior/billing/plans" className="text-sm font-semibold text-primary hover:underline">Edit plans</Link>
      </div>

      {!enabled && (
        <Alert tone="warning">Billing is switched off on this server (BILLING_ENABLED). Plans can still be prepared.</Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
          {STATUSES.map((s) => (
            <button
              key={s.value || 'all'}
              type="button"
              role="tab"
              aria-selected={filters.status === s.value}
              onClick={() => setFilter({ status: s.value })}
              className={`min-h-0 rounded-md px-3 py-1.5 text-sm font-medium ${filters.status === s.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setFilter({ search: search.trim() }); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Company name or code" className="w-64" aria-label="Search companies" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </div>

      {notice && <Alert tone="success" role="status">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Ends</th>
              <th className="px-4 py-2.5">Users</th>
              <th className="px-4 py-2.5">Card</th>
              <th className="px-4 py-2.5"><span className="sr-only">Manage</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && !rows.length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No companies here.</td></tr>}
            {!loading && rows.map((r) => {
              // A count, or { used, limit } — read either, so the column does not
              // depend on which shape the server settles on.
              const usersObject = r.users && typeof r.users === 'object' ? r.users : null;
              const used = usersObject ? usersObject.used : r.users;
              const limit = usersObject ? usersObject.limit : plans.find((p) => p.code === r.plan_code)?.user_limit;
              return (
                <tr key={r.company_id}>
                  <td className="px-4 py-2.5">
                    <span className="block font-semibold text-slate-900">{r.company_name}</span>
                    <span className="block text-xs text-slate-500">
                      {r.company_code}{r.company_status && r.company_status !== 'active' ? ` · ${enumTitle(r.company_status)}` : ''}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status] || STATUS_STYLE.none}`}>
                      {STATUS_LABELS[r.status] || enumTitle(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'trialing' ? 'Free trial' : (r.plan_name || '—')}
                    {r.interval && r.status !== 'trialing' && <span className="block text-xs text-slate-500">{INTERVAL_LABELS[r.interval]}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {formatBillingDate(r.ends_at)}
                    {r.status === 'grace' && r.grace_ends_at && (
                      <span className="block text-xs text-amber-700">read-only from {formatBillingDate(r.grace_ends_at)}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {Number(used || 0).toLocaleString()}
                    {limit != null && r.status !== 'trialing' && <span className="text-slate-500"> / {Number(limit).toLocaleString()}</span>}
                    {r.held > 0 && <span className="block text-xs font-semibold text-amber-700">{r.held} waiting</span>}
                  </td>
                  <td className="px-4 py-2.5">{r.has_card ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button type="button" size="sm" variant="secondary" onClick={() => { setNotice(''); setOpen(r); }}>Manage</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plans.length > 0 && (
        <p className="text-xs text-slate-500">
          Current prices: {plans.filter((p) => p.active !== false).map((p) => `${p.name} ${formatPlanMoney(p.monthly_price, p.currency)}/month`).join(' · ')}
        </p>
      )}

      {/* Keyed by company so a second company opens with a fresh form. */}
      {open && <ManageModal key={open.company_id} row={open} plans={plans} onClose={() => setOpen(null)} onDone={done} />}
    </div>
  );
}
