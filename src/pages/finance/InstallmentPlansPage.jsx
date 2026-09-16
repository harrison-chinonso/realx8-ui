import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listInstallmentPlans, createInstallmentPlan, updateInstallmentPlan, deleteInstallmentPlan,
  assignPlanToUnit, unassignPlanFromUnit,
} from '../../api/financeApi';
import { listProperties, getPropertyUnits } from '../../api/propertyApi';
import Table from '../../components/common/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/common/Badge';
import { useCurrency } from '../../context/useAppearance';
import FieldMark from '../../components/ui/FieldMark';

const getItems = (response) => response?.data ?? response ?? [];

const EMPTY_FORM = {
  name: '',
  duration_months: '',
  surcharge_type: 'none',
  surcharge_value: '',
  rounding_rule: 'none',
  grace_period_days: '0',
  default_fee_type: 'none',
  default_fee_value: '',
  default_fee_recurrence: 'once',
  is_active: true,
};

const ROUNDING_LABELS = {
  none: 'No rounding',
  nearest_100: 'Nearest 100',
  nearest_1000: 'Nearest 1,000',
  up_to_1000: 'Round up to 1,000',
};

const toForm = (plan) => ({
  name: plan?.name || '',
  duration_months: plan?.duration_months ?? '',
  surcharge_type: plan?.surcharge_type || 'none',
  surcharge_value: plan?.surcharge_type === 'none' ? '' : (plan?.surcharge_value ?? ''),
  rounding_rule: plan?.rounding_rule || 'none',
  grace_period_days: String(plan?.grace_period_days ?? 0),
  default_fee_type: plan?.default_fee_type || 'none',
  default_fee_value: plan?.default_fee_type === 'none' ? '' : (plan?.default_fee_value ?? ''),
  default_fee_recurrence: plan?.default_fee_recurrence || 'once',
  is_active: plan?.is_active !== false,
});

/** How a plan's surcharge reads in the list. */
const describeSurcharge = (plan, fmt) => {
  if (plan.surcharge_type === 'percentage') return `${Number(plan.surcharge_value)}%`;
  if (plan.surcharge_type === 'flat') return fmt(plan.surcharge_value);
  return 'None';
};

const describeFee = (plan, fmt) => {
  if (plan.default_fee_type === 'none') return 'None';
  const amount = plan.default_fee_type === 'percentage'
    ? `${Number(plan.default_fee_value)}%`
    : fmt(plan.default_fee_value);
  return `${amount}${plan.default_fee_recurrence === 'monthly' ? ' monthly' : ' once'}`;
};

/**
 * Installment plan configuration.
 *
 * Not the same thing as Payment Plans, which is the subscription price list —
 * these are the arrangements a buyer chooses between when purchasing a property
 * on installments: duration, surcharge, rounding, grace period and late fee.
 *
 * Two things worth knowing while editing here:
 *
 *   Editing a plan cannot restate an invoice already issued against it. The
 *   terms are copied onto each invoice at purchase, so a change here only
 *   affects what is offered from now on.
 *
 *   Assignment is per property UNIT, not per property — a full plot and a half
 *   plot on the same estate can carry completely different plan sets, which is
 *   the point of the Units column below.
 */
