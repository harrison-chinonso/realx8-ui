/**
 * GroupedLayout — left sidebar with collapsible section groups.
 * Borrows the Primary/Secondary grouping logic from ModernLayout
 * but renders everything as an accordion sidebar on the left.
 *
 * Desktop: fixed sidebar (260px) + scrollable content area.
 * Mobile:  slide-in overlay drawer via hamburger button.
 */
import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Bell, LogOut, User, X } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, isNavItemVisible, filterNavItems } from './navConfig';
import CollapsibleSection from './CollapsibleSection';
import useAuthStore from '../../store/authStore';
import useNavBadgeStore from '../../store/navBadgeStore';
import { useAppearance } from '../../context/useAppearance';
import ProfileToggle from '../common/ProfileToggle';
import NavBadge from './NavBadge';

// ── Sidebar content (shared between desktop + mobile drawer) ─
function SidebarContent({ onNavigate }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userType = useAuthStore((s) => s.effectiveType());
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { app_name, app_logo } = useAppearance();

  // Platform Admin appended AFTER all NAV sections → renders after General
  const allNav = isSuperiorAdmin
    ? [...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) })), ...SUPERIOR_ADMIN_NAV]
    : NAV;

  // Dashboard (section: null)
  const topItems = allNav
    .filter((s) => !s.section)
    .flatMap((s) => s.items.filter((i) => isNavItemVisible(i, { hasPermission, isSuperiorAdmin, userType })));

  // All sections in natural navConfig order — first 3 open, rest collapsed
  const allSections = allNav
    .filter((s) => s.section && s.section !== 'Account')
    .map((s) => ({
      ...s,
      items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }),
    }))
    .filter((s) => s.items.length > 0)
    .map((s, idx) => ({ ...s, defaultOpen: idx < 3 }));

  // Account items
  const accountItems = allNav
    .filter((s) => s.section === 'Account')
    .flatMap((s) => s.items.filter((i) => isNavItemVisible(i, { hasPermission, isSuperiorAdmin, userType })));

  const avatarBg = `hsl(${((user?.name || 'U').charCodeAt(0) * 37) % 360}, 55%, 45%)`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo — 24px top padding as spec */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 pb-5 pt-6">
        {app_logo && (
          <img src={app_logo} alt="logo" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
            onError={(e) => { e.target.style.display = 'none'; }} />
        )}
        <span className="text-[15px] font-bold leading-tight text-slate-900">{app_name}</span>
      </div>

      {/* Scrollable nav — 3px gap between items, 16px h-padding, 10px v-padding */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-[3px]">
        {/* Top-level (Dashboard) */}
        {topItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-4 py-[11px] text-[14px] font-medium leading-[1.5] transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            <NavBadge item={item} />
          </NavLink>
        ))}

        {/* Divider */}
        {topItems.length > 0 && allSections.length > 0 && (
          <div className="my-3 border-t border-slate-200" />
        )}

        {/* All sections in natural order — first 3 open, rest collapsed */}
        {allSections.map((s) => (
          <CollapsibleSection
            key={s.section}
            section={s.section}
            items={s.items}
            defaultOpen={s.defaultOpen}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* Bottom: profile switcher + account links + user card */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-3 space-y-[3px]">
        {accountItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-4 py-[10px] text-[14px] font-medium leading-[1.5] text-slate-500 hover:bg-white hover:text-slate-800 transition-colors"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}

        {!accountItems.find((i) => i.to === '/profile') && (
          <NavLink to="/profile" onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-4 py-[10px] text-[14px] font-medium leading-[1.5] text-slate-500 hover:bg-white hover:text-slate-800 transition-colors">
            <User className="h-4 w-4 shrink-0" />
            My Profile
          </NavLink>
        )}
        {/* Settings is a nav item now, in Operations & Support. It used to be
            hand-linked here with a guard written out per layout - six copies
            of one rule. */}

        {/* User card */}
        <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm mt-1">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: avatarBg }}
          >
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-[1.5] text-slate-800">{user?.name || 'Guest'}</div>
            <div className="truncate text-[11px] capitalize leading-[1.5] text-slate-400">{user?.type || 'visitor'}</div>
          </div>
          <button onClick={logout} title="Logout" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top bar (mobile hamburger + notifications) ────────────────
function TopBar({ onMenuOpen }) {
  /* One count for the whole application — see navBadgeStore. Each layout
     used to fetch its own, so marking everything read on the notifications
     page left the bell showing the old number. */
  const count = useNavBadgeStore((state) => state.counts.unreadNotifications) || 0;
  const { app_name, app_logo } = useAppearance();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      <button onClick={onMenuOpen} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        {app_logo && (
          <img src={app_logo} alt="logo" className="h-6 w-6 rounded object-contain"
            onError={(e) => { e.target.style.display = 'none'; }} />
        )}
        <span className="text-sm font-bold text-slate-900">{app_name}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ProfileToggle />
        <NavLink to="/notifications" className="relative rounded-full p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </NavLink>
      </div>
    </header>
  );
}

// ── Root layout ───────────────────────────────────────────────
export default function GroupedLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);

  // Close mobile drawer on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setMobileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar — 256px wide (within 240-260px spec) */}
      <aside className="hidden w-[300px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <SidebarContent onNavigate={undefined} />
      </aside>

      {/* Mobile drawer overlay — same 256px width */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div ref={drawerRef} className="flex w-[300px] shrink-0 flex-col bg-white shadow-2xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Content column */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <TopBar onMenuOpen={() => setMobileOpen(true)} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
