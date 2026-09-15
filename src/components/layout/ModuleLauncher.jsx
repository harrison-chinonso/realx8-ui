import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Settings, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';

/**
 * The module launcher — a flat grid of every area of the product.
 *
 * ── Why it is an overlay and not the landing page ───────────────────────────
 *
 * A launcher AS the landing page has two known costs: it is a dead end once you
 * are inside a module, and it tells you nothing about the state of the business
 * at the moment you most want to know. This application already has a dashboard
 * that answers the second, so making the launcher the landing page would have
 * made one of the two redundant and taken the "something needs me" cue away
 * from staff at the moment they sign in. As an overlay it is reachable from
 * anywhere in one click and costs nothing.
 *
 * ── Why the tiles are SECTIONS ──────────────────────────────────────────────
 *
 * The pattern wants one tile per top-level module, flat, no nesting. This
 * product has 61 destinations across 12 sections, and Finance alone holds 16 of
 * them — so a genuinely flat grid would either be 61 tiles, which is three
 * times past where a grid stops beating a sidebar, or a hand-picked subset that
 * silently strands the rest.
 *
 * Tiles are therefore sections, and opening one replaces the grid with that
 * section's destinations. That is a second level, which the pure pattern does
 * not have; it is the honest cost of 61 destinations. Everything else about the
 * pattern holds — uniform tiles, no featured tile, no counts, fixed order.
 *
 * ── Why nothing here is hand-listed ─────────────────────────────────────────
 *
 * Every tile is derived from navConfig, the same source the other five layouts
 * navigate by, filtered through the same `filterNavItems`. A hand-written list
 * of modules would be a second source of truth, and this file has the precedent
 * in front of it: ModernLayout once referred to sections by name, two were
 * renamed, and they silently vanished from that template alone.
 */

/** Sections in the order navConfig declares them — never sorted by usage. */
const useSections = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const userType = useAuthStore((s) => s.effectiveType());

  return useMemo(() => {
    const source = isSuperiorAdmin
      ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
      : NAV;
    const ctx = { hasPermission, isSuperiorAdmin, userType };

    const sections = source
      .filter((section) => section.section !== 'Account')
      .map((section) => {
        const items = filterNavItems(section.items, ctx);
        /*
         * Sub-menus are flattened. A launcher tile leads to a place, and
         * "Finance → Invoicing" is not a place — it is a drawer with four
         * screens in it. Flattening keeps the second level flat, which is the
         * one part of the pattern's contract that survives here.
         */
        return { ...section, destinations: flattenNavItems(items) };
      })
      .filter((section) => section.destinations.length > 0);

    /**
     * Settings, last, always — and the one tile written by hand.
     *
     * It has to be. Settings is not a navConfig entry anywhere: every template
     * puts it in its own chrome, in an avatar menu or a footer, so there is
     * nothing to derive it from. Appending it here rather than adding it to
     * navConfig keeps it out of the other five templates' menus, where it would
     * appear twice.
     *
     * Its position is the point. A grid is memorised by position, and the last
     * cell is the one place a person can find without scanning — which is why
     * the pattern reserves it for the thing you reach for rarely and want
     * instantly. It is appended after the derived sections so no rename or
     * reordering in navConfig can dislodge it.
     *
     * Company settings are staff-only, the same rule the other templates apply:
     * a realtor or client gets their profile and nothing more.
     */
    if (!['realtor', 'client'].includes(userType)) {
      sections.push({
        section: 'Settings',
        destinations: [{ to: '/settings', label: 'Settings', icon: Settings }],
      });
    }

    return sections;
  }, [hasPermission, isSuperiorAdmin, userType]);
};

/**
 * One tile. Uniform, whole-tile hit target, icon above label.
 *
 * Monochrome by choice. The pattern gets real value from colour as a
 * recognition shortcut, but every tenant here configures their own primary and
 * secondary colours and there is a dark mode — a fixed palette of accent
 * colours would clash with whichever brand it was not designed around. The
 * accent appears on hover and focus instead, in the tenant's own colour.
 */
function Tile({ icon: Icon, label, ...props }) {
  const className = 'group flex aspect-[4/3] flex-col items-center justify-center gap-2.5 '
    + 'rounded-xl border border-slate-200 bg-white p-3 text-center transition-colors '
    + 'hover:border-slate-400 hover:bg-slate-50 '
    + 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 '
    + 'active:bg-slate-100 '
    + 'aria-disabled:pointer-events-none aria-disabled:opacity-40';

  const body = (
    <>
      {/* Decorative: the label is the accessible name. */}
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className="h-[26px] w-[26px] shrink-0 text-slate-500 transition-colors group-hover:text-[color:var(--primary,#2563eb)] group-focus-visible:text-[color:var(--primary,#2563eb)]"
      />
      {/*
        Two lines, clamped. A label that wraps to three would push the icon off
        centre and break the alignment across the row.
      */}
      <span className="line-clamp-2 text-[13px] leading-tight text-slate-700">{label}</span>
    </>
  );

  const style = { outlineColor: 'var(--primary, #2563eb)' };

  return props.to
    ? <Link {...props} className={className} style={style}>{body}</Link>
    : <button type="button" {...props} className={className} style={style}>{body}</button>;
}

