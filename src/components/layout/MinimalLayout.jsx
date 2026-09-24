/**
 * MinimalLayout — icon-only collapsible sidebar.
 * Desktop: w-14 icon sidebar, click to expand to w-[300px].
 * Mobile: sidebar hidden entirely; hamburger opens full overlay drawer.
 */
import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, Bell, ChevronDown, ChevronLeft, User, LogOut, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, filterNavItems, flattenNavItems } from './navConfig';
import useAuthStore from '../../store/authStore';
import useNavBadgeStore from '../../store/navBadgeStore';
import { useAppearance } from '../../context/useAppearance';
import Button from '../ui/Button';
import ProfileToggle from '../common/ProfileToggle';
import CompanySwitcher from '../common/CompanySwitcher';
import NavBadge from './NavBadge';

function MinimalSidebar({ expanded, onToggle, mobileOpen, onClose }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const userType = useAuthStore((s) => s.effectiveType());
  const { app_logo, app_name } = useAppearance();
  const allNav = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;

  // Sub-menus are flattened into the rail — an icon-only column has nowhere to
  // put a third level, so Invoicing's and Payments' children sit inline.
  const allItems = allNav.flatMap((s) =>
    flattenNavItems(filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType })).map((item) => ({
      ...item,
      sectionLabel: s.section,
    }))
  );

  // Mobile: full overlay drawer (always expanded)
  // Desktop: icon or expanded based on `expanded`
  const isMobileExpanded = mobileOpen;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      {/* Mobile drawer (fixed overlay) */}
      <aside className={[
        'fixed inset-y-0 left-0 z-50 flex h-full w-[300px] flex-col overflow-y-auto',
        'border-r border-slate-200 bg-white',
        'transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:hidden',
      ].join(' ')}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
          <div className="flex items-center gap-2">
            {app_logo && (
              <img src={app_logo} alt="logo" className="h-7 w-7 rounded object-contain"
                onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <span className="text-sm font-bold text-slate-800">{app_name}</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 py-2">
          {allItems.map((item) => (
            <NavLink key={item.to + item.label} to={item.to} end={item.to === '/'} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`
              }>
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              <NavBadge item={item} />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Desktop icon sidebar */}
      <aside className={[
        'hidden lg:flex h-screen flex-col overflow-y-auto',
        'border-r border-slate-200 bg-white transition-all duration-200',
        expanded ? 'w-[300px]' : 'w-14',
      ].join(' ')}>
        {/* Logo / Toggle */}
        <div className="sticky top-0 z-10 flex items-center border-b border-slate-200 bg-white">
          <button onClick={onToggle}
            className="flex h-14 w-14 shrink-0 items-center justify-center text-slate-500 hover:text-slate-900">
            {expanded ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              app_logo
                ? <img src={app_logo} alt="logo" className="h-8 w-8 rounded object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }} />
                : <Menu className="h-6 w-6" />
            )}
          </button>
          {expanded && (
            <span className="truncate pr-3 text-sm font-bold text-slate-800">{app_name}</span>
          )}
        </div>
        <nav className="flex-1 py-2">
          {allItems.map((item) => (
            <div key={item.to + item.label} className="group/item relative px-1.5 py-0.5">
              <NavLink to={item.to} end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg transition-colors ${
                    expanded ? 'px-3 py-2' : 'h-10 w-10 justify-center'
                  } ${
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }>
                <item.icon className="h-4 w-4 shrink-0" />
                {expanded && <span className="truncate text-sm">{item.label}</span>}
                {expanded && <NavBadge item={item} />}
              </NavLink>
              {/* Collapsed: no label to sit beside, so it rides the icon. */}
              {!expanded && (
                <NavBadge item={item} className="pointer-events-none absolute right-0 top-0 ml-0" />
              )}
              {!expanded && (
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover/item:opacity-100">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function MinimalHeader({ onMenuOpen }) {
  /* One count for the whole application — see navBadgeStore. Each layout
     used to fetch its own, so marking everything read on the notifications
     page left the bell showing the old number. */
  const count = useNavBadgeStore((state) => state.counts.unreadNotifications) || 0;
  const [userOpen, setUserOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4" ref={menuRef}>
      {/* Hamburger — mobile only */}
      <button onClick={onMenuOpen}
        className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex-1 lg:hidden" />

      <div className="ml-auto flex items-center gap-2">
        <NavLink to="/notifications" className="relative rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
              {count}
            </span>
          )}
        </NavLink>

        <CompanySwitcher />

        <ProfileToggle />
        <div className="relative">
          <Button onClick={() => setUserOpen((v) => !v)} variant="ghost" size="sm" className="px-2 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </Button>
          {userOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg z-[100]">
              <div className="border-b border-slate-100 px-4 py-2">
                <div className="text-sm font-semibold text-slate-800">{user?.name || 'Guest'}</div>
                <div className="text-xs text-slate-400 capitalize">{user?.type}</div>
              </div>
              <NavLink to="/profile" onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <User className="h-4 w-4 shrink-0" /> My Profile
              </NavLink>
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
    </header>
  );
}

export default function MinimalLayout({ children }) {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <MinimalSidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <MinimalHeader onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
