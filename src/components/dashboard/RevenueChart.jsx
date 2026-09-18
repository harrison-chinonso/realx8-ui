import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readableOn } from '../../utils/colorUtils';

/**
 * This week against last week, day for day.
 *
 * ── Both lines share one vertical scale ─────────────────────────────────────
 *
 * Deliberately. Two series on independent scales can show a worse week sitting
 * above a better one, which is the single most misleading thing a comparison
 * chart can do — and it does it while looking perfectly normal. The scale is
 * taken from the larger of the two series for the same reason: an axis fitted
 * to this week alone can push last week off the top of the plot.
 *
 * ── This week's line stops at today ─────────────────────────────────────────
 *
 * Days that have not happened are not drawn. Running the line along the bottom
 * to Sunday would put a cliff on the chart every week, and a cliff reads as a
 * collapse in sales rather than as Thursday not having happened yet.
 *
 * ── Why the SVG is still hand-rolled ────────────────────────────────────────
 *
 * There is no charting library in this application, and this is not the change
 * that should add one: the dashboard's other charts are hand-rolled too, and
 * pulling one in for a single panel would leave the set inconsistent and the
 * bundle heavier. The only part worth importing was the curve, and it is forty
 * lines below.
 */

const DEFAULT_HEIGHT = 200;
const MIN_PLOT = 180;
const PAD = { top: 14, right: 14, bottom: 30, left: 48 };

/** Last week is a baseline, not an equal partner — see the note on colour. */
const LAST_WEEK = '#94a3b8';

/**
 * Compact axis label: 20M, 5.0M, 500k, 0.
 *
 * Axis ticks want magnitude, not precision. The exact figures are in the hero
 * number above the plot and in the tooltip, both of which are fully formatted.
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
 * A monotone cubic through the points — Fritsch–Carlson.
 *
 * Monotone specifically, not a plain cardinal spline. A smooth curve fitted
 * without that constraint overshoots between points, and when a series touches
 * zero — this one does, most days of most weeks — the overshoot dips BELOW the
 * axis and draws negative revenue. The tangents here are clamped so the curve
 * cannot leave the interval between two consecutive values, which is the one
 * property that makes smoothing safe on data with a floor.
 */
