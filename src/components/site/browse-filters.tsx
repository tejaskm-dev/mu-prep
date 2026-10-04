"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCE_TAGS, RESOURCE_TYPES, SEMESTERS, SORT_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

export type BrowseValues = {
  q: string;
  dept: string; // slug | "all"
  sem: string; // "1".."8" | "all"
  subject: string; // slug | "all"
  type: string; // type | "all"
  module: string; // "1".."6" | "full" | "all"
  tag: string; // tag | "all"
  sort: string;
};

/** URL-driven filters for /notes. Every change re-renders the server results. */
export function BrowseFilters({
  values,
  departments,
  subjects,
  extraParams = {},
}: {
  values: BrowseValues;
  departments: { slug: string; code: string }[];
  subjects: { slug: string; name: string; semester: number }[];
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(values.q);

  const push = (patch: Partial<BrowseValues>) => {
    const next = { ...values, ...patch };
    const params = new URLSearchParams(extraParams);
    for (const [k, v] of Object.entries(next)) {
      if (k === "sort" ? v && v !== "newest" : v && v !== "" ) params.set(k, v);
    }
    // explicit "all" keeps the visitor's saved class from being re-applied
    for (const k of ["subject", "type", "module", "tag"] as const) if (params.get(k) === "all") params.delete(k);
    if (!next.q) params.delete("q");
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  // Debounced search box
  useEffect(() => {
    if (q === values.q) return;
    const t = setTimeout(() => push({ q, subject: values.subject }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const subjectOptions = subjects.filter((s) => values.sem === "all" || String(s.semester) === values.sem);

  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          {pending ? (
            <MuSpinner className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2  text-brand" />
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, topics, course codes…"
            className="h-11 w-full rounded-xl border border-border bg-surface pr-9 pl-10 text-[14.5px] outline-none placeholder:text-muted-foreground focus:border-lime-border focus:bg-white focus:ring-3 focus:ring-lime-soft"
            aria-label="Search notes"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:flex">
          <FilterSelect
            label="Branch"
            value={values.dept}
            onChange={(v) => push({ dept: v, subject: "all" })}
            options={[{ value: "all", label: "All branches" }, ...departments.map((d) => ({ value: d.slug, label: d.code }))]}
          />
          <FilterSelect
            label="Semester"
            value={values.sem}
            onChange={(v) => push({ sem: v, subject: "all" })}
            options={[{ value: "all", label: "All semesters" }, ...SEMESTERS.map((s) => ({ value: String(s), label: `Semester ${s}` }))]}
          />
          <FilterSelect
            label="Subject"
            value={values.subject}
            onChange={(v) => push({ subject: v })}
            className="lg:w-[200px]"
            options={[{ value: "all", label: "All subjects" }, ...subjectOptions.map((s) => ({ value: s.slug, label: s.name }))]}
          />
          <FilterSelect label="Sort" value={values.sort} onChange={(v) => push({ sort: v })} options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          {[{ value: "all", plural: "All types" }, ...RESOURCE_TYPES].map((t) => (
            <button key={t.value} type="button" data-active={values.type === t.value} onClick={() => push({ type: t.value })} className="chip h-8">
              {t.plural}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <FilterSelect
            label="Module"
            compact
            value={values.module}
            onChange={(v) => push({ module: v })}
            options={[{ value: "all", label: "Any module" }, ...[1, 2, 3, 4, 5, 6].map((m) => ({ value: String(m), label: `Module ${m}` })), { value: "full", label: "Full syllabus" }]}
          />
          <FilterSelect
            label="Tag"
            compact
            value={values.tag}
            onChange={(v) => push({ tag: v })}
            options={[{ value: "all", label: "Any tag" }, ...RESOURCE_TAGS.map((t) => ({ value: t.value, label: t.label }))]}
          />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className={cn("w-full rounded-xl bg-white lg:w-[150px]", compact ? "h-8! lg:w-[140px]" : "h-11!", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
