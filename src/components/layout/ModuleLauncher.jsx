import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Bell, ChevronRight, LayoutGrid, Search, X,
} from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import { LAUNCHER_CSS } from './launcherStyles';
import { DESCRIPTIONS, orderTiles } from './launcherGroups';
import { rememberVisit, recentVisits } from './recentScreens';
import NavBadge from './NavBadge';
import { focusUnlessTouch, dismissKeyboard } from '../../utils/softKeyboard';
import useNavBadgeStore from '../../store/navBadgeStore';
import { useAppearance } from '../../context/useAppearance';
import {
  darkerOf, mixHex, readableOn, readableTextOn,
} from '../../utils/colorUtils';
import { accentSlotFor, accentStyle, parseAccents } from './launcherPalette';

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
 * ── Two shapes, chosen by how much there is to show ─────────────────────────
 *
 * GROUPED, for staff and realtors. One tile per module, filling the page, and
 * opening one shows the screens inside it — at the same size, so a tile does
 * not shrink as you go deeper. An administrator can see 52 screens across eight
 * menus; laid out at once that is a wall to be read rather than a menu to be
 * scanned, and the eight-tile top level is the thing that can be learned by
 * position.
 *
 * FLAT, for clients. A handful of screens about the one property they are
 * buying, on the page in rows headed by the menu they belong to. A drill-in
 * over four tiles would charge a click and a change of context to save
 * nothing.
 *
 * The split is `effectiveType`, the same value that decides whether the Settings
 * tile exists — so a member of staff who switches to their realtor profile gets
 * the realtor's launcher, which is the right answer for both.
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

    /*
     * Settings used to be appended here by hand, because it was not a navConfig
     * entry anywhere. It is one now — Operations & Support — so it arrives
     * through the same filter as everything else, carrying its own permission
     * rather than a user-type test copied from the other templates.
     */
    return sections;
  }, [hasPermission, isSuperiorAdmin, userType]);
};

/**
 * Slot keys in layout order: 1–9, then 0 for the tenth.
 *
 * Grouped mode only. A slot key promises a position is worth memorising, which
 * holds for a twelve-tile top level and does not hold across a flat list of 52,
 * where which ten get a digit is an accident of permissions.
 */
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * One module card.
 *
 * ── The card is the colour, and the colour is the company's ─────────────────
 *
 * Each module takes a slot in the company's launcher palette (see
 * launcherPalette): the icon tile is that colour, the card is a pale tint of
 * it, the chevron sits in a slightly stronger tint. Every foreground is derived
 * from the colour behind it, so a company can pick any palette and nothing on
 * the card stops being legible.
 *
 * ── Two ways in ─────────────────────────────────────────────────────────────
 *
 * The whole card opens the module (a link when it goes somewhere, a button
 * when it opens a drawer — its ::after covers the card). Below that, on wider
 * screens, the first few screens inside the module are their own links, so the
 * one somebody wants most is one click from the launcher rather than two.
 * They sit above the card's cover so each is a target of its own, and nothing
 * interactive is nested inside anything else.
 */
function Card({
  icon: Icon, name, description, slot, badge, onOpen, to, innerRef, accent, links = [], onLink, more = 0, ...props
}) {
  const body = (
    <>
      {slot && <span className="rx-slot" aria-hidden="true">{slot}</span>}
      {/* Decorative: the name is the accessible name. */}
      <span className="rx-ic"><Icon aria-hidden="true" strokeWidth={1.9} /></span>
      <span className="rx-name">{name}</span>
      {description && <span className="rx-desc">{description}</span>}
      <span className="rx-chev" aria-hidden="true"><ChevronRight strokeWidth={2.25} /></span>
    </>
  );

  return (
    <div className="rx-card" style={accentStyle(accent)}>
      {to
        ? <Link ref={innerRef} to={to} className="rx-card-main" onClick={onOpen} {...props}>{body}</Link>
        : <button ref={innerRef} type="button" className="rx-card-main" onClick={onOpen} {...props}>{body}</button>}
      {badge}
      {links.length > 0 && (
        <div className="rx-card-links">
          {links.map((item) => (
            <Link key={item.to} to={item.to} className="rx-card-link" onClick={() => onLink?.(item)}>
              {item.label}
            </Link>
          ))}
          {more > 0 && <span className="rx-card-more">+{more} more</span>}
        </div>
      )}
    </div>
  );
}

