import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAppearance, useBrandSurface } from '../../context/useAppearance';
import { accentSlotFor, accentStyle, parseAccents } from '../layout/launcherPalette';

/**
 * The dashboards' shared pieces, in the launcher's design language.
 *
 * ── Where colour comes from ─────────────────────────────────────────────────
 *
 * The same two places as the launcher, and nowhere else:
 *
 *   the brand     the welcome banner is the company's darker brand colour,
 *                 through useBrandSurface — every ink on it derived from it
 *   the palette   metric cards take the company's module colours
 *                 (Settings → Appearance → Module launcher), through the same
 *                 accentStyle the launcher's cards use, so a figure about
 *                 Finance wears Finance's colour on both screens
 *
 * So there is no colour here a company did not choose, and no foreground that
 * was not measured against what it sits on.
 */

/** The company's module colours, and a lookup by module name. */
export function useModuleAccent() {
  const { accent_colors: stored } = useAppearance();
  const palette = useMemo(() => parseAccents(stored), [stored]);
  return useMemo(() => ({
    palette,
    accentFor: (module) => palette[accentSlotFor(module)],
    nth: (index) => palette[index % palette.length],
  }), [palette]);
}

/** A faint row of buildings, in whatever ink the banner carries. */
function Skyline({ className = '' }) {
  return (
    <svg viewBox="0 0 240 100" aria-hidden="true" className={className} preserveAspectRatio="xMaxYMax meet">
      <g fill="currentColor">
        <rect x="10" y="44" width="26" height="56" rx="2" />
        <rect x="42" y="18" width="34" height="82" rx="2" />
        <rect x="82" y="36" width="24" height="64" rx="2" />
        <path d="M112 100V52l30-22 30 22v48z" />
        <rect x="178" y="60" width="24" height="40" rx="2" />
        <rect x="206" y="30" width="26" height="70" rx="2" />
      </g>
    </svg>
  );
}

/**
 * The welcome banner at the top of every dashboard.
 *
 * Filled with the company's darker brand colour, with a glow of the primary in
 * one corner. The glow is decoration only — everything that carries meaning
 * sits on the solid fill its ink was chosen against.
 */
export function DashboardHero({
  kicker, title, subtitle, badges, children, aside,
}) {
  const surface = useBrandSurface();
  return (
    <section
      style={{
        ...surface,
        background: 'radial-gradient(circle at 88% 12%, rgba(var(--primary-rgb), 0.38), transparent 55%), var(--sf-fill)',
      }}
      className="relative overflow-hidden rounded-3xl p-6 text-[color:var(--sf-ink)] shadow-[0_18px_36px_-24px_rgba(11,27,77,0.8)] sm:p-8 print:rounded-none print:shadow-none"
    >
      <Skyline className="pointer-events-none absolute bottom-0 right-6 h-28 w-64 opacity-[0.12] sm:h-36 sm:w-80" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          {kicker && (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--sf-ink-subtle)]">{kicker}</p>
          )}
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-[34px] sm:leading-tight">{title}</h1>
          {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
          {subtitle && <p className="text-sm text-[color:var(--sf-ink-muted)] sm:text-[15px]">{subtitle}</p>}
          {children && <div className="flex flex-wrap items-center gap-2 pt-2">{children}</div>}
        </div>
        {aside && (
          <div className="relative flex shrink-0 flex-col gap-2 rounded-2xl border border-[color:var(--sf-border)] bg-[color:var(--sf-track)] p-5 lg:items-end lg:text-right">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}

/** A label and big figure inside the hero's aside. */
export function HeroFigure({ label, value, title }) {
  return (
    <>
      <p className="text-[13px] font-semibold text-[color:var(--sf-ink-subtle)]">{label}</p>
      <p className="font-heading text-3xl font-extrabold tabular-nums tracking-tight" title={title}>{value}</p>
    </>
  );
}

/**
 * A metric in a module's colour: icon tile, figure, label, and what it means.
 *
 * A link when it goes somewhere — then it also carries the chevron, like a
 * launcher card, so it reads as something to open.
 */
export function TintCard({
  accent, icon: Icon, value, label, sub, trend, to, title, className = '', children,
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--rx-card-fill)] text-[color:var(--rx-card-on-fill)] shadow-[0_8px_16px_-10px_var(--rx-card-fill)]">
            <Icon size={24} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        {trend}
        {to && !trend && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--rx-card-chev-bg)] text-[color:var(--rx-card-chev)]" aria-hidden="true">
            <ChevronRight size={17} strokeWidth={2.4} />
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="break-words font-heading text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-[28px]" title={title}>{value}</p>
        <p className="text-[15px] font-bold text-slate-800">{label}</p>
        {sub && <p className="break-words text-[13px] text-slate-600">{sub}</p>}
      </div>
      {children}
    </>
  );
  const cls = `flex min-w-0 flex-col gap-4 rounded-[20px] border border-[color:var(--rx-card-edge)] bg-[linear-gradient(160deg,#ffffff_0%,var(--rx-card-tint)_75%)] p-5 ${to ? 'transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''} ${className}`;
  const style = accentStyle(accent);
  return to
    ? <Link to={to} style={style} className={cls}>{body}</Link>
    : <div style={style} className={cls}>{body}</div>;
}

