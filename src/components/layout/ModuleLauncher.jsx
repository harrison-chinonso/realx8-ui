import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Settings, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import { LAUNCHER_CSS } from './launcherStyles';
import { groupSections, DESCRIPTIONS } from './launcherGroups';
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
 * ── Why the tiles are SECTIONS ──────────────────────────────────────────────
 *
 * The pattern wants one tile per top-level module, flat. This product has 61
 * destinations across 12 sections, and Finance alone holds 16 of them — so a
 * genuinely flat grid would either be 61 tiles, which is three times past where
 * a grid stops beating a sidebar, or a hand-picked subset that strands the
 * rest. Opening a section shows its destinations.
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

/** Slot keys in layout order: 1–9, then 0 for the tenth. */
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * One tile. Identical to every other tile — no featured one, no per-module
 * colour, no counts. Only the words change.
 */
function Tile({ icon: Icon, name, description, slot, onOpen, to, innerRef, ...props }) {
  const body = (
    <>
      {slot && <span className="rx-slot" aria-hidden="true">{slot}</span>}
      {/* Decorative: the name is the accessible name. */}
      <span className="rx-ic"><Icon aria-hidden="true" strokeWidth={1.75} size={20} /></span>
      <span className="rx-name">{name}</span>
      {description && <span className="rx-desc">{description}</span>}
    </>
  );

  return to
    ? <Link ref={innerRef} to={to} className="rx-tile" onClick={onOpen} {...props}>{body}</Link>
    : <button ref={innerRef} type="button" className="rx-tile" onClick={onOpen} {...props}>{body}</button>;
}

