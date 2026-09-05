"use client";

import { useId, useMemo, useState } from "react";

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

// Hand-rolled SVG rather than a charting library: the whole visual
// language here is a dark operational UI with three status hues, and every
// library ships its own opinion about that which then has to be fought.
// This is ~150 lines, has no bundle cost, and hovers where the pointer is
// rather than where the nearest point happens to be.
export function MetricChart({
  labels,
  series,
  height = 180,
  formatValue = (n: number) => n.toLocaleString("fr-FR"),
}: {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const width = 720;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = useMemo(() => {
    const peak = Math.max(1, ...series.flatMap((s) => s.values));
    // Round up to something legible so the top gridline isn't 8 731.
    const magnitude = 10 ** Math.floor(Math.log10(peak));
    return Math.ceil(peak / magnitude) * magnitude;
  }, [series]);

  const count = labels.length;
  const x = (i: number) => (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW) + padding.left;
  const y = (v: number) => padding.top + plotH - (v / max) * plotH;

  function pathFor(values: number[]): string {
    return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
            {hover !== null && (
              <span className="font-mono text-foreground">
                {formatValue(s.values[hover] ?? 0)}
              </span>
            )}
          </span>
        ))}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {hover !== null ? labels[hover] : `max ${formatValue(max)}`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Évolution sur ${count} jours : ${series.map((s) => s.label).join(", ")}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const px = ratio * width - padding.left;
          const index = Math.round((px / plotW) * (count - 1));
          setHover(Math.min(count - 1, Math.max(0, index)));
        }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotH * t}
            y2={padding.top + plotH * t}
            stroke="currentColor"
            strokeWidth="1"
            className="text-border"
          />
        ))}

        {series.map((s) => (
          <g key={s.key}>
            <path
              d={`${pathFor(s.values)} L${x(count - 1)},${padding.top + plotH} L${x(0)},${padding.top + plotH} Z`}
              fill={`url(#${gradientId}-${s.key})`}
            />
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="1.75" />
          </g>
        ))}

        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + plotH}
              stroke="currentColor"
              strokeWidth="1"
              className="text-muted-foreground"
            />
            {series.map((s) => (
              <circle
                key={s.key}
                cx={x(hover)}
                cy={y(s.values[hover] ?? 0)}
                r="3.5"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}

        {labels.map((label, i) =>
          // One label every ~6 points: a 30-day axis with 30 dates is a
          // smear, and the hovered date is shown above anyway.
          i % Math.ceil(count / 6) === 0 || i === count - 1 ? (
            <text
              key={label}
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"}
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
