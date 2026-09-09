import { useMemo } from 'react';

const W = 600;
const H = 160;
const PAD = { top: 16, right: 24, bottom: 32, left: 56 };

/**
 * Compact axis label: 1.2M, 500k, 0.
 *
 * Full currency strings ("NGN 25,000,000") are ~70px at 9px type and are drawn
 * right-anchored at x=48, so they ran off the left edge of the viewBox. Axis
 * ticks want magnitude, not precision — the exact figures live in the cards.
 */
const compact = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
};

export default function RevenueChart({ data = [] }) {
  const chartData = useMemo(() => {
    if (!data.length) return { points: '', area: '', labels: [], maxVal: 0, ticks: [] };
    const vals = data.map((d) => d.amount);
    const maxVal = Math.max(...vals, 1);

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const pts = data.map((d, i) => ({
      x: PAD.left + (i / (data.length - 1 || 1)) * innerW,
      y: PAD.top + innerH - (d.amount / maxVal) * innerH,
      label: d.label,
      amount: d.amount,
    }));

    const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const areaStr =
      `M ${pts[0].x},${H - PAD.bottom} ` +
      pts.map((p) => `L ${p.x},${p.y}`).join(' ') +
      ` L ${pts[pts.length - 1].x},${H - PAD.bottom} Z`;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      y: PAD.top + (1 - f) * (H - PAD.top - PAD.bottom),
      label: compact(maxVal * f),
    }));

    return { points: pointsStr, area: areaStr, labels: pts, maxVal, ticks };
  }, [data]);

  if (!data.length) {
    return <div className="flex h-40 items-center justify-center text-xs text-slate-400">No revenue data for this period</div>;
  }

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y axis ticks */}
        {chartData.ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left - 4} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{t.label}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={chartData.area} fill="url(#rev-grad)" />

        {/* Line */}
        <polyline
          points={chartData.points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points + labels */}
        {chartData.labels.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
            <text x={p.x} y={H - PAD.bottom + 14} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
