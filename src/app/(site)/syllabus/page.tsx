import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, Download, GraduationCap } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ClassLinks, readClassParams } from "@/components/site/class-links";
import { ClassFocusBar } from "@/components/site/class-scope";
import { EmptyState } from "@/components/site/empty-state";
import { getDepartments, getSubjects, getSyllabusResources } from "@/lib/data";
import { formatBytes } from "@/lib/format";
import { getPrefs } from "@/lib/prefs";
import { parseModules } from "@/lib/subject-utils";

export const metadata: Metadata = {
  title: "Syllabus & curriculum",
  description: "Module-wise syllabus for every subject, branch and semester.",
};

export default function SyllabusPage({ searchParams }: PageProps<"/syllabus">) {
  return (
    <div className="container-page pt-6">
      <span className="section-mark mb-3" aria-hidden />
      <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">Syllabus &amp; curriculum</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-muted-foreground">
        Module-by-module outline for each subject, with the official syllabus documents where available.
      </p>
      <Suspense fallback={<div className="mt-6 h-[420px] animate-pulse rounded-2xl border border-border bg-white" />}>
        <SyllabusContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SyllabusContent({ searchParams }: { searchParams: PageProps<"/syllabus">["searchParams"] }) {
  const [sp, prefs, departments] = await Promise.all([searchParams, getPrefs(), getDepartments()]);
  const { dept, sem, locked } = readClassParams(sp, prefs);
  const department = dept ?? departments[0]?.slug ?? null;
  const semester = sem ?? 1;
  const subjects = await getSubjects(department, semester);
  const files = await getSyllabusResources(subjects.map((s) => s.id));
  const deptRow = departments.find((d) => d.slug === department);

  return (
    <div>
      <div className="mt-6">
        {locked ? (
          <ClassFocusBar department={deptRow ?? null} semester={semester} />
        ) : (
          <ClassLinks base="/syllabus" departments={departments} dept={department} sem={semester} />
        )}
      </div>

      <h2 className="mt-9 mb-4 text-[18px] font-bold text-ink">
        S{semester} {deptRow?.code ?? ""} · {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
        {subjects.some((s) => s.credits) ? (
          <span className="ml-2 text-[14px] font-medium text-muted-foreground">
            · {subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0)} credits
          </span>
        ) : null}
      </h2>

      {subjects.length === 0 ? (
        <EmptyState icon={<GraduationCap />} title="No subjects added for this semester yet">
          The µLearn team is still building out this curriculum.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {subjects.map((s) => {
            const modules = parseModules(s.modules);
            const docs = files.filter((f) => f.subject_id === s.id);
            return (
              <article key={s.id} className="flex flex-col rounded-2xl border border-border bg-white p-5 shadow-card">
                <header className="flex items-start gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime-soft text-brand">
                    <DynamicIcon name={s.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[16px] leading-snug font-semibold text-ink">{s.name}</h3>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {[s.code, s.credits ? `${s.credits} credits` : null, `${s.resource_count} files`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Link href={`/subjects/${s.slug}`} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                    Notes <ArrowRight className="size-3.5" />
                  </Link>
                </header>
                {modules.length ? (
                  <ol className="mt-4 space-y-1.5">
                    {modules.map((m) => (
                      <li key={m.n}>
                        <Link
                          href={`/subjects/${s.slug}?module=${m.n}`}
                          className="group flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13.5px] text-ink hover:bg-lime-soft"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-ink/70 group-hover:bg-ink group-hover:text-lime">
                            {m.n}
                          </span>
                          {m.title || `Module ${m.n}`}
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 rounded-lg bg-surface px-3 py-2.5 text-[13px] text-muted-foreground">Module outline hasn&apos;t been added yet.</p>
                )}
                {docs.length ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    {docs.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/download/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-ink hover:border-lime-border hover:bg-lime-soft"
                      >
                        <BookMarked className="size-4 text-brand" /> {d.title}
                        {d.file_size ? <span className="text-muted-foreground">· {formatBytes(d.file_size)}</span> : null}
                        <Download className="size-3.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
