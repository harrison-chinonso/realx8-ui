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

const TABS = ['Plans', 'Investments', 'Categories', 'Periods'];
const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500';
const emptyPlanForm = () => ({
  name: '',
  category_id: '',
  period_id: '',
  min_amount: '',
  max_amount: '',
  return_rate: '',
  status: 'active',
});
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editingPlan ? 'Edit Investment Plan' : 'Create Investment Plan'}</h2>
              <p className="text-sm text-slate-500">Configure plan details and availability.</p>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  value={planForm.name}
                  onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
                  className={INPUT_CLASS}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Period</label>
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Min Amount</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Max Amount</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Return Rate (%)</label>
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
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

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closePlanModal}>Cancel</Button>
                <Button type="submit">{saving ? 'Saving…' : editingPlan ? 'Save Changes' : 'Create Plan'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvestmentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create Investment</h2>
              <p className="text-sm text-slate-500">Assign a user to an investment plan.</p>
            </div>

            <form onSubmit={handleCreateInvestment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">User ID</label>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Plan</label>
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create Payout</h2>
              <p className="text-sm text-slate-500">Record a payout for investment #{payoutFor.id}.</p>
            </div>

            <form onSubmit={handleCreatePayout} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payout Amount</label>
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
            <span className="text-sm font-medium text-slate-700">Notes</span>
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
