import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Download, Eye, ScrollText } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { ClassLinks, readClassParams } from "@/components/site/class-links";
import { ClassFocusBar } from "@/components/site/class-scope";
import { EmptyState } from "@/components/site/empty-state";
import { BookStackIllustration } from "@/components/site/illustrations";
import type { ResourceFeedRow } from "@/lib/database.types";
import { getDepartments, getPapers } from "@/lib/data";
import { formatBytes } from "@/lib/format";
import { getPrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Previous year question papers",
  description: "KTU previous year question papers by branch, semester and subject — with solutions where available.",
};

export default function PapersPage({ searchParams }: PageProps<"/papers">) {
  return (
    <div className="container-page pt-6">
      <section className="relative overflow-hidden rounded-2xl bg-[#0d110e] px-6 py-9 sm:px-10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(120,160,90,0.25),transparent_55%)]" />
        <div className="relative z-10 max-w-xl">
          <span className="mb-4 block h-[3px] w-6 rounded-full bg-white/80" aria-hidden />
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-white sm:text-[38px]">Previous Year Papers</h1>
          <p className="mt-2 text-[15px] text-white/75">University question papers by subject — with solutions where available.</p>
        </div>
        <BookStackIllustration className="pointer-events-none absolute -right-4 -bottom-3 hidden w-[300px] sm:block" />
      </section>
      <Suspense fallback={<div className="mt-6 h-[420px] animate-pulse rounded-2xl border border-border bg-white" />}>
        <PapersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PapersContent({ searchParams }: { searchParams: PageProps<"/papers">["searchParams"] }) {
  const [sp, prefs, departments] = await Promise.all([searchParams, getPrefs(), getDepartments()]);
  const { dept, sem, locked, get } = readClassParams(sp, prefs);
  const year = Number(get("year")) || null;
  const solvedOnly = get("solved") === "1";

  const all = await getPapers({ department: dept, semester: sem });
  const years = [...new Set(all.map((p) => p.exam_year).filter((y): y is number => !!y))].sort((a, b) => b - a);
  const papers = all.filter((p) => (!year || p.exam_year === year) && (!solvedOnly || p.tags.includes("solved")));

  const groups = new Map<string, { subject: Pick<ResourceFeedRow, "subject_slug" | "subject_name" | "subject_icon" | "subject_code" | "semester">; items: ResourceFeedRow[] }>();
  for (const p of papers) {
    const g = groups.get(p.subject_id) ?? { subject: p, items: [] };
    g.items.push(p);
    groups.set(p.subject_id, g);
  }

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ dept: dept ?? "all", sem: sem ? String(sem) : "all" });
    if (year) p.set("year", String(year));
    if (solvedOnly) p.set("solved", "1");
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/papers?${p}`;
  };

  return (
    <div>
      <div className="mt-6">
        {locked && sem ? (
          <ClassFocusBar department={departments.find((d) => d.slug === dept) ?? null} semester={sem} />
        ) : (
          <ClassLinks base="/papers" departments={departments} dept={dept} sem={sem} allowAll extra={year ? { year: String(year) } : {}} />
        )}
      </div>

      {years.length > 0 || all.some((p) => p.tags.includes("solved")) ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Year</span>
          <Link href={qs({ year: null })} data-active={!year} className="chip h-8">
            All
          </Link>
          {years.map((y) => (
            <Link key={y} href={qs({ year: String(y) })} data-active={year === y} className="chip h-8">
              {y}
            </Link>
          ))}
          <Link href={qs({ solved: solvedOnly ? null : "1" })} data-active={solvedOnly} className="chip ml-auto h-8">
            <BadgeCheck className="size-3.5" /> With solutions
          </Link>
        </div>
      ) : null}

      <div className="mt-8 space-y-6">
        {groups.size === 0 ? (
          <EmptyState icon={<ScrollText />} title="No papers here yet">
            Try another semester or branch — or{" "}
            <Link href="/contribute" className="font-medium text-brand hover:underline">
              share a paper you have
            </Link>
            .
          </EmptyState>
        ) : (
          [...groups.entries()].map(([id, g]) => (
            <section key={id} className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              <header className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-lime-soft text-brand">
                  <DynamicIcon name={g.subject.subject_icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15.5px] font-semibold text-ink">{g.subject.subject_name}</h2>
                  <p className="text-[12.5px] text-muted-foreground">
                    S{g.subject.semester}
                    {g.subject.subject_code ? ` · ${g.subject.subject_code}` : ""} · {g.items.length} {g.items.length === 1 ? "paper" : "papers"}
                  </p>
                </div>
                <Link href={`/subjects/${g.subject.subject_slug}?type=pyq`} className="hidden items-center gap-1 text-[13px] font-medium text-brand hover:underline sm:inline-flex">
                  Subject page <ArrowRight className="size-3.5" />
                </Link>
              </header>
              <ul className="divide-y divide-border">
                {g.items.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <span className={cn("w-[92px] shrink-0 text-[13px] font-semibold text-ink tabular-nums")}>
                      {p.exam_session ?? p.exam_year ?? "—"}
                    </span>
                    <Link href={`/notes/${p.id}`} className="min-w-0 flex-1 truncate text-[14px] text-ink hover:text-brand">
                      {p.title}
                    </Link>
                    {p.tags.includes("solved") ? (
                      <span className="hidden rounded-full bg-lime-soft px-2 py-0.5 text-[11px] font-semibold text-accent-foreground sm:inline">Solved</span>
                    ) : null}
                    <span className="hidden w-16 text-right text-[12px] text-muted-foreground md:inline">{formatBytes(p.file_size)}</span>
                    <Link href={`/notes/${p.id}`} className="inline-flex size-8 items-center justify-center rounded-lg text-ink/80 hover:bg-lime-soft hover:text-brand" aria-label={`View ${p.title}`}>
                      <Eye className="size-4" />
                    </Link>
                    <a href={`/api/download/${p.id}`} target="_blank" rel="noopener" className="inline-flex size-8 items-center justify-center rounded-lg text-ink/80 hover:bg-lime-soft hover:text-brand" aria-label={`Download ${p.title}`}>
                      <Download className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
