import { Building2, Home, UserRound } from 'lucide-react';

/**
 * Who and what is actually earning.
 *
 * Three rankings side by side — properties, the units within them, and clients
 * — each by money RECEIVED rather than invoiced. Ranking by invoice value
 * would promote whoever raised the largest unpaid invoice, which is exactly
 * backwards for a panel people use to decide where to push.
 */

const Bar = ({ value, max }) => (
  <div className="h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-sunken)' }}>
    <div
      className="h-full rounded-full"
      style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%`, backgroundColor: 'var(--primary)' }}
    />
  </div>
);

/**
 * Exported so the platform admin dashboard can rank companies with the same
 * bar, the same ordering and the same empty note. A second copy over there
 * would drift the moment either is touched.
 */
export function Ranking({ icon: Icon, title, rows, fmt, emptyNote }) {
  const max = rows?.length ? Math.max(...rows.map((r) => r.received)) : 0;

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>

      {!rows?.length ? (
        <p className="py-6 text-center text-xs text-slate-400">{emptyNote}</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                  <span className="truncate text-sm text-slate-700" title={row.name}>{row.name}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {fmt(row.received)}
                </span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <Bar value={row.received} max={max} />
                <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                  {row.invoices} {row.invoices === 1 ? 'sale' : 'sales'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function TopPerformersPanel({ data, fmt, period }) {
  const { properties = [], units, clients = [], units_unattributed: unattributed = 0 } = data || {};

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Top performers</h2>
        <span className="text-[11px] text-slate-400">By payments received · {period}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Ranking
          icon={Building2} title="Properties" rows={properties} fmt={fmt}
          emptyNote="No payments received yet."
        />
        {/*
          `units` is null — not empty — when the unit table cannot be read at
          all, which happens where property-service keeps its own database.
          "Not available here" and "nothing sold" are different answers and
          showing the wrong one sends someone looking for missing sales.
        */}
        <Ranking
          icon={Home} title="Units" rows={units || []} fmt={fmt}
          emptyNote={units === null
            ? 'Unit figures are not available in this deployment.'
            : 'No unit-level sales recorded yet.'}
        />
        <Ranking
          icon={UserRound} title="Clients" rows={clients} fmt={fmt}
          emptyNote="No payments received yet."
        />
      </div>

      {/*
        Stated rather than hidden: a sale recorded without going through the
        purchase flow has no unit against it, so the unit column can be lower
        than the property one. Silently omitting it would make the two columns
        look inconsistent for no visible reason.
      */}
      {units !== null && unattributed > 0 && (
        <p className="text-[11px] text-slate-400">
          {fmt(unattributed)} received against sales with no unit recorded — counted under
          properties and clients, but not in the unit ranking.
        </p>
      )}
    </div>
  );
}
