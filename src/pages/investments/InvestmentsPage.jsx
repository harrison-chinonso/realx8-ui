import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '../../context/useAppearance';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import DetailsModal from '../../components/common/DetailsModal';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import ActionsMenu from '../../components/common/ActionsMenu';
import useAuthStore from '../../store/authStore';
import Select from '../../components/ui/Select';
import {
  activateInvestment,
  createInvestment,
  createInvestmentCategory,
  createInvestmentPayout,
  createInvestmentPeriod,
  createInvestmentPlan,
  deleteInvestment,
  deleteInvestmentCategory,
  deleteInvestmentPeriod,
  deleteInvestmentPlan,
  getInvestmentPayouts,
  listInvestmentCategories,
  listInvestmentPeriods,
  listInvestmentPlans,
  listInvestments,
  requestCashOut,
  updateInvestmentPlan,
} from '../../api/investmentApi';
import { listProperties } from '../../api/propertyApi';
import FieldMark from '../../components/ui/FieldMark';

const TABS = ['Plans', 'Investments', 'Categories', 'Periods'];
// Disabled inputs must LOOK disabled. The penalty amount is already
// switched off for 'No penalty' and 'Forfeit all return', but with no
// disabled styling it read as an ordinary empty box somebody had failed
// to fill in.
const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';
const emptyPlanForm = () => ({
  name: '',
  category_id: '',
  period_id: '',
  min_amount: '',
  max_amount: '',
  return_rate: '',
  status: 'active',
  /*
   * A rate alone is not an offer. 12% a year paid monthly and compounding is a
   * different sum from 12% paid once at maturity, and an investor cannot judge
   * an opportunity without all three. Defaults are the cautious reading:
   * simple, at maturity, no early exit.
   */
  payout_frequency: 'at_maturity',
  return_basis: 'simple',
  tenor_days: '',
  cap_amount: '',
  opens_at: '',
  closes_at: '',
  property_id: '',
  early_exit_allowed: false,
  lock_in_days: '',
  penalty_type: 'none',
  penalty_value: '',
});

/** What a company is actually offering, in the words an investor reads. */
const FREQUENCY_OPTIONS = [
  { value: 'at_maturity', label: 'Once, at maturity' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];
/*
 * Short labels, with the meaning underneath.
 *
 * "Simple — the return does not itself earn" needs 244px and the control is
 * 240px wide in a two-column row, so it was being cut mid-word. A select is not
 * a place for a sentence: the choice goes in the option, the explanation goes
 * in a line below where it has the full width to itself.
 */
const BASIS_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'compound', label: 'Compounding' },
];
const BASIS_HELP = {
  simple: 'The return is worked out on the original amount each period.',
  compound: 'Each period earns on the amount plus everything earned before it.',
};
/*
 * Same treatment as the basis options above, for the same measured reason: this
 * control sits in a three-column row and is 139px wide, and "A percentage of the
 * return earned" wants 209px. The name goes in the option; what it means goes in
 * the line underneath, which has the whole row to itself.
 */
const PENALTY_OPTIONS = [
  { value: 'none', label: 'No penalty' },
  { value: 'percentage_of_return', label: 'Percentage of return' },
  { value: 'flat_fee', label: 'Flat fee' },
  { value: 'forfeit_all_return', label: 'Forfeit all return' },
];
const PENALTY_HELP = {
  none: 'Leaving early costs the investor nothing.',
  percentage_of_return: 'A share of what they have earned, never of their capital.',
  flat_fee: 'A fixed charge, capped at what they have earned.',
  forfeit_all_return: 'They give up the return earned; their capital is returned in full.',
};
const emptyInvestmentForm = () => ({ user_id: '', plan_id: '', amount: '' });

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const todayValue = () => new Date().toISOString().slice(0, 10);
const getErrorMessage = (error, fallback) => error?.userMessage || fallback;

