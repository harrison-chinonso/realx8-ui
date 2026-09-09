import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Date range helpers ───────────────────────────────────────────────
function startOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOf(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export const DATE_PRESETS = [
  'Today',
  'Yesterday',
  'This Week',
  'Last Week',
  'This Month',
  'Last Month',
  'This Quarter',
  'Last Quarter',
  'This Year',
  'Last Year',
  'Custom Range',
];

export function resolveDateRange(preset, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dow = now.getDay(); // 0=Sun

  switch (preset) {
    case 'Today':
      return { from: startOf(now), to: endOf(now) };
    case 'Yesterday': {
      const yest = new Date(y, m, d - 1);
      return { from: startOf(yest), to: endOf(yest) };
    }
    case 'This Week': {
      const monday = new Date(y, m, d - ((dow + 6) % 7));
      return { from: startOf(monday), to: endOf(now) };
    }
    case 'Last Week': {
      const thisMonday = new Date(y, m, d - ((dow + 6) % 7));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { from: startOf(lastMonday), to: endOf(lastSunday) };
    }
    case 'This Month':
      return { from: new Date(y, m, 1), to: endOf(new Date(y, m + 1, 0)) };
    case 'Last Month':
      return { from: new Date(y, m - 1, 1), to: endOf(new Date(y, m, 0)) };
    case 'This Quarter': {
      const q = Math.floor(m / 3);
      return { from: new Date(y, q * 3, 1), to: endOf(new Date(y, q * 3 + 3, 0)) };
    }
    case 'Last Quarter': {
      const q = Math.floor(m / 3);
      const lq = q === 0 ? 3 : q - 1;
      const lqy = q === 0 ? y - 1 : y;
      return { from: new Date(lqy, lq * 3, 1), to: endOf(new Date(lqy, lq * 3 + 3, 0)) };
    }
    case 'This Year':
      return { from: new Date(y, 0, 1), to: endOf(new Date(y, 11, 31)) };
    case 'Last Year':
      return { from: new Date(y - 1, 0, 1), to: endOf(new Date(y - 1, 11, 31)) };
    case 'Custom Range':
      return {
        from: customStart ? new Date(customStart) : new Date(y, m, 1),
        to: customEnd ? new Date(customEnd) : endOf(now),
      };
    default:
      return { from: new Date(y, m, 1), to: endOf(now) };
  }
}

// ─── Default widget visibility ────────────────────────────────────────
const DEFAULT_WIDGETS = {
  kpiSummary: true,
  operationalSummary: true,
  financeSummary: true,
  topDuePayments: true,
  paymentReminders: true,
  leadStatus: true,
  revenueChart: true,
  propertyStatus: true,
  realtorLeaderboard: true,
  recentActivities: true,
  supportStats: true,
};

// ─── Store ────────────────────────────────────────────────────────────
const useDashboardStore = create(
  persist(
    (set, get) => ({
      preset: 'This Month',
      customStart: null,
      customEnd: null,
      widgets: { ...DEFAULT_WIDGETS },

      setPreset: (preset) => set({ preset }),
      setCustomRange: (customStart, customEnd) =>
        set({ preset: 'Custom Range', customStart, customEnd }),

      getDateRange: () => {
        const { preset, customStart, customEnd } = get();
        return resolveDateRange(preset, customStart, customEnd);
      },

      toggleWidget: (key) =>
        set((s) => ({ widgets: { ...s.widgets, [key]: !s.widgets[key] } })),

      resetWidgets: () => set({ widgets: { ...DEFAULT_WIDGETS } }),
    }),
    { name: 'realto-dashboard-v1' }
  )
);

export default useDashboardStore;