/**
 * "+12% vs last month", or nothing when there is nothing to compare with.
 *
 * `previous` of zero is not a -100% or an infinity: it is either "new" or no
 * signal at all, and saying so beats a number nobody can act on.
 */
export function TrendChip({ current, previous, label = 'vs last month', invert = false }) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (!p && !c) return null;
  if (!p) return <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">New</span>;
  const pct = ((c - p) / p) * 100;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${good ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`} title={label}>
      {up ? '▲' : '▼'} {Math.abs(pct) >= 1000 ? `${(c / p).toFixed(0)}×` : `${Math.abs(pct).toFixed(0)}%`}
    </span>
  );
}

/** A white panel with a heading, a line under it, and an optional link. */
export function Panel({
  title, subtitle, action, children, className = '', as: Tag = 'section', ...props
}) {
  return (
    <Tag className={`flex min-w-0 flex-col gap-4 rounded-[22px] bg-white p-5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.35)] ring-1 ring-slate-200 sm:p-6 ${className}`} {...props}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {title && <h2 className="font-heading text-lg font-extrabold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-slate-600">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** "View all →" beside a panel title. */
export function PanelLink({ to, children }) {
  return (
    <Link to={to} className="shrink-0 rounded text-sm font-bold text-[color:var(--secondary-read,#1d4ed8)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {children}
    </Link>
  );
}

/** A small tinted figure, for the grids inside a panel. */
export function MiniStat({
  value, label, note, accent, title,
}) {
  return (
    <div style={accentStyle(accent)} className="min-w-0 rounded-2xl bg-[color:var(--rx-card-tint)] px-4 py-3">
      <p className="break-words font-heading text-xl font-extrabold tabular-nums text-slate-900" title={title}>{value}</p>
      <p className="text-[13px] font-semibold text-slate-600">{label}</p>
      {note && <p className="mt-0.5 text-xs font-semibold text-slate-700">{note}</p>}
    </div>
  );
}

/** A heading above a row of cards. */
export function SectionHeading({ children, action }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-heading text-lg font-extrabold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

/** Two-part bar: settled against outstanding, with a text equivalent for screen readers. */
export function SplitBar({ done, total, label }) {
  const pct = total > 0 ? Math.min((done / total) * 100, 100) : 0;
  return (
    <div role="img" aria-label={label || `${pct.toFixed(0)} percent`} className="flex h-3 overflow-hidden rounded-full bg-slate-200">
      <span className="bg-emerald-500" style={{ width: `${pct}%` }} />
      <span className="bg-[repeating-linear-gradient(135deg,#f59e0b_0_6px,#fbbf24_6px_12px)]" style={{ width: `${100 - pct}%` }} />
    </div>
  );
}
