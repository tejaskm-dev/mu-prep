"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  EyeOff,
  FileSearch,
  FileText,
  Layers,
  ListOrdered,
  NotebookPen,
  RotateCcw,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import { InlineRich, RichText, plainText } from "@/components/rich-text";
import { PriorityBar, PriorityIcon, PriorityPill, ProgressRing } from "@/components/topic-bits";
import { RESOURCE_TYPE_MAP } from "@/lib/constants";
import type { SubjectModule, TopicPriority } from "@/lib/database.types";
import { setRevised, useRevised } from "@/lib/library-store";
import { PRIORITIES, PRIORITY_MAP, appearances, heatScore, maxMarks, topicYears, yearOf, type TopicView } from "@/lib/topics";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

type View = "module" | "rank";
type State = { module: number | null; priority: TopicPriority | null; q: string; view: View; hideRevised: boolean };

const DEFAULT_STATE: State = { module: null, priority: null, q: "", view: "module", hideRevised: false };

function readUrlState(): State {
  const p = new URLSearchParams(window.location.search);
  const mod = Number(p.get("module"));
  const pr = p.get("priority");
  return {
    module: Number.isInteger(mod) && mod >= 1 && mod <= 12 ? mod : null,
    priority: PRIORITIES.some((x) => x.value === pr) ? (pr as TopicPriority) : null,
    q: (p.get("q") ?? "").slice(0, 80),
    view: p.get("view") === "rank" ? "rank" : "module",
    hideRevised: p.get("hide") === "revised",
  };
}

function toQuery(s: State) {
  const p = new URLSearchParams();
  if (s.module) p.set("module", String(s.module));
  if (s.priority) p.set("priority", s.priority);
  if (s.view !== "module") p.set("view", s.view);
  if (s.hideRevised) p.set("hide", "revised");
  if (s.q) p.set("q", s.q);
  const str = p.toString();
  return str ? `?${str}` : "";
}

