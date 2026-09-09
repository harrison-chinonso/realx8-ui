import { NavLink } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { useAppearance } from '../../context/useAppearance';
import { NAV, isNavItemVisible, filterNavItems } from './navConfig';
import CollapsibleSection from './CollapsibleSection';

export default function Sidebar() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const isSuperiorAdmin = useAuthStore((state) => state.isSuperiorAdmin);
  const userType = useAuthStore((state) => state.effectiveType());
  const { app_name, app_logo } = useAppearance();

  const topItems = NAV
    .filter((s) => !s.section)
    .flatMap((s) => s.items.filter((i) => isNavItemVisible(i, { hasPermission, isSuperiorAdmin, userType })));

  const sections = NAV
    .filter((s) => s.section)
    .map((s) => ({ ...s, items: filterNavItems(s.items, { hasPermission, isSuperiorAdmin, userType }) }))
    .filter((s) => s.items.length > 0)
    .map((s, idx) => ({ ...s, defaultOpen: idx < 3 }));

  return (
    <aside className="flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-700 bg-slate-900 text-white">
      <div className="sticky top-0 flex items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-5">
        {app_logo && (
          <img
            src={app_logo}
            alt="logo"
            className="h-10 w-10 rounded-lg bg-white object-contain p-0.5 shrink-0"
            onError={(event) => { event.target.style.display = 'none'; }}
          />
        )}
        <span className="truncate text-xl font-bold">{app_name}</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {topItems.map((item) => (
          <NavLink key={item.to} to={item.to} end
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {topItems.length > 0 && <div className="my-2 border-t border-slate-700" />}
        {sections.map((s) => (
          <CollapsibleSection
            key={s.section}
            section={s.section}
            items={s.items}
            defaultOpen={s.defaultOpen}
            labelClassName="text-slate-500 hover:text-slate-300 hover:bg-slate-800"
            activeLabelClassName="text-blue-400"
            linkClassName="text-slate-300 hover:bg-slate-800 hover:text-white"
            activeLinkClassName="bg-blue-600 text-white"
            borderColor="border-slate-700"
          />
        ))}
      </nav>
    </aside>
  );
}
