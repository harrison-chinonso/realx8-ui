/**
 * BoldLayout — PostHog-inspired design.
 * Light sidebar with brand-colored top band, user profile at bottom.
 * Mobile: sidebar hidden, toggled via hamburger button in content header.
 */
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, LogOut, User, Settings } from 'lucide-react';
import { NAV, SUPERIOR_ADMIN_NAV, isNavItemVisible, filterNavItems } from './navConfig';
import CollapsibleSection from './CollapsibleSection';
import useAuthStore from '../../store/authStore';
import { useAppearance } from '../../context/useAppearance';
import { listNotifications } from '../../api/notificationApi';
import ProfileToggle from '../common/ProfileToggle';
import NavBadge from './NavBadge';

function usePageTitle() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  if (!parts.length) return 'Dashboard';
  return parts
    .map((p) => p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' › ');
}

function BoldSidebar({ open, onClose }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const userType = useAuthStore((s) => s.effectiveType());
  const isSuperiorAdmin = useAuthStore((s) => s.isSuperiorAdmin);
  // Company settings are staff-only; realtors and clients get Profile alone.
  const canSeeSettings = !['realtor', 'client'].includes(useAuthStore((s) => s.effectiveType()));
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { app_name, app_logo, primary_color, secondary_color } = useAppearance();
  const allNav = isSuperiorAdmin
    ? [...SUPERIOR_ADMIN_NAV, ...NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.hideForSuperior) }))]
    : NAV;
  const topBg = primary_color || '#2563eb';
  const avatarBg = secondary_color || '#0f172a';
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    listNotifications()
      .then((r) => setNotifCount((r.data || []).filter((n) => !n.is_read).length))
      .catch(() => {});
  }, []);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-50 flex h-full w-[300px] flex-col overflow-hidden',
        'border-r border-slate-200 bg-slate-50',
        'transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:relative lg:z-auto lg:translate-x-0',
      ].join(' ')}>

        {/* Brand top band */}
        <div className="flex items-center justify-between px-4 py-4" style={{ backgroundColor: topBg }}>
          <div className="flex min-w-0 items-center gap-3">
            {app_logo ? (
              <img src={app_logo} alt="logo" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-0.5"
                onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/20 text-lg font-bold text-white">
                {(app_name || '').charAt(0)}
              </div>
            )}
            <span className="truncate text-base font-bold text-white">{app_name}</span>
          </div>
          <button onClick={onClose} className="ml-2 shrink-0 rounded p-1 text-white/70 hover:text-white lg:hidden">
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {(() => {
            // Dashboard (no section label) — always flat
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
                      `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'border-l-2 border-blue-600 bg-blue-50 pl-[10px] text-blue-700'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                      }`
                    }>
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    <NavBadge item={item} />
                  </NavLink>
                ))}
                {topItems.length > 0 && <div className="my-2 border-t border-slate-200" />}
                {sections.map((s) => (
                  <CollapsibleSection
                    key={s.section}
                    section={s.section}
                    items={s.items}
                    defaultOpen={s.defaultOpen}
                    onNavigate={onClose}
                  />
                ))}
              </>
            );
          })()}
        </nav>

        {/* User profile at bottom */}
        <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-1">
          <NavLink to="/profile" onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-800">
            <User className="h-3.5 w-3.5" /> My Profile
          </NavLink>
          {!isSuperiorAdmin && canSeeSettings && (
          <NavLink to="/settings" onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-800">
            <Settings className="h-3.5 w-3.5" /> Settings
          </NavLink>
          )}
          <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm mt-1">
            {/* One glyph, so the ink flips rather than the fill being deepened —
                which keeps the tenant's exact colour. --secondary-ink is white
                or near-black, whichever the colour can actually carry. */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: avatarBg, color: 'var(--secondary-ink, #fff)' }}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800">{user?.name || 'Guest'}</div>
              <div className="truncate text-[10px] capitalize text-slate-400">{user?.type || 'visitor'}</div>
            </div>
            <button onClick={logout} title="Logout"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function BoldContentHeader({ onMenuOpen }) {
  const title = usePageTitle();
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      <button onClick={onMenuOpen}
        className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
        <Menu className="h-6 w-6" />
      </button>
      <span className="text-sm font-medium text-slate-800">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        <ProfileToggle />
      </div>
    </div>
  );
}

export default function BoldLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <BoldSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <BoldContentHeader onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
