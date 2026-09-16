import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { checkoutProperty } from '../../api/propertyApi';
import { getUnitPurchaseOptions } from '../../api/financeApi';
import { useCurrency } from '../../context/useAppearance';
import FieldMark from '../ui/FieldMark';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const availableOf = (unit) => Number(unit?.quantity_available ?? unit?.quantity ?? 0);
const getData = (response) => response?.data ?? response ?? null;

/** How a plan's default fee reads to a buyer. */
const describeFee = (terms) => {
  if (!terms || terms.default_fee_type === 'none') return 'No late fee';
  const amount = terms.default_fee_type === 'percentage'
    ? `${terms.default_fee_value}% of the outstanding amount`
    : `a fixed ${Number(terms.default_fee_value).toLocaleString()}`;
  const recurrence = terms.default_fee_recurrence === 'monthly' ? ', repeating monthly while unpaid' : '';
  return `Late fee ${amount}${recurrence}`;
};

const describeGrace = (terms) => (Number(terms?.grace_period_days) > 0
  ? `${terms.grace_period_days}-day grace period after each due date`
  : 'No grace period — a late fee applies the day after a missed due date');

/**
 * Purchase configuration: unit, quantity, payment type, and — for installments
 * — the plan, chosen from a list of FULLY PRICED options.
 *
 * Every amount shown comes from the server's own pricing code
 * (/installment-plans/units/:id/options), including the plan surcharge stated
 * as its own line. The buyer never has to compute anything, and never discovers
 * the surcharge later folded into a total. Nothing here is trusted at checkout:
 * the server reprices from the same function and its figure is the one stored.
 *
 * Two ways out, and they create an IDENTICAL invoice — the only difference is
 * where the buyer lands afterwards:
 *
 *   Create Invoice     the invoice is raised and the buyer goes back to their
 *                      list to pay it whenever they like.
 *   Proceed to Payment straight to the payment page, no return trip.
 */
