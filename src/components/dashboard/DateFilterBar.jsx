import { Calendar } from 'lucide-react';
import useDashboardStore, { DATE_PRESETS } from '../../store/dashboardStore';
import Select from '../ui/Select';

const PRESETS = DATE_PRESETS.filter((p) => p !== 'Custom Range');

const fmtRange = (from, to) => {
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const day = (d) => d.getDate();
  const month = (d) => d.toLocaleDateString('en-GB', { month: 'short' });
  const year = to.getFullYear();
  if (sameMonth) return `${day(from)}–${day(to)} ${month(to)} ${year}`;
  return `${day(from)} ${month(from)} – ${day(to)} ${month(to)} ${year}`;
};

export default function DateFilterBar() {
  const preset = useDashboardStore((s) => s.preset);
  const setPreset = useDashboardStore((s) => s.setPreset);
  const getDateRange = useDashboardStore((s) => s.getDateRange);
  const { from, to } = getDateRange();

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
      <Calendar size={13} className="shrink-0 text-slate-400" />
      {/* Select already renders its own chevron — no custom background-image
          chevron here, which used to draw a second one on top of it. */}
      <Select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="h-7 cursor-pointer border-0 bg-transparent px-0 text-xs font-medium text-slate-700 shadow-none focus-visible:ring-0"
      >
        {PRESETS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </Select>
      <span className="hidden shrink-0 border-l border-slate-200 pl-1.5 text-[11px] tabular-nums text-slate-400 sm:inline">
        {fmtRange(from, to)}
      </span>
    </div>
  );
}
