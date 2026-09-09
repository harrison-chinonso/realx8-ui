import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import Button from '../ui/Button';
import { checkoutProperty } from '../../api/propertyApi';
import { useCurrency } from '../../context/useAppearance';
import Select from '../ui/Select';

const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

const PAYMENT_MODES = [
  { value: 'outright', label: 'Outright', hint: 'Pay the full amount. Invoice due in 14 days.' },
  { value: 'installment', label: 'Installment', hint: 'Pay in parts. Invoice due in 30 days.' },
];

const availableOf = (unit) => Number(unit?.quantity_available ?? unit?.quantity ?? 0);

/**
 * Purchase flow: pick a unit configuration, quantity (bounded by remaining
 * availability) and payment mode, then generate the invoice.
 * Availability is re-checked server-side on submit — this is guidance, not the guard.
 */
export default function PurchaseModal({ open, property, onClose, onInvoice }) {
  const fmt = useCurrency();
  const units = useMemo(() => (property?.units || []).filter((u) => availableOf(u) > 0), [property]);

  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paymentMode, setPaymentMode] = useState('outright');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The invoice blocking this purchase, so we can link the buyer straight to it.
  const [blockedBy, setBlockedBy] = useState(null);

  useEffect(() => {
    if (!open) return;
    setUnitId(units.length === 1 ? String(units[0].id) : '');
    setQuantity('1');
    setPaymentMode('outright');
    setError('');
  }, [open, units.length]);

  const unit = units.find((u) => String(u.id) === String(unitId)) || null;
  const available = unit ? availableOf(unit) : 0;
  const parsedQty = Number(quantity);
  const qtyValid = Number.isInteger(parsedQty) && parsedQty >= 1 && (!unit || parsedQty <= available);
  const total = unit && qtyValid ? Number(unit.price || 0) * parsedQty : 0;

  const quantityError = !unit || quantity === '' ? ''
    : !Number.isInteger(parsedQty) || parsedQty < 1 ? 'Enter a whole number of at least 1.'
    : parsedQty > available ? `Only ${available} available for this unit.`
    : '';

  const submit = async () => {
    if (!unit || !qtyValid) return;
    setBusy(true);
    setError('');
    try {
      const response = await checkoutProperty(property.id, {
        unit_id: unit.id,
        quantity: parsedQty,
        payment_mode: paymentMode,
      });
      onInvoice(response?.data ?? response);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'Could not create the invoice.');
      setBlockedBy(err?.response?.data?.outstanding_invoice ?? null);
      setBusy(false);
    }
  };

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
              <span className="text-sm font-medium text-slate-700">Unit</span>
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
              </span>
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

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Payment Mode</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {PAYMENT_MODES.map((mode) => (
                  <label
                    key={mode.value}
                    className={`cursor-pointer rounded-lg border p-3 ${paymentMode === mode.value ? 'border-transparent ring-2' : 'border-slate-200'}`}
                    style={paymentMode === mode.value ? { '--tw-ring-color': 'var(--primary)' } : undefined}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="payment_mode"
                        value={mode.value}
                        checked={paymentMode === mode.value}
                        onChange={() => setPaymentMode(mode.value)}
                      />
                      <span className="text-sm font-semibold text-slate-900">{mode.label}</span>
                    </div>
                    <p className="mt-1 pl-6 text-xs text-slate-500">{mode.hint}</p>
                  </label>
                ))}
              </div>
            </fieldset>

            {unit && qtyValid && (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">{parsedQty} × {fmt(unit.price || 0)}</span>
                  <span className="text-lg font-semibold text-slate-900">{fmt(total)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
            {blockedBy?.id && (
              <>
                {' '}
                <Link to={`/finance/invoices/${blockedBy.id}`} className="font-semibold underline underline-offset-2">
                  Open {blockedBy.invoice_id}
                </Link>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || !unit || !qtyValid}>
            {busy ? 'Creating invoice...' : 'Create Payment Invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