/** How many of a module's screens appear on its card as shortcuts. */
const SHORTCUTS = 3;

/** The leaves under a nav entry, in order — what a card's shortcuts are drawn from. */
const leavesOf = (items = []) => items.flatMap((item) => (item.children?.length ? leavesOf(item.children) : [item]));

/**
 * Where the launcher was standing when it sent you somewhere.
 *
 * ── Why this is remembered at all ───────────────────────────────────────────
 *
 * Drilling to a sub-menu is work: two clicks and a change of context. Somebody
 * who opened Payables from inside Finance and comes back to the menu is almost
 * always after its neighbour — the Ledger, the Statements — and putting them
 * at the top level makes them redo both clicks to get back to where they
 * already were.
 *
 * ── And why only when you are still on that page ────────────────────────────
 *
 * The restore is tied to the destination, not to the launcher. Once you have
 * moved on somewhere else, the sub-menu you drilled through is no longer where
 * you were; reopening at the top is then the honest answer rather than a stale
 * one. Held outside the component so it survives a remount, and holding two
 * labels rather than the objects themselves, so a navConfig rebuilt from a
 * changed permission set cannot restore a level that no longer exists.
 */
let lastDrill = null;

export default function ModuleLauncher({ open, onClose, returnFocusTo }) {
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(null);
  const [group, setGroup] = useState(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const sections = useSections();
  /*
   * Grouped for staff and realtors; flat for clients.
   *
   * A realtor sees seven modules, which is a menu worth grouping — their own
   * hub, their people, their commissions. A client sees a handful of screens
   * about the one property they are buying, and a drill-in over four tiles
   * charges a click and a change of context to save nothing.
   */
  const userType = useAuthStore((s) => s.effectiveType());
  const isGrouped = userType !== 'client';
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const tileRefs = useRef([]);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setShowOverflow(false);
    // Desktop only — see softKeyboard. On a phone the launcher opens without
    // the keyboard covering the tiles it just showed.
    focusUnlessTouch(searchRef.current);

    /*
     * Back to the sub-menu you came through, not to the top.
     *
     * Only while you are still on the page it sent you to — see lastDrill.
     * The levels are re-resolved from the CURRENT sections rather than
     * restored as objects, so a menu rebuilt since (a permission changed, a
     * screen retired) cannot put back a level that no longer exists; it falls
     * to whatever part of the path still resolves, and to the top if none of
     * it does.
     */
    const remembered = lastDrill && lastDrill.to === pathname ? lastDrill : null;
    const restoredSection = remembered
      ? sections.find((entry) => entry.section === remembered.section) || null
      : null;
    const restoredGroup = restoredSection && remembered.group
      ? (restoredSection.items || []).find((item) => item.label === remembered.group) || null
      : null;

    setSection(restoredSection);
    setGroup(restoredGroup);
  }, [open, pathname, sections]);

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

  /**
   * The tiles on the grouped top level.
   *
   * One per module, except where a section carries `flattenInLauncher` — then
   * its screens stand as tiles of their own. Realtor Hub is the case: two
   * screens a realtor uses constantly, behind a tile that would open a drawer
   * of two, and flattening them completes the grid at eight.
   *
   * A section holding ONE destination is named after what it opens: "General"
   * landing on Notifications was a tile that lied about where it went.
   */
  const moduleTiles = useMemo(() => sections.flatMap((entry) => {
    /* `true` flattens for everyone; a list flattens only for those types. */
    const flatten = Array.isArray(entry.flattenInLauncher)
      ? entry.flattenInLauncher.includes(userType)
      : Boolean(entry.flattenInLauncher);
    if (flatten) {
      return entry.destinations.map((item) => ({
        kind: 'link', item, name: item.label, icon: item.icon, to: item.to,
      }));
    }
    const only = entry.destinations.length === 1 ? entry.destinations[0] : null;
    return [{
      kind: 'section',
      item: entry,
      name: only ? only.label : (entry.section || 'More'),
      icon: (only || entry.destinations[0]).icon,
      to: only?.to,
      count: entry.destinations.length,
    }];
  }), [sections, userType]);

  /* Staff keep navConfig's order; a realtor's is declared — see launcherGroups. */
  /**
   * The top level, as one list.
   *
   * Staff and realtors get a tile per module; a client gets a tile per screen.
   * Past this point the two are the same thing — ordered, capped and rendered
   * by the same code — so the cap cannot apply to one shape and not the other.
   */
  const topLevelTiles = useMemo(() => (isGrouped
    ? moduleTiles
    : rows.flatMap((row) => row.tiles).map((item) => ({
      kind: 'link', item, name: item.label, icon: item.icon, to: item.to,
    }))), [isGrouped, moduleTiles, rows]);

  const orderedModuleTiles = useMemo(
    () => orderTiles(topLevelTiles, userType), [topLevelTiles, userType],
  );

  /**
   * Eight tiles, never nine.
   *
   * The grid is two rows of four, and the counts that fall out of navConfig
   * happen to be eight for a company admin, a realtor and a client today. They
   * are not guaranteed to be: a platform administrator sees Platform Admin as a
   * ninth, and any new section or permission moves the number again. A grid
   * that silently grows a third row of one stops being the thing people learn
   * by position.
   *
   * So the eighth tile becomes More whenever there would have been a ninth,
   * and everything from the eighth onwards goes inside it. Seven plus More,
   * rather than eight plus More, because the eighth would otherwise be pushed
   * out by the tile that exists to hold what was pushed out.
   */
  const MAX_TILES = 8;
  const { mainTiles, overflowTiles } = useMemo(() => {
    if (orderedModuleTiles.length <= MAX_TILES) {
      return { mainTiles: orderedModuleTiles, overflowTiles: [] };
    }
    return {
      mainTiles: orderedModuleTiles.slice(0, MAX_TILES - 1),
      overflowTiles: orderedModuleTiles.slice(MAX_TILES - 1),
    };
  }, [orderedModuleTiles]);

  const close = useCallback(() => {
    onClose();
    // Leaving the launcher takes the keyboard with it, rather than leaving it
    // over the page underneath.
    dismissKeyboard();
    returnFocusTo?.current?.focus();
  }, [onClose, returnFocusTo]);

  /**
   * What is on screen now, in visual order — for the slot keys.
   *
   * Only grouped mode needs this: the flat rows have no drill-in levels to
   * describe and no slot keys to resolve, and their arrow keys read the layout
   * itself rather than an index.
   */
  const visibleTiles = useMemo(() => {
    if (!isGrouped) return [];
    if (term) return matches.map((item) => ({ kind: 'link', item }));
    if (group) return group.children.map((item) => ({ kind: 'link', item }));
    if (section) {
      return section.items.map((item) => (item.children ? { kind: 'group', item } : { kind: 'link', item }));
    }
    if (showOverflow) return overflowTiles;
    return mainTiles;
  }, [isGrouped, term, matches, group, section, showOverflow, mainTiles, overflowTiles]);

  /**
   * Remember the level this destination was opened from.
   *
   * Called at every place a leaf can be clicked rather than inside `close`,
   * because closing also happens on Escape and on a click outside — neither of
   * which went anywhere, and neither of which should leave a level behind to
   * be restored.
   */
  const noteDrill = useCallback((item) => {
    lastDrill = item?.to
      ? { to: item.to, section: section?.section ?? null, group: group?.label ?? null }
      : null;
  }, [section, group]);

  const openTile = useCallback((tile) => {
    if (tile.kind === 'overflow') { setShowOverflow(true); return; }
    if (tile.kind === 'group') { setGroup(tile.item); return; }
    if (tile.kind === 'section') {
      const entry = tile.item;
      const only = entry.destinations.length === 1 ? entry.destinations[0] : null;
      // A section holding one destination IS that destination.
      if (only) { rememberVisit(only); noteDrill(only); close(); return; }
      setSection(entry);
      return;
    }
    rememberVisit(tile.item);
    noteDrill(tile.item);
    close();
  }, [close, noteDrill]);

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
  }, [open, close, term, visibleTiles, openTile]);

  const appearance = useAppearance();
  const user = useAuthStore((s) => s.user);
  const unread = useNavBadgeStore((state) => state.counts.unreadNotifications) || 0;
  const palette = useMemo(() => parseAccents(appearance?.accent_colors), [appearance?.accent_colors]);

  /**
   * The brand surfaces — header, banner, footer — and the ink each carries.
   *
   * Read from the COMPUTED --primary / --secondary rather than the raw
   * settings, so dark-mode brightening and a shared link's branding are
   * followed. Every foreground is chosen against the colour it actually sits
   * on, because a tenant's primary can be anything: white on #d6c7cb is 1.6:1.
   *
   *   hero     the header band, primary into a touch of the secondary
   *   banner   the welcome panel, the DARKER of the two brand colours, so its
   *            weight holds whichever way round they were entered
   *   badge    the pill on the banner, in the primary
   *   focus    the focus ring, held at 3:1 against the white page
   */
  const brand = useMemo(() => {
    if (!open) return null;
    const styles = getComputedStyle(document.documentElement);
    const hex = (name, fallback) => {
      const value = styles.getPropertyValue(name).trim();
      return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    };
    const primary = hex('--primary', '#1e3a8a');
    const secondary = hex('--secondary', '#0f172a');
    const heroEnd = mixHex(primary, secondary, 0.35);
    // The ink has to hold across the whole gradient, so it is judged against
    // the end it contrasts with LEAST.
    const heroInk = readableTextOn(mixHex(primary, heroEnd, 0.5));
    const banner = darkerOf(primary, secondary);
    return {
      '--rx-hero-a': primary,
      '--rx-hero-b': heroEnd,
      '--rx-on-hero': heroInk,
      '--rx-banner': banner,
      '--rx-banner-2': mixHex(banner, primary, 0.45),
      '--rx-on-banner': readableTextOn(banner),
      '--rx-badge-bg': primary,
      '--rx-on-badge': readableTextOn(primary),
      '--rx-focus': readableOn(primary, '#ffffff', 3),
    };
    // The settings are not read here — the computed variables are — but they
    // are what CHANGES those variables, so they are what re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appearance?.primary_color, appearance?.secondary_color,
    appearance?.dark_primary_color, appearance?.dark_secondary_color, appearance?.dark_mode]);

  const recent = useMemo(() => (open ? recentVisits(allDestinations) : []), [open, allDestinations]);

  if (!open) return null;

  tileRefs.current = [];

  const heading = [section?.section, group?.label].filter(Boolean).join(' → ');
  const colourOf = (name) => palette[accentSlotFor(name)];
  // Inside a module every card wears the module's colour, so drilling in reads
  // as going deeper into the same place rather than somewhere new.
  const levelAccent = section ? colourOf(section.section) : null;
  const leave = (item) => { rememberVisit(item); noteDrill(item); close(); };

  /**
   * The module cards — modules for staff and realtors, screens for a client,
   * and the same code for the overflow behind More.
   */
  const renderModuleTiles = (tiles, offset = 0) => (
    <div className="rx-cards">
      {tiles.map((tile, index) => {
        // A tile that GOES somewhere takes its own words; only a tile that opens
        // a drawer speaks for the section behind it. A realtor's Finance holds
        // one screen, My Commissions, and was describing itself as "Invoices
        // and payments".
        const opensDrawer = !tile.to;
        const inside = tile.kind === 'section' && opensDrawer ? tile.item.destinations : [];
        return (
          <Card
            key={tile.name}
            innerRef={(node) => { tileRefs.current[offset + index] = node; }}
            icon={tile.icon}
            name={tile.name}
            accent={colourOf(tile.name)}
            description={opensDrawer
              ? (DESCRIPTIONS[tile.item.section] ?? DESCRIPTIONS[tile.name])
              : DESCRIPTIONS[tile.name]}
            slot={SLOT_KEYS[offset + index]}
            /*
             * The count of work waiting inside, on the card that opens it.
             * NavBadge sums every badged leaf beneath whatever it is given,
             * which is how the sidebar puts the same number on a collapsed
             * section.
             */
            badge={opensDrawer
              ? <NavBadge items={tile.item.items} className="rx-badge" />
              : <NavBadge item={tile.item} className="rx-badge" />}
            to={tile.to}
            onOpen={() => openTile(tile)}
            links={inside.slice(0, SHORTCUTS)}
            more={Math.max(inside.length - SHORTCUTS, 0)}
            onLink={(item) => { rememberVisit(item); lastDrill = null; close(); }}
            aria-label={opensDrawer ? `${tile.name} — ${tile.count} screens` : undefined}
          />
        );
      })}
    </div>
  );

  /** Inside a module: its screens, and its sub-menus as cards of their own. */
  const renderEntries = (tiles) => (
    <div className="rx-cards">
      {tiles.map((tile, index) => {
        const entry = tile.item;
        const isDrawer = tile.kind === 'group';
        const inside = isDrawer ? leavesOf(entry.children) : [];
        return (
          <Card
            key={`${tile.kind}-${entry.label || entry.section}-${index}`}
            innerRef={(node) => { tileRefs.current[index] = node; }}
            icon={entry.icon}
            name={entry.label}
            accent={levelAccent || colourOf(entry.label)}
            description={isDrawer ? `${inside.length} screens` : null}
            slot={SLOT_KEYS[index]}
            to={isDrawer ? undefined : entry.to}
            // The same count carried down one fold at a time — see NavBadge.
            badge={<NavBadge item={entry} className="rx-badge" />}
            onOpen={() => openTile(tile)}
            links={inside.slice(0, SHORTCUTS)}
            more={Math.max(inside.length - SHORTCUTS, 0)}
            onLink={leave}
            aria-label={isDrawer ? `${entry.label} — ${entry.children.length} screens` : undefined}
          />
        );
      })}
    </div>
  );

  /** Search results, each in the colour of the module it belongs to. */
  const renderTiles = (items, offset = 0) => (
    <div className="rx-cards">
      {items.map((item, index) => (
        <Card
          key={item.to}
          innerRef={(node) => { tileRefs.current[offset + index] = node; }}
          icon={item.icon}
          name={item.label}
          description={item.section || null}
          accent={colourOf(item.section || item.label)}
          to={item.to}
          onOpen={() => leave(item)}
        />
      ))}
    </div>
  );

  const appName = appearance?.app_name || 'Realx8';
  const logo = appearance?.app_logo;
  const initials = (user?.name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0].toUpperCase()).join('');
  // Only an http(s) image is drawn — the value is company-supplied text.
  const bannerImage = /^https?:\/\/\S+$/i.test(appearance?.launcher_banner_image || '')
    ? appearance.launcher_banner_image : null;
  const atTop = !term && !section && !group && !showOverflow;

  return (
    <div className="rx-launcher fixed inset-0 z-[70] flex bg-slate-900/40">
      <style>{LAUNCHER_CSS}</style>
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Modules"
        className={`rx-panel relative${isGrouped ? ' rx-panel-grouped' : ''}`}
        style={brand || undefined}
      >
        <div className="rx-scroll">
          <header className="rx-hero">
            <div className="rx-hero-row">
              <Link to="/" onClick={close} aria-label={`${appName} — home`}><Brand logo={logo} name={appName} /></Link>
              <div className="rx-hero-actions">
                <Link
                  to="/notifications"
                  onClick={close}
                  className="rx-hero-btn"
                  aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                >
                  <Bell aria-hidden="true" />
                  {unread > 0 && <span className="rx-hero-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
                </Link>
                <Link to="/profile" onClick={close} className="rx-avatar" aria-label="Your profile">
                  {initials}
                </Link>
                <button type="button" onClick={close} className="rx-hero-btn" aria-label="Close modules">
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>
          </header>

          <div className="rx-search">
            {(section || group || showOverflow) && !term && (
              <button
                type="button"
                className="rx-search-back"
                onClick={() => {
                  if (group) return setGroup(null);
                  if (section) return setSection(null);
                  return setShowOverflow(false);
                }}
                aria-label={group ? `Back to ${section?.section || 'the section'}` : 'Back to all modules'}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Search aria-hidden="true" size={20} className="rx-search-icon" />
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
          </div>

          <div className="rx-content">
            {atTop && (
              <section className="rx-banner" aria-label="Welcome">
                <div className="rx-banner-text">
                  <span className="rx-banner-kicker">Welcome back,</span>
                  <span className="rx-banner-name">{user?.name || 'there'}</span>
                  <span className="rx-banner-lead">
                    {appearance?.launcher_welcome_text
                      || 'Manage your properties, clients, transactions and more — all in one place.'}
                  </span>
                </div>
                <div className="rx-banner-art" aria-hidden="true">
                  {bannerImage ? <img src={bannerImage} alt="" /> : <Skyline />}
                </div>
                <span className="rx-banner-badge">
                  <span className="rx-bars" aria-hidden="true"><i /><i /><i /></span>
                  {appearance?.launcher_badge || 'Grow · Track · Succeed'}
                </span>
              </section>
            )}

            {/* Recently visited: most launcher trips are return trips, and a chip
                answers that in a glance where a grid needs a scan. */}
            {!term && recent.length > 0 && atTop && (
              <div className="rx-recent">
                <span className="rx-recent-label">Recent</span>
                {recent.map((item) => (
                  <Link key={item.to} to={item.to} className="rx-chip" onClick={() => leave(item)}>
                    <item.icon aria-hidden="true" size={13} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            <nav aria-label="Modules">
              {term ? (
                matches.length
                  ? (
                    <div className="rx-group">
                      <div className="rx-group-head"><span>Results</span><i /><span>{matches.length}</span></div>
                      {renderTiles(matches)}
                    </div>
                  )
                  : <p className="rx-empty">Nothing matches “{query.trim()}”.</p>
              ) : (section || group) ? (
                <div className="rx-group">
                  <div className="rx-group-head"><span>{heading}</span><i /><span>{visibleTiles.length}</span></div>
                  {renderEntries(visibleTiles)}
                </div>
              ) : showOverflow ? (
                <div className="rx-group">
                  <div className="rx-group-head"><span>More</span><i /><span>{overflowTiles.length}</span></div>
                  {renderModuleTiles(overflowTiles)}
                </div>
              ) : (
                /* The top level: never more than eight — see the cap. */
                renderModuleTiles(mainTiles.concat(overflowTiles.length ? [{
                  kind: 'overflow',
                  name: 'More',
                  icon: LayoutGrid,
                  item: { items: overflowTiles.map((t) => t.item) },
                  count: overflowTiles.length,
                }] : []))
              )}
            </nav>
          </div>

          <footer className="rx-footer">
            <Brand logo={logo} name={appName} small />
            <span className="rx-footer-tag">{appearance?.app_tagline || 'Smarter tools. Greater results.'}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

/** The company's logo and name, on the header and again in the footer. */
function Brand({ logo, name, small = false }) {
  return (
    <span className={`rx-brand${small ? ' rx-brand-sm' : ''}`}>
      {logo
        ? <img src={logo} alt="" className="rx-brand-logo" />
        : <span className="rx-brand-mark" aria-hidden="true">{name.charAt(0)}</span>}
      <span className="rx-brand-name">{name}</span>
    </span>
  );
}

/**
 * The banner's picture when a company has not supplied one: a row of
 * buildings in the banner's own ink, faint enough to stay decoration.
 */
function Skyline() {
  return (
    <svg viewBox="0 0 240 120" preserveAspectRatio="xMaxYMax meet" focusable="false">
      <g fill="currentColor">
        <rect x="18" y="58" width="30" height="62" rx="2" opacity=".35" />
        <rect x="54" y="30" width="38" height="90" rx="2" opacity=".55" />
        <rect x="98" y="46" width="28" height="74" rx="2" opacity=".4" />
        <path d="M134 120V62l34-24 34 24v58z" opacity=".7" />
        <rect x="206" y="72" width="26" height="48" rx="2" opacity=".35" />
      </g>
      <g fill="currentColor" opacity=".9">
        {[0, 1, 2, 3].map((row) => [0, 1].map((col) => (
          <rect key={`${row}-${col}`} x={62 + col * 14} y={40 + row * 18} width="8" height="9" rx="1" opacity=".35" />
        )))}
        <rect x="160" y="92" width="16" height="28" rx="1" opacity=".35" />
      </g>
    </svg>
  );
}
