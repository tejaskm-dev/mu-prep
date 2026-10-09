import Link from "next/link";
import { ChevronRight, Flame, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ModuleHeatStrip, PriorityIcon } from "@/components/topic-bits";
import type { TopicPriority } from "@/lib/database.types";
import { requireAdminPage } from "@/lib/auth";
import { SEMESTERS } from "@/lib/constants";
import { parseModules } from "@/lib/subject-utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "Important topics" };

export default async function AdminTopicsPage({ searchParams }: PageProps<"/admin/topics">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const semRaw = Number(Array.isArray(sp.sem) ? sp.sem[0] : sp.sem);
  const sem = Number.isInteger(semRaw) && semRaw >= 1 && semRaw <= 8 ? semRaw : null;
  const show = sp.show === "missing" ? "missing" : sp.show === "done" ? "done" : "all";

  const [{ data: subjects }, { data: topics }] = await Promise.all([
    supabase.from("subject_overview").select("id,name,short_name,code,semester,icon,modules,is_active,department_slugs").order("semester").order("sort_order").order("name"),
    supabase.from("important_topics").select("subject_id,module,priority,is_published"),
  ]);

  const bySubject = new Map<string, { module: number; priority: TopicPriority; is_published: boolean }[]>();
  for (const t of topics ?? []) bySubject.set(t.subject_id, [...(bySubject.get(t.subject_id) ?? []), t]);

  const all = subjects ?? [];
  const covered = all.filter((s) => bySubject.has(s.id)).length;
  const rows = all.filter(
    (s) => (!sem || s.semester === sem) && (show === "all" || (show === "done" ? bySubject.has(s.id) : !bySubject.has(s.id))),
  );
  const totalTopics = topics?.length ?? 0;
  const critical = (topics ?? []).filter((t) => t.priority === "critical").length;
  const drafts = (topics ?? []).filter((t) => !t.is_published).length;

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (sem) p.set("sem", String(sem));
    if (show !== "all") p.set("show", show);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const str = p.toString();
    return `/admin/topics${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Important topics"
        description="Mark what matters in each module — priorities, the exam questions they map to, short notes and where to read them."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Subjects covered", value: `${covered}/${all.length}` },
          { label: "Topics", value: totalTopics },
          { label: "Must know", value: critical, hot: true },
          { label: "Drafts", value: drafts },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <p className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
              {s.hot ? <PriorityIcon priority="critical" className="size-3.5 text-hot" strokeWidth={2.4} /> : null}
              {s.label}
            </p>
            <p className="mt-1 text-[24px] leading-none font-extrabold text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={href({ sem: null })} data-active={!sem} className="chip h-8">
          All semesters
        </Link>
        {SEMESTERS.map((s) => (
          <Link key={s} href={href({ sem: String(s) })} data-active={sem === s} className="chip h-8 min-w-11 justify-center">
            S{s}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {(
          [
            ["all", "Everything"],
            ["done", "Has topics"],
            ["missing", "No topics yet"],
          ] as const
        ).map(([v, label]) => (
          <Link key={v} href={href({ show: v === "all" ? null : v })} data-active={show === v} className="chip h-8">
            {label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[14px] text-muted-foreground">No subjects match these filters.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((s) => {
              const list = bySubject.get(s.id) ?? [];
              const counts = new Map<number, Partial<Record<TopicPriority, number>>>(parseModules(s.modules).map((m) => [m.n, {}]));
              for (const t of list) {
                const c = counts.get(t.module) ?? {};
                c[t.priority] = (c[t.priority] ?? 0) + 1;
                counts.set(t.module, c);
              }
              const strip = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => ({ n, counts: c }));
              const must = list.filter((t) => t.priority === "critical").length;
              const draft = list.filter((t) => !t.is_published).length;
              return (
                <li key={s.id}>
                  <Link href={`/admin/topics/${s.id}`} className={cn("group flex items-center gap-4 px-4 py-3.5 hover:bg-surface sm:px-5", !s.is_active && "opacity-60")}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-soft text-brand">
                      <DynamicIcon name={s.icon} className="size-[19px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{s.name}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        S{s.semester}
                        {s.code ? ` · ${s.code}` : ""}
                        {list.length ? ` · ${list.length} topics` : ""}
                        {must ? ` · ${must} must know` : ""}
                        {draft ? ` · ${draft} draft` : ""}
                      </span>
                    </span>
                    {strip.length ? <ModuleHeatStrip modules={strip} compact className="hidden w-[170px] shrink-0 md:flex" /> : null}
                    {list.length ? (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-lime-border px-2.5 py-1 text-[12px] font-medium text-brand">
                        <Plus className="size-3.5" /> Add
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Flame className="size-3.5 text-hot" /> Bars show topics per module, coloured by priority.
      </p>
    </>
  );
}