export default function ModuleLauncher({ open, onClose, returnFocusTo }) {
  const [section, setSection] = useState(null);
  const [group, setGroup] = useState(null);
  const [query, setQuery] = useState('');
  const sections = useSections();
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const tileRefs = useRef([]);

  useEffect(() => {
    if (open) { setSection(null); setGroup(null); setQuery(''); searchRef.current?.focus(); }
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

  const grouped = useMemo(() => groupSections(sections), [sections]);

  const close = useCallback(() => {
    onClose();
    returnFocusTo?.current?.focus();
  }, [onClose, returnFocusTo]);

  /** What is on screen now, in visual order — for arrow keys and slot keys. */
  const visibleTiles = useMemo(() => {
    if (term) return matches.map((item) => ({ kind: 'link', item }));
    if (group) return group.children.map((item) => ({ kind: 'link', item }));
    if (section) {
      return section.items.map((item) => (item.children ? { kind: 'group', item } : { kind: 'link', item }));
    }
    return grouped.flatMap((g) => g.members.map((entry) => ({ kind: 'section', item: entry })));
  }, [term, matches, group, section, grouped]);

  const openTile = useCallback((tile) => {
    if (tile.kind === 'group') { setGroup(tile.item); return; }
    if (tile.kind === 'section') {
      const entry = tile.item;
      const only = entry.destinations.length === 1 ? entry.destinations[0] : null;
      // A section holding one destination IS that destination.
      if (only) { rememberVisit(only); close(); return; }
      setSection(entry);
      return;
    }
    rememberVisit(tile.item);
    close();
  }, [close]);

  /**
   * Keyboard. The keycaps in the search row advertise this as keyboard-driven,
   * so it has to actually be one.
   */
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); return; }

      /*
       * Slot keys jump straight to a module — but only while the search box is
       * empty. Otherwise typing "2 bedroom" would navigate on the first
       * keystroke, which is the kind of shortcut people disable the feature
       * over.
       */
      if (!term && SLOT_KEYS.includes(event.key) && !event.metaKey && !event.ctrlKey) {
        const index = SLOT_KEYS.indexOf(event.key);
        const tile = visibleTiles[index];
        const node = tileRefs.current[index];
        if (tile) {
          event.preventDefault();
          /*
           * Ask the RENDERED TILE what it is, rather than the data behind it.
           *
           * A section holding one destination is rendered as a link — the
           * mouse path follows it and navigates. The keyboard path branched on
           * `tile.kind` instead, saw 'section', and called openTile, which for
           * a collapsed section only closes the launcher. Pressing 1 therefore
           * dismissed the overlay and went nowhere, while clicking the same
           * tile worked. One source of truth: if it is an anchor, click it.
           */
          if (node?.tagName === 'A') node.click();
          else openTile(tile);
          return;
        }
      }

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
         * here: the grid is split into four groups, each its own grid, and a
         * group with three members still lays out across six tracks. Stepping
         * down by six from the second tile in Core skipped the whole of Sales &
         * clients and landed in Finance — which is not where the eye went.
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
  }, [open, close, term, visibleTiles, openTile]);

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

  const heading = term
    ? `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`
    : [section?.section, group?.label].filter(Boolean).join(' → ');

  /** One grid of tiles, used by search and by every drill-in level. */
  const renderTiles = (tiles) => (
    <div className="rx-grid">
      {tiles.map((tile, index) => {
        const entry = tile.item;
        const isGroup = tile.kind === 'group';
        return (
          <Tile
            key={`${tile.kind}-${entry.label || entry.section}-${index}`}
            innerRef={(node) => { tileRefs.current[index] = node; }}
            icon={entry.icon}
            name={entry.label}
            to={isGroup ? undefined : entry.to}
            onOpen={() => openTile(tile)}
            aria-label={isGroup ? `${entry.label} — ${entry.children.length} screens` : undefined}
          />
        );
      })}
    </div>
  );

  return (
    <div className="rx-launcher fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/40 min-[520px]:p-6 min-[900px]:p-10">
      <style>{LAUNCHER_CSS}</style>
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Modules" className="rx-panel relative">
        <div className="rx-search">
          {(section || group) && !term && (
            <button
              type="button"
              onClick={() => (group ? setGroup(null) : setSection(null))}
              aria-label={group ? `Back to ${section?.section || 'the section'}` : 'Back to all modules'}
              style={{ color: 'var(--rx-ink-3)', flexShrink: 0 }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
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
        {!term && !section && !group && recent.length > 0 && (
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
                ? renderTiles(visibleTiles)
                : <p className="rx-empty">Nothing matches “{query.trim()}”.</p>
            ) : (section || group) ? (
              <div className="rx-group">
                <div className="rx-group-head">
                  <span>{heading}</span><i /><span>{visibleTiles.length}</span>
                </div>
                {renderTiles(visibleTiles)}
              </div>
            ) : (
              /*
               * Grouped. A flat grid of twelve equal tiles has no vertical
               * rhythm — the eye reads every label in order because nothing
               * tells it where to start. Four labelled groups cost nothing:
               * the tiles themselves stay identical.
               */
              grouped.map((entry, groupIndex) => {
                const offset = grouped.slice(0, groupIndex)
                  .reduce((total, previous) => total + previous.members.length, 0);
                return (
                  <div className="rx-group" key={entry.id}>
                    <div className="rx-group-head">
                      <span>{entry.label}</span><i /><span>{entry.members.length}</span>
                    </div>
                    <div className="rx-grid">
                      {entry.members.map((member, index) => {
                        const position = offset + index;
                        const only = member.destinations.length === 1 ? member.destinations[0] : null;
                        // A section holding one destination is named after what
                        // it OPENS — "General" that lands on Notifications is a
                        // tile that lied about where it went.
                        const name = only ? only.label : (member.section || 'More');
                        const icon = (only || member.destinations[0]).icon;
                        return (
                          <Tile
                            key={name}
                            innerRef={(node) => { tileRefs.current[position] = node; }}
                            icon={icon}
                            name={name}
                            /* Keyed by section name, falling back to the tile's
                               own name — Dashboard has no section name, which
                               is the same gap that put it in "More". */
                            description={DESCRIPTIONS[member.section] ?? DESCRIPTIONS[name]}
                            slot={SLOT_KEYS[position]}
                            to={only?.to}
                            onOpen={() => openTile({ kind: 'section', item: member })}
                            aria-label={only ? undefined : `${name} — ${member.destinations.length} screens`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
