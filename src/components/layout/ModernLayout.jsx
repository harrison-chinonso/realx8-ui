/**
 * ModernLayout — full-width top navigation bar.
 *
 * Nav strategy to avoid overflow:
 *  • PRIMARY sections (shown directly in nav bar as dropdowns)
 *  • SECONDARY sections (collapsed into a single "More ▼" dropdown)
 *  • Account items (Profile / Settings) always in the user-avatar dropdown
 */
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Bell, ChevronDown, User, LogOut, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import { useAppearance } from '../../context/useAppearance';
import { listNotifications } from '../../api/notificationApi';
import Button from '../ui/Button';
import ProfileToggle from '../common/ProfileToggle';
import NavBadge from './NavBadge';

// Only these sections get their own nav-bar dropdown; everything else → More
/**
 * Which sections sit in the top bar is declared BY THE SECTION, in navConfig.
 *
 * This was a list of names here, and two of them had been renamed in navConfig
 * — so 'CRM' and 'Users' matched nothing and User Management and Leads & Deals
 * silently fell into "More" on this template alone. Nothing errored; the menu
 * was just different here than everywhere else. Reading a flag off the section
 * means a rename cannot break the reference, because there is no longer a
 * reference to break.
 */
const isPrimarySection = (section) => section?.primary === true;

const dropdownLinkClass = ({ isActive }) =>
  `flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
  }`;

/**
 * Dropdown contents for one section. Sub-menus (Finance → Invoicing) render as a
 * labelled group of indented links rather than a nested fly-out, which a top bar
 * has no room for.
 */
function DropdownItems({ items, onNavigate, indent = '', linkClass = dropdownLinkClass }) {
  return items.map((item) =>
    item.children ? (
      <div key={item.label}>
        <p className={`flex items-center gap-2 px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${indent}`}>
          <item.icon className="h-3 w-3 shrink-0" />
          {item.label}
          <NavBadge item={item} />
        </p>
        <DropdownItems items={item.children} onNavigate={onNavigate} linkClass={linkClass} indent="pl-4" />
      </div>
    ) : (
      <NavLink key={item.to + item.label} to={item.to} end={item.to === '/'} onClick={onNavigate}
        className={(state) => `${linkClass(state)} ${indent}`}>
        <item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span>
        <NavBadge item={item} />
      </NavLink>
    )
  );
}

const drawerLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
    isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700 hover:bg-slate-50'
  }`;

function TopNav({ onMobileMenuOpen }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const userType = useAuthStore((s) => s.effectiveType());
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { app_name, app_logo } = useAppearance();
  const [count, setCount] = useState(0);
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const activeNAV = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;

  useEffect(() => {
    listNotifications()
      .then((r) => setCount((r.data || []).filter((n) => !n.is_read).length))
      .catch(() => setCount(0));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name) => setOpenMenu((prev) => (prev === name ? null : name));

  // Primary sections shown in nav bar
  const primarySections = activeNAV
    .filter((s) => s.section && isPrimarySection(s))
    .map((s) => ({ ...s, items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }) }))
    .filter((s) => s.items.length > 0);

  // Secondary sections collapsed into "More"
  const secondarySections = activeNAV
    .filter((s) => s.section && !isPrimarySection(s) && s.section !== 'Account')
    .map((s) => ({ ...s, items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }) }))
    .filter((s) => s.items.length > 0);

  /**
   * How many sections fit in the bar, measured rather than guessed.
   *
   * ── Why not a breakpoint ────────────────────────────────────────────────
   *
   * The bar holds eight section names whose widths depend on the names
   * themselves, on the tenant's UI font, and on how much room the logo and the
   * company name have taken first. "Operations & Support" is three times the
   * width of "Finance". A hard breakpoint would have to be tuned for one
   * tenant's font and one company's name length and would be wrong for the
   * next, so this asks the layout what actually fits.
   *
   * ── Why the overflow is hidden rather than unmounted ────────────────────
   *
   * A folded section stays in the DOM, taken out of flow and made invisible,
   * so its width is still measurable. Unmounting it would throw away the one
   * number needed to decide whether it can come back when the window grows,
   * and the alternative — a duplicate hidden row to measure against — is a
   * second copy of the nav to keep in step.
   *
   * Running in a layout effect means the fold is applied before paint, so
   * nobody sees eight sections flash and then collapse to five.
   */
  const navRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(Number.POSITIVE_INFINITY);
  const sectionSignature = primarySections.map((s) => s.section).join('|');

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const GAP = 2; // matches gap-0.5 on the nav

    const fit = () => {
      const entries = [...nav.querySelectorAll('[data-nav-entry]')];
      if (!entries.length) return;
      // Always present, so its width is known even while nothing is folded.
      const more = nav.querySelector('[data-nav-more]');
      const moreWidth = more ? more.getBoundingClientRect().width + GAP : 0;
      const available = nav.clientWidth;

      let used = 0;
      let count = 0;
      for (let i = 0; i < entries.length; i += 1) {
        used += entries[i].getBoundingClientRect().width + GAP;
        // Stopping before the end means More has to be on screen too.
        const needsMore = i + 1 < entries.length;
        if (used + (needsMore ? moreWidth : 0) <= available) count = i + 1;
        else break;
      }
      // Never fold everything: one section in the bar beats a bare "More".
      setVisibleCount(Math.max(count, 1));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [sectionSignature]);

  const foldedSections = primarySections.slice(0, visibleCount).length === primarySections.length
    ? []
    : primarySections.slice(visibleCount);
  const moreSections = [...foldedSections, ...secondarySections];

  // Account section items for user dropdown (Profile always shown, Settings permission-gated)
  const accountItems = activeNAV
    .filter((s) => s.section === 'Account')
    .flatMap((s) => filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }));

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 shadow-sm" ref={menuRef}>
      {/* Mobile hamburger */}
      <button onClick={onMobileMenuOpen}
        className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
        <Menu className="h-6 w-6" />
      </button>

      {/* Logo */}
      <NavLink to="/" className="flex shrink-0 items-center gap-2 mr-2">
        {app_logo && (
          <img src={app_logo} alt="logo" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5"
            onError={(e) => { e.target.style.display = 'none'; }} />
        )}
        <span className="text-sm font-bold text-slate-900 whitespace-nowrap">{app_name}</span>
      </NavLink>

      <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

      {/* Nav items — hidden on mobile */}
      {/*
        Not a scroll container. `overflow-x-auto` here would make this the
        containing block for overflow in BOTH axes, and every section dropdown
        below hangs off `top-full` — they would be clipped by the bar they open
        from. The fold is what keeps the contents inside instead.
      */}
      <nav ref={navRef} className="relative hidden md:flex flex-1 items-center gap-0.5 min-w-0">
        {/* Primary section dropdowns */}
        {primarySections.map((section, index) => {
          const isOpen = openMenu === section.section;
          /*
           * Out of flow and out of reach, but still measurable — see the fold.
           *
           * Pinned to the nav's top-left rather than left where it fell. An
           * absolutely positioned box still counts toward its container's
           * scrollable area, so a folded section sitting at its static position
           * — past the right edge of a bar too narrow to hold it — stretched
           * the header and gave the whole page a horizontal scrollbar. At 0,0
           * it sits inside the bar it is hidden in and extends nothing.
           */
          const folded = index >= visibleCount;
          /*
           * The two positions are mutually exclusive, and they must be, because
           * a class list carrying both `relative` and `absolute` does not
           * resolve in the order written — Tailwind emits `.relative` after
           * `.absolute`, so `relative` won and every folded section stayed in
           * flow, invisible but still taking its full width. The bar looked
           * folded and was not: "More" was shoved to the far right, over the
           * user's name.
           */
          const position = folded
            ? 'pointer-events-none absolute left-0 top-0 opacity-0'
            : 'relative';
          /*
           * A section holding ONE screen is that screen, so it is a link rather
           * than a menu you open to find a single entry. Dashboard is the case
           * that forced it — it used to be a nameless section rendered as a
           * direct link here, and naming it turned it into a one-item dropdown.
           */
          const only = section.items.length === 1 && !section.items[0].children
            ? section.items[0]
            : null;
          if (only) {
            return (
              <NavLink key={section.section} to={only.to} end={only.to === '/'}
                data-nav-entry aria-hidden={folded || undefined} tabIndex={folded ? -1 : undefined}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${folded ? 'pointer-events-none absolute left-0 top-0 opacity-0' : ''} ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }>
                <only.icon className="h-4 w-4 shrink-0" />
                <span>{section.section}</span>
                <NavBadge item={only} />
              </NavLink>
            );
          }
          return (
            <div key={section.section} data-nav-entry className={`${position} shrink-0`}>
              <Button
                onClick={() => toggle(section.section)}
                aria-hidden={folded || undefined}
                tabIndex={folded ? -1 : undefined}
                variant={isOpen ? 'secondary' : 'ghost'}
                size="sm"
                className="px-2.5 py-1.5 whitespace-nowrap"
              >
                {section.section}
                {/* On the trigger, or it is hidden inside the menu it should open. */}
                <NavBadge items={section.items} className="ml-1" />
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
              {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-[100]">
                  <DropdownItems items={section.items} onNavigate={() => setOpenMenu(null)} />
                </div>
              )}
            </div>
          );
        })}

        {/*
          "More ▼" — whatever did not fit, plus the sections that were never
          meant for the bar.

          Always mounted, because the fold needs its width to decide how many
          sections can be shown alongside it; when it holds nothing it is hidden
          the same way a folded section is.
        */}
        {(() => {
          const isOpen = openMenu === 'more';
          const empty = moreSections.length === 0;
          return (
            <div data-nav-more className={`${empty ? 'pointer-events-none absolute left-0 top-0 opacity-0' : 'relative'} shrink-0`}>
              <Button
                onClick={() => toggle('more')}
                variant={isOpen ? 'secondary' : 'ghost'}
                size="sm"
                aria-hidden={empty || undefined}
                tabIndex={empty ? -1 : undefined}
                className="px-2.5 py-1.5 whitespace-nowrap"
              >
                More
                {/* Sections folded behind "More" are the easiest to miss. */}
                <NavBadge items={moreSections.flatMap((section) => section.items)} className="ml-1" />
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
              {isOpen && !empty && (
                <div className="absolute right-0 top-full mt-1 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg max-h-[70vh] overflow-y-auto z-[100]">
                  {moreSections.map((section) => (
                    <div key={section.section}>
                      <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{section.section}</p>
                      <DropdownItems items={section.items} onNavigate={() => setOpenMenu(null)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </nav>

      {/* Right side */}
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <NavLink to="/notifications" className="relative rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </NavLink>

        {/* User dropdown — Profile & Settings always accessible here */}
        <div className="flex items-center gap-2">
          <ProfileToggle />
          <div className="relative">
            <Button onClick={() => toggle('user')} variant="ghost" size="sm" className="px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-slate-800 leading-tight whitespace-nowrap">{user?.name || 'Guest'}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user?.type}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>

            {openMenu === 'user' && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-[100]">
                {/* Permission-aware Account section items */}
                {accountItems.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setOpenMenu(null)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <item.icon className="h-4 w-4 shrink-0" /><span>{item.label}</span>
                  </NavLink>
                ))}
                {/* Fallback: always show Profile + Settings even if permission wasn't in token */}
                {!accountItems.find((i) => i.to === '/profile') && (
                  <NavLink to="/profile" onClick={() => setOpenMenu(null)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <User className="h-4 w-4 shrink-0" /> My Profile
                  </NavLink>
                )}
        {/* Settings is a nav item now, in Operations & Support. It used to be
            hand-linked here with a guard written out per layout - six copies
            of one rule. */}
                <div className="my-1 border-t border-slate-100" />
                <Button onClick={logout} variant="danger" size="sm" className="w-full justify-start px-4 py-2">
                  <LogOut className="h-4 w-4 shrink-0" /> Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function ModernLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const userType = useAuthStore((s) => s.effectiveType());
  const allNav = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;

  // All nav items for the mobile drawer
  const allSections = allNav
    .map((s) => ({ ...s, items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      <TopNav onMobileMenuOpen={() => setMobileOpen(true)} />

      {/* Mobile full-screen drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <span className="font-bold text-slate-800">Navigation</span>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto py-2">
              {allSections.map((section, i) => (
                <div key={i} className="mb-2">
                  {section.section && (
                    <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {section.section}
                    </p>
                  )}
                  <DropdownItems
                    items={section.items}
                    onNavigate={() => setMobileOpen(false)}
                    linkClass={drawerLinkClass}
                  />
                </div>
              ))}
            </nav>
          </div>
          {/* Backdrop */}
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
