import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Settings, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import { LAUNCHER_CSS } from './launcherStyles';
import { rememberVisit, recentVisits } from './recentScreens';

/**
 * The module launcher — every area of the product, in one grid.
 *
 * ── Why it is an overlay and not the landing page ───────────────────────────
 *
 * A launcher AS the landing page is a dead end once you are inside a module,
 * and it says nothing about the state of the business at the moment you most
 * want to know. This product already has a dashboard that answers the second,
 * so as an overlay the launcher is reachable from anywhere in one click and
 * costs nothing.
 *
 * ── Why every screen is on the page ─────────────────────────────────────────
 *
 * The tiles were sections, and opening one showed a second grid of the screens
 * inside it. That was the right trade while this was a 1060px card: 61 tiles
 * will not fit in a dialog, so the dialog showed twelve and charged a click
 * for the rest.
 *
 * It is a full page now, and a full page has the room. So the drill-in is gone
 * and the screens are simply there, in rows headed by the menu they belong to
 * — 61 tiles a scroll away rather than twelve tiles and a click away. Sixty-one
 * is a lot to lay out and nothing to scan, because the row headings are what
 * the eye travels, and they read the same as the sidebar in every other
 * template.
 *
 * ── Nothing here is hand-listed ─────────────────────────────────────────────
 *
 * Every tile comes from navConfig through the same `filterNavItems` the other
 * five layouts use, so permissions and role scoping are identical and a new
 * screen appears the day it appears in the menu.
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
        // Sub-menus are kept — a grouping that exists in navConfig and
        // dissolves in one layout is worse than no grouping at all.
        // `destinations` is the flat list, because SEARCH wants screens rather
        // than the drawers they sit in.
        return { ...section, items, destinations: flattenNavItems(items) };
      })
      .filter((section) => section.destinations.length > 0);

    /**
     * Settings, last, and the one tile written by hand — it has to be, because
     * Settings is not a navConfig entry anywhere. Staff only, the same rule the
     * other templates apply.
     */
    if (!['realtor', 'client'].includes(userType)) {
      const settings = { to: '/settings', label: 'Settings', icon: Settings };
      sections.push({ section: 'Settings', items: [settings], destinations: [settings] });
    }

    return sections;
  }, [hasPermission, isSuperiorAdmin, userType]);
};

/*
 * The 1–9,0 slot keys are gone with the drill-in.
 *
 * A slot key is a promise that a position is worth memorising. That held for a
 * twelve-tile top level; across sixty-one screens in twelve rows, which ten get
 * a digit is an accident of what this particular user may see, and the badge
 * would appear on ten tiles and not the other fifty-one for no reason a person
 * could work out. Search and the arrow keys carry the keyboard now.
 */

/**
 * One tile — one screen. Identical to every other tile: no featured one, no
 * per-module colour, no counts. Only the words change.
 *
 * The two-word description is gone with the drill-in. It existed to say what
 * "General" or "Media" held, which was a fair question of a tile that opened a
 * drawer; a tile that goes straight to Invoices has already answered it.
 */
function Tile({ icon: Icon, name, onOpen, to, innerRef, ...props }) {
  return (
    <Link ref={innerRef} to={to} className="rx-tile" onClick={onOpen} {...props}>
      {/* Decorative: the name is the accessible name. */}
      <span className="rx-ic"><Icon aria-hidden="true" strokeWidth={1.75} size={20} /></span>
      <span className="rx-name">{name}</span>
    </Link>
  );
}

