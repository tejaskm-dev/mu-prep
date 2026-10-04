"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, FileSearch, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCE_TYPES, SORT_OPTIONS, TAG_LABELS, type SortValue } from "@/lib/constants";
import { parseExplorerState, type ExplorerState } from "@/lib/explorer-state";
import type { ResourceType, SubjectModule } from "@/lib/database.types";
import type { ResourceCardData } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { ResourceCard, ResourceRow } from "./resource-card";

function toQuery(s: ExplorerState) {
  const p = new URLSearchParams();
  if (s.type !== "all") p.set("type", s.type);
  if (s.module) p.set("module", String(s.module));
  if (s.tags.length) p.set("tags", s.tags.join(","));
  if (s.year) p.set("year", String(s.year));
  if (s.verified) p.set("verified", "1");
  if (s.q) p.set("q", s.q);
  if (s.sort !== "newest") p.set("sort", s.sort);
  if (s.view !== "grid") p.set("view", s.view);
  const str = p.toString();
  return str ? `?${str}` : "";
}

function matchesQuery(r: ResourceCardData, q: string) {
  if (!q) return true;
  const hay = `${r.title} ${r.author ?? ""} ${r.exam_session ?? ""} ${r.tags.join(" ")} module ${r.module ?? ""}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function SubjectExplorer({
  resources,
  modules,
  initial,
  aside,
}: {
  resources: ResourceCardData[];
  modules: SubjectModule[];
  initial: ExplorerState;
  aside?: React.ReactNode;
}) {
  const [state, setState] = useState<ExplorerState>(initial);
  const [showFilters, setShowFilters] = useState(false);
  const deferredQ = state.q;

  // The page is prerendered without search params; apply shared-link filters after mount.
  useEffect(() => {
    if (!window.location.search) return;
    const fromUrl = parseExplorerState(Object.fromEntries(new URLSearchParams(window.location.search)));
    setState(fromUrl);
    setShowFilters(fromUrl.tags.length > 0 || !!fromUrl.year || fromUrl.verified);
  }, []);

  // Reflect filters in the URL (shareable links) without a server round trip.
  useEffect(() => {
    const next = `${window.location.pathname}${toQuery(state)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [state]);

  const update = (patch: Partial<ExplorerState>) => setState((s) => ({ ...s, ...patch }));

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resources) {
      const key = r.module ? String(r.module) : "full";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [resources]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resources) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return counts;
  }, [resources]);

  const years = useMemo(
    () => [...new Set(resources.map((r) => r.exam_year).filter((y): y is number => !!y))].sort((a, b) => b - a),
    [resources],
  );
  const availableTags = useMemo(() => [...new Set(resources.flatMap((r) => r.tags))].filter((t) => t in TAG_LABELS), [resources]);

  const filtered = useMemo(() => {
    const rows = resources.filter(
      (r) =>
        (state.type === "all" || r.type === state.type) &&
        (state.module === null || (state.module === "full" ? r.module === null : r.module === state.module)) &&
        state.tags.every((t) => r.tags.includes(t)) &&
        (!state.year || r.exam_year === state.year) &&
        (!state.verified || r.is_verified) &&
        matchesQuery(r, deferredQ),
    );
    const byDate = (a: ResourceCardData, b: ResourceCardData) => (b.published_at ?? "").localeCompare(a.published_at ?? "");
    switch (state.sort) {
      case "popular":
        return rows.sort((a, b) => b.download_count - a.download_count || byDate(a, b));
      case "title":
        return rows.sort((a, b) => a.title.localeCompare(b.title));
      case "oldest":
        return rows.sort((a, b) => -byDate(a, b));
      case "module":
        return rows.sort((a, b) => (a.module ?? 99) - (b.module ?? 99) || a.title.localeCompare(b.title));
      default:
        return rows.sort(byDate);
    }
  }, [resources, state.type, state.module, state.tags, state.year, state.verified, state.sort, deferredQ]);

  const activeFilterCount = state.tags.length + (state.year ? 1 : 0) + (state.verified ? 1 : 0) + (state.module ? 1 : 0);
  const reset = () => update({ type: "all", module: null, tags: [], year: null, verified: false, q: "" });

  const groups = useMemo(() => {
    if (state.sort !== "module") return null;
    const map = new Map<string, ResourceCardData[]>();
    for (const r of filtered) {
      const key = r.module ? String(r.module) : "full";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].map(([key, items]) => {
      const m = modules.find((x) => String(x.n) === key);
      return { key, title: key === "full" ? "Covers all modules" : `Module ${key}${m ? ` — ${m.title}` : ""}`, items };
    });
  }, [filtered, modules, state.sort]);

  const swapKey = [state.type, state.module, state.tags.join(","), state.year, state.verified, state.sort, state.view].join("|");
  const renderItems = (items: ResourceCardData[]) =>
    state.view === "grid" ? (
      <div key={swapKey} className="swap-in grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <ResourceCard key={r.id} r={r} showSubject={false} />
        ))}
      </div>
    ) : (
      <div key={swapKey} className="swap-in flex flex-col gap-2.5">
        {items.map((r) => (
          <ResourceRow key={r.id} r={r} />
        ))}
      </div>
    );

  const moduleList: { key: number | "full"; label: string; title?: string }[] = [
    ...(modules.length ? modules : [...new Set(resources.map((r) => r.module).filter((m): m is number => !!m))].sort((a, b) => a - b).map((n) => ({ n, title: "" }))).map((m) => ({
      key: m.n,
      label: `Module ${m.n}`,
      title: m.title,
    })),
    { key: "full" as const, label: "Full syllabus", title: "Files covering every module" },
  ];

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0">
      {/* type tabs */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Resource type">
        <button type="button" role="tab" aria-selected={state.type === "all"} data-active={state.type === "all"} onClick={() => update({ type: "all" })} className="chip h-9 px-4">
          All <span className="text-xs opacity-60">{resources.length}</span>
        </button>
        {RESOURCE_TYPES.filter((t) => typeCounts.get(t.value)).map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={state.type === t.value}
            data-active={state.type === t.value}
            onClick={() => update({ type: t.value, year: t.value === "pyq" ? state.year : null })}
            className="chip h-9 px-4"
          >
            {t.plural} <span className="text-xs opacity-60">{typeCounts.get(t.value)}</span>
          </button>
        ))}
      </div>

      {/* toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={state.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search in this subject…"
            className="h-10 w-full rounded-lg border border-border bg-white pr-8 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-lime-border focus:ring-3 focus:ring-lime-soft"
          />
          {state.q ? (
            <button type="button" onClick={() => update({ q: "" })} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-ink" aria-label="Clear">
              <X className="size-3.5" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-expanded={showFilters}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-ink hover:border-lime-border",
            showFilters && "border-lime-border bg-lime-soft",
          )}
        >
          <SlidersHorizontal className="size-4" /> Filters
          {activeFilterCount ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-white">{activeFilterCount}</span>
          ) : null}
        </button>
        <Select value={state.sort} onValueChange={(v) => update({ sort: v as SortValue })}>
          <SelectTrigger className="h-10! w-[168px] rounded-lg bg-white" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-10 items-center rounded-lg border border-border bg-white p-1" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => {
            const Icon = v === "grid" ? LayoutGrid : List;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={state.view === v}
                aria-label={`${v} view`}
                onClick={() => update({ view: v })}
                className={cn("flex size-8 items-center justify-center rounded-md text-muted-foreground", state.view === v && "bg-lime-soft text-ink")}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      {showFilters ? (
        <div className="mt-3 flex flex-col gap-4 rounded-xl border border-border bg-white p-4 animate-fade-up sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Module</span>
            <button type="button" data-active={state.module === null} onClick={() => update({ module: null })} className="chip h-8">
              Any
            </button>
            {(modules.length ? modules.map((m) => m.n) : [1, 2, 3, 4, 5]).map((n) => (
              <button key={n} type="button" data-active={state.module === n} onClick={() => update({ module: state.module === n ? null : n })} className="chip h-8 min-w-10 justify-center">
                {n}
              </button>
            ))}
            <button type="button" data-active={state.module === "full"} onClick={() => update({ module: state.module === "full" ? null : "full" })} className="chip h-8">
              Full
            </button>
          </div>
          {availableTags.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tags</span>
              {availableTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-active={state.tags.includes(t)}
                  onClick={() => update({ tags: state.tags.includes(t) ? state.tags.filter((x) => x !== t) : [...state.tags, t] })}
                  className="chip h-8"
                >
                  {TAG_LABELS[t]}
                </button>
              ))}
            </div>
          ) : null}
          {years.length ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Exam year</span>
              <Select value={state.year ? String(state.year) : "any"} onValueChange={(v) => update({ year: v === "any" ? null : Number(v) })}>
                <SelectTrigger className="h-8! w-[110px] rounded-lg" aria-label="Exam year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any year</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <button type="button" data-active={state.verified} onClick={() => update({ verified: !state.verified })} className="chip h-8">
            <BadgeCheck className="size-3.5" /> Verified only
          </button>
          {activeFilterCount ? (
            <button type="button" onClick={reset} className="text-sm font-medium text-brand hover:underline sm:ml-auto">
              Reset all
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 mb-3 text-[13px] text-muted-foreground" aria-live="polite">
        {filtered.length === resources.length
          ? `${resources.length} ${resources.length === 1 ? "file" : "files"}`
          : `Showing ${filtered.length} of ${resources.length}`}
        {state.module ? ` · ${state.module === "full" ? "full-syllabus files" : `module ${state.module}`}` : ""}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileSearch />}
          title="Nothing matches these filters"
          action={
            <button type="button" onClick={reset} className="text-sm font-medium text-brand hover:underline">
              Clear filters
            </button>
          }
        >
          Try another module or type — or request what you need from the sidebar.
        </EmptyState>
      ) : groups ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-3 text-[15px] font-semibold text-ink">{g.title}</h3>
              {renderItems(g.items)}
            </section>
          ))}
        </div>
      ) : (
        renderItems(filtered)
      )}
    </div>

    <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
      <section className="rounded-xl border border-border bg-white p-4" aria-label="Modules">
        <h2 className="mb-2 flex items-center justify-between text-[14px] font-semibold text-ink">
          Modules
          {state.module ? (
            <button type="button" onClick={() => update({ module: null })} className="text-xs font-medium text-brand hover:underline">
              Show all
            </button>
          ) : null}
        </h2>
        <ul className="-mx-1.5 flex flex-col">
          {moduleList.map((m) => {
            const active = state.module === m.key;
            const count = moduleCounts.get(String(m.key)) ?? 0;
            return (
              <li key={String(m.key)}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ module: active ? null : m.key })}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-lime-soft/70",
                    active && "bg-lime-soft",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                      active ? "bg-ink text-lime" : "bg-muted text-ink/70",
                    )}
                  >
                    {m.key === "full" ? "∗" : m.key}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug font-medium text-ink">{m.title || m.label}</span>
                    <span className="block text-[11.5px] text-muted-foreground">
                      {m.title && m.key !== "full" ? `${m.label} · ` : ""}
                      {count ? `${count} ${count === 1 ? "file" : "files"}` : "Nothing yet"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {aside}
    </aside>
    </div>
  );
}