/**
 * `repeat(auto-fill, …)` rather than a column count per breakpoint.
 *
 * The column count is not stated anywhere — it falls out of the tile minimum
 * and the width the panel is allowed. The PANEL is what carries the
 * breakpoints, which keeps the grid rule itself a single line that cannot get
 * out of step with itself: 2 columns on a phone, 3 on a tablet, 4 on a desktop.
 * The one explicit breakpoint is 1200px, on the PANEL — the width at which the
 * fourth column is specified to appear, and not a width Tailwind has a name for.
 */
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 '
  + 'sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:gap-4';

export default function ModuleLauncher({ open, onClose, returnFocusTo }) {
  const [section, setSection] = useState(null);
  const [query, setQuery] = useState('');
  const sections = useSections();
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  // Every opening starts at the top level. Reopening into a section somebody
  // drilled into ten minutes ago is disorienting — and spatial memory, which is
  // the whole point of the grid, is memory of the TOP level.
  useEffect(() => {
    if (open) { setSection(null); setQuery(''); }
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  /**
   * Escape closes, and focus goes back to the button that opened it.
   *
   * Without the return, a keyboard user who opens the launcher and changes
   * their mind is dropped at the top of the document and has to tab back
   * through the whole page.
   */
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        returnFocusTo?.current?.focus();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the dialog: it is modal, and tabbing to the page
      // underneath while it covers the screen loses the focus ring entirely.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, returnFocusTo]);

  if (!open) return null;

  const term = query.trim().toLowerCase();

  /*
   * Searching drops the two levels and lists destinations, because somebody who
   * types "invoice" wants the screen, not the section it lives in.
   */
  const matches = term
    ? sections.flatMap((s) => s.destinations
      .filter((item) => item.label.toLowerCase().includes(term)
        || (s.section || '').toLowerCase().includes(term))
      .map((item) => ({ ...item, section: s.section })))
    : [];

  const heading = term ? 'Results' : (section?.section || 'Modules');

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 p-3 sm:p-6">
      {/* The backdrop closes it, as every overlay in this application does. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Modules"
        className="relative mt-2 flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 sm:mt-6 min-[1200px]:max-w-4xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
          {section && !term && (
            <button
              type="button"
              onClick={() => setSection(null)}
              aria-label="Back to all modules"
              className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              /*
               * Filters the launcher, and says so. It is not a search of
               * clients or properties, and a placeholder reading "Search" would
               * promise one.
               */
              placeholder="Find a screen…"
              aria-label="Find a screen"
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modules"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{heading}</p>

          <nav aria-label="Modules">
            {term ? (
              matches.length ? (
                <div className={GRID}>
                  {matches.map((item) => (
                    <Tile
                      key={`${item.section}-${item.to}-${item.label}`}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      onClick={onClose}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-400">
                  Nothing matches “{query.trim()}”.
                </p>
              )
            ) : section ? (
              <div className={GRID}>
                {section.destinations.map((item) => (
                  <Tile key={`${item.to}-${item.label}`} to={item.to} icon={item.icon} label={item.label} onClick={onClose} />
                ))}
              </div>
            ) : (
              <div className={GRID}>
                {sections.map((entry) => {
                  /*
                   * A section holding one destination IS that destination.
                   * Making somebody open Front Desk to find a single tile
                   * called Visitors is a click that buys nothing.
                   */
                  const only = entry.destinations.length === 1 ? entry.destinations[0] : null;
                  /*
                   * A collapsed section is named after what it OPENS, not after
                   * the section it came from. A buyer's General section holds
                   * only Notifications, and a tile reading "General" that lands
                   * on Notifications is a tile that lied about where it went.
                   */
                  const label = only ? only.label : (entry.section || 'More');
                  /*
                   * Sections carry no icon of their own in navConfig, so the
                   * first destination's icon stands for the section. Derived
                   * rather than mapped by name, because a name-keyed lookup is
                   * exactly what broke ModernLayout when two sections were
                   * renamed.
                   */
                  const icon = (only || entry.destinations[0]).icon;

                  return only
                    ? <Tile key={label} to={only.to} icon={icon} label={label} onClick={onClose} />
                    : <Tile key={label} icon={icon} label={label} onClick={() => setSection(entry)} />;
                })}
              </div>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
