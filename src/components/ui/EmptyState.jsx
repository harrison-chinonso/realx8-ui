import { cn } from '../../lib/cn';

/**
 * The "nothing here yet" panel for empty lists and tables.
 *
 * An empty list should say what would live there and how to add the first one,
 * rather than leaving a bare "No records found" line — so `action` is part of
 * the shape, not an afterthought.
 */
export function EmptyState({ icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon ? (
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--content-muted)' }}
        >
          {icon}
        </div>
      ) : null}
      <p className="font-heading text-sm font-semibold text-content">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-content-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
