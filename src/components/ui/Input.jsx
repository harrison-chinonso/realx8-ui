import { cn } from '../../lib/cn';
import FieldMark from './FieldMark';

/**
 * Text input.
 *
 * Follows the reference: a generous 48px field, one radius, muted placeholder,
 * and a focus ring rather than a colour-shifting border. `label` and `error`
 * are kept from the previous component so existing forms need no changes.
 */
export default function Input({ label, error, className = '', containerClassName = '', ...props }) {
  const { required } = props;
  const field = (
    <input
      className={cn(
        'flex h-12 w-full rounded-md border bg-surface px-3 py-2 text-base md:text-sm',
        'text-content placeholder:text-content-subtle',
        'transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-subtle',
        className,
      )}
      style={{ borderColor: error ? 'var(--danger)' : 'var(--line-strong)' }}
      {...props}
    />
  );

  // Always wrapped, as before. An unlabelled Input used to still render inside
  // a block <label>, and call sites rely on that box for layout.
  return (
    <label className={cn('block space-y-1.5', containerClassName)}>
      {label && (
        <span className="text-sm font-medium text-content">
          {label}
          {/* Driven by the same `required` the control gets, so the mark and the
              validation can never disagree. */}
          <FieldMark required={Boolean(required)} />
        </span>
      )}
      {field}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}
