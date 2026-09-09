/**
 * CollapsibleSection — reusable accordion nav section.
 * Used by all layout sidebars to provide consistent collapse behaviour.
 *
 * defaultOpen: true  → expanded on mount
 * defaultOpen: false → collapsed on mount
 * Always auto-opens when a child route is active.
 *
 * Items carrying `children` render as a nested accordion one level deeper —
 * Finance → Invoicing → All Invoices.
 */
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const isPathActive = (pathname, to) =>
  !!to && (pathname === to || pathname.startsWith(to + '/'));

/** True when the item — or, for a sub-menu, anything inside it — is the current route. */
const itemHasActive = (pathname, item) =>
  item.children
    ? item.children.some((child) => isPathActive(pathname, child.to))
    : isPathActive(pathname, item.to);

const navKey = (item) => (item.to || '') + item.label;

function NavItemLink({ item, onNavigate, linkClassName, activeLinkClassName }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? activeLinkClassName : linkClassName
        }`
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

/** A sub-menu nested inside a section — same look as a link, plus a chevron. */
function NavGroup({ item, onNavigate, linkClassName, activeLinkClassName, borderColor }) {
  const location = useLocation();
  const hasActive = itemHasActive(location.pathname, item);
  const [open, setOpen] = useState(hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          hasActive ? activeLinkClassName : linkClassName
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className={`mt-0.5 ml-3.5 space-y-0.5 border-l pl-2 ${borderColor}`}>
          {item.children.map((child) => (
            <NavItemLink
              key={navKey(child)}
              item={child}
              onNavigate={onNavigate}
              linkClassName={linkClassName}
              activeLinkClassName={activeLinkClassName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollapsibleSection({
  section,
  items,
  defaultOpen = false,
  onNavigate,
  // style props for dark vs light sidebars
  labelClassName = 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
  activeLabelClassName = 'text-blue-600',
  linkClassName = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  activeLinkClassName = 'bg-blue-50 text-blue-600',
  borderColor = 'border-slate-100',
}) {
  const location = useLocation();
  const hasActive = items.some((i) => itemHasActive(location.pathname, i));
  const [open, setOpen] = useState(defaultOpen || hasActive);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
          hasActive ? activeLabelClassName : labelClassName
        }`}
      >
        <span className="flex-1 text-left">{section}</span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 opacity-50 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className={`mb-1 ml-2.5 space-y-0.5 border-l-2 pl-2 ${borderColor}`}>
          {items.map((item) =>
            item.children ? (
              <NavGroup
                key={navKey(item)}
                item={item}
                onNavigate={onNavigate}
                linkClassName={linkClassName}
                activeLinkClassName={activeLinkClassName}
                borderColor={borderColor}
              />
            ) : (
              <NavItemLink
                key={navKey(item)}
                item={item}
                onNavigate={onNavigate}
                linkClassName={linkClassName}
                activeLinkClassName={activeLinkClassName}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
