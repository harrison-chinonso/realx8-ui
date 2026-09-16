/**
 * ClassicLayout — dark left sidebar + white top header.
 * Mobile: sidebar hidden, toggled via hamburger → slides in as overlay.
 * Desktop (lg+): sidebar always visible.
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Bell, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, isNavItemVisible, filterNavItems } from './navConfig';
import CollapsibleSection from './CollapsibleSection';
import useAuthStore from '../../store/authStore';
import useNavBadgeStore from '../../store/navBadgeStore';
import { readableOn } from '../../utils/colorUtils';
import { useAppearance } from '../../context/useAppearance';
import Button from '../ui/Button';
import ProfileToggle from '../common/ProfileToggle';
import NavBadge from './NavBadge';

function ClassicSidebar({ open, onClose }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userType = useAuthStore((s) => s.effectiveType());
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const { app_name, app_logo, secondary_color } = useAppearance();
  const allNav = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;
  /*
   * Deepened if it needs to be.
   *
   * The white text on this surface is hard-coded in a dozen class names
   * below, so the background has to be dark enough to carry it. It always
   * has been by luck: the default is #0f172a at 17.8:1. A tenant who set a
   * pale secondary got white on pale — around 1.6:1 — and a navigation they
   * could not read, with no warning anywhere that the colour had a floor.
   *
   * readableOn keeps the hue and walks the lightness only as far as 4.5:1
   * requires, so a tenant's colour still looks like their colour.
   */
  const sidebarBg = readableOn(secondary_color || '#0f172a', '#ffffff');

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        style={{ backgroundColor: sidebarBg }}
        className={[
          'fixed inset-y-0 left-0 z-50 flex h-full w-[300px] flex-col overflow-y-auto',
          'border-r border-white/10 text-white',
          'transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:z-auto lg:translate-x-0',
        ].join(' ')}>

        {/* Logo + close (mobile) */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 px-4 py-4"
          style={{ backgroundColor: sidebarBg }}>
          <div className="flex min-w-0 items-center gap-3">
            {app_logo && (
              <img src={app_logo} alt="logo"
                className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5"
                onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <span className="truncate text-lg font-bold">{app_name}</span>
          </div>
          <button onClick={onClose}
            className="ml-2 shrink-0 rounded-md p-1 text-white/50 hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto space-y-0.5 p-3">
          {(() => {
            const topItems = allNav
              .filter((s) => !s.section)
              .flatMap((s) => s.items.filter((i) => isNavItemVisible(i, { hasPermission, isSuperiorAdmin, userType })));

            const sections = allNav
              .filter((s) => s.section)
              .map((s) => ({
                ...s,
                items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }),
              }))
              .filter((s) => s.items.length > 0)
              .map((s, idx) => ({ ...s, defaultOpen: idx < 3 }));

            return (
              <>
                {topItems.map((item) => (
                  <NavLink key={item.to} to={item.to} end onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`
                    }>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    <NavBadge item={item} />
                  </NavLink>
                ))}
                {topItems.length > 0 && <div className="my-2 border-t border-white/10" />}
                {sections.map((s) => (
                  <CollapsibleSection
                    key={s.section}
                    section={s.section}
                    items={s.items}
                    defaultOpen={s.defaultOpen}
                    onNavigate={onClose}
                    labelClassName="text-white/40 hover:text-white/70 hover:bg-white/5"
                    activeLabelClassName="text-blue-400"
                    linkClassName="text-white/70 hover:bg-white/10 hover:text-white"
                    activeLinkClassName="bg-blue-600 text-white"
                    borderColor="border-white/10"
                  />
                ))}
              </>
            );
          })()}
        </nav>
      </aside>
    </>
  );
}

function ClassicHeader({ onMenuOpen }) {
  /* One count for the whole application — see navBadgeStore. Each layout
     used to fetch its own, so marking everything read on the notifications
     page left the bell showing the old number. */
  const count = useNavBadgeStore((state) => state.counts.unreadNotifications) || 0;
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userType = useAuthStore((s) => s.effectiveType());
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const { app_name, secondary_color } = useAppearance();
  /*
   * Deepened if it needs to be.
   *
   * The white text on this surface is hard-coded in a dozen class names
   * below, so the background has to be dark enough to carry it. It always
   * has been by luck: the default is #0f172a at 17.8:1. A tenant who set a
   * pale secondary got white on pale — around 1.6:1 — and a navigation they
   * could not read, with no warning anywhere that the colour had a floor.
   *
   * readableOn keeps the hue and walks the lightness only as far as 4.5:1
   * requires, so a tenant's colour still looks like their colour.
   */
  const sidebarBg = readableOn(secondary_color || '#0f172a', '#ffffff');

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuOpen}
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 lg:text-xl">
            {app_name} Workspace
          </h1>
          <p className="hidden text-xs text-slate-500 sm:block">
            Manage sales, investments, finance, and support.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:gap-4">
        <NavLink to="/notifications"
          className="relative rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </NavLink>
        <ProfileToggle />
        {/* Every role reaches Profile from here — the sidebar no longer carries
            an Account section. */}
        <NavLink to="/profile" className="hidden text-right text-sm sm:block hover:opacity-80">
          <div className="font-semibold text-slate-800">{user?.name || 'Guest'}</div>
          <div className="text-slate-500 capitalize">{user?.type}</div>
        </NavLink>
        {/* Settings is a nav item now, in Operations & Support. It used to be
            hand-linked here with a guard written out per layout - six copies
            of one rule. */}
        <Button onClick={logout} size="sm" style={{ backgroundColor: sidebarBg }} className="opacity-90 hover:opacity-100 lg:px-4 lg:py-2 lg:text-sm">
          Logout
        </Button>
      </div>
    </header>
  );
}

export default function ClassicLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <ClassicSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <ClassicHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
