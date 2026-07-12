import { formatCents } from "../../lib/money.ts";

interface AreaChartProps {
  points: { label: string; valueCents: number }[];
  color: string;
  label: string;
}

/** A minimal filled line chart, no dependency — just an SVG path over the points. */
export function AreaChart({ points, color, label }: AreaChartProps) {
  const W = 560;
  const H = 170;
  const PAD = 26;
  const max = Math.max(...points.map((p) => p.valueCents), 1);
  const n = Math.max(points.length, 1);
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(n - 1, 1);
  const y = (v: number) => H - 24 - (v / max) * (H - 54);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valueCents).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - 24).toFixed(1)} L${x(0).toFixed(1)},${(H - 24).toFixed(1)} Z`;
  const gradientId = "area-fill";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart-area" role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={PAD}
          x2={W - PAD}
          y1={y(max * f)}
          y2={y(max * f)}
          className="chart-gridline"
        />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle
          key={`c${i}`}
          cx={x(i)}
          cy={y(p.valueCents)}
          r={i === n - 1 ? 4 : 2.5}
          fill={i === n - 1 ? color : "var(--surface)"}
          stroke={color}
          strokeWidth={1.6}
        />
      ))}
      {points.map((p, i) => (
        <text key={`t${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="chart-tick">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

interface DonutSegment {
  label: string;
  valueCents?: number;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  label: string;
  totalLabel?: string;
}

/** A ring chart built from stroke-dasharray circles, plus a text legend. */
export function DonutChart({ segments, label, totalLabel = "invoices" }: DonutChartProps) {
  const totalCount = segments.reduce((t, s) => t + s.value, 0);
  const total = totalCount || 1;
  const r = 52;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / total) * circ;
      const el = (
        <circle
          key={s.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={16}
          strokeDasharray={`${len} ${circ - len}`}
          strokeDashoffset={-offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      );
      offset += len;
      return el;
    });

  return (
    <div className="donut-wrap">
      <svg width={140} height={140} viewBox="0 0 140 140" role="img" aria-label={label}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={16} />
        {arcs}
        <text x={cx} y={cy - 4} textAnchor="middle" className="donut-total">
          {totalCount}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" className="donut-total-label">
          {totalLabel}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((s) => (
          <div className="donut-legend__item" key={s.label}>
            <span className="donut-legend__dot" style={{ background: s.color }} />
            <span className="donut-legend__value">{s.value}</span>
            <span>{s.label}</span>
            {s.valueCents !== undefined && (
              <span className="donut-legend__cents">{formatCents(s.valueCents)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