export default function InstallmentPlansPage() {
  const fmt = useCurrency();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [assigning, setAssigning] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    listInstallmentPlans({ limit: 100 })
      .then((response) => { setPlans(getItems(response)); setError(''); })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load installment plans.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditing(plan);
    setForm(toForm(plan));
    setFormError('');
    setShowForm(true);
  };

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      duration_months: Number(form.duration_months),
      surcharge_type: form.surcharge_type,
      surcharge_value: form.surcharge_type === 'none' ? 0 : Number(form.surcharge_value || 0),
      rounding_rule: form.rounding_rule,
      grace_period_days: Number(form.grace_period_days || 0),
      default_fee_type: form.default_fee_type,
      default_fee_value: form.default_fee_type === 'none' ? 0 : Number(form.default_fee_value || 0),
      default_fee_recurrence: form.default_fee_recurrence,
      is_active: form.is_active,
    };
    try {
      if (editing) await updateInstallmentPlan(editing.id, payload);
      else await createInstallmentPlan(payload);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan) => {
    if (!window.confirm(`Delete "${plan.name}"? Deactivate it instead if it has been sold against.`)) return;
    try {
      await deleteInstallmentPlan(plan.id);
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete the plan.');
    }
  };

  const valid = form.name.trim() && Number(form.duration_months) >= 1
    && (form.surcharge_type === 'none' || Number(form.surcharge_value) >= 0)
    && (form.default_fee_type === 'none' || Number(form.default_fee_value) >= 0);

  const columns = useMemo(() => [
    { key: 'name', label: 'Plan', render: (row) => (
      <div>
        <div className="font-medium text-slate-900">{row.name}</div>
        <div className="text-xs text-slate-500">
          {row.duration_months} month{row.duration_months === 1 ? '' : 's'}
        </div>
      </div>
    ) },
    { key: 'surcharge', label: 'Surcharge', render: (row) => describeSurcharge(row, fmt) },
    { key: 'rounding_rule', label: 'Rounding', render: (row) => ROUNDING_LABELS[row.rounding_rule] || row.rounding_rule },
    { key: 'grace_period_days', label: 'Grace', render: (row) => (
      Number(row.grace_period_days) > 0 ? `${row.grace_period_days} days` : 'None'
    ) },
    { key: 'fee', label: 'Late fee', render: (row) => describeFee(row, fmt) },
    { key: 'units', label: 'Units', render: (row) => (
      <Button type="button" variant="link" onClick={() => setAssigning(row)}>
        {(row.unitAssignments?.length ?? 0) === 0
          ? 'Assign to units'
          : `${row.unitAssignments.length} unit${row.unitAssignments.length === 1 ? '' : 's'}`}
      </Button>
    ) },
    { key: 'is_active', label: 'Status', render: (row) => (
      <Badge value={row.is_active === false ? 'inactive' : 'active'} />
    ) },
  ], [fmt]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Installment Plans</h1>
          <p className="text-sm text-slate-500">
            What buyers choose between when paying in installments. Assign each plan to the units
            it is offered on — a unit with no plan can only be bought outright.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>New plan</Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading plans...</p>
      ) : plans.length === 0 ? (
        <p className="rounded-xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          No installment plans yet. Until one is created and assigned to a unit, every property is
          outright-purchase only.
        </p>
      ) : (
        <Table
          columns={columns}
          rows={plans}
          renderActions={(row) => (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
              <Button type="button" variant="ghost" onClick={() => remove(row)}>Delete</Button>
            </div>
          )}
        />
      )}

      <Modal
        open={showForm}
        onClose={saving ? () => {} : () => setShowForm(false)}
        title={editing ? `Edit ${editing.name}` : 'New installment plan'}
        size="lg"
      >
        <div className="space-y-4">
          {editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">
              Invoices already issued on this plan keep the terms they were sold on. Changes here only
              affect new purchases.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Plan name" value={form.name} onChange={set('name')} placeholder="6-month plan" />
            <Input
              label="Duration (months)"
              type="number"
              min="1"
              step="1"
              value={form.duration_months}
              onChange={set('duration_months')}
              placeholder="6"
            />
          </div>

          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">Plan charge</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Type<FieldMark /></span>
                <Select value={form.surcharge_type} onChange={set('surcharge_type')}>
                  <option value="none">No charge</option>
                  <option value="percentage">Percentage of the purchase</option>
                  <option value="flat">Flat amount</option>
                </Select>
              </label>
              {form.surcharge_type !== 'none' && (
                <Input
                  label={form.surcharge_type === 'percentage' ? 'Percentage' : 'Amount'}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.surcharge_value}
                  onChange={set('surcharge_value')}
                  placeholder={form.surcharge_type === 'percentage' ? '2' : '150000'}
                />
              )}
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Rounding<FieldMark /></span>
              <Select value={form.rounding_rule} onChange={set('rounding_rule')}>
                {Object.entries(ROUNDING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <span className="text-xs text-slate-500">
                Applied to the total after the plan charge. Any remainder lands on the final installment,
                so the schedule always sums to the total exactly.
              </span>
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-medium text-slate-700">Missed payments</legend>
            <Input
              label="Grace period (days)"
              type="number"
              min="0"
              step="1"
              value={form.grace_period_days}
              onChange={set('grace_period_days')}
            />
            <p className="text-xs text-slate-500">
              Days after a due date before the installment is treated as overdue. The late fee is applied
              automatically the moment it elapses — no admin action.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Late fee<FieldMark /></span>
                <Select value={form.default_fee_type} onChange={set('default_fee_type')}>
                  <option value="none">No late fee</option>
                  <option value="percentage">Percentage of the amount outstanding</option>
                  <option value="flat">Flat amount</option>
                </Select>
              </label>
              {form.default_fee_type !== 'none' && (
                <Input
                  label={form.default_fee_type === 'percentage' ? 'Percentage' : 'Amount'}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.default_fee_value}
                  onChange={set('default_fee_value')}
                  placeholder={form.default_fee_type === 'percentage' ? '5' : '25000'}
                />
              )}
            </div>
            {form.default_fee_type !== 'none' && (
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Applies<FieldMark /></span>
                <Select value={form.default_fee_recurrence} onChange={set('default_fee_recurrence')}>
                  <option value="once">Once, when the grace period elapses</option>
                  <option value="monthly">Every 30 days while the installment is unpaid</option>
                </Select>
              </label>
            )}
          </fieldset>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
            <span className="text-sm text-slate-700">
              Offer this plan on new purchases
              <span className="block text-xs text-slate-500">
                Unchecking it hides the plan from buyers. Invoices already on it are unaffected.
              </span>
            </span>
          </label>

          {formError && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving || !valid}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create plan'}
            </Button>
          </div>
        </div>
      </Modal>

      {assigning && (
        <UnitAssignmentModal
          plan={assigning}
          onClose={() => setAssigning(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/**
 * Assigns one plan to individual property units.
 *
 * Per-unit rather than per-property because that is the requirement: a half
 * plot may offer 1, 2, 3 and 6-month plans while the full plot on the same
 * estate offers only 3.
 */
function UnitAssignmentModal({ plan, onClose, onChanged }) {
  const fmt = useCurrency();
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  // Assignments live on the plan, so they are tracked here and pushed up on close.
  const [assigned, setAssigned] = useState(
    () => new Set((plan.unitAssignments || []).map((a) => Number(a.property_unit_id))),
  );

  useEffect(() => {
    listProperties({ limit: 100 })
      .then((response) => setProperties(getItems(response)))
      .catch(() => setError('Could not load properties.'));
  }, []);

  useEffect(() => {
    if (!propertyId) { setUnits([]); return; }
    setLoadingUnits(true);
    getPropertyUnits(propertyId)
      .then((response) => setUnits(getItems(response)))
      .catch(() => setError('Could not load the units for that property.'))
      .finally(() => setLoadingUnits(false));
  }, [propertyId]);

  const toggle = async (unit) => {
    const isAssigned = assigned.has(Number(unit.id));
    setBusy(unit.id);
    setError('');
    try {
      if (isAssigned) {
        await unassignPlanFromUnit(plan.id, unit.id);
        setAssigned((current) => {
          const next = new Set(current);
          next.delete(Number(unit.id));
          return next;
        });
      } else {
        await assignPlanToUnit(plan.id, unit.id);
        setAssigned((current) => new Set(current).add(Number(unit.id)));
      }
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not change the assignment.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${plan.name} — assigned units`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Choose which property units offer this plan. {assigned.size === 0
            ? 'It is not offered anywhere yet.'
            : `Currently on ${assigned.size} unit${assigned.size === 1 ? '' : 's'}.`}
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Property<FieldMark /></span>
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Select a property...</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </Select>
        </label>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {loadingUnits ? (
          <p className="text-sm text-slate-500">Loading units...</p>
        ) : propertyId && units.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            This property has no unit configurations yet.
          </p>
        ) : (
          <div className="space-y-2">
            {units.map((unit) => {
              const isAssigned = assigned.has(Number(unit.id));
              return (
                <div
                  key={unit.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{unit.name}</div>
                    <div className="text-xs text-slate-500">
                      {fmt(unit.price || 0)}
                      {unit.size ? ` · ${Number(unit.size).toLocaleString()} ${unit.unit || 'sqm'}` : ''}
                      {' · '}{unit.quantity_available ?? unit.quantity} available
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isAssigned ? 'secondary' : 'primary'}
                    onClick={() => toggle(unit)}
                    disabled={busy === unit.id}
                  >
                    {busy === unit.id ? 'Saving…' : isAssigned ? 'Remove' : 'Assign'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
