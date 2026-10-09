import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { FileSearch } from "lucide-react";
import { ClassFocusBar } from "@/components/site/class-scope";
import { EmptyState } from "@/components/site/empty-state";
import { ResourceCard } from "@/components/site/resource-card";
import { SubjectCard } from "@/components/site/subject-card";
import { SearchRefine } from "@/components/site/search-refine";
import { RESOURCE_TYPES } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { getDepartments, searchEverything } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { toCard, toSubjectCard } from "@/lib/serialize";
import { hasServiceRole, serviceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="container-page pt-6">
      <Suspense fallback={<SearchRefine initial="" />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  await connection(); // results are per-request (and logged for search insights)
  const sp = await searchParams;
  const q = String(Array.isArray(sp.q) ? sp.q[0] : (sp.q ?? "")).trim().slice(0, 80);
  const typeParam = String(sp.type ?? "");
  const type = RESOURCE_TYPES.some((t) => t.value === typeParam) ? (typeParam as ResourceType) : null;
  const [prefs, departments] = await Promise.all([getPrefs(), getDepartments()]);
  const { subjects, resources } = q
    ? await searchEverything(q, { department: prefs.department, semester: prefs.semester, type, limit: 48, strict: prefs.focus })
    : { subjects: [], resources: [] };

  // Search analytics: lets admins see what students look for (and what's missing).
  if (q.length >= 2 && hasServiceRole()) {
    after(async () => {
      await serviceClient()
        .from("search_logs")
        .insert({ query: q.toLowerCase(), results: subjects.length + resources.length });
    });
  }

  return (
    <div>
      <SearchRefine initial={q} />
      {prefs.focus && prefs.semester ? (
        <ClassFocusBar className="mt-5" department={departments.find((d) => d.slug === prefs.department) ?? null} semester={prefs.semester} />
      ) : null}
      {q ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href={`/search?q=${encodeURIComponent(q)}`} data-active={!type} className="chip h-8">
              Everything
            </Link>
            {RESOURCE_TYPES.map((t) => (
              <Link key={t.value} href={`/search?q=${encodeURIComponent(q)}&type=${t.value}`} data-active={type === t.value} className="chip h-8">
                {t.plural}
              </Link>
            ))}
          </div>

          {subjects.length === 0 && resources.length === 0 ? (
            <EmptyState
              className="mt-8"
              icon={<FileSearch />}
              title={`No results for “${q}”`}
              action={
                <Link href="/notes" className="text-sm font-medium text-brand hover:underline">
                  Browse everything instead
                </Link>
              }
            >
              Check the spelling, try a shorter phrase or a course code (e.g. MAT101). If it&apos;s missing, request it from the subject page.
            </EmptyState>
          ) : null}

          {subjects.length > 0 && !type ? (
            <section className="mt-8">
              <h2 className="mb-3 text-[15px] font-semibold text-ink">Subjects</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {subjects.map((s) => (
                  <SubjectCard key={s.id} s={toSubjectCard(s)} showSemester />
                ))}
              </div>
            </section>
          ) : null}

          {resources.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 text-[15px] font-semibold text-ink">
                Files <span className="font-normal text-muted-foreground">· {resources.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {resources.map((r) => (
                  <ResourceCard key={r.id} r={toCard(r)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Type a subject, topic or course code to search µPrep.</p>
      )}
    </div>
  );
}