function matches(t: TopicView, q: string) {
  if (!q) return true;
  const hay = `${t.title} ${plainText(t.notes ?? "")} ${t.questions.map((x) => plainText(x.text)).join(" ")}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function countBy(topics: TopicView[]) {
  const counts: Partial<Record<TopicPriority, number>> = {};
  for (const t of topics) counts[t.priority] = (counts[t.priority] ?? 0) + 1;
  return counts;
}

const shortYear = (y: number) => `’${String(y).slice(2)}`;

// ---------------------------------------------------------------- hero progress

/** Revision progress for the hero (shares the localStorage store with the portal). */
export function TopicsProgress({ ids }: { ids: string[] }) {
  const revisedList = useRevised();
  const done = useMemo(() => {
    const set = new Set(revisedList);
    return ids.filter((id) => set.has(id)).length;
  }, [revisedList, ids]);
  const pct = ids.length ? done / ids.length : 0;
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
      <ProgressRing value={pct} size={64} thickness={7} track="rgb(255 255 255 / 0.12)" color="var(--lime)">
        <span className="text-[15px] font-extrabold text-white tabular-nums">{Math.round(pct * 100)}%</span>
      </ProgressRing>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white">Your revision</p>
        <p className="text-[12.5px] text-white/65 tabular-nums">
          {done} of {ids.length} topics revised
        </p>
        {done > 0 ? (
          <button
            type="button"
            onClick={() => setRevised(ids, false)}
            className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-lime/90 hover:text-lime"
          >
            <RotateCcw className="size-3" /> Start over
          </button>
        ) : (
          <p className="mt-0.5 text-[12px] text-white/50">Tick topics as you finish them.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- portal

export function TopicsPortal({ topics, modules }: { topics: TopicView[]; modules: SubjectModule[] }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const revisedList = useRevised();
  const revised = useMemo(() => new Set(revisedList), [revisedList]);
  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  // Prerendered without search params: apply shared-link filters (and #topic- anchors) after mount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.location.search) setState(readUrlState());
      const id = window.location.hash.match(/^#topic-([0-9a-f-]{36})$/i)?.[1];
      if (id) {
        setOpen(new Set([id]));
        requestAnimationFrame(() => document.getElementById(`topic-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const next = `${window.location.pathname}${toQuery(state)}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
  }, [state]);

  const moduleList = useMemo(() => {
    const known = new Map(modules.map((m) => [m.n, m.title]));
    for (const t of topics) if (!known.has(t.module)) known.set(t.module, "");
    return [...known.entries()].sort((a, b) => a[0] - b[0]).map(([n, title]) => ({ n, title }));
  }, [modules, topics]);
  const moduleTitle = (n: number) => moduleList.find((m) => m.n === n)?.title ?? "";

  const maxApp = useMemo(() => Math.max(1, ...topics.map(appearances)), [topics]);
  const rankOf = useMemo(() => {
    const ranked = [...topics].sort((a, b) => heatScore(b) - heatScore(a));
    return new Map(ranked.map((t, i) => [t.id, i + 1]));
  }, [topics]);

  const inModule = useMemo(() => topics.filter((t) => !state.module || t.module === state.module), [topics, state.module]);
  const priorityCounts = useMemo(() => countBy(inModule), [inModule]);

  const filtered = useMemo(() => {
    const rows = inModule.filter(
      (t) => (!state.priority || t.priority === state.priority) && (!state.hideRevised || !revised.has(t.id)) && matches(t, state.q),
    );
    return state.view === "rank" ? rows.sort((a, b) => (rankOf.get(a.id) ?? 0) - (rankOf.get(b.id) ?? 0)) : rows;
  }, [inModule, state.priority, state.hideRevised, state.q, state.view, revised, rankOf]);

  const groups = useMemo(() => {
    if (state.view !== "module") return null;
    return moduleList
      .map((m) => ({ ...m, items: filtered.filter((t) => t.module === m.n), all: topics.filter((t) => t.module === m.n) }))
      .filter((g) => g.items.length > 0);
  }, [state.view, moduleList, filtered, topics]);

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = filtered.length > 0 && filtered.every((t) => open.has(t.id));
  const reveal = (id: string) => {
    setOpen((s) => new Set(s).add(id));
    if (state.hideRevised && revised.has(id)) update({ hideRevised: false });
    if (state.priority || state.q) update({ priority: null, q: "" });
    requestAnimationFrame(() => document.getElementById(`topic-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };
  const filtersActive = !!state.priority || !!state.q || state.hideRevised;

  return (
    <div className="space-y-8">
      {/* module radar */}
      <section aria-label="Modules">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <span className="section-mark mb-3" aria-hidden />
            <h2 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-ink">Module radar</h2>
          </div>
          {state.module ? (
            <button type="button" onClick={() => update({ module: null })} className="text-[13px] font-medium text-brand hover:underline">
              Show all modules
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {moduleList.map((m) => {
            const list = topics.filter((t) => t.module === m.n);
            const done = list.filter((t) => revised.has(t.id)).length;
            const counts = countBy(list);
            const active = state.module === m.n;
            return (
              <button
                key={m.n}
                type="button"
                aria-pressed={active}
                disabled={list.length === 0}
                onClick={() => update({ module: active ? null : m.n })}
                className={cn(
                  "group relative flex min-h-[176px] flex-col overflow-hidden rounded-2xl border p-4 text-left transition-[border-color,box-shadow,transform,background-color] duration-200",
                  active
                    ? "border-ink bg-ink text-white shadow-lift"
                    : "border-border bg-white shadow-card hover:-translate-y-0.5 hover:border-lime-border hover:shadow-lift",
                  list.length === 0 && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-border hover:shadow-card",
                )}
              >
                <span aria-hidden className={cn("absolute -top-10 -right-10 size-28 rounded-full blur-2xl", active ? "bg-lime/25" : "bg-lime-chip/30")} />
                <span className="relative flex items-start justify-between gap-2">
                  <span className={cn("font-display text-[38px] leading-none font-extrabold tracking-[-0.04em] tabular-nums", active ? "text-lime" : "text-ink/85")}>
                    {String(m.n).padStart(2, "0")}
                  </span>
                  {list.length ? (
                    <ProgressRing
                      value={done / list.length}
                      size={36}
                      thickness={4}
                      track={active ? "rgb(255 255 255 / 0.14)" : "var(--muted)"}
                      color={active ? "var(--lime)" : "var(--brand)"}
                    >
                      <span className={cn("text-[10px] font-bold tabular-nums", active ? "text-white" : "text-ink")}>{Math.round((done / list.length) * 100)}</span>
                    </ProgressRing>
                  ) : null}
                </span>
                <span className={cn("relative mt-3 text-[10.5px] font-semibold tracking-[0.08em] uppercase", active ? "text-white/55" : "text-muted-foreground")}>
                  Module {m.n}
                </span>
                <span className={cn("relative mt-0.5 line-clamp-2 text-[13.5px] leading-snug font-semibold", active ? "text-white" : "text-ink")}>
                  {m.title || `Module ${m.n}`}
                </span>
                <span className="relative mt-auto pt-3">
                  <PriorityBar counts={counts} empty={active ? "bg-white/15" : "bg-muted"} />
                  <span className={cn("mt-2 flex items-center justify-between text-[11.5px]", active ? "text-white/70" : "text-muted-foreground")}>
                    <span>{list.length ? `${list.length} ${list.length === 1 ? "topic" : "topics"}` : "No topics yet"}</span>
                    {counts.critical ? (
                      <span className={cn("inline-flex items-center gap-0.5 font-semibold", active ? "text-[#ffb59c]" : "text-hot-ink")}>
                        <PriorityIcon priority="critical" className="size-3" strokeWidth={2.4} />
                        {counts.critical}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <RepeatPattern topics={inModule} onPick={reveal} />

      {/* toolbar */}
      <section aria-label="Topics" className="scroll-mt-20" id="topics">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="section-mark mb-3" aria-hidden />
            <h2 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-ink">
              {state.module ? `Module ${state.module} topics` : "All topics"}
            </h2>
          </div>
          <div className="flex h-10 items-center rounded-lg border border-border bg-white p-1" role="group" aria-label="Order">
            {(
              [
                { v: "module", label: "By module", icon: Layers },
                { v: "rank", label: "Most important", icon: ListOrdered },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={state.view === o.v}
                onClick={() => update({ view: o.v })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-muted-foreground",
                  state.view === o.v && "bg-lime-soft text-ink",
                )}
              >
                <o.icon className="size-4" /> {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={state.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Search topics, notes and questions…"
              className="h-10 w-full rounded-lg border border-border bg-white pr-8 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-lime-border focus:ring-3 focus:ring-lime-soft"
            />
            {state.q ? (
              <button type="button" onClick={() => update({ q: "" })} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-ink" aria-label="Clear search">
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(filtered.map((t) => t.id)))}
            disabled={filtered.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-ink hover:border-lime-border disabled:opacity-50"
          >
            {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" data-active={!state.priority} onClick={() => update({ priority: null })} className="chip h-9 px-4">
            Everything <span className="text-xs opacity-60">{inModule.length}</span>
          </button>
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              data-active={state.priority === p.value}
              disabled={!priorityCounts[p.value]}
              onClick={() => update({ priority: state.priority === p.value ? null : p.value })}
              className={cn("chip h-9 px-4 disabled:opacity-45", state.priority === p.value && p.badge)}
              title={p.hint}
            >
              <PriorityIcon priority={p.value} className={cn("size-3.5", p.text)} strokeWidth={2.4} />
              {p.label} <span className="text-xs opacity-60">{priorityCounts[p.value] ?? 0}</span>
            </button>
          ))}
          <button type="button" data-active={state.hideRevised} onClick={() => update({ hideRevised: !state.hideRevised })} className="chip h-9 px-4 sm:ml-auto">
            <EyeOff className="size-3.5" /> Hide revised
          </button>
        </div>

        <p className="mt-4 mb-3 text-[13px] text-muted-foreground" aria-live="polite">
          {filtered.length === inModule.length ? `${inModule.length} ${inModule.length === 1 ? "topic" : "topics"}` : `Showing ${filtered.length} of ${inModule.length}`}
          {filtersActive ? (
            <button type="button" onClick={() => update({ priority: null, q: "", hideRevised: false })} className="ml-2 font-medium text-brand hover:underline">
              Clear filters
            </button>
          ) : null}
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileSearch />}
            title={state.hideRevised && inModule.every((t) => revised.has(t.id)) ? "All revised — nice work!" : "Nothing matches"}
            action={
              <button type="button" onClick={() => update({ priority: null, q: "", hideRevised: false })} className="text-sm font-medium text-brand hover:underline">
                Clear filters
              </button>
            }
          >
            {state.hideRevised ? "Every topic here is marked as revised." : "Try another priority or search term."}
          </EmptyState>
        ) : groups ? (
          <div className="space-y-10">
            {groups.map((g) => {
              const done = g.all.filter((t) => revised.has(t.id)).length;
              const critical = g.all.filter((t) => t.priority === "critical").length;
              return (
                <section key={g.n} id={`module-${g.n}`} className="scroll-mt-24">
                  <header className="mb-3.5 flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-[16px] font-extrabold text-lime tabular-nums">
                      {String(g.n).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[17px] leading-tight font-bold tracking-[-0.01em] text-ink">{g.title || `Module ${g.n}`}</h3>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        Module {g.n} · {g.all.length} {g.all.length === 1 ? "topic" : "topics"}
                        {critical ? ` · ${critical} must know` : ""}
                      </p>
                    </div>
                    <span className="hidden items-center gap-2 text-[12.5px] font-medium text-muted-foreground tabular-nums sm:inline-flex">
                      {done}/{g.all.length} revised
                      <ProgressRing value={done / g.all.length} size={28} thickness={4} />
                    </span>
                  </header>
                  <div className="space-y-3">
                    {g.items.map((t) => (
                      <TopicCard
                        key={t.id}
                        t={t}
                        maxApp={maxApp}
                        open={open.has(t.id)}
                        revised={revised.has(t.id)}
                        onToggle={() => toggle(t.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TopicCard
                key={t.id}
                t={t}
                rank={rankOf.get(t.id)}
                moduleLabel={`M${t.module}${moduleTitle(t.module) ? ` · ${moduleTitle(t.module)}` : ""}`}
                maxApp={maxApp}
                open={open.has(t.id)}
                revised={revised.has(t.id)}
                onToggle={() => toggle(t.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- repeat pattern (topic × year)

function RepeatPattern({ topics, onPick }: { topics: TopicView[]; onPick: (id: string) => void }) {
  const { years, rows } = useMemo(() => {
    const all = new Set<number>();
    for (const t of topics) for (const y of topicYears(t)) all.add(y);
    const years = [...all].sort((a, b) => a - b).slice(-10);
    const rows = topics
      .map((t) => {
        const perYear = new Map<number, number>();
        for (const q of t.questions) for (const label of q.years) {
          const y = yearOf(label);
          if (y) perYear.set(y, (perYear.get(y) ?? 0) + 1);
        }
        return { t, perYear, total: appearances(t) };
      })
      .filter((r) => r.perYear.size > 0)
      .sort((a, b) => b.total - a.total || heatScore(b.t) - heatScore(a.t))
      .slice(0, 12);
    return { years, rows };
  }, [topics]);

  if (years.length < 2 || rows.length < 2) return null;

  return (
    <section aria-label="When each topic was asked" className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-ink">Repeat pattern</h2>
          <p className="text-[12.5px] text-muted-foreground">Which topics came up in which exam year — the most repeated first.</p>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
          {PRIORITIES.map((p) => (
            <span key={p.value} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-[3px]", p.fill)} /> {p.short}
            </span>
          ))}
        </div>
      </header>
      <div className="overflow-x-auto px-3 py-3 sm:px-4">
        <table className="w-full min-w-[520px] border-separate border-spacing-x-1 border-spacing-y-1">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[1] w-[200px] bg-white pr-2 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:w-[38%]">
                Topic
              </th>
              {years.map((y) => (
                <th key={y} scope="col" className="text-center text-[11.5px] font-semibold text-muted-foreground tabular-nums">
                  {shortYear(y)}
                </th>
              ))}
              <th scope="col" className="w-12 text-right text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Asked
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, perYear, total }) => {
              const p = PRIORITY_MAP[t.priority];
              return (
                <tr key={t.id} className="group">
                  <th scope="row" className="sticky left-0 z-[1] max-w-[200px] bg-white pr-2 text-left font-normal sm:max-w-none">
                    <a
                      href={`#topic-${t.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onPick(t.id);
                      }}
                      className="flex items-center gap-2 rounded-md py-1 text-[13px] font-medium text-ink group-hover:text-brand"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", p.fill)} />
                      <span className="truncate">{plainText(t.title)}</span>
                    </a>
                  </th>
                  {years.map((y) => {
                    const n = perYear.get(y) ?? 0;
                    return (
                      <td key={y} className="p-0">
                        <span
                          title={n ? `${plainText(t.title)} — asked ${n === 1 ? "once" : `${n} times`} in ${y}` : `Not asked in ${y}`}
                          className={cn("mx-auto block h-7 w-full min-w-7 rounded-md transition-transform group-hover:scale-y-110", n ? p.fill : "bg-muted/80")}
                          style={n ? { opacity: Math.min(1, 0.5 + n * 0.25) } : undefined}
                        />
                      </td>
                    );
                  })}
                  <td className="text-right text-[12.5px] font-bold text-ink tabular-nums">{total}×</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- topic card

function HeatMeter({ value, max, fill }: { value: number; max: number; fill: string }) {
  const level = Math.max(1, Math.round((value / max) * 5));
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-full", i <= level ? fill : "bg-border")} style={{ height: `${30 + i * 14}%` }} />
      ))}
    </span>
  );
}

function TopicCard({
  t,
  rank,
  moduleLabel,
  maxApp,
  open,
  revised,
  onToggle,
}: {
  t: TopicView;
  rank?: number;
  moduleLabel?: string;
  maxApp: number;
  open: boolean;
  revised: boolean;
  onToggle: () => void;
}) {
  const p = PRIORITY_MAP[t.priority];
  const asked = appearances(t);
  const years = topicYears(t);
  const marks = maxMarks(t);
  const hasBody = Boolean(t.notes) || t.questions.length > 0 || t.resources.length > 0;
  const bodyId = `topic-body-${t.id}`;

  return (
    <article
      id={`topic-${t.id}`}
      className={cn(
        "relative scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-card transition-[border-color,box-shadow] duration-200 before:absolute before:inset-y-0 before:left-0 before:w-1",
        p.edge,
        open ? "border-lime-border/70 shadow-lift" : "border-border hover:border-lime-border/70",
      )}
    >
      <div className="flex items-start gap-3 py-4 pr-3 pl-5 sm:py-5 sm:pr-4 sm:pl-6">
        {rank ? (
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-[14px] font-extrabold tabular-nums",
              rank <= 3 ? "bg-ink text-lime" : "bg-muted text-ink/70",
            )}
          >
            {rank}
          </span>
        ) : null}
        <div className={cn("min-w-0 flex-1", hasBody && "cursor-pointer")} onClick={hasBody ? onToggle : undefined}>
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityPill priority={t.priority} />
            {moduleLabel ? (
              <span className="inline-block h-6 max-w-[240px] truncate rounded-full bg-chip px-2 text-[11.5px] leading-6 font-medium text-ink/70">{moduleLabel}</span>
            ) : null}
            {revised ? (
              <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand px-2 text-[11.5px] font-semibold text-white">
                <Check className="size-3" strokeWidth={3} /> Revised
              </span>
            ) : null}
          </div>
          <h3 className={cn("mt-2 text-[16.5px] leading-snug font-bold tracking-[-0.01em] text-ink", revised && "text-ink/60")}>
            {hasBody ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="text-left outline-none focus-visible:underline focus-visible:decoration-lime-border focus-visible:decoration-2 focus-visible:underline-offset-4"
              >
                <InlineRich text={t.title} />
              </button>
            ) : (
              <InlineRich text={t.title} />
            )}
          </h3>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
            {t.questions.length ? (
              <span className="inline-flex items-center gap-1.5">
                <HeatMeter value={asked} max={maxApp} fill={p.fill} />
                Asked <b className="font-semibold text-ink tabular-nums">{asked}×</b>
              </span>
            ) : null}
            {years.length ? (
              <span className="inline-flex flex-wrap items-center gap-1">
                {years.slice(-4).map((y) => (
                  <span key={y} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-ink/70 tabular-nums">
                    {y}
                  </span>
                ))}
                {years.length > 4 ? <span className="text-[11px]">+{years.length - 4}</span> : null}
              </span>
            ) : null}
            {marks ? <span className="tabular-nums">up to {marks} marks</span> : null}
            {t.resources.length ? (
              <span className="inline-flex items-center gap-1">
                <BookOpenText className="size-3.5" /> {t.resources.length} {t.resources.length === 1 ? "file" : "files"}
              </span>
            ) : null}
            {!hasBody ? <span>Details coming soon</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-pressed={revised}
            onClick={() => setRevised([t.id], !revised)}
            title={revised ? "Mark as not revised" : "Mark as revised"}
            aria-label={revised ? `Mark ${plainText(t.title)} as not revised` : `Mark ${plainText(t.title)} as revised`}
            className={cn(
              "flex size-9 items-center justify-center rounded-full border-2 transition-colors",
              revised ? "border-brand bg-brand text-white" : "border-border text-transparent hover:border-lime-border hover:text-lime-border",
            )}
          >
            <Check className="size-4" strokeWidth={3} />
          </button>
          {hasBody ? (
            <button
              type="button"
              onClick={onToggle}
              tabIndex={-1}
              aria-hidden
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-ink"
            >
              <ChevronDown className={cn("size-[18px] transition-transform duration-200", open && "rotate-180")} />
            </button>
          ) : null}
        </div>
      </div>

      {hasBody && open ? (
        <div id={bodyId} className="animate-fade-up border-t border-border bg-surface/70 px-5 py-5 sm:px-6">
          <div className={cn("grid gap-6", t.resources.length > 0 && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
            <div className="min-w-0 space-y-6">
              {t.notes ? (
                <section>
                  <BodyHeading icon={NotebookPen}>Quick notes</BodyHeading>
                  <div className="relative rounded-xl border border-[#ebe7c4] bg-[#fffef3] px-4 py-3.5 shadow-[0_1px_0_rgb(0_0_0/0.02)]">
                    <RichText text={t.notes} />
                  </div>
                </section>
              ) : null}
              {t.questions.length ? (
                <section>
                  <BodyHeading icon={ScrollText}>
                    Asked in exams <span className="font-normal text-muted-foreground">· {t.questions.length}</span>
                  </BodyHeading>
                  <ol className="space-y-2">
                    {t.questions.map((q, i) => (
                      <li key={i} className={cn("relative overflow-hidden rounded-xl border border-border bg-white py-3 pr-3 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px]", p.edge)}>
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold text-muted-foreground">Q{i + 1}</span>
                          <p className="min-w-0 flex-1 text-[14px] leading-relaxed text-ink/90">
                            <InlineRich text={q.text} />
                          </p>
                          {q.marks ? (
                            <span className="shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold text-lime tabular-nums">{q.marks}m</span>
                          ) : null}
                        </div>
                        {q.years.length ? (
                          <div className="mt-2 flex flex-wrap gap-1 pl-7">
                            {q.years.map((y) => (
                              <span key={y} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", p.badge)}>
                                {y}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
            {t.resources.length ? (
              <aside className="min-w-0">
                <BodyHeading icon={FileText}>Read it in</BodyHeading>
                <ul className="space-y-2">
                  {t.resources.map((r) => (
                    <li key={r.id}>
                      <Link href={`/notes/${r.id}${r.page ? `#page=${r.page}` : ""}`} className="interactive-card group flex items-center gap-3 p-2.5">
                        {r.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- generated first-page preview
                          <img src={r.thumbnail_url} alt="" loading="lazy" className="h-[52px] w-10 shrink-0 rounded-md border border-border bg-white object-cover object-top" />
                        ) : (
                          <span className="flex h-[52px] w-10 shrink-0 items-center justify-center rounded-md bg-lime-soft text-brand">
                            <FileText className="size-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink group-hover:text-brand">{r.title}</span>
                          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                            {RESOURCE_TYPE_MAP[r.type].label}
                            {r.module ? ` · M${r.module}` : ""}
                          </span>
                        </span>
                        {r.page ? (
                          <span className="shrink-0 rounded-md bg-sticky px-1.5 py-0.5 text-[11px] font-bold text-ink tabular-nums">p.{r.page}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function BodyHeading({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h4 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
      <Icon className="size-3.5" /> {children}
    </h4>
  );
}
