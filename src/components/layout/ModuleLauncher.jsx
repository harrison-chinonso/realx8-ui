import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Search, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import { LAUNCHER_CSS } from './launcherStyles';
import { DESCRIPTIONS, orderTiles } from './launcherGroups';
import { rememberVisit, recentVisits } from './recentScreens';
import NavBadge from './NavBadge';

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
 * One tile. Identical to every other tile — no featured one, no per-module
 * colour, no counts. Only the words change.
 *
 * A link when it goes somewhere, a button when it opens a drawer. The
 * description is the two words saying what a module HOLDS, so it appears on the
 * grouped tiles and not on a tile that already names the screen it opens.
 */
function Tile({ icon: Icon, name, description, slot, badge, onOpen, to, innerRef, ...props }) {
  const body = (
    <>
      {slot && <span className="rx-slot" aria-hidden="true">{slot}</span>}
      {/* Top-right, where the slot key used to sit — the slot key is on hover
          only and moved to the left, because a count that is always there
          should not have something appearing on top of it. */}
      {badge}
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
    searchRef.current?.focus();

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

  /**
   * Resolve the brand colours, and the ink each one can actually carry.
   *
   * ── Where the two colours land ───────────────────────────────────────────
   *
   * The primary fills the ICON, not the tile: at rest a tile is the neutral
   * surface it always was, with one brand-coloured chip in the middle of it.
   * The secondary fills the whole tile on hover, so the colour arrives as an
   * event rather than as wallpaper — sixty tiles at rest stay quiet, and the
   * one under the pointer is unmistakable.
   *
   * ── Why it is computed and not written in CSS ────────────────────────────
   *
   * Both colours end up carrying something: a glyph on the chip, and the whole
   * tile's text on hover. A tenant colour can be anything — #CCCCCC under
   * white is 1.6:1, invisible — so neither foreground can be a fixed value.
   * They are derived from the fills here, once, when the launcher opens.
   *
   * ── And why the hover is not simply the secondary ────────────────────────
   *
   * A secondary close to the resting surface is a hover nobody sees: the
   * pointer moves, the tile does nothing, and the interface feels dead rather
   * than themed. The secondary is used exactly as given when it reads as a
   * change against the resting tile, and moved away from it when it does not.
   */
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const styles = getComputedStyle(panel);

    /** '#1e3a8a' or 'rgb(30, 58, 138)' → [30, 58, 138]. */
    const toRgb = (value) => {
      const text = String(value || '').trim();
      const hex = /^#?([0-9a-f]{6})$/i.exec(text);
      if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
      const rgb = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
      return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
    };

    const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

    // WCAG relative luminance — linearised, unlike the quick Rec. 709 average,
    // because it is being used for a contrast RATIO and not just a threshold.
    const luminance = ([r, g, b]) => {
      const channel = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    const WHITE = [255, 255, 255];
    const BLACK = [0, 0, 0];
    const INK = [22, 24, 26];           // --rx-ink

    const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);

    /**
     * The ink a fill carries: whichever of the two reads better ON it.
     *
     * Measured, not thresholded. A luminance cutoff gets the ends of the range
     * right and the middle wrong — #FF00AA sits just under it and takes white
     * at 3.6:1, while the dark ink on the same pink is 5.8:1. The question is
     * which contrasts more, so that is the question asked.
     */
    const inkFor = (fill) => (ratio(fill, WHITE) >= ratio(fill, INK) ? WHITE : INK);

    /**
     * Move a fill until its ink is legible on it.
     *
     * Some colours cannot carry either ink at 4.5:1 — a mid-tone teal is about
     * 2.6 against white and 4.1 against the ink, and no choice of foreground
     * fixes that. The fill itself has to give a little: away from the ink, in
     * 4% steps, until it clears AA or the cap stops it.
     *
     * This is the one place the tenant's colour is not reproduced exactly, and
     * it is the right place. The tile name is the primary navigation of the
     * application; a brand shade that cannot be read is not a brand decision
     * anyone made on purpose. Colours that already pass — most do — are
     * untouched.
     */
    const legible = (fill, ink, min = 4.5) => {
      const away = ink === WHITE ? BLACK : WHITE;
      let out = fill;
      for (let i = 0; i < 14 && ratio(out, ink) < min; i += 1) out = mix(out, away, 0.04);
      return out;
    };

    /** Toward white for a dark colour, toward black for a light one. */
    const lift = (rgb, amount) => mix(rgb, luminance(rgb) > 0.35 ? BLACK : WHITE, amount);

    /**
     * Has the colour visibly changed?
     *
     * A contrast ratio alone is the wrong question, and measuring proved it:
     * #FF00AA to #00B3A4 — magenta to teal, about as different as two colours
     * get — scores 1.43, because the two sit at nearly the same LIGHTNESS. A
     * ratio only ever sees lightness. Meanwhile #1e3a8a to #0f172a, two navies,
     * scores 1.72 on the strength of lightness alone and reads clearly.
     *
     * Both are real changes, arrived at differently, so both count: a lightness
     * step of 1.5:1, or a straight-line distance of 72 in RGB, which is about
     * where a hue shift stops being a shade of the same colour. Requiring both
     * would have dragged the teal through a pointless lightening; requiring
     * neither leaves the identical-colour case with no hover at all.
     */
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const distinct = (a, b) => ratio(a, b) >= 1.5 || distance(a, b) >= 72;

    const primaryRaw = toRgb(styles.getPropertyValue('--rx-accent'));
    if (!primaryRaw) return;
    const secondaryRaw = toRgb(styles.getPropertyValue('--secondary')) || primaryRaw;
    // The tile at rest, which is what the hover has to distinguish itself from.
    const resting = toRgb(styles.getPropertyValue('--rx-surface-2')) || [245, 245, 242];

    /*
     * The chip. Adjusted only if its own glyph would not be legible on it —
     * most brand colours carry one of the two inks comfortably and pass through
     * untouched.
     */
    const icon = legible(primaryRaw, inkFor(primaryRaw));

    /*
     * The hover fill, separated from the RESTING tile rather than from the
     * primary — that is what the eye compares it against now.
     *
     * Separate, then make legible, then check the separation survived: the
     * second step can walk the colour back toward the first. Three passes is
     * enough for every palette tried and cannot loop for ever on one that is
     * pathological.
     */
    let hover = secondaryRaw;
    for (let pass = 0; pass < 3; pass += 1) {
      for (let i = 0; i < 12 && !distinct(resting, hover); i += 1) hover = lift(hover, 0.08);
      const adjusted = legible(hover, inkFor(hover));
      const settled = adjusted === hover || distinct(resting, adjusted);
      hover = adjusted;
      if (settled) break;
    }

    /*
     * The focus ring sits on the panel, outside the tile, so it is the brand
     * colour against white — and a pale brand against white is a ring a
     * keyboard user cannot find. Darkened until it holds 3:1 there, which is
     * the threshold for a non-text indicator.
     */
    const focus = legible(primaryRaw, WHITE, 3);

    panel.style.setProperty('--rx-fill-icon', toHex(icon));
    panel.style.setProperty('--rx-on-icon', toHex(inkFor(icon)));
    panel.style.setProperty('--rx-fill-hover', toHex(hover));
    panel.style.setProperty('--rx-on-fill-hover', toHex(inkFor(hover)));
    panel.style.setProperty('--rx-focus', toHex(focus));
  }, [open]);

  const recent = useMemo(() => (open ? recentVisits(allDestinations) : []), [open, allDestinations]);

  if (!open) return null;

  tileRefs.current = [];

  /**
   * One grid of screens. `offset` keeps tileRefs in visual order across the
   * rows, which is the order the arrow keys walk.
   */
  const heading = [section?.section, group?.label].filter(Boolean).join(' → ');

  /**
   * A grid of top-level tiles — modules for staff and realtors, screens for a
   * client, and the same code for the overflow behind More.
   */
  const renderModuleTiles = (tiles, offset = 0) => (
    <div className="rx-modules">
      {tiles.map((tile, index) => {
        // A tile that GOES somewhere takes its own words; only a tile that opens
        // a drawer speaks for the section behind it. A realtor's Finance holds
        // one screen, My Commissions, and was describing itself as "Invoices
        // and payments".
        const opensDrawer = !tile.to;
        return (
          <Tile
            key={tile.name}
            innerRef={(node) => { tileRefs.current[offset + index] = node; }}
            icon={tile.icon}
            name={tile.name}
            description={opensDrawer
              ? (DESCRIPTIONS[tile.item.section] ?? DESCRIPTIONS[tile.name])
              : DESCRIPTIONS[tile.name]}
            slot={SLOT_KEYS[offset + index]}
            /*
             * The count of work waiting inside, on the tile that opens it.
             *
             * Payment Approvals is three levels down — Finance, then Payments,
             * then the screen — so without this the badge exists and is behind
             * two folds, which is where a notification is no use. NavBadge sums
             * every badged leaf beneath whatever it is given, which is how the
             * sidebar templates put the same number on a collapsed section.
             */
            badge={opensDrawer
              ? <NavBadge items={tile.item.items} className="rx-badge" />
              : <NavBadge item={tile.item} className="rx-badge" />}
            to={tile.to}
            onOpen={() => openTile(tile)}
            aria-label={opensDrawer ? `${tile.name} — ${tile.count} screens` : undefined}
          />
        );
      })}
    </div>
  );

  /** A grid of tiles built from drill-in entries, which may open rather than go. */
  const renderEntries = (tiles) => (
    <div className="rx-modules">
      {tiles.map((tile, index) => {
        const entry = tile.item;
        const isDrawer = tile.kind === 'group';
        return (
          <Tile
            key={`${tile.kind}-${entry.label || entry.section}-${index}`}
            innerRef={(node) => { tileRefs.current[index] = node; }}
            icon={entry.icon}
            name={entry.label}
            to={isDrawer ? undefined : entry.to}
            /*
             * The same count carried down from the module tile, one level at a
             * time, instead of stopping at the first fold.
             *
             * renderModuleTiles put the badge on Finance because Payment
             * Approvals is three folds deep; this is the SECOND and THIRD of
             * those folds — the "Income" group tile, and then the "Payment
             * Approvals" tile itself once inside Income. Leaving it off here
             * meant the count vanished the moment you opened the very drawer it
             * was telling you to open, which read as the badge having been
             * wrong. NavBadge already sums recursively, so a group tile (entry
             * has children) and a leaf tile (entry does not) both work from the
             * same prop.
             */
            badge={<NavBadge item={entry} className="rx-badge" />}
            onOpen={() => openTile(tile)}
            aria-label={isDrawer ? `${entry.label} — ${entry.children.length} screens` : undefined}
          />
        );
      })}
    </div>
  );

  const renderTiles = (items, offset = 0) => (
    <div className="rx-grid">
      {items.map((item, index) => (
        <Tile
          key={item.to}
          innerRef={(node) => { tileRefs.current[offset + index] = node; }}
          icon={item.icon}
          name={item.label}
          to={item.to}
          onOpen={() => { rememberVisit(item); noteDrill(item); close(); }}
        />
      ))}
    </div>
  );

  return (
    <div className="rx-launcher fixed inset-0 z-[70] flex bg-slate-900/40">
      <style>{LAUNCHER_CSS}</style>
      <div className="absolute inset-0" onClick={close} aria-hidden="true" />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Modules" className={`rx-panel relative${isGrouped ? ' rx-panel-grouped' : ''}`}>
        <div className="rx-search">
          {(section || group || showOverflow) && !term && (
            <button
              type="button"
              onClick={() => {
                if (group) return setGroup(null);
                if (section) return setSection(null);
                return setShowOverflow(false);
              }}
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
        {!term && recent.length > 0 && (
          <div className="rx-recent">
            <span className="rx-recent-label">Recent</span>
            {recent.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rx-chip"
                onClick={() => { rememberVisit(item); noteDrill(item); close(); }}
              >
                <item.icon aria-hidden="true" size={13} />
                {item.label}
              </Link>
            ))}
          </div>
        )}

        {/*
          Every view but search fills the page: the modules, the screens inside
          one of them, and a client's flat list. Search results still scroll,
          being a list of unknown length rather than a fixed grid.
        */}
        <div className={`rx-body${term ? '' : ' rx-body-modules'}`}>
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
            ) : (section || group) ? (
              /* Inside a module: the screens it holds, or the drawer's contents. */
              <div className="rx-group">
                <div className="rx-group-head">
                  <span>{heading}</span><i /><span>{visibleTiles.length}</span>
                </div>
                {renderEntries(visibleTiles)}
              </div>
            ) : showOverflow ? (
              /* Behind More: everything the eight-tile grid could not hold. */
              <div className="rx-group">
                <div className="rx-group-head">
                  <span>More</span><i /><span>{overflowTiles.length}</span>
                </div>
                {renderModuleTiles(overflowTiles)}
              </div>
            ) : (
              /*
               * The top level: four across the top, four across the bottom.
               *
               * Staff and realtors see a tile per module; a client sees a tile
               * per screen, because grouping a client's four menus would give
               * four tiles each opening one or two things. Either way the grid
               * is the same shape and never more than eight — see the cap.
               */
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
      </div>
    </div>
  );
}
