import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bell, ChevronDown, Grid3x3, LogOut, User } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import useNavBadgeStore from '../../store/navBadgeStore';
import { useAppearance, useOnPrimary } from '../../context/useAppearance';
import ProfileToggle from '../common/ProfileToggle';
import CompanySwitcher from '../common/CompanySwitcher';
import ModuleLauncher from './ModuleLauncher';
import { consumeFreshLogin } from '../../lib/launcherGreeting';

/**
 * LauncherLayout — a utility bar and a module launcher, with no sidebar.
 *
 * ── What is different about this template ───────────────────────────────────
 *
 * The other five all keep the navigation permanently on screen, in a rail, a
 * column or a top bar. This one does not: the whole width belongs to the page
 * you are on, and navigation lives behind a single grid button that opens a
 * launcher over the top of it.
 *
 * That trade is the point. It suits somebody who spends a long stretch inside
 * one screen — a finance officer working a payment queue, a realtor on their
 * clients — and suits a small screen, where a sidebar is a drawer anyway. It
 * suits somebody hopping between four areas a minute rather less, which is why
 * it is one option among six and not a replacement for any of them.
 *
 * Everything reachable here is reachable in the other templates and nothing
 * else is: the launcher reads navConfig through the same `filterNavItems` they
 * all use.
 */
export default function LauncherLayout({ children }) {
  /* One count for the whole application — see navBadgeStore. Each layout
     used to fetch its own, so marking everything read on the
     notifications page left the bell showing the old number. */
  const unread = useNavBadgeStore((state) => state.counts.unreadNotifications) || 0;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const userType = useAuthStore((s) => s.effectiveType());
  const { app_name, app_logo } = useAppearance();
  // The logo square and the avatar are filled with the PRIMARY colour, so
  // their ink comes from primary rather than from the bar underneath.
  const onPrimary = useOnPrimary();

  const [launcherOpen, setLauncherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const launcherButtonRef = useRef(null);
  const menuRef = useRef(null);

  /*
   * The menu is the first thing you see after signing in.
   *
   * This template has no sidebar, so somebody arriving on it has a dashboard
   * and a grid button and no visible way to anywhere else. Opening the menu on
   * arrival makes the first screen the map rather than something to be found.
   *
   * Once per login, not once per mount — see launcherGreeting for why a mount
   * is the wrong trigger. In an effect rather than a useState initialiser
   * because StrictMode invokes an initialiser twice, and the second call would
   * find a flag the first had already spent.
   */
  useEffect(() => {
    if (consumeFreshLogin()) setLauncherOpen(true);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Profile and Settings, filtered exactly as the other templates filter them.
  const activeNAV = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;
  const accountItems = activeNAV
    .filter((section) => section.section === 'Account')
    .flatMap((section) => filterNavItems(section.items, { hasPermission, isSuperiorAdmin, userType }));

  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="rx-topbar relative z-50 flex h-14 shrink-0 items-center gap-2 px-3 shadow-sm sm:px-4">
        {/*
          The launcher button sits first, where a hamburger would.
          It is the only way to navigate on this template, so it gets the
          position the eye goes to and a label that says what it does.
        */}
        <button
          ref={launcherButtonRef}
          type="button"
          onClick={() => setLauncherOpen((v) => !v)}
          aria-label="Open modules"
          aria-haspopup="dialog"
          aria-expanded={launcherOpen}
          className="rx-topbar-btn flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5"
        >
          <Grid3x3 className="h-5 w-5" />
          <span className="hidden text-sm font-medium sm:inline">Modules</span>
        </button>

        <Link to="/" className="rx-topbar-btn flex min-w-0 items-center gap-2 rounded-lg px-1 py-1">
          {app_logo
            ? <img src={app_logo} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
            : (
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold"
                style={{ backgroundColor: 'var(--primary, #2563eb)', color: onPrimary }}
              >
                {(app_name || 'R').charAt(0)}
              </span>
            )}
          <span className="truncate text-sm font-semibold">{app_name || 'Realx8'}</span>
        </Link>

        <div className="flex-1" />

        {/* A realtor or client acting as themselves rather than as staff. */}
        <CompanySwitcher />
        <ProfileToggle />

        <NavLink
          to="/notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          className="rx-topbar-btn rx-topbar-dim relative shrink-0 rounded-lg p-2"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {unread > 0 && (
            <>
              <span
                aria-hidden="true"
                className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
              >
                {unread > 99 ? '99+' : unread}
              </span>
              {/*
                The count is on screen as a badge and in the link's own label
                above. This is for the case where neither is read aloud: a
                coloured dot tells a screen-reader user nothing at all.
              */}
              <span className="sr-only">{unread} unread</span>
            </>
          )}
        </NavLink>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rx-topbar-btn flex items-center gap-2 rounded-lg px-1.5 py-1.5"
          >
            <span className="rx-topbar-dim hidden text-sm md:inline">
              Hello, <span className="font-medium">{firstName || 'there'}</span>
            </span>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--primary, #2563eb)', color: onPrimary }}
            >
              {(user?.name || '?').charAt(0).toUpperCase()}
            </span>
            <ChevronDown aria-hidden="true" className="rx-topbar-dim h-4 w-4" />
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-1 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="truncate text-sm font-medium text-slate-800">{user?.name || 'Guest'}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
              {accountItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
              {/*
                Profile only. Settings is a tile in the launcher, in the last
                cell, and listing it here as well would put the same
                destination in two places a few pixels apart.
              */}
              {!accountItems.length && (
                <NavLink to="/profile" role="menuitem" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <User aria-hidden="true" className="h-4 w-4" /> Profile
                </NavLink>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <ModuleLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        returnFocusTo={launcherButtonRef}
      />

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
