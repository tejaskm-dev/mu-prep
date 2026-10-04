"use client";

import { useId, useMemo, useState } from "react";

type Point = { day: string; value: number };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const fmtDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const fmtLong = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

/** Single-series column chart (no legend — the title names it) with per-bar tooltips. */
export function DailyChart({ data, unit }: { data: Point[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const W = 760;
  const H = 210;
  const left = 34;
  const bottom = 22;
  const top = 20;
  const max = useMemo(() => niceMax(Math.max(0, ...data.map((d) => d.value))), [data]);
  const band = (W - left) / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(2, band * 0.68));
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const labelEvery = data.length > 45 ? 14 : data.length > 14 ? 7 : 1;
  const total = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${unit} per day, ${total} in total`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="#e6e8e0" strokeWidth={1} />
              <text x={left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px] tabular-nums">
                {Number.isInteger(t) ? t.toLocaleString("en-IN") : t.toFixed(1)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = left + band * i + (band - barW) / 2;
            const h = Math.max(0, H - bottom - y(d.value));
            const r = Math.min(4, h, barW / 2);
            const yTop = H - bottom - h;
            return (
              <g key={d.day}>
                {h > 0 ? (
                  <path
                    d={`M${x},${H - bottom} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${H - bottom} Z`}
                    fill={active === i ? "#157a18" : "#1e951f"}
                    opacity={active === null || active === i ? 1 : 0.55}
                  />
                ) : null}
                <rect
                  x={left + band * i}
                  y={top}
                  width={band}
                  height={H - top - bottom}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${fmtLong.format(new Date(`${d.day}T12:00:00`))}: ${d.value} ${unit}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none"
                />
                {i % labelEvery === 0 || (i === data.length - 1 && (data.length - 1) % labelEvery > labelEvery / 2) ? (
                  <text x={left + band * i + band / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {fmtDay.format(new Date(`${d.day}T12:00:00`))}
                  </text>
                ) : null}
              </g>
            );
          })}
          {data[peak]?.value > 0 && active === null ? (
            <text
              x={left + band * peak + band / 2}
              y={y(data[peak].value) - 6}
              textAnchor="middle"
              className="fill-foreground text-[11px] font-semibold tabular-nums"
            >
              {data[peak].value}
            </text>
          ) : null}
        </svg>
        {active !== null && data[active] ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-white px-3 py-2 shadow-lift"
            style={{
              left: `${((left + band * active + band / 2) / W) * 100}%`,
              top: `${(Math.max(top, y(data[active].value) - 8) / H) * 100}%`,
            }}
          >
            <p className="text-[15px] leading-none font-bold text-ink tabular-nums">{data[active].value.toLocaleString("en-IN")}</p>
            <p className="mt-1 text-[11.5px] whitespace-nowrap text-muted-foreground">
              {unit} · {fmtLong.format(new Date(`${data[active].day}T12:00:00`))}
            </p>
          </div>
        ) : null}
      </div>
      <details className="mt-2 text-[12.5px]">
        <summary className="cursor-pointer text-muted-foreground hover:text-ink" aria-controls={tableId}>
          View as table
        </summary>
        <div id={tableId} className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">Day</th>
                <th className="px-3 py-1.5 text-right font-medium capitalize">{unit}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="px-3 py-1.5">{fmtLong.format(new Date(`${d.day}T12:00:00`))}</td>
                  <td className="px-3 py-1.5 text-right">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
