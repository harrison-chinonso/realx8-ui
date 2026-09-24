import { useAppearance } from '../../context/useAppearance';
import FieldMark from './FieldMark';

/** Groups the integer part with commas, preserving a partially typed decimal. */
const withCommas = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return '';
  const [whole, decimal] = String(raw).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal === undefined ? grouped : `${grouped}.${decimal}`;
};

/** Strips everything except digits and a single decimal point, capped at 2dp. */
const toRaw = (input) => {
  let next = String(input).replace(/[^\d.]/g, '');
  const parts = next.split('.');
  if (parts.length > 2) next = `${parts[0]}.${parts.slice(1).join('')}`;
  let [whole, decimal] = next.split('.');
  // Drop leading zeros so "000123" does not render as "000,123".
  whole = whole.replace(/^0+(?=\d)/, '');
  return decimal === undefined ? whole : `${whole}.${decimal.slice(0, 2)}`;
};

/**
 * Money entry field. Displays the value comma-separated as it is typed and
 * shows the company's configured currency code alongside it.
 *
 * `onChange` receives the RAW unformatted string (e.g. "25000000.50"), so
 * callers can keep doing Number(value) exactly as with a plain number input.
 */
export default function MoneyInput({
  label,
  value,
  onChange,
  error,
  className = '',
  placeholder = '0.00',
  ...props
}) {
  // Left in ...props so the input still receives it; read here for the mark.
  const { required } = props;
  // The sign, not the ISO code — matches how amounts are displayed.
  const { currencySymbol, currency } = useAppearance();
  const code = currencySymbol || currency || 'NGN';

  return (
    <label className="block space-y-1">
      {label && (
        <span className="text-sm font-medium text-content">
          {label}
          <FieldMark required={Boolean(required)} />
        </span>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-content-subtle">
          {code}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={withCommas(value)}
          onChange={(event) => onChange(toRaw(event.target.value))}
          placeholder={placeholder}
          className={`flex h-12 w-full rounded-md border bg-surface py-2 pr-3 text-base md:text-sm text-content placeholder:text-content-subtle transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-surface-sunken ${className}`}
          style={{ borderColor: error ? 'var(--danger)' : 'var(--line-strong)', paddingLeft: `${code.length * 0.62 + 1.4}rem` }}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
