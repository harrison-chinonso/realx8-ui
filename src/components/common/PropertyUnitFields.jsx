import MoneyInput from '../ui/MoneyInput';
import Select from '../ui/Select';
import FieldMark from '../ui/FieldMark';
const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';

export const MEASUREMENT_UNITS = ['sqm', 'sqft', 'hectares', 'acres', 'plots'];

/** An empty unit configuration, used to seed forms. */
export const emptyUnitConfig = { name: '', size: '', unit: 'sqm', price: '', quantity: '' };

/** Human-readable summary of one configuration, e.g. "4 × 500 sqm". */
export const describeUnitConfig = ({ name, quantity, size, unit }) => {
  if (name) return name;
  const qty = Number(quantity) || 0;
  const measure = Number(size) || 0;
  const label = unit || 'sqm';
  if (qty && measure) return `${qty} × ${measure.toLocaleString()} ${label}`;
  if (qty) return `${qty} × ${label}`;
  if (measure) return `${measure.toLocaleString()} ${label}`;
  return '—';
};

/**
 * Property-level summary derived from the mirrored unit_* fields.
 * Kept for surfaces that show one line per property (cards, exports).
 */
export const describeUnits = ({ unit_quantity, unit_measurement, unit_measurement_unit }) => {
  const quantity = Number(unit_quantity) || 0;
  const size = Number(unit_measurement) || 0;
  if (!quantity && !size) return null;
  const measure = unit_measurement_unit || 'sqm';
  if (quantity && size) return `${quantity} × ${size.toLocaleString()} ${measure}`;
  if (quantity) return `${quantity} × ${measure}`;
  return `${size.toLocaleString()} ${measure}`;
};

/**
 * One unit configuration: Unit Name / Property Size / Measured In / Price / Quantity.
 * The name is optional — the backend derives one from size and unit when blank.
 * Controlled — `value` is a config object, `onChange` receives the updated one.
 */
export default function PropertyUnitFields({ value, onChange }) {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">
          Unit Name <span className="font-normal text-slate-400">(optional)</span>
        <FieldMark /></span>
        <input value={value.name ?? ''} onChange={set('name')} className={INPUT_CLASS} placeholder="Corner Plot" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Property Size<FieldMark /></span>
        <input type="number" min="0" step="0.01" value={value.size ?? ''} onChange={set('size')} className={INPUT_CLASS} placeholder="500" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Measured In<FieldMark /></span>
        <Select value={value.unit || 'sqm'} onChange={set('unit')} className={INPUT_CLASS}>
          {MEASUREMENT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </Select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Price<FieldMark /></span>
        <MoneyInput value={value.price ?? ''} onChange={(price) => onChange({ ...value, price })} placeholder="25000000" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Quantity<FieldMark /></span>
        <input type="number" min="0" step="1" value={value.quantity ?? ''} onChange={set('quantity')} className={INPUT_CLASS} placeholder="4" />
      </label>
    </div>
  );
}
