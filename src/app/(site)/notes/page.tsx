import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSearch } from "lucide-react";
import { BrowseFilters, type BrowseValues } from "@/components/site/browse-filters";
import { ClassFocusBar } from "@/components/site/class-scope";
import { EmptyState } from "@/components/site/empty-state";
import { ResourceCard } from "@/components/site/resource-card";
import { SubjectCard } from "@/components/site/subject-card";
import { RESOURCE_TAGS, RESOURCE_TYPES, SORT_OPTIONS, type SortValue } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { browseResources, getDepartments, getSubjects } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { toCard, toSubjectCard } from "@/lib/serialize";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Browse notes",
  description: "Filter notes, previous papers, lab records and assignments by branch, semester, subject and module.",
};

const PAGE_SIZE = 24;

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <div className="container-page pt-6">
      <Suspense fallback={<NotesSkeleton />}>
        <NotesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div aria-busy="true">
      <span className="section-mark mb-3" aria-hidden />
      <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">Browse notes</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Notes, previous papers, lab records and more — filter down to exactly what you need.</p>
      <div className="mt-6 h-[134px] animate-pulse rounded-2xl border border-border bg-white" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[270px] animate-pulse rounded-xl border border-border bg-white" />
        ))}
      </div>
    </div>
  );
}

async function NotesContent({ searchParams }: { searchParams: PageProps<"/notes">["searchParams"] }) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const prefs = await getPrefs();

  // Absent params fall back to the visitor's class; "all" means explicitly unfiltered.
  // With "Only my class" on, the class is fixed and the params are ignored.
  const deptParam = prefs.focus ? prefs.department! : get("dept") || prefs.department || "all";
  const semParam = prefs.focus ? String(prefs.semester) : get("sem") || (prefs.semester ? String(prefs.semester) : "all");
  const values: BrowseValues = {
    q: get("q").slice(0, 80),
    dept: deptParam,
    sem: semParam,
    subject: get("subject") || "all",
    type: RESOURCE_TYPES.some((t) => t.value === get("type")) ? get("type") : "all",
    module: /^([1-9]|1[0-2]|full)$/.test(get("module")) ? get("module") : "all",
    tag: RESOURCE_TAGS.some((t) => t.value === get("tag")) ? get("tag") : "all",
    sort: SORT_OPTIONS.some((o) => o.value === get("sort")) ? get("sort") : "newest",
  };
  const page = Math.max(1, Number(get("page")) || 1);
  const department = values.dept === "all" ? null : values.dept;
  const semester = values.sem === "all" ? null : Number(values.sem);

  const [departments, subjects, { rows, total }] = await Promise.all([
    getDepartments(),
    getSubjects(department, null),
    browseResources({
      q: values.q,
      department,
      semester,
      subject: values.subject === "all" ? null : values.subject,
      type: values.type === "all" ? null : (values.type as ResourceType),
      module: values.module === "all" ? null : values.module === "full" ? "full" : Number(values.module),
      tag: values.tag === "all" ? null : values.tag,
      sort: values.sort as SortValue,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const semesterSubjects = semester ? subjects.filter((s) => s.semester === semester) : [];
  const dept = departments.find((d) => d.slug === department);
  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) if (v && v !== "all" && !(k === "sort" && v === "newest")) params.set(k, v);
    if (values.dept === "all") params.set("dept", "all");
    if (values.sem === "all") params.set("sem", "all");
    if (n > 1) params.set("page", String(n));
    return `/notes?${params}`;
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="section-mark mb-3" aria-hidden />
          <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">
            Browse notes
            {dept || semester ? (
              <span className="text-brand">
                {" "}
                · {[semester ? `S${semester}` : null, dept?.code].filter(Boolean).join(" ")}
              </span>
            ) : null}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Notes, previous papers, lab records and more — filter down to exactly what you need.
          </p>
        </div>
      </div>

      {prefs.focus && semester ? (
        <ClassFocusBar className="mb-4" department={dept ?? null} semester={semester} />
      ) : null}

      <BrowseFilters
        values={values}
        classLocked={prefs.focus}
        departments={departments.map((d) => ({ slug: d.slug, code: d.code }))}
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name, semester: s.semester }))}
        extraParams={{ ...(values.dept === "all" ? { dept: "all" } : {}), ...(values.sem === "all" ? { sem: "all" } : {}) }}
      />

      {semesterSubjects.length > 0 && values.subject === "all" && !values.q ? (
        <section className="mt-8" aria-label="Subjects">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Subjects in this semester</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {semesterSubjects.map((s) => (
              <SubjectCard key={s.id} s={toSubjectCard(s)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <p className="mb-3 text-[13px] text-muted-foreground" aria-live="polite">
          {total === 0 ? "No results" : `${total} ${total === 1 ? "result" : "results"}`}
          {values.q ? ` for “${values.q}”` : ""}
          {pages > 1 ? ` · page ${page} of ${pages}` : ""}
        </p>
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileSearch />}
            title="Nothing found"
            action={
              <Link href={prefs.focus ? "/notes" : "/notes?dept=all&sem=all"} className="text-sm font-medium text-brand hover:underline">
                Clear all filters
              </Link>
            }
          >
            Try a different semester or subject, or search with a course code like MAT101.
          </EmptyState>
        ) : (
          <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((r) => (
              <ResourceCard key={r.id} r={toCard(r)} />
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
            <PageLink href={pageHref(page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="size-4" />
            </PageLink>
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <span key={n} className="flex items-center gap-1.5">
                  {i > 0 && n - arr[i - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
                  <PageLink href={pageHref(n)} active={n === page} label={`Page ${n}`}>
                    {n}
                  </PageLink>
                </span>
              ))}
            <PageLink href={pageHref(page + 1)} disabled={page >= pages} label="Next page">
              <ChevronRight className="size-4" />
            </PageLink>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function PageLink({ href, children, disabled, active, label }: { href: string; children: React.ReactNode; disabled?: boolean; active?: boolean; label: string }) {
  if (disabled) {
    return (
      <span aria-disabled className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg border border-border bg-white text-sm font-medium text-ink hover:border-lime-border",
        active && "border-lime-border bg-lime-soft",
      )}
    >
      {children}
    </Link>
  );
}