function CashOutBadge({ value }) {
  const key = String(value || 'not_requested').toLowerCase();
  const colors = {
    not_requested: 'bg-slate-100 text-slate-700',
    requested: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    paid: 'bg-blue-100 text-blue-700',
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[key] || 'bg-slate-100 text-slate-700'}`}>{value || 'not_requested'}</span>;
}

export default function InvestmentsPage() {
  const fmt = useCurrency();
  // Realtors/clients hold only investments.own.view — they may look at their own
  // investments but must not create, edit, pay out or delete anything.
  // Select the boolean, not the function: selecting hasPermission itself returns
  // a stable reference and would not re-render when permissions change.
  const canManage = useAuthStore((state) => state.hasPermission('investments.manage'));
  const [tab, setTab] = useState('Plans');
  const [plans, setPlans] = useState([]);
  const [planDetailRow, setPlanDetailRow] = useState(null);
  const [categories, setCategories] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [properties, setProperties] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [investmentDetailRow, setInvestmentDetailRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState(emptyPlanForm());

  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [investmentForm, setInvestmentForm] = useState(emptyInvestmentForm());

  const [payoutFor, setPayoutFor] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutHistory, setPayoutHistory] = useState([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);

  const [cashOutFor, setCashOutFor] = useState(null);
  const [cashOutNotes, setCashOutNotes] = useState('');

  const [newCatName, setNewCatName] = useState('');
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodDays, setNewPeriodDays] = useState('');

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [String(category.id), category])),
    [categories]
  );
  const periodMap = useMemo(
    () => Object.fromEntries(periods.map((period) => [String(period.id), period])),
    [periods]
  );
  const planMap = useMemo(
    () => Object.fromEntries(plans.map((plan) => [String(plan.id), plan])),
    [plans]
  );

  const loadAll = async () => {
    setLoading(true);
    setError('');

    try {
      const [plansResponse, categoriesResponse, periodsResponse, investmentsResponse] = await Promise.all([
        listInvestmentPlans(),
        listInvestmentCategories(),
        listInvestmentPeriods(),
        listInvestments(),
      ]);

      setPlans(normalizeList(plansResponse));
      setCategories(normalizeList(categoriesResponse));
      setPeriods(normalizeList(periodsResponse));
      setInvestments(normalizeList(investmentsResponse));

      /*
       * Properties are fetched apart from the four above, and a failure is
       * swallowed on purpose. Someone may administer investments without being
       * allowed to read the property register, and a 403 there should cost them
       * the optional picker below — not the whole page.
       */
      listProperties()
        .then((response) => setProperties(normalizeList(response)))
        .catch(() => setProperties([]));
    } catch (loadError) {
      console.error(loadError);
      setError(getErrorMessage(loadError, 'Failed to load investment data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const closePlanModal = (force = false) => {
    if (saving && !force) return;
    setShowPlanModal(false);
    setEditingPlan(null);
    setPlanForm(emptyPlanForm());
  };

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm());
    setShowPlanModal(true);
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name ?? '',
      category_id: String(plan.category_id ?? plan.category?.id ?? ''),
      period_id: String(plan.period_id ?? plan.period?.id ?? ''),
      min_amount: String(plan.min_amount ?? ''),
      max_amount: String(plan.max_amount ?? ''),
      return_rate: String(plan.return_rate ?? ''),
      status: plan.status ?? 'active',
      payout_frequency: plan.payout_frequency ?? 'at_maturity',
      return_basis: plan.return_basis ?? 'simple',
      tenor_days: String(plan.tenor_days ?? ''),
      cap_amount: plan.cap_minor ? String(Number(plan.cap_minor) / 100) : '',
      // Date inputs want yyyy-mm-dd and nothing else.
      opens_at: plan.opens_at ? String(plan.opens_at).slice(0, 10) : '',
      closes_at: plan.closes_at ? String(plan.closes_at).slice(0, 10) : '',
      property_id: String(plan.property_id ?? ''),
      early_exit_allowed: Boolean(plan.early_exit_allowed),
      lock_in_days: String(plan.lock_in_days ?? ''),
      penalty_type: plan.penalty_type ?? 'none',
      penalty_value: String(plan.penalty_value ?? ''),
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (event) => {
    event.preventDefault();
    if (!planForm.name.trim() || planForm.min_amount === '' || planForm.max_amount === '' || planForm.return_rate === '') return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        name: planForm.name.trim(),
        category_id: planForm.category_id || null,
        period_id: planForm.period_id || null,
        min_amount: Number(planForm.min_amount),
        max_amount: Number(planForm.max_amount),
        return_rate: Number(planForm.return_rate),
        status: planForm.status || 'active',

        // The terms the engine copies onto every subscription made against
        // this opportunity. Empty means "not set", not zero.
        payout_frequency: planForm.payout_frequency || 'at_maturity',
        return_basis: planForm.return_basis || 'simple',
        tenor_days: planForm.tenor_days === '' ? 0 : Number(planForm.tenor_days),
        cap_minor: planForm.cap_amount === '' ? 0 : Math.round(Number(planForm.cap_amount) * 100),
        opens_at: planForm.opens_at || null,
        closes_at: planForm.closes_at || null,
        property_id: planForm.property_id || null,
        early_exit_allowed: Boolean(planForm.early_exit_allowed),
        lock_in_days: planForm.lock_in_days === '' ? 0 : Number(planForm.lock_in_days),
        penalty_type: planForm.early_exit_allowed ? (planForm.penalty_type || 'none') : 'none',
        penalty_value: planForm.penalty_value === '' ? 0 : Number(planForm.penalty_value),
      };

      if (editingPlan) {
        await updateInvestmentPlan(editingPlan.id, payload);
      } else {
        await createInvestmentPlan(payload);
      }

      closePlanModal(true);
      await loadAll();
      setNotice(`Investment plan ${editingPlan ? 'updated' : 'created'} successfully.`);
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, `Failed to ${editingPlan ? 'update' : 'create'} investment plan.`));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (plan) => {
    if (!window.confirm(`Delete plan "${plan.name}"?`)) return;

    setError('');
    try {
      await deleteInvestmentPlan(plan.id);
      await loadAll();
      setNotice('Investment plan deleted successfully.');
    } catch (deleteError) {
      console.error(deleteError);
      setError(getErrorMessage(deleteError, 'Failed to delete investment plan.'));
    }
  };

  const closeInvestmentModal = (force = false) => {
    if (saving && !force) return;
    setShowInvestmentModal(false);
    setInvestmentForm(emptyInvestmentForm());
  };

  const handleCreateInvestment = async (event) => {
    event.preventDefault();
    if (investmentForm.user_id === '' || !investmentForm.plan_id || investmentForm.amount === '') return;

    setSaving(true);
    setError('');

    try {
      await createInvestment({
        user_id: Number(investmentForm.user_id),
        plan_id: Number(investmentForm.plan_id),
        amount: Number(investmentForm.amount),
      });
      closeInvestmentModal(true);
      await loadAll();
      setNotice('Investment created successfully.');
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Failed to create investment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleActivateInvestment = async (investment) => {
    setSaving(true);
    setError('');

    try {
      await activateInvestment(investment.id);
      await loadAll();
      setNotice(`Investment #${investment.id} activated successfully.`);
    } catch (activateError) {
      console.error(activateError);
      setError(getErrorMessage(activateError, 'Failed to activate investment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInvestment = async (investment) => {
    if (!window.confirm(`Delete investment #${investment.id}?`)) return;

    setError('');
    try {
      await deleteInvestment(investment.id);
      await loadAll();
      setNotice(`Investment #${investment.id} deleted successfully.`);
    } catch (deleteError) {
      console.error(deleteError);
      setError(getErrorMessage(deleteError, 'Failed to delete investment.'));
    }
  };

  const openPayoutModal = async (investment) => {
    setPayoutFor(investment);
    setPayoutAmount('');
    setPayoutHistory([]);
    setLoadingPayouts(true);

    try {
      const response = await getInvestmentPayouts(investment.id);
      setPayoutHistory(normalizeList(response));
    } catch (payoutError) {
      console.error(payoutError);
      setPayoutHistory([]);
      setError(getErrorMessage(payoutError, 'Failed to load payout history.'));
    } finally {
      setLoadingPayouts(false);
    }
  };

  const closePayoutModal = (force = false) => {
    if (saving && !force) return;
    setPayoutFor(null);
    setPayoutAmount('');
    setPayoutHistory([]);
  };

  const handleCreatePayout = async (event) => {
    event.preventDefault();
    if (!payoutFor || payoutAmount === '') return;

    setSaving(true);
    setError('');

    try {
      await createInvestmentPayout(payoutFor.id, {
        amount: Number(payoutAmount),
        payout_date: todayValue(),
      });
      closePayoutModal(true);
      await loadAll();
      setNotice(`Payout recorded for investment #${payoutFor.id}.`);
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Failed to record payout.'));
    } finally {
      setSaving(false);
    }
  };

  const closeCashOutModal = (force = false) => {
    if (saving && !force) return;
    setCashOutFor(null);
    setCashOutNotes('');
  };

  const handleRequestCashOut = async (event) => {
    event.preventDefault();
    if (!cashOutFor) return;

    setSaving(true);
    setError('');

    try {
      await requestCashOut(cashOutFor.id, { notes: cashOutNotes.trim() || null });
      closeCashOutModal(true);
      await loadAll();
      setNotice(`Cash-out requested for investment #${cashOutFor.id}.`);
    } catch (requestError) {
      console.error(requestError);
      setError(getErrorMessage(requestError, 'Failed to request cash-out.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;

    setSaving(true);
    setError('');
    try {
      await createInvestmentCategory({ name: newCatName.trim() });
      setNewCatName('');
      await loadAll();
      setNotice('Category added successfully.');
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Failed to create category.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    setError('');
    try {
      await deleteInvestmentCategory(category.id);
      await loadAll();
      setNotice('Category deleted successfully.');
    } catch (deleteError) {
      console.error(deleteError);
      setError(getErrorMessage(deleteError, 'Failed to delete category.'));
    }
  };

  const handleAddPeriod = async () => {
    if (!newPeriodName.trim() || newPeriodDays === '') return;

    setSaving(true);
    setError('');
    try {
      await createInvestmentPeriod({
        name: newPeriodName.trim(),
        days: Number(newPeriodDays),
      });
      setNewPeriodName('');
      setNewPeriodDays('');
      await loadAll();
      setNotice('Period added successfully.');
    } catch (submitError) {
      console.error(submitError);
      setError(getErrorMessage(submitError, 'Failed to create period.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (period) => {
    if (!window.confirm(`Delete period "${period.name}"?`)) return;

    setError('');
    try {
      await deleteInvestmentPeriod(period.id);
      await loadAll();
      setNotice('Period deleted successfully.');
    } catch (deleteError) {
      console.error(deleteError);
      setError(getErrorMessage(deleteError, 'Failed to delete period.'));
    }
  };

  const planColumns = useMemo(
    () => [
      { key: 'name', label: 'Name', render: (plan) => plan.name || '—' },
      {
        key: 'category',
        label: 'Category',
        render: (plan) => categoryMap[String(plan.category_id ?? plan.category?.id ?? '')]?.name ?? plan.category?.name ?? '—',
      },
      {
        key: 'period',
        label: 'Period',
        render: (plan) => {
          const period = periodMap[String(plan.period_id ?? plan.period?.id ?? '')] ?? plan.period;
          if (!period) return '—';
          if (period.days) return `${period.days} days`;
          return period.name || '—';
        },
      },
      { key: 'return_rate', label: 'Return Rate (%)', render: (plan) => plan.return_rate ?? '—' },
      { key: 'status', label: 'Status', render: (plan) => <Badge value={plan.status || 'inactive'} /> },
    ],
    [categoryMap, fmt, periodMap]
  );

  const planDetailFields = useMemo(
    () => [
      { label: 'Name', key: 'name' },
      {
        label: 'Category',
        render: (plan) => categoryMap[String(plan.category_id ?? plan.category?.id ?? '')]?.name ?? plan.category?.name ?? '—',
      },
      {
        label: 'Period',
        render: (plan) => {
          const period = periodMap[String(plan.period_id ?? plan.period?.id ?? '')] ?? plan.period;
          if (!period) return '—';
          if (period.days) return `${period.days} days`;
          return period.name || '—';
        },
      },
      { label: 'Min Amount', render: (plan) => fmt(plan.min_amount) },
      { label: 'Max Amount', render: (plan) => fmt(plan.max_amount) },
      { label: 'Return Rate', render: (plan) => (plan.return_rate != null ? `${plan.return_rate}%` : '—') },
      { label: 'Status', render: (plan) => <Badge value={plan.status || 'inactive'} /> },
    ],
    [categoryMap, fmt, periodMap]
  );

  const investmentColumns = useMemo(
    () => [
      {
        key: 'plan_name',
        label: 'Plan Name',
        render: (investment) => {
          const plan = planMap[String(investment.plan_id ?? investment.plan?.id ?? '')] ?? investment.plan;
          return plan?.name || investment.plan_name || '—';
        },
      },
      { key: 'amount', label: 'Amount', render: (investment) => fmt(investment.amount) },
      { key: 'status', label: 'Status', render: (investment) => <Badge value={investment.status || 'pending'} /> },
      {
        key: 'start_date',
        label: 'Start Date',
        render: (investment) => formatDate(investment.start_date ?? investment.started_at ?? investment.created_at),
      },
      {
        key: 'end_date',
        label: 'End Date',
        render: (investment) => formatDate(investment.end_date ?? investment.maturity_date ?? investment.ends_at),
      },
    ],
    [fmt, planMap]
  );

  const investmentDetailFields = useMemo(
    () => [
      { label: 'Investment ID', render: (investment) => investment.id ?? '—' },
      { label: 'User ID', render: (investment) => investment.user_id ?? investment.user?.id ?? '—' },
      {
        label: 'Plan Name',
        render: (investment) => {
          const plan = planMap[String(investment.plan_id ?? investment.plan?.id ?? '')] ?? investment.plan;
          return plan?.name || investment.plan_name || '—';
        },
      },
      { label: 'Amount', render: (investment) => fmt(investment.amount) },
      { label: 'Status', render: (investment) => <Badge value={investment.status || 'pending'} /> },
      { label: 'Cash-Out Status', render: (investment) => <CashOutBadge value={investment.cash_out_status} /> },
      {
        label: 'Start Date',
        render: (investment) => formatDate(investment.start_date ?? investment.started_at ?? investment.created_at),
      },
      {
        label: 'End Date',
        render: (investment) => formatDate(investment.end_date ?? investment.maturity_date ?? investment.ends_at),
      },
    ],
    [fmt, planMap]
  );

  const categoryColumns = useMemo(
    () => [{ key: 'name', label: 'Name', render: (category) => category.name || '—' }],
    []
  );

  const periodColumns = useMemo(
    () => [
      { key: 'name', label: 'Name', render: (period) => period.name || '—' },
      { key: 'days', label: 'Days', render: (period) => period.days ?? '—' },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Investments</h1>
          <p className="text-sm text-slate-500">Manage plans, investments, categories, and payout operations.</p>
        </div>
        {canManage && tab === 'Plans' && <Button type="button" onClick={openCreatePlan}>+ Create Plan</Button>}
        {canManage && tab === 'Investments' && <Button type="button" onClick={() => setShowInvestmentModal(true)}>+ Create Investment</Button>}
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {(canManage ? TABS : TABS.filter((t) => t === 'Plans' || t === 'Investments')).map((item) => (
          <Button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            variant={tab === item ? 'primary' : 'ghost'}
            size="sm"
          >
            {item}
          </Button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Loading investment data...</div>
      ) : (
        <>
          {tab === 'Plans' && (
            <Table
              columns={planColumns}
              data={plans}
              renderActions={(plan) => (
                <div className="flex items-center justify-end gap-3">
                  {canManage && <Button type="button" onClick={() => openEditPlan(plan)} variant="primary" size="sm">Edit</Button>}
                  <ActionsMenu
                    items={[
                      { label: '👁 View Details', onClick: () => setPlanDetailRow(plan) },
                      ...(canManage ? [{ label: '🗑 Delete', variant: 'danger', onClick: () => handleDeletePlan(plan) }] : []),
                    ]}
                  />
                </div>
              )}
            />
          )}

          {tab === 'Investments' && (
            <Table
              columns={investmentColumns}
              data={investments}
              renderActions={(investment) => (
                <div className="flex items-center justify-end gap-2">
                  {canManage && <Button type="button" onClick={() => openPayoutModal(investment)} variant="primary" size="sm">Payout</Button>}
                  <ActionsMenu
                    items={[
                      { label: '👁 View Details', onClick: () => setInvestmentDetailRow(investment) },
                      ...(canManage && String(investment.status || '').toLowerCase() === 'pending' ? [{
                        label: '✅ Activate',
                        onClick: () => handleActivateInvestment(investment),
                      }] : []),
                      ...(canManage && String(investment.status || '').toLowerCase() === 'active' && String(investment.cash_out_status || '').toLowerCase() === 'not_requested' ? [{
                        label: '💰 Request Cash-Out',
                        onClick: () => setCashOutFor(investment),
                      }] : []),
                      ...(canManage ? [{ label: '🗑 Delete', variant: 'danger', onClick: () => handleDeleteInvestment(investment) }] : []),
                    ]}
                  />
                </div>
              )}
            />
          )}

          {tab === 'Categories' && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <input
                  value={newCatName}
                  onChange={(event) => setNewCatName(event.target.value)}
                  placeholder="Category name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500"
                />
                <Button type="button" onClick={handleAddCategory}>+ Add</Button>
              </div>
              <Table
                columns={categoryColumns}
                data={categories}
                renderActions={(category) => (
                  canManage ? <Button type="button" onClick={() => handleDeleteCategory(category)} variant="danger" size="sm">Delete</Button> : null
                )}
              />
            </div>
          )}

          {tab === 'Periods' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 mb-4 sm:flex-row">
                <input
                  value={newPeriodName}
                  onChange={(event) => setNewPeriodName(event.target.value)}
                  placeholder="Period name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  min="1"
                  value={newPeriodDays}
                  onChange={(event) => setNewPeriodDays(event.target.value)}
                  placeholder="Days"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-40 focus:outline-none focus:border-blue-500"
                />
                <Button type="button" onClick={handleAddPeriod}>+ Add</Button>
              </div>
              <Table
                columns={periodColumns}
                data={periods}
                renderActions={(period) => (
                  canManage ? <Button type="button" onClick={() => handleDeletePeriod(period)} variant="danger" size="sm">Delete</Button> : null
                )}
              />
            </div>
          )}
        </>
      )}

      <DetailsModal
        open={!!planDetailRow}
        onClose={() => setPlanDetailRow(null)}
        title={planDetailRow?.name || 'Plan Details'}
        record={planDetailRow}
        fields={planDetailFields}
      />

      <DetailsModal
        open={!!investmentDetailRow}
        onClose={() => setInvestmentDetailRow(null)}
        title={investmentDetailRow?.plan_name || planMap[String(investmentDetailRow?.plan_id ?? investmentDetailRow?.plan?.id ?? '')]?.name || 'Investment Details'}
        record={investmentDetailRow}
        fields={investmentDetailFields}
      />

      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {/*
            Wider, capped, and scrollable — the same shell as Modal.jsx.

            This was a 448px box centred in the viewport with no way to scroll.
            The terms section made it 1030px tall, so on a 1280x720 laptop it
            overflowed both edges and the save button sat below the fold with
            nothing to scroll — the form could be filled in and not submitted.
            672px also gives the two-column rows room: "Simple — the return does
            not itself earn" was being cut to half its length.
          */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editingPlan ? 'Edit Investment Plan' : 'Create Investment Plan'}</h2>
              <p className="text-sm text-slate-500">Configure plan details and availability.</p>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name<FieldMark required /></label>
                <input
                  value={planForm.name}
                  onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category<FieldMark /></label>
                <Select
                  value={planForm.category_id}
                  onChange={(event) => setPlanForm((current) => ({ ...current, category_id: event.target.value }))}
                  className={INPUT_CLASS}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Period<FieldMark /></label>
                <Select
                  value={planForm.period_id}
                  onChange={(event) => setPlanForm((current) => ({ ...current, period_id: event.target.value }))}
                  className={INPUT_CLASS}
                >
                  <option value="">Select period</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>{period.days ? `${period.days} days` : period.name}</option>
                  ))}
                </Select>
              </div>

              {/*
                What the money is actually for.

                `property_id` was already being read on the way in and sent on
                the way out, and the server stamps it onto the invoice every
                subscriber is billed with — but nothing on this form could ever
                set it, so it left as null on every plan ever created here.
                Optional, because an opportunity need not be tied to one
                development, and hidden entirely when the register cannot be read.
              */}
              {properties.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Property<FieldMark /></label>
                  <Select
                    value={planForm.property_id}
                    onChange={(event) => setPlanForm((current) => ({ ...current, property_id: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="">Not tied to a property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>{property.name || property.title}</option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-slate-400">The development this opportunity raises money for.</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Min Amount<FieldMark required /></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.min_amount}
                    onChange={(event) => setPlanForm((current) => ({ ...current, min_amount: event.target.value }))}
                    className={INPUT_CLASS}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Max Amount<FieldMark required /></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.max_amount}
                    onChange={(event) => setPlanForm((current) => ({ ...current, max_amount: event.target.value }))}
                    className={INPUT_CLASS}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Return Rate (%)<FieldMark required /></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.return_rate}
                    onChange={(event) => setPlanForm((current) => ({ ...current, return_rate: event.target.value }))}
                    className={INPUT_CLASS}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status<FieldMark /></label>
                  <Select
                    value={planForm.status}
                    onChange={(event) => setPlanForm((current) => ({ ...current, status: event.target.value }))}
                    className={INPUT_CLASS}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
              </div>

              {/*
                ── The terms, which are the offer ──────────────────────────
                A rate on its own is not one: the same 12% paid monthly and
                compounding is a different sum from 12% paid once at maturity.
                Everything below is copied onto each subscription at the moment
                it is made, and cannot be changed for investors already in.
              */}
              <div className="space-y-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terms</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Return is paid<FieldMark /></label>
                    <Select
                      value={planForm.payout_frequency}
                      onChange={(event) => setPlanForm((current) => ({ ...current, payout_frequency: event.target.value }))}
                      className={INPUT_CLASS}
                      options={FREQUENCY_OPTIONS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Basis<FieldMark /></label>
                    <Select
                      value={planForm.return_basis}
                      onChange={(event) => setPlanForm((current) => ({ ...current, return_basis: event.target.value }))}
                      className={INPUT_CLASS}
                      options={BASIS_OPTIONS}
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-slate-400">
                  {BASIS_HELP[planForm.return_basis] || BASIS_HELP.simple}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Committed for (days)<FieldMark /></label>
                    <input
                      type="number" min="0"
                      value={planForm.tenor_days}
                      onChange={(event) => setPlanForm((current) => ({ ...current, tenor_days: event.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="365"
                    />
                    <p className="mt-1 text-xs text-slate-400">The tenor runs from the day the investor’s money arrives.</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Raise cap<FieldMark /></label>
                    <input
                      type="number" min="0" step="0.01"
                      value={planForm.cap_amount}
                      onChange={(event) => setPlanForm((current) => ({ ...current, cap_amount: event.target.value }))}
                      className={INPUT_CLASS}
                      placeholder="Leave blank for no ceiling"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Opens<FieldMark /></label>
                    <input
                      type="date"
                      value={planForm.opens_at}
                      onChange={(event) => setPlanForm((current) => ({ ...current, opens_at: event.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Closes<FieldMark /></label>
                    <input
                      type="date"
                      value={planForm.closes_at}
                      onChange={(event) => setPlanForm((current) => ({ ...current, closes_at: event.target.value }))}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                {/* The window is not the tenor: an opportunity can be open for
                    two weeks and run for two years. It describes both dates, so
                    it sits under the pair rather than under the second one. */}
                <p className="-mt-2 text-xs text-slate-400">
                  When the opportunity accepts money — not how long it runs.
                </p>

                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={planForm.early_exit_allowed}
                    onChange={(event) => setPlanForm((current) => ({ ...current, early_exit_allowed: event.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    Allow investors to withdraw before maturity
                    <span className="block text-xs text-slate-400">
                      Off by default. Money raised against a development is normally committed for the full term.
                    </span>
                  </span>
                </label>

                {planForm.early_exit_allowed && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Lock-in (days)<FieldMark /></label>
                      <input
                        type="number" min="0"
                        value={planForm.lock_in_days}
                        onChange={(event) => setPlanForm((current) => ({ ...current, lock_in_days: event.target.value }))}
                        className={INPUT_CLASS}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Penalty<FieldMark /></label>
                      <Select
                        value={planForm.penalty_type}
                        onChange={(event) => setPlanForm((current) => ({ ...current, penalty_type: event.target.value }))}
                        className={INPUT_CLASS}
                        options={PENALTY_OPTIONS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        {planForm.penalty_type === 'percentage_of_return' ? 'Percentage' : 'Amount'}<FieldMark />
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={planForm.penalty_value}
                        onChange={(event) => setPlanForm((current) => ({ ...current, penalty_value: event.target.value }))}
                        className={INPUT_CLASS}
                        disabled={['none', 'forfeit_all_return'].includes(planForm.penalty_type)}
                      />
                    </div>
                  </div>
                )}
                {/*
                  What the chosen penalty actually does, in full width. A penalty
                  can take the return but never the capital — the server caps it,
                  and saying so here stops anybody configuring a fee larger than
                  the return and expecting it to be collected.
                */}
                {planForm.early_exit_allowed && (
                  <p className="-mt-2 text-xs text-slate-400">
                    {PENALTY_HELP[planForm.penalty_type] || PENALTY_HELP.none}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closePlanModal}>Cancel</Button>
                <Button type="submit">{saving ? 'Saving…' : editingPlan ? 'Save Changes' : 'Create Plan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvestmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create Investment</h2>
              <p className="text-sm text-slate-500">Assign a user to an investment plan.</p>
            </div>

            <form onSubmit={handleCreateInvestment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">User ID<FieldMark required /></label>
                <input
                  type="number"
                  min="1"
                  value={investmentForm.user_id}
                  onChange={(event) => setInvestmentForm((current) => ({ ...current, user_id: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plan<FieldMark required /></label>
                <Select
                  value={investmentForm.plan_id}
                  onChange={(event) => setInvestmentForm((current) => ({ ...current, plan_id: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                >
                  <option value="">Select plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount<FieldMark required /></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={investmentForm.amount}
                  onChange={(event) => setInvestmentForm((current) => ({ ...current, amount: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeInvestmentModal}>Cancel</Button>
                <Button type="submit">{saving ? 'Saving…' : 'Create Investment'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payoutFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create Payout</h2>
              <p className="text-sm text-slate-500">Record a payout for investment #{payoutFor.id}.</p>
            </div>

            <form onSubmit={handleCreatePayout} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payout Amount<FieldMark required /></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(event) => setPayoutAmount(event.target.value)}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-medium text-slate-700">Recent payouts</div>
                {loadingPayouts ? (
                  <div className="text-sm text-slate-500">Loading payouts...</div>
                ) : payoutHistory.length ? (
                  <div className="space-y-2">
                    {payoutHistory.slice(0, 5).map((payout, index) => (
                      <div key={payout.id ?? index} className="flex items-center justify-between text-sm text-slate-600">
                        <span>{formatDate(payout.payout_date ?? payout.created_at)}</span>
                        <span className="font-medium text-slate-900">{fmt(payout.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No payouts recorded yet.</div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closePayoutModal}>Cancel</Button>
                <Button type="submit">{saving ? 'Saving…' : 'Record Payout'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal open={Boolean(cashOutFor)} onClose={closeCashOutModal} title="Request Cash-Out" size="sm">
        <form onSubmit={handleRequestCashOut} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">Notes<FieldMark /></span>
            <textarea
              rows={4}
              value={cashOutNotes}
              onChange={(event) => setCashOutNotes(event.target.value)}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="Optional cash-out notes"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeCashOutModal} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="warning" disabled={saving}>{saving ? 'Submitting…' : 'Request Cash-Out'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
