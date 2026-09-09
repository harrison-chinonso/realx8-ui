import { cn } from '../../lib/cn';

/**
 * Surface container.
 *
 * The app repeats `rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200` in
 * dozens of places; this is that pattern named once, on the design tokens, so
 * elevation and border stay consistent as screens are added.
 */
export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn('rounded-xl border bg-surface shadow-card', className)}
      style={{ borderColor: 'var(--line)' }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;
}

export function CardTitle({ className = '', children }) {
  return <h2 className={cn('font-heading text-lg font-semibold text-content', className)}>{children}</h2>;
}

export function CardDescription({ className = '', children }) {
  return <p className={cn('text-sm text-content-muted', className)}>{children}</p>;
}

export function CardContent({ className = '', children }) {
  return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}

export function CardFooter({ className = '', children }) {
  return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>;
}

export default Card;
