import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPropertyInstallmentPlans } from '../../api/propertyApi';
import { assignPlanToUnit, unassignPlanFromUnit } from '../../api/financeApi';
import { usePermission } from '../../hooks/usePermission';
import { useCurrency } from '../../context/useAppearance';
import Badge from '../common/Badge';

const getData = (response) => response?.data ?? response ?? null;

/** How a plan's terms read in the matrix header. */
const describeTerms = (plan) => {
  const bits = [`${plan.duration_months} month${plan.duration_months === 1 ? '' : 's'}`];
  if (plan.surcharge_type === 'percentage' && plan.surcharge_value) bits.push(`+${plan.surcharge_value}%`);
  if (plan.surcharge_type === 'flat' && plan.surcharge_value) bits.push(`+${Number(plan.surcharge_value).toLocaleString()}`);
  return bits.join(' · ');
};

/**
 * Which installment plans this property's units may be sold on.
 *
 * A matrix of units against plans, because assignment is PER UNIT — a half plot
 * and a full plot on the same estate routinely carry different sets, and a
 * property-level toggle could not express that.
 *
 * The plans themselves are defined in Finance; this screen only decides which
 * of them apply here. A unit with nothing ticked can only be bought outright.
 */
export default function PropertyInstallmentPlansPanel({ propertyId }) {
  const fmt = useCurrency();
  const canManage = usePermission('properties.installment-plans.manage');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Keyed `unitId:planId` so two cells can never share a spinner.
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getPropertyInstallmentPlans(propertyId)
      .then((response) => { setData(getData(response)); setError(''); })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load the installment plans.'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (unit, plan, isAssigned) => {
    setBusy(`${unit.id}:${plan.id}`);
    setError('');
    try {
      if (isAssigned) await unassignPlanFromUnit(plan.id, unit.id);
      else await assignPlanToUnit(plan.id, unit.id);
      // Refetched rather than patched locally: the server is the authority on
      // what is assigned, and a failed write must not leave a ticked box.
      load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not change the assignment.');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading installment plans...</p>;

  const plans = data?.available_plans || [];
  const units = data?.units || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Allowable Installment Plans</h2>
        <p className="text-xs text-slate-500">
          Plans are set per unit, so different units of this property can offer different sets.
          A unit with no plans can only be purchased outright.
          {!canManage && ' You have read-only access to this.'}
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {!plans.length ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No installment plans have been created for this company yet, so every unit here is
          outright-purchase only.{' '}
          <Link to="/finance/installment-plans" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
            Create one in Finance
          </Link>
          .
        </p>
      ) : !units.length ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Add a unit configuration first — plans are assigned to units, not to the property.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          {/* The matrix can be wide; it scrolls in its own container. */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Unit</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 text-center font-semibold text-slate-600">
                      <div className="whitespace-nowrap">{plan.name}</div>
                      <div className="text-xs font-normal text-slate-500">{describeTerms(plan)}</div>
                      {/* Inactive plans stay visible: a unit may already be on
                          one, and hiding it would look like the assignment had
                          vanished. */}
                      {!plan.is_active && <div className="mt-1"><Badge value="inactive" /></div>}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit) => {
                  const assigned = new Set((unit.installment_plan_ids || []).map(Number));
                  return (
                    <tr key={unit.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{unit.name}</div>
                        <div className="text-xs text-slate-500">{fmt(unit.price || 0)}</div>
                      </td>
                      {plans.map((plan) => {
                        const isAssigned = assigned.has(Number(plan.id));
                        const cell = `${unit.id}:${plan.id}`;
                        return (
                          <td key={plan.id} className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              disabled={!canManage || busy === cell}
                              onChange={() => toggle(unit, plan, isAssigned)}
                              aria-label={`${plan.name} on ${unit.name}`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {assigned.size === 0
                          ? 'Outright only'
                          : `Outright + ${assigned.size} plan${assigned.size === 1 ? '' : 's'}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
