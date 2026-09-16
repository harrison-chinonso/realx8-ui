import { cn } from '../../lib/cn';
import { useOnPrimary } from '../../context/useAppearance';

/**
 * Button.
 *
 * Proportions and states follow the reference design: a 40px default with 36/44
 * variants, medium weight, one radius, and a visible focus ring. Colour still
 * comes from the tenant's brand rather than a fixed blue, and the label colour
 * is chosen for contrast — a pale brand colour gets dark text, not white.
 *
 * The existing variant and size names are kept so every call site in the app
 * keeps working unchanged.
 */
const SIZES = {
  xs: 'h-6 px-2 text-xs',
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-8 text-base',
  icon: 'h-10 w-10 p-0',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  style: extraStyle = {},
  ...props
}) {
  const onPrimary = useOnPrimary();

  const base = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md '
    + 'font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 '
    + 'focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed';

  // Tenant-coloured variants carry their colour inline, because the brand value
  // is a runtime CSS variable rather than a build-time Tailwind class.
  const styles = {
    primary:   { backgroundColor: 'var(--primary)', color: onPrimary },
    /* The outline button beside a primary one. --secondary-read carries the
       4.5:1 floor, so a pale brand colour is deepened rather than rendered
       as invisible text on white. Falls back to the old neutral ink if the
       theme has not been applied yet. */
    secondary: {
      backgroundColor: 'var(--surface)',
      color: 'var(--secondary-read, var(--content))',
      border: '1px solid rgba(var(--secondary-rgb, 15, 23, 42), .38)',
    },
    ghost:     { backgroundColor: 'transparent', color: 'var(--content-muted)' },
    link:      { backgroundColor: 'transparent', color: 'var(--primary)' },
    danger:    { backgroundColor: 'var(--danger)', color: '#fff' },
    success:   { backgroundColor: 'var(--success)', color: '#fff' },
    warning:   { backgroundColor: 'var(--warning)', color: '#fff' },
  };

  const hover = {
    primary: 'hover:brightness-95',
    secondary: 'hover:bg-surface-sunken',
    ghost: 'hover:bg-surface-sunken hover:text-content',
    link: 'underline-offset-4 hover:underline',
    danger: 'hover:brightness-95',
    success: 'hover:brightness-95',
    warning: 'hover:brightness-95',
  };

  return (
    <button
      className={cn(base, SIZES[size] || SIZES.md, hover[variant] || '', 'disabled:opacity-60', className)}
      style={{ ...(styles[variant] || styles.primary), ...extraStyle }}
      {...props}
    >
      {children}
    </button>
  );
}
