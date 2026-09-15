import { useMemo } from 'react';

const W = 600;
const H = 180;
const PAD = { top: 16, right: 24, bottom: 42, left: 56 };

const LAST_WEEK = '#94a3b8';
const THIS_WEEK = '#2563eb';

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

/**
 * This week against last week, day for day.
 *
 * ── Both lines share one vertical scale ─────────────────────────────────────
 *
 * Deliberately. Two series on independent scales can show a worse week sitting
 * above a better one, which is the single most misleading thing a comparison
 * chart can do — and it does it while looking perfectly normal.
 *
 * ── This week's line stops at today ─────────────────────────────────────────
 *
 * Days that have not happened are not drawn. Running the line along the bottom
 * to Sunday would put a cliff on the chart every week, and a cliff reads as a
 * collapse in sales rather than as Thursday not having happened yet.
 */
export default function RevenueChart({ data }) {
  const days = data?.days || [];

  const chart = useMemo(() => {
    if (!days.length) return null;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const maxVal = Math.max(
      ...days.map((d) => Math.max(Number(d.current) || 0, Number(d.previous) || 0)),
      1,
    );

    const xOf = (i) => PAD.left + (i / (days.length - 1 || 1)) * innerW;
    const yOf = (v) => PAD.top + innerH - ((Number(v) || 0) / maxVal) * innerH;

    const previous = days.map((d, i) => ({ x: xOf(i), y: yOf(d.previous), value: d.previous }));

    /**
     * Only the days that have actually happened. `future` is set by the hook
     * from today's position in the week.
     */
    const current = days
      .map((d, i) => ({ x: xOf(i), y: yOf(d.current), value: d.current, future: d.future, today: d.today }))
      .filter((p) => !p.future);

    const line = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ');

    return {
      previous,
      current,
      previousLine: line(previous),
      currentLine: line(current),
      labels: days.map((d, i) => ({ x: xOf(i), label: d.label, today: d.today })),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        y: PAD.top + (1 - f) * innerH,
        label: compact(maxVal * f),
      })),
      baseline: H - PAD.bottom,
    };
  }, [days]);

  if (!chart) {
    return <div className="flex h-40 items-center justify-center text-xs text-slate-400">No revenue data for this period</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: LAST_WEEK }} />
          Last week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: THIS_WEEK }} />
          This week
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
          {/* Y axis ticks */}
          {chart.ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left - 4} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{t.label}</text>
            </g>
          ))}

          {/* Last week, behind — it is the reference, not the subject. */}
          <polyline
            points={chart.previousLine}
            fill="none"
            stroke={LAST_WEEK}
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {chart.previous.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={LAST_WEEK} />
          ))}

          {/* This week, in front, stopping at today. */}
          <polyline
            points={chart.currentLine}
            fill="none"
            stroke={THIS_WEEK}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {chart.current.map((p, i) => (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r={p.today ? '4.5' : '3.5'}
              fill={THIS_WEEK}
              stroke="#fff"
              strokeWidth="1.5"
            />
          ))}

          {/* Day labels, with today picked out. */}
          {chart.labels.map((l, i) => (
            <text
              key={i}
              x={l.x} y={chart.baseline + 15}
              textAnchor="middle" fontSize="9"
              fill={l.today ? THIS_WEEK : '#94a3b8'}
              fontWeight={l.today ? '600' : '400'}
            >
              {l.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
