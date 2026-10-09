import { Flame, Sparkles, Zap, type LucideProps } from "lucide-react";
import type { TopicPriority } from "@/lib/database.types";
import { PRIORITIES, PRIORITY_MAP } from "@/lib/topics";
import { cn } from "@/lib/utils";

const ICONS = { critical: Flame, high: Zap, medium: Sparkles } as const;

export function PriorityIcon({ priority, ...props }: { priority: TopicPriority } & LucideProps) {
  const Icon = ICONS[priority];
  return <Icon {...props} />;
}

export function PriorityPill({ priority, className, compact = false }: { priority: TopicPriority; className?: string; compact?: boolean }) {
  const p = PRIORITY_MAP[priority];
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold", p.badge, className)}>
      <PriorityIcon priority={priority} className="size-3" strokeWidth={2.4} />
      {compact ? p.short : p.label}
    </span>
  );
}

/** Horizontal bar split by priority (must know → high → good to know). */
export function PriorityBar({
  counts,
  className,
  empty = "bg-muted",
}: {
  counts: Partial<Record<TopicPriority, number>>;
  className?: string;
  empty?: string;
}) {
  const total = PRIORITIES.reduce((n, p) => n + (counts[p.value] ?? 0), 0);
  return (
    <div
      className={cn("flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full", total === 0 && empty, className)}
      role="img"
      aria-label={total ? PRIORITIES.map((p) => `${counts[p.value] ?? 0} ${p.label.toLowerCase()}`).join(", ") : "No topics"}
    >
      {total
        ? PRIORITIES.filter((p) => counts[p.value]).map((p) => (
            <span key={p.value} className={cn("h-full rounded-full", p.fill)} style={{ flexGrow: counts[p.value] }} />
          ))
        : null}
    </div>
  );
}

/** Circular progress (0–1) drawn with a conic gradient. */
export function ProgressRing({
  value,
  size = 44,
  thickness = 5,
  className,
  track = "var(--muted)",
  color = "var(--brand)",
  children,
}: {
  value: number;
  size?: number;
  thickness?: number;
  className?: string;
  track?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${thickness}px), #000 calc(100% - ${thickness}px + 0.5px))`;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", className)} style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full transition-[background] duration-500"
        style={{ background: `conic-gradient(${color} ${pct}%, ${track} ${pct}% 100%)`, mask, WebkitMask: mask }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** One column per module; height = topic count, split by priority. */
export function ModuleHeatStrip({
  modules,
  className,
  tone = "light",
  compact = false,
}: {
  modules: { n: number; counts: Partial<Record<TopicPriority, number>> }[];
  className?: string;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const totals = modules.map((m) => PRIORITIES.reduce((n, p) => n + (m.counts[p.value] ?? 0), 0));
  const max = Math.max(1, ...totals);
  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      {modules.map((m, i) => (
        <div key={m.n} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className={cn("flex w-full flex-col-reverse overflow-hidden rounded-md", compact ? "h-8" : "h-12", tone === "dark" ? "bg-white/10" : "bg-muted")} title={`Module ${m.n}: ${totals[i]} ${totals[i] === 1 ? "topic" : "topics"}`}>
            {[...PRIORITIES].reverse().map((p) =>
              m.counts[p.value] ? (
                <span key={p.value} className={cn("w-full border-t border-white/70 first:border-t-0", p.fill)} style={{ height: `${((m.counts[p.value] ?? 0) / max) * 100}%` }} />
              ) : null,
            )}
          </div>
          <span className={cn("text-[10.5px] font-semibold tabular-nums", tone === "dark" ? "text-white/50" : "text-muted-foreground")}>M{m.n}</span>
        </div>
      ))}
    </div>
  );
}