const monotonePath = (points) => {
  const n = points.length;
  if (!n) return '';
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  if (n === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = (points[i + 1].y - points[i].y) / (dx[i] || 1);
  }

  // The tangent at each point, zeroed wherever the data turns — so the curve
  // flattens into a peak or a trough instead of sailing past it.
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    if (slope[i - 1] * slope[i] <= 0) {
      tangent[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i]);
    }
  }
  tangent[n - 1] = slope[n - 2];

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = dx[i] / 3;
    d += `C${points[i].x + third},${points[i].y + tangent[i] * third}`
      + ` ${points[i + 1].x - third},${points[i + 1].y - tangent[i + 1] * third}`
      + ` ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
};

export default function RevenueChart({ data, fmt = (value) => String(value) }) {
  const days = useMemo(() => data?.days || [], [data]);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(null);

  /**
   * Measured, rather than a fixed viewBox scaled to fit.
   *
   * A 600-unit viewBox stretched to the container scales its text with it, so
   * "13px" is 13px at one window size and 9px at another. Measuring means every
   * label is the size it says it is, which is the point of specifying one.
   */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const narrow = width < 640;
  const height = Math.max(MIN_PLOT, DEFAULT_HEIGHT);

  /**
   * ── Colour ────────────────────────────────────────────────────────────────
   *
   * This week takes the tenant's accent; last week is a muted neutral.
   *
   * Two saturated hues would make the series compete, and the comparison is a
   * baseline rather than an equal partner — the eye should land on this week
   * and read last week as the thing it is measured against. It also means only
   * one series carries a themed colour, so no tenant palette can produce two
   * lines that are hard to tell apart.
   *
   * readableOn pulls a pale accent down until it holds 3:1 on white, the
   * threshold for a graphical object. Safe here despite the direction heuristic
   * inside it: that only misfires against a saturated mid-tone background, and
   * this background is white.
   */
  const accent = useMemo(() => {
    if (typeof window === 'undefined') return '#2563eb';
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return readableOn(/^#[0-9a-f]{6}$/i.test(primary) ? primary : '#2563eb', '#ffffff', 3);
  }, []);

  const chart = useMemo(() => {
    if (!days.length) return null;

    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const maxVal = Math.max(
      ...days.map((d) => Math.max(Number(d.current) || 0, Number(d.previous) || 0)),
      1,
    );

    const xOf = (i) => PAD.left + (i / (days.length - 1 || 1)) * innerW;
    const yOf = (v) => PAD.top + innerH - ((Number(v) || 0) / maxVal) * innerH;

    const previous = days.map((d, i) => ({ x: xOf(i), y: yOf(d.previous) }));
    const current = days
      .map((d, i) => ({ x: xOf(i), y: yOf(d.current), future: d.future }))
      .filter((p) => !p.future);

    // Four or five ticks; three on a narrow screen, where five collide.
    const tickCount = narrow ? 3 : 5;
    const ticks = Array.from({ length: tickCount }, (_, i) => {
      const fraction = i / (tickCount - 1);
      return { key: `t${i}`, y: PAD.top + (1 - fraction) * innerH, label: compact(maxVal * fraction) };
    });

    return {
      previousPath: monotonePath(previous),
      currentPath: monotonePath(current),
      columns: days.map((d, i) => ({
        x: xOf(i),
        label: d.label,
        today: d.today,
        future: d.future,
        current: Number(d.current) || 0,
        previous: Number(d.previous) || 0,
        currentY: yOf(d.current),
        previousY: yOf(d.previous),
      })),
      ticks,
      baseline: height - PAD.bottom,
    };
  }, [days, width, height, narrow]);

  /** Pointer x → the nearest day column. */
  const onPointer = useCallback((event) => {
    if (!chart) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    let nearest = 0;
    chart.columns.forEach((col, i) => {
      if (Math.abs(col.x - x) < Math.abs(chart.columns[nearest].x - x)) nearest = i;
    });
    setActive(nearest);
  }, [chart]);

  const onKeyDown = useCallback((event) => {
    if (!chart) return;
    const last = chart.columns.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i === null ? 0 : Math.min(i + 1, last)));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i === null ? last : Math.max(i - 1, 0)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  }, [chart]);

  if (!chart) {
    return <div className="flex h-40 items-center justify-center text-xs text-slate-400">No revenue data for this period</div>;
  }

  const activeColumn = active === null ? null : chart.columns[active];

  /**
   * "Only one day with revenue" — said, not drawn.
   *
   * A curve through one spike and five zeros is a shape that reads as a
   * rendering fault, and smoothing makes it worse rather than better: the line
   * leaves the axis, returns to it, and implies movement across days where
   * nothing happened. The chart still draws — removing it would hide the one
   * real figure there is — but it says what it is underneath.
   */
  const daysWithRevenue = chart.columns.filter((col) => !col.future && col.current > 0).length;
  const sparse = chart.columns.filter((col) => !col.future).length > 1 && daysWithRevenue <= 1;

  const summary = `Revenue this week to date ${fmt(data?.currentToDate || 0)}, `
    + `against ${fmt(data?.previousToDate || 0)} over the same days last week.`;

  return (
    /*
      `relative` is load-bearing, not decoration.
      
      The two sr-only blocks at the foot of this component are
      position:absolute — that is how Tailwind's sr-only hides them. With no
      positioned ancestor they anchor to the BODY, which puts them at their
      static position in document space: below the fold, and outside the clip
      of the scrolling <main>. A 1×1 box there still extends the document's
      scroll height, and the page gained 89px of empty scroll past the last
      card. Positioning this wrapper gives them a containing block inside main,
      where main's overflow can clip them.
    */
    <div className="relative space-y-3">
      {/*
        ── The hero figure ──────────────────────────────────────────────────
        This week to date, in full. The axis is abbreviated and the tooltip
        needs a pointer; this is the number somebody reads off the screen.
      */}
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className="font-semibold tabular-nums text-slate-900"
          style={{ fontSize: narrow ? 26 : 34, lineHeight: 1.1 }}
        >
          {fmt(data?.currentToDate || 0)}
        </span>
        <span className="text-sm text-slate-400">This week</span>
      </p>

      <div ref={wrapRef} className="relative">
        {/*
          Focusable as one object rather than seven. Arrow keys step the day and
          the live region below announces it, which is the keyboard equivalent
          of running a pointer along the plot.
        */}
        <div
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <svg width={width} height={height} className="block w-full overflow-visible">
            {/* No gridlines and no axis rules — the labels carry the scale. */}
            {chart.ticks.map((tick) => (
              <text key={tick.key} x={PAD.left - 10} y={tick.y + 4} textAnchor="end" fontSize="13" fill="#94a3b8">
                {tick.label}
              </text>
            ))}

            {activeColumn && (
              <line
                x1={activeColumn.x} y1={PAD.top - 4}
                x2={activeColumn.x} y2={chart.baseline}
                stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3"
              />
            )}

            {/* Last week behind, same weight, solid — a reference, not a ghost. */}
            <path d={chart.previousPath} fill="none" stroke={LAST_WEEK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={chart.currentPath} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* One dot per line, on the hovered day only. */}
            {activeColumn && (
              <>
                <circle cx={activeColumn.x} cy={activeColumn.previousY} r="4" fill={LAST_WEEK} stroke="#fff" strokeWidth="2" />
                {!activeColumn.future && (
                  <circle cx={activeColumn.x} cy={activeColumn.currentY} r="4" fill={accent} stroke="#fff" strokeWidth="2" />
                )}
              </>
            )}

            {chart.columns.map((col) => (
              <text
                key={col.label}
                x={col.x} y={chart.baseline + 20}
                textAnchor="middle" fontSize="13" letterSpacing="0.06em"
                fill={col.today ? accent : '#94a3b8'}
                fontWeight={col.today ? 700 : 400}
              >
                {String(col.label).toUpperCase()}
              </text>
            ))}
          </svg>
        </div>

        {activeColumn && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: Math.min(Math.max(activeColumn.x - 80, 0), Math.max(width - 180, 0)) }}
          >
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-300">{String(activeColumn.label).toUpperCase()}</p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-slate-300">This week</span>
              <span className="font-semibold tabular-nums">{activeColumn.future ? '—' : fmt(activeColumn.current)}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-slate-300">Last week</span>
              <span className="font-semibold tabular-nums">{fmt(activeColumn.previous)}</span>
            </p>
            {!activeColumn.future && (
              <p className="mt-1 flex items-center justify-between gap-4 border-t border-slate-700 pt-1">
                <span className="text-slate-300">Difference</span>
                <span className="font-semibold tabular-nums">
                  {activeColumn.current - activeColumn.previous >= 0 ? '+' : '−'}
                  {fmt(Math.abs(activeColumn.current - activeColumn.previous))}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/*
        Legend, centred under the axis. Each label takes its own line's colour,
        so the pairing needs no swatch-to-name mapping in the reader's head —
        and the names are there for anyone who cannot use the colour at all.
      */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px]">
        <span className="flex items-center gap-2" style={{ color: LAST_WEEK }}>
          <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: LAST_WEEK }} />
          Last week
        </span>
        <span className="flex items-center gap-2" style={{ color: accent }}>
          <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: accent }} />
          This week
        </span>
      </div>

      {sparse && (
        <p className="text-center text-[11px] text-slate-400">
          Only one day with revenue this week — the line is not a trend.
        </p>
      )}

      {/* The keyboard announcement, and the text equivalent of the plot. */}
      <div aria-live="polite" className="sr-only">
        {activeColumn
          ? `${activeColumn.label}: this week ${activeColumn.future ? 'not yet' : fmt(activeColumn.current)}, last week ${fmt(activeColumn.previous)}`
          : ''}
      </div>
      {/*
        Wrapped in a div, and the div carries sr-only — not the table.
        
        `sr-only` clamps a box to 1×1 and clips it. That works on a block, and
        does NOT work on a <table>: the CSS table layout algorithm treats width
        as a MINIMUM, so the table sizes to its content regardless and stays
        716×232. It is also position:absolute, and nothing between here and the
        body is positioned — so it escaped the scrolling <main> entirely, landed
        in the document, and gave the whole page 320px of empty scroll below the
        last card. Measured: html.scrollHeight 900 before this table existed,
        1220 after.
      */}
      <div className="sr-only">
      <table>
        <caption>{summary}</caption>
        <thead>
          <tr><th scope="col">Day</th><th scope="col">This week</th><th scope="col">Last week</th></tr>
        </thead>
        <tbody>
          {chart.columns.map((col) => (
            <tr key={col.label}>
              <th scope="row">{col.label}</th>
              <td>{col.future ? 'Not yet' : fmt(col.current)}</td>
              <td>{fmt(col.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