export default function PurchaseModal({ open, property, onClose, onInvoice }) {
  const fmt = useCurrency();
  const units = useMemo(() => (property?.units || []).filter((u) => availableOf(u) > 0), [property]);

  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentType, setPaymentType] = useState('outright');
  const [planId, setPlanId] = useState('');
  const [options, setOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  // Which button is in flight, so only that one shows a spinner.
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const unit = units.find((u) => String(u.id) === String(unitId)) || null;
  const available = unit ? availableOf(unit) : 0;
  const parsedQty = Number(quantity);
  const qtyValid = Number.isInteger(parsedQty) && parsedQty >= 1 && (!unit || parsedQty <= available);

  useEffect(() => {
    if (!open) return;
    setUnitId(units.length === 1 ? String(units[0].id) : '');
    setQuantity('1');
    setPaymentType('outright');
    setPlanId('');
    setOptions(null);
    setError('');
    setOptionsError('');
  }, [open, units.length]);

  /**
   * Reprice whenever the unit or quantity changes.
   *
   * The plan totals depend on quantity — a percentage surcharge is applied to
   * the whole purchase, so 3 units is not 3x one unit's monthly figure — which
   * is why this refetches rather than scaling what it already has.
   */
  useEffect(() => {
    if (!open || !unit || !qtyValid) { setOptions(null); return undefined; }
    let cancelled = false;
    setLoadingOptions(true);
    setOptionsError('');
    getUnitPurchaseOptions(unit.id, parsedQty)
      .then((response) => {
        if (cancelled) return;
        const data = getData(response);
        setOptions(data);
        // Drop a selected plan that is not offered at this quantity.
        setPlanId((current) => (
          (data?.installment_plans || []).some((p) => String(p.installment_plan_id) === String(current))
            ? current : ''
        ));
      })
      .catch((err) => {
        if (cancelled) return;
        setOptions(null);
        setOptionsError(err?.response?.data?.message || 'Could not load the payment options for this unit.');
      })
      .finally(() => { if (!cancelled) setLoadingOptions(false); });
    return () => { cancelled = true; };
  }, [open, unit?.id, parsedQty, qtyValid]);

  const plans = options?.installment_plans || [];
  const selectedPlan = plans.find((p) => String(p.installment_plan_id) === String(planId)) || null;
  const outrightTotal = options?.outright?.total?.amount ?? (unit && qtyValid ? Number(unit.price || 0) * parsedQty : 0);

  // A unit with no assigned plans can only be bought outright.
  const installmentsAvailable = plans.length > 0;
  useEffect(() => {
    if (!installmentsAvailable && paymentType === 'installment') setPaymentType('outright');
  }, [installmentsAvailable, paymentType]);

  const ready = Boolean(unit) && qtyValid && !loadingOptions
    && (paymentType === 'outright' || Boolean(selectedPlan));

  const quantityError = !unit || quantity === '' ? ''
    : !Number.isInteger(parsedQty) || parsedQty < 1 ? 'Enter a whole number of at least 1.'
    : parsedQty > available ? `Only ${available} available for this unit.`
    : '';

  const submit = async (intent) => {
    if (!ready) return;
    setBusy(intent);
    setError('');
    try {
      const response = await checkoutProperty(property.id, {
        unit_id: unit.id,
        quantity: parsedQty,
        payment_type: paymentType,
        ...(paymentType === 'installment' ? { installment_plan_id: selectedPlan.installment_plan_id } : {}),
      });
      // `intent` is what decides where the caller sends the buyer. Both
      // branches have already created the same invoice by this point.
      onInvoice(getData(response), intent);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not create the invoice.');
      setBusy('');
    }
  };

  /**
   * Whatever promotion applies to the arrangement being looked at.
   *
   * Read per payment type, because a campaign may be restricted to one — the
   * discount on the outright column is not necessarily the discount on a plan.
   */
  const promotion = paymentType === 'installment' && selectedPlan
    ? selectedPlan.promotion
    : options?.outright?.promotion;

  /**
   * The running summary — base, discount, surcharge, total.
   *
   * ── Why the discount gets its own line ──────────────────────────────────
   *
   * The outright row used to read "3 × R5,000,000" against a total of
   * R12,750,000, because the total already had the promotion in it and nothing
   * said so. A buyer reading that sees an arithmetic error, and the honest
   * ones ask about it before paying. Original, discount, payable — the three
   * figures, each on its own line.
   */
  const summary = paymentType === 'installment' && selectedPlan
    ? [
      { label: `${parsedQty} × ${fmt(unit.price || 0)}`, value: fmt(selectedPlan.base.amount) },
      ...(promotion
        ? [{
          label: promotion.offers?.[0]?.name || 'Promotion',
          value: `−${fmt(promotion.discount.amount)}`,
          discount: true,
        }]
        : []),
      ...(selectedPlan.surcharge.amount > 0
        ? [{ label: `${selectedPlan.name} charge`, value: fmt(selectedPlan.surcharge.amount), muted: true }]
        : []),
      ...(selectedPlan.rounding.amount !== 0
        ? [{ label: 'Rounding', value: fmt(selectedPlan.rounding.amount), muted: true }]
        : []),
    ]
    : [
      {
        label: `${parsedQty} × ${fmt(unit?.price || 0)}`,
        value: fmt(options?.outright?.base?.amount ?? (Number(unit?.price || 0) * parsedQty)),
      },
      ...(promotion
        ? [{
          label: promotion.offers?.[0]?.name || 'Promotion',
          value: `−${fmt(promotion.discount.amount)}`,
          discount: true,
        }]
        : []),
    ];

  /** The offer's own wording, for a buyer deciding whether to commit. */
  const offer = promotion?.offers?.[0] || null;

  const total = paymentType === 'installment' && selectedPlan ? selectedPlan.total.amount : outrightTotal;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={`Purchase — ${property?.name ?? ''}`} size="lg">
      <div className="space-y-5">
        {units.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No unit configurations are currently available for this property.
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Unit<FieldMark /></span>
              <Select value={unitId} onChange={(e) => { setUnitId(e.target.value); setQuantity('1'); }} className={INPUT_CLASS}>
                <option value="">Select a unit...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.size ? `${Number(u.size).toLocaleString()} ${u.unit || 'sqm'} · ` : ''}
                    {fmt(u.price || 0)} ({availableOf(u)} available)
                  </option>
                ))}
              </Select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Quantity {unit && <span className="font-normal text-slate-400">(max {available})</span>}
              <FieldMark /></span>
              <input
                type="number"
                min="1"
                step="1"
                max={unit ? available : undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!unit}
                className={INPUT_CLASS}
              />
              {quantityError && <span className="text-xs text-rose-600">{quantityError}</span>}
            </label>

            {unit && qtyValid && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Payment type</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label
                    className={`cursor-pointer rounded-lg border p-3 ${paymentType === 'outright' ? 'border-transparent ring-2' : 'border-slate-200'}`}
                    style={paymentType === 'outright' ? { '--tw-ring-color': 'var(--primary)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <input type="radio" name="payment_type" checked={paymentType === 'outright'} onChange={() => setPaymentType('outright')} />
                      <span className="text-sm font-semibold text-slate-900">Outright</span>
                    </div>
                    {/* Shown alongside the plans so the cost of financing is visible. */}
                    <p className="mt-1 pl-6 text-xs text-slate-500">Pay {fmt(outrightTotal)} in full — no plan charge.</p>
                  </label>

                  <label
                    className={`rounded-lg border p-3 ${!installmentsAvailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${paymentType === 'installment' ? 'border-transparent ring-2' : 'border-slate-200'}`}
                    style={paymentType === 'installment' ? { '--tw-ring-color': 'var(--primary)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_type"
                        checked={paymentType === 'installment'}
                        disabled={!installmentsAvailable}
                        onChange={() => setPaymentType('installment')}
                      />
                      <span className="text-sm font-semibold text-slate-900">Installments</span>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-slate-500">
                      {loadingOptions ? 'Checking available plans...'
                        : installmentsAvailable
                          ? `${plans.length} plan${plans.length === 1 ? '' : 's'} available on this unit.`
                          : 'No installment plans are offered on this unit.'}
                    </p>
                  </label>
                </div>
              </fieldset>
            )}

            {paymentType === 'installment' && installmentsAvailable && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-700">Choose a plan</legend>
                <div className="space-y-2">
                  {plans.map((plan) => {
                    const selected = String(plan.installment_plan_id) === String(planId);
                    // Rounding puts a remainder on the last installment, so the
                    // final month can differ from the rest.
                    const finalDiffers = plan.final_month.minor !== plan.monthly.minor;
                    return (
                      <label
                        key={plan.installment_plan_id}
                        className={`block cursor-pointer rounded-lg border p-3 ${selected ? 'border-transparent ring-2' : 'border-slate-200'}`}
                        style={selected ? { '--tw-ring-color': 'var(--primary)' } : undefined}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="installment_plan"
                            className="mt-1"
                            checked={selected}
                            onChange={() => setPlanId(String(plan.installment_plan_id))}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="text-sm font-semibold text-slate-900">{plan.name}</span>
                              <span className="text-sm font-semibold text-slate-900">
                                {fmt(plan.monthly.amount)}
                                <span className="font-normal text-slate-500">/month</span>
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">
                              {plan.duration_months} month{plan.duration_months === 1 ? '' : 's'} · total {fmt(plan.total.amount)}
                              {finalDiffers && <> · final month {fmt(plan.final_month.amount)}</>}
                            </p>
                            {/* Stated explicitly, never buried in the total. */}
                            {plan.surcharge.amount > 0 && (
                              <p className="mt-0.5 text-xs font-medium text-amber-700">
                                Includes {fmt(plan.surcharge.amount)} plan charge
                                {plan.surcharge.type === 'percentage' && ` (${plan.surcharge.value}%)`}
                                {' — '}{fmt(plan.total.amount - outrightTotal)} more than paying outright
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-slate-500">{describeGrace(plan.terms)}</p>
                            <p className="text-xs text-slate-500">{describeFee(plan.terms)}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {optionsError && (
              <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{optionsError}</p>
            )}

            {unit && qtyValid && (paymentType === 'outright' || selectedPlan) && (
              <div className="space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
                {/*
                  The terms are shown HERE, at the moment of committing, rather than a
                  click away — FRD 34 asks that a buyer can read them before completing
                  the purchase, and a condition somebody has to go looking for is one
                  they will not find.
                */}
                {offer && (
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200">
                    <span className="font-semibold">{offer.name}</span>
                    {offer.message && <span> — {offer.message}</span>}
                    {offer.terms && <p className="mt-1 text-emerald-800/80">{offer.terms}</p>}
                  </div>
                )}

                {summary.map((line) => (
                  <div key={line.label} className="flex items-center justify-between">
                    {/* A discount reads as good news, so it is coloured as such. */}
                    <span className={line.discount ? 'text-emerald-700' : line.muted ? 'text-slate-500' : 'text-slate-600'}>
                      {line.label}
                    </span>
                    <span className={line.discount ? 'font-medium text-emerald-700' : line.muted ? 'text-slate-500' : 'text-slate-700'}>
                      {line.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                  <span className="font-medium text-slate-700">Total payable</span>
                  <span className="text-lg font-semibold text-slate-900">{fmt(total)}</span>
                </div>
                {paymentType === 'installment' && selectedPlan && (
                  <p className="pt-1 text-xs text-slate-500">
                    {selectedPlan.duration_months} monthly payments of {fmt(selectedPlan.monthly.amount)},
                    the first due one month from today.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
            <Button type="button" variant="secondary" onClick={() => submit('invoice')} disabled={Boolean(busy) || !ready}>
              {busy === 'invoice' ? 'Creating invoice...' : 'Create Invoice'}
            </Button>
            <Button type="button" onClick={() => submit('pay')} disabled={Boolean(busy) || !ready}>
              {busy === 'pay' ? 'Creating invoice...' : 'Proceed to Payment'}
            </Button>
          </div>
          <p className="text-right text-xs text-slate-400">
            Both raise the same invoice. Creating it alone leaves it in your invoices to pay later.
          </p>
        </div>
      </div>
    </Modal>
  );
}
