import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import useDashboardStore from '../../store/dashboardStore';
import useAuthStore from '../../store/authStore';
import { canSeeWidget } from './widgetPermissions';

const WIDGET_LABELS = {
  kpiSummary:         'Cash Position & Portfolio',
  topPerformers:      'Top Performers',
  operationalSummary: 'Pipeline',
  financeSummary:     'Revenue Panel',
  topDuePayments:     'Top Due Payments',
  paymentReminders:   'Payment Reminders',
  leadStatus:         'Lead Status',
  revenueChart:       'Revenue Chart',
  propertyStatus:     'Property Status',
  realtorLeaderboard: 'Realtor Leaderboard',
  recentActivities:   'Activity & Sales Feed',
  supportStats:       'Support Performance',
};

export default function WidgetToggleBar() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const widgets = useDashboardStore((s) => s.widgets);
  const toggleWidget = useDashboardStore((s) => s.toggleWidget);
  const resetWidgets = useDashboardStore((s) => s.resetWidgets);

  const hasPermission = useAuthStore((s) => s.hasPermission);

  /*
   * Only the cards this account is allowed.
   *
   * A switch for a card the viewer may never see is a switch that does
   * nothing, and worse, it implies the card exists and they have merely
   * hidden it. The counter has to be drawn from the same list or it reads
   * "8 of 12" to somebody who can only ever have eight.
   */
  const allowed = Object.entries(WIDGET_LABELS)
    .filter(([key]) => canSeeWidget(key, hasPermission));

  const visibleCount = allowed.filter(([key]) => widgets[key]).length;
  const total = allowed.length;

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors motion-reduce:transition-none"
      >
        <LayoutDashboard size={13} className="text-slate-400" />
        Customise
        <ChevronDown size={12} className={`text-slate-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Widgets visible <span className="tabular-nums">{visibleCount}/{total}</span>
            </span>
            <button
              onClick={resetWidgets}
              className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:underline"
            >
              <RotateCcw size={10} /> Reset
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {allowed.map(([key, label]) => {
              const visible = widgets[key];
              return (
                <button
                  key={key}
                  onClick={() => toggleWidget(key)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                >
                  <span className={visible ? 'font-medium text-slate-800' : 'text-slate-400'}>{label}</span>
                  {visible
                    ? <Eye size={13} className="text-emerald-500 shrink-0" />
                    : <EyeOff size={13} className="text-slate-300 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
