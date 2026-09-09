const STATUS_COLORS = {
  Available: '#10b981',
  Reserved: '#f59e0b',
  Sold: '#3b82f6',
  'Under Construction': '#8b5cf6',
  Rented: '#ec4899',
};

const CX = 60;
const CY = 60;
const R = 48;
const INNER_R = 28;

export default function PropertyStatusChart({ statusMap = {} }) {
  const entries = Object.entries(statusMap);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  if (total === 0) {
    return <div className="flex h-32 items-center justify-center text-xs text-slate-400">No property data</div>;
  }

  let cumAngle = -Math.PI / 2;
  const slices = entries.map(([label, count]) => {
    const angle = (count / total) * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    return { label, count, angle, start, end: cumAngle, pct: ((count / total) * 100).toFixed(0) };
  });

  const polarToXY = (angle, r) => ({
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-28 shrink-0">
        {slices.map((s, i) => {
          const start = polarToXY(s.start, R);
          const end = polarToXY(s.end, R);
          const startInner = polarToXY(s.end, INNER_R);
          const endInner = polarToXY(s.start, INNER_R);
          const large = s.angle > Math.PI ? 1 : 0;
          const color = STATUS_COLORS[s.label] || '#94a3b8';
          return (
            <path
              key={i}
              d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y} L ${startInner.x} ${startInner.y} A ${INNER_R} ${INNER_R} 0 ${large} 0 ${endInner.x} ${endInner.y} Z`}
              fill={color}
              stroke="#fff"
              strokeWidth="1.5"
            />
          );
        })}
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1e293b">{total}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" fontSize="7" fill="#94a3b8">Total</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.label] || '#94a3b8' }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto font-semibold text-slate-800">{s.count}</span>
            <span className="text-slate-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
