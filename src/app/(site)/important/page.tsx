import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Flame, ScrollText } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ClassLinks, readClassParams } from "@/components/site/class-links";
import { EmptyState } from "@/components/site/empty-state";
import { ModuleHeatStrip, PriorityIcon } from "@/components/topic-bits";
import type { SubjectOverviewRow, TopicPriority } from "@/lib/database.types";
import { getDepartments, getSubjects, getTopicModules, getTopicStats } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { parseModules } from "@/lib/subject-utils";
import { PRIORITIES } from "@/lib/topics";

export const metadata: Metadata = {
  title: "Important topics",
  description: "Module-wise important topics for every subject — what to study first, the questions that keep coming back, and where to read them.",
};

export default function ImportantPage({ searchParams }: PageProps<"/important">) {
  return (
    <div className="container-page pt-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#0d110e] px-6 py-9 sm:px-10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_82%_30%,rgba(228,87,46,0.25),transparent_45%),radial-gradient(circle_at_60%_100%,rgba(120,160,90,0.3),transparent_55%)]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <span className="mb-4 block h-[3px] w-6 rounded-full bg-white/80" aria-hidden />
            <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-white sm:text-[38px]">Important Topics</h1>
            <p className="mt-2 text-[15px] text-white/75">
              Module by module: what to learn first, the questions that keep coming back, and exactly where to read them.
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="Priorities">
            {PRIORITIES.map((p) => (
              <li key={p.value} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-white/80">
                <span className={`size-2 rounded-full ${p.fill}`} /> {p.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Suspense fallback={<div className="mt-6 h-[420px] animate-pulse rounded-2xl border border-border bg-white" />}>
        <ImportantContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ImportantContent({ searchParams }: { searchParams: PageProps<"/important">["searchParams"] }) {
  const [sp, prefs, departments, stats] = await Promise.all([searchParams, getPrefs(), getDepartments(), getTopicStats()]);
  const { dept, sem } = readClassParams(sp, prefs);
  const subjects = await getSubjects(dept, sem);
  const withTopics = subjects.filter((s) => stats.has(s.id));
  const without = subjects.filter((s) => !stats.has(s.id));
  const moduleRows = await getTopicModules(withTopics.map((s) => s.id));

  const bySemester = new Map<number, SubjectOverviewRow[]>();
  for (const s of withTopics) bySemester.set(s.semester, [...(bySemester.get(s.semester) ?? []), s]);

  const strip = (s: SubjectOverviewRow) => {
    const counts = new Map<number, Partial<Record<TopicPriority, number>>>();
    for (const m of parseModules(s.modules)) counts.set(m.n, {});
    for (const r of moduleRows) {
      if (r.subject_id !== s.id) continue;
      const c = counts.get(r.module) ?? {};
      c[r.priority] = (c[r.priority] ?? 0) + 1;
      counts.set(r.module, c);
    }
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => ({ n, counts: c }));
  };

  return (
    <div>
      <div className="mt-6">
        <ClassLinks base="/important" departments={departments} dept={dept} sem={sem} allowAll />
      </div>

      {withTopics.length === 0 ? (
        <EmptyState icon={<Flame />} title="No important topics for this class yet" className="mt-8">
          The team adds them subject by subject before exams. Meanwhile,{" "}
          <Link href="/papers" className="font-medium text-brand hover:underline">
            browse previous papers
          </Link>
          .
        </EmptyState>
      ) : (
        <div className="mt-9 space-y-10">
          {[...bySemester.entries()].map(([semester, list]) => (
            <section key={semester} aria-label={`Semester ${semester}`}>
              <h2 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-ink">
                <span className="rounded-md bg-ink px-2 py-0.5 text-[13px] font-semibold text-lime">S{semester}</span>
                {list.length} {list.length === 1 ? "subject" : "subjects"}
              </h2>
              <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => {
                  const st = stats.get(s.id)!;
                  return (
                    <Link key={s.id} href={`/subjects/${s.slug}/important`} className="interactive-card group flex flex-col p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef6e5] text-brand transition-colors group-hover:bg-lime-chip/70">
                          <DynamicIcon name={s.icon} className="size-[21px]" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[15px] leading-snug font-semibold tracking-[-0.01em] text-ink">{s.name}</span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            S{s.semester}
                            {s.code ? ` · ${s.code}` : ""}
                          </span>
                        </span>
                      </div>
                      <div className="mt-4 flex items-baseline gap-4">
                        <span>
                          <span className="text-[26px] leading-none font-extrabold tracking-[-0.03em] text-ink tabular-nums">{st.topic_count}</span>
                          <span className="ml-1 text-[12.5px] text-muted-foreground">topics</span>
                        </span>
                        {st.critical_count ? (
                          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-hot-ink">
                            <PriorityIcon priority="critical" className="size-3.5" strokeWidth={2.4} />
                            {st.critical_count} must know
                          </span>
                        ) : null}
                      </div>
                      <ModuleHeatStrip modules={strip(s)} className="mt-4" />
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <ScrollText className="size-3.5" />
                          {st.question_count ? `${st.question_count} exam questions mapped` : `${st.module_count} ${st.module_count === 1 ? "module" : "modules"} covered`}
                        </span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {without.length > 0 && withTopics.length > 0 ? (
        <section className="mt-12" aria-label="Coming soon">
          <h2 className="mb-3 text-[14px] font-semibold text-muted-foreground">Coming soon</h2>
          <div className="flex flex-wrap gap-2">
            {without.slice(0, 30).map((s) => (
              <Link key={s.id} href={`/subjects/${s.slug}`} className="chip h-9">
                <DynamicIcon name={s.icon} className="size-3.5" /> {s.short_name ?? s.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
