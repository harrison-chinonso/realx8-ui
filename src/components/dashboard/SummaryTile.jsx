import { Link } from 'react-router-dom';

/**
 * Compact stat tile for the realtor/client dashboards. Values are money or
 * counts, so the text wraps rather than overflowing the card.
 * Pass `to` to make the whole tile a link.
 */
export default function SummaryTile({ label, value, sub, accent = false, to, linkText, children }) {
  const body = (
    <>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500" title={label}>{label}</p>
      <p
        className="mt-1.5 break-words text-2xl font-bold leading-tight text-slate-900"
        style={accent ? { color: 'var(--primary)' } : undefined}
      >
        {value}
      </p>
      {sub && <p className="mt-1 break-words text-[11px] text-slate-400">{sub}</p>}
      {to && (
        <span className="mt-2 inline-block text-[11px] font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
          {linkText || 'View details'} →
        </span>
      )}
      {children}
    </>
  );

  const className = `min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200${to ? ' block transition-shadow hover:shadow-md' : ''}`;

  return to ? <Link to={to} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}
