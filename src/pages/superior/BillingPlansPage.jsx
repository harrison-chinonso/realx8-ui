import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { adminListPlans, adminUpdatePlan } from '../../api/billingApi';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { formatPlanMoney } from '../../utils/billing';

/**
 * Platform admins: the subscription plans companies choose from.
 *
 * Editable whether or not billing is switched on, so prices can be agreed and
 * entered before the first company is asked to pay. A price change applies to
 * the next checkout; nobody's current period is re-priced.
 *
 * Plans are edited, never created or deleted here — the codes are referenced
 * by every subscription and payment, and the set of three is a business
 * decision rather than a screen's. "Active" takes one off the price list
 * without breaking the companies already on it.
 */
const toDraft = (plan) => ({
  name: plan.name || '',
  description: plan.description || '',
  monthly_price: plan.monthly_price == null ? '' : String(plan.monthly_price),
  annual_price: plan.annual_price == null ? '' : String(plan.annual_price),
  user_limit: plan.user_limit == null ? '' : String(plan.user_limit),
  active: plan.active !== false,
});

const money = (value) => String(value).replace(/[^\d.]/g, '');

function PlanEditor({ plan, onSaved }) {
  const [draft, setDraft] = useState(() => toDraft(plan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (patch) => { setSaved(false); setDraft((d) => ({ ...d, ...patch })); };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const monthly = Number(draft.monthly_price);
    const annual = Number(draft.annual_price);
    if (!draft.name.trim()) { setError('Give the plan a name.'); return; }
    if (draft.monthly_price === '' || !(monthly >= 0)) { setError('Enter the monthly price.'); return; }
    if (draft.annual_price === '' || !(annual >= 0)) { setError('Enter the annual price.'); return; }
    // Blank is the meaningful value here: no limit at all.
    const limit = draft.user_limit.trim() === '' ? null : Number(draft.user_limit);
    if (limit !== null && (!Number.isInteger(limit) || limit < 1)) { setError('User limit must be a whole number, or blank for unlimited.'); return; }

    setSaving(true);
    try {
      const updated = await adminUpdatePlan(plan.code, {
        name: draft.name.trim(),
        description: draft.description.trim(),
        monthly_price: monthly,
        annual_price: annual,
        user_limit: limit,
        active: draft.active,
      });
      setSaved(true);
      onSaved(updated || { ...plan, ...draft, monthly_price: monthly, annual_price: annual, user_limit: limit });
    } catch (err) {
      setError(err.userMessage || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };

  const annualSaving = Number(draft.monthly_price) * 12 - Number(draft.annual_price);

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          {plan.name} <span className="font-mono text-xs font-normal text-slate-400">{plan.code}</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4" />
          Active — offered to companies
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Name" value={draft.name} onChange={(e) => set({ name: e.target.value })} required />
        <Input
          label="User limit"
          inputMode="numeric"
          value={draft.user_limit}
          onChange={(e) => set({ user_limit: e.target.value.replace(/\D/g, '') })}
          placeholder="Blank = unlimited"
        />
        <Input label={`Monthly price (${plan.currency || 'NGN'})`} inputMode="decimal" value={draft.monthly_price} onChange={(e) => set({ monthly_price: money(e.target.value) })} required />
        <Input label={`Annual price (${plan.currency || 'NGN'})`} inputMode="decimal" value={draft.annual_price} onChange={(e) => set({ annual_price: money(e.target.value) })} required />
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <textarea rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <p className="text-xs text-slate-500">
        {draft.monthly_price !== '' && draft.annual_price !== '' && (annualSaving > 0
          ? `Annual saves ${formatPlanMoney(annualSaving, plan.currency)} against twelve monthly payments.`
          : 'Annual is not cheaper than twelve monthly payments.')}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        {saved && <span className="text-sm text-emerald-700" role="status">Saved.</span>}
      </div>
    </form>
  );
}

export default function BillingPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminListPlans()
      .then((list) => setPlans([...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .catch((err) => setError(err.userMessage || 'Could not load the plans.'))
      .finally(() => setLoading(false));
  }, []);

  const replace = (updated) => setPlans((list) => list.map((p) => (p.code === updated.code ? { ...p, ...updated } : p)));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link to="/superior/billing" className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft size={14} aria-hidden="true" /> Subscriptions
        </Link>
        <h1 className="text-xl font-bold text-slate-800">Plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          What companies pay, and how many user accounts each plan allows. Every account counts —
          staff, realtors and clients. Changes apply from the next payment.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {!loading && !plans.length && !error && <p className="text-sm text-slate-500">No plans have been set up on the server.</p>}
      {plans.map((plan) => <PlanEditor key={plan.code} plan={plan} onSaved={replace} />)}
    </div>
  );
}