export default function ModuleLauncher({ open, onClose, returnFocusTo }) {
  const [query, setQuery] = useState('');
  const sections = useSections();
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const tileRefs = useRef([]);

  useEffect(() => {
    if (open) { setQuery(''); searchRef.current?.focus(); }
  }, [open]);

  const term = query.trim().toLowerCase();

  /** Everything reachable, flat and deduplicated — what search looks through. */
  const allDestinations = useMemo(() => [...new Map(
    sections.flatMap((s) => s.destinations.map((item) => [item.to, { ...item, section: s.section }])),
  ).values()], [sections]);

  const matches = useMemo(() => (term
    ? allDestinations.filter((item) => item.label.toLowerCase().includes(term)
      || (item.section || '').toLowerCase().includes(term))
    : []), [term, allDestinations]);

  /**
   * One row per parent menu, in the order navConfig declares them.
   *
   * `destinations` is already flat, so a sub-menu — Realtors inside User
   * Management — dissolves into its parent's row rather than becoming a second
   * thing to open. That is the point of the change: one label, everything
   * under it.
   *
   * `offset` is where the row's tiles begin in the overall tile order, which is
   * what keeps tileRefs in visual order for the arrow keys.
   */
  const rows = useMemo(() => {
    let offset = 0;
    return sections.map((entry) => {
      const row = {
        /* A section with no name of its own is named after what it holds —
           Dashboard is declared nameless in navConfig. */
        key: entry.section || entry.destinations[0]?.to || 'row',
        name: entry.section || entry.destinations[0]?.label || 'More',
        tiles: entry.destinations,
        offset,
      };
      offset += entry.destinations.length;
      return row;
    });
  }, [sections]);

  const close = useCallback(() => {
    onClose();
    returnFocusTo?.current?.focus();
  }, [onClose, returnFocusTo]);

  /**
   * Keyboard. The keycaps in the search row advertise this as keyboard-driven,
   * so it has to actually be one.
   */
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); return; }

      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const nodes = tileRefs.current.filter(Boolean);
        if (!nodes.length) return;
        event.preventDefault();

        const current = nodes.indexOf(document.activeElement);
        if (current < 0) { nodes[0].focus(); return; }

        /*
         * Navigation is GEOMETRIC, not arithmetic.
         *
         * Index maths needs a column count, and there is no single right one
         * here: every row is its own grid, and a row of two screens still lays
         * out across six tracks. Stepping down by six from the second tile in
         * one row skipped whole rows and landed somewhere the eye had not
         * gone.
         *
         * Asking the layout where things actually are handles partial rows,
         * group boundaries and any future column count without knowing about
         * any of them.
         */
        const box = (node) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };
        const from = box(nodes[current]);
        const vertical = ['ArrowDown', 'ArrowUp'].includes(event.key);
        const forward = ['ArrowDown', 'ArrowRight'].includes(event.key);

        const candidates = nodes
          .map((node, index) => ({ node, index, ...box(node) }))
          .filter(({ index }) => index !== current)
          .filter(({ x, y }) => (vertical
            // Strictly on another row, in the direction travelled.
            ? (forward ? y > from.y + 4 : y < from.y - 4)
            : (forward ? x > from.x + 4 : x < from.x - 4)));

        if (!candidates.length) return;

        /*
         * Nearest in the direction of travel, then nearest across it — so
         * moving down from a tile lands in the tile below rather than the
         * first one on the next row.
         */
        candidates.sort((a, b) => {
          const major = vertical
            ? Math.abs(a.y - from.y) - Math.abs(b.y - from.y)
            : Math.abs(a.x - from.x) - Math.abs(b.x - from.x);
          if (Math.abs(major) > 4) return major;
          return vertical
            ? Math.abs(a.x - from.x) - Math.abs(b.x - from.x)
            : Math.abs(a.y - from.y) - Math.abs(b.y - from.y);
        });

        candidates[0].node.focus();
        return;
      }

      if (event.key !== 'Tab') return;

      // Modal: Tab stays inside. Tabbing to the page underneath while it covers
      // the screen loses the focus ring entirely.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  /**
   * Pick a glyph colour the accent can actually carry.
   *
   * Computed when the launcher opens rather than at build time, because the
   * accent is the tenant's and is resolved from a CSS variable at runtime. The
   * threshold is the usual relative-luminance one: a light accent takes the ink
   * glyph, a dark one takes white.
   */
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const accent = getComputedStyle(panelRef.current).getPropertyValue('--rx-accent').trim();
    const match = /^#?([0-9a-f]{6})$/i.exec(accent) || /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(accent);
    if (!match) return;

    const [r, g, b] = match[1]?.length === 6
      ? [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16))
      : [Number(match[1]), Number(match[2]), Number(match[3])];

    // Rec. 709 luminance — the same weighting every contrast tool uses.
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    panelRef.current.style.setProperty('--rx-on-accent', luminance > 0.6 ? 'var(--rx-ink)' : '#fff');
  }, [open]);

  const recent = useMemo(() => (open ? recentVisits(allDestinations) : []), [open, allDestinations]);

  if (!open) return null;

  tileRefs.current = [];

  /**
   * One grid of screens. `offset` keeps tileRefs in visual order across the
   * rows, which is the order the arrow keys walk.
   */
  const renderTiles = (items, offset = 0) => (
    <div className="rx-grid">
      {items.map((item, index) => (
        <Tile
          key={item.to}
          innerRef={(node) => { tileRefs.current[offset + index] = node; }}
          icon={item.icon}
          name={item.label}
          to={item.to}
          onOpen={() => { rememberVisit(item); close(); }}
        />
      ))}
    </div>
  );

  return (
    <div className="rx-launcher fixed inset-0 z-[70] flex bg-slate-900/40">
      <style>{LAUNCHER_CSS}</style>
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Modules" className="rx-panel relative">
        <div className="rx-search">
          <Search aria-hidden="true" size={18} style={{ color: 'var(--rx-ink-3)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            /* Not "Search": this does not search clients or properties, and a
               placeholder promising that would be one that lies. */
            placeholder="Find a screen or jump to a record…"
            aria-label="Find a screen"
          />
          <div className="rx-keys" aria-hidden="true">
            <span className="rx-key">↑↓</span>
            <span className="rx-key">↵</span>
            <span className="rx-key">esc</span>
          </div>
          <button type="button" onClick={close} aria-label="Close modules" style={{ color: 'var(--rx-ink-3)', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Recently visited: most launcher trips are return trips, and a chip
            answers that in a glance where a grid needs a scan. */}
        {!term && recent.length > 0 && (
          <div className="rx-recent">
            <span className="rx-recent-label">Recent</span>
            {recent.map((item) => (
              <Link key={item.to} to={item.to} className="rx-chip" onClick={() => { rememberVisit(item); close(); }}>
                <item.icon aria-hidden="true" size={13} />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <div className="rx-body">
          <nav aria-label="Modules">
            {term ? (
              matches.length
                /* Headed like every other row, so searching rearranges the page
                   rather than replacing it with something shaped differently. */
                ? (
                  <div className="rx-group">
                    <div className="rx-group-head">
                      <span>Results</span><i /><span>{matches.length}</span>
                    </div>
                    {renderTiles(matches)}
                  </div>
                )
                : <p className="rx-empty">Nothing matches “{query.trim()}”.</p>
            ) : (
              /*
               * Every screen, under the menu it belongs to.
               *
               * The row label is the parent menu's name — the same name the
               * sidebar gives it in the other five templates — so somebody who
               * learned the menu in one of those can read this without
               * translating. The count on the right says how many screens the
               * row holds, which is the only thing the old section tile said
               * that this does not say by simply showing them.
               */
              rows.map((row) => (
                <div className="rx-group" key={row.key}>
                  <div className="rx-group-head">
                    <span>{row.name}</span><i /><span>{row.tiles.length}</span>
                  </div>
                  {renderTiles(row.tiles, row.offset)}
                </div>
              ))
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
