import { Building2, Home, UserRound, Landmark } from 'lucide-react';
import { DASHBOARD_ROWS, capRows } from './dashboardRows';

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
export function Ranking({ icon: Icon, title, rows, fmt, emptyNote, limit = DASHBOARD_ROWS }) {
  /*
   * Capped here rather than at each of the four call sites — the three cards
   * below and the platform admin's company ranking all draw through this, so
   * one cap keeps them consistent with each other.
   */
  const shown = capRows(rows, limit);
  /*
   * The bar is scaled to the largest row SHOWN, not the largest that exists.
   * Scaling to a row nobody can see would leave every visible bar short of the
   * edge for no reason a reader could work out.
   */
  const max = shown.length ? Math.max(...shown.map((r) => r.received)) : 0;

  /*
   * ── Why the width is pinned rather than left to the content ───────────────
   *
   * A grid item's min-width is `auto`, which means "at least as wide as my
   * content refuses to get smaller than". A long property name, a naira figure
   * and a sales count in one row add up to more than a 360px phone, so the card
   * grew past the single mobile column, the column grew past the page, and the
   * whole dashboard picked up a horizontal scrollbar — which reads to anyone
   * looking at it as white space down the right-hand side of every section
   * BELOW this one, because those sections end where the viewport does and this
   * one does not.
   *
   * `min-w-0` opts out of that floor so the card can be as narrow as its
   * column, and `overflow-hidden` gives the truncation inside something to
   * truncate against. Both are needed: without the first the card never
   * shrinks, without the second the text still spills out of a card that has.
   */
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <Icon size={15} className="shrink-0 text-slate-400" />
        <h3 className="truncate text-sm font-semibold text-slate-700">{title}</h3>
      </div>

      {!shown.length ? (
        <p className="py-6 text-center text-xs text-slate-400">{emptyNote}</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((row, index) => (
            <li key={row.id} className="space-y-1">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-slate-400">{index + 1}</span>
                  <span className="truncate text-sm text-slate-700" title={row.name}>{row.name}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                  {fmt(row.received)}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 pl-6">
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
  const {
    properties = [], units, clients = [], branches,
    units_unattributed: unattributed = 0,
    branches_unassigned: branchless = 0,
  } = data || {};

  return (
    <div className="w-full min-w-0 space-y-2">
      {/*
        Wraps on a narrow phone instead of the period caption being pushed off
        the edge — it is a sentence, not a column, and it has somewhere to go.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-sm font-semibold text-slate-700">Top performers</h2>
        <span className="text-[11px] text-slate-400">By payments received · {period}</span>
      </div>

      {/*
        Three columns, or four once a company runs branches. The branch card is
        absent rather than empty for a company that has not set any up — an
        empty leaderboard reads as "no sales", which is a different and alarming
        claim.
      */}
      <div className={`grid w-full min-w-0 grid-cols-1 gap-3 ${branches ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
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
        {/*
          A branch earns through the properties assigned to it, so this ranks
          the same money as the property column — grouped by the office that
          sells it rather than by the estate.
        */}
        {branches && (
          <Ranking
            icon={Landmark} title="Branches" rows={branches} fmt={fmt}
            emptyNote="No payments received yet."
          />
        )}
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

      {/*
        Same reasoning as the unit note. A branch ranking covering a third of
        the revenue looks exactly like one covering all of it, and somebody
        decides which office is performing on the strength of that.
      */}
      {branches && branchless > 0 && (
        <p className="text-[11px] text-slate-400">
          {fmt(branchless)} received against properties in no branch — not counted in the
          branch ranking. Assign them on the property to include them.
        </p>
      )}
    </div>
  );
}
