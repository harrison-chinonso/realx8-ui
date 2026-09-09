import { cn } from '../../lib/cn';

/**
 * Inline notice — form errors, save confirmations, standing warnings.
 *
 * Screens currently hand-roll this as `rounded-lg bg-red-50 px-4 py-2 text-sm
 * text-red-700`, with three different reds in circulation. Naming it once puts
 * every notice on the semantic tokens and gives the copy a consistent shape.
 */

const TONES = {
  danger: {
    surface: 'var(--danger-surface)',
    border: 'color-mix(in srgb, var(--danger) 22%, transparent)',
    text: 'var(--danger)',
  },
  success: {
    surface: 'var(--success-surface)',
    border: 'color-mix(in srgb, var(--success) 22%, transparent)',
    text: 'var(--success)',
  },
  warning: {
    surface: 'var(--warning-surface)',
    border: 'color-mix(in srgb, var(--warning) 25%, transparent)',
    text: 'var(--warning)',
  },
  info: {
    surface: 'rgba(var(--primary-rgb), 0.06)',
    border: 'rgba(var(--primary-rgb), 0.20)',
    text: 'rgb(var(--primary-rgb))',
  },
  neutral: {
    surface: 'var(--surface-muted)',
    border: 'var(--line)',
    text: 'var(--content-muted)',
  },
};

export function Alert({ tone = 'info', title, icon, className = '', children, ...props }) {
  const t = TONES[tone] || TONES.info;

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border px-4 py-3 text-sm', className)}
      style={{ backgroundColor: t.surface, borderColor: t.border, color: t.text }}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {/* Body sits a shade calmer than the title so the tone reads as accent, not shouting. */}
        {children ? <div className={cn('leading-relaxed', title && 'mt-0.5 opacity-90')}>{children}</div> : null}
      </div>
    </div>
  );
}

export default Alert;
