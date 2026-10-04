import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Download, FileText, FileUp, ScrollText } from "lucide-react";
import { PageLoader } from "@/components/brand/mu-loader";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { EmptyState } from "@/components/site/empty-state";
import { RequestDialog } from "@/components/site/request-dialog";
import { SubjectCard } from "@/components/site/subject-card";
import { SubjectExplorer } from "@/components/site/subject-explorer";
import { Button } from "@/components/ui/button";
import { getDepartments, getSiteSettings, getSubjectBySlug, getSubjectResources, getSubjectSlugs, getSubjects } from "@/lib/data";
import { DEFAULT_EXPLORER_STATE } from "@/lib/explorer-state";
import { formatNumber } from "@/lib/format";
import { toCard, toSubjectCard } from "@/lib/serialize";
import { departmentLabel, parseModules } from "@/lib/subject-utils";

// Every subject page is prerendered and revalidated by tag when admins change content.
export async function generateStaticParams() {
  const slugs = await getSubjectSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/subjects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) return { title: "Subject not found" };
  return {
    title: `${subject.name} notes & papers (S${subject.semester})`,
    description: `Notes, handwritten notes, previous year papers and lab records for ${subject.name}${subject.code ? ` (${subject.code})` : ""}.`,
  };
}

export default function SubjectPage({ params }: PageProps<"/subjects/[slug]">) {
  return (
    <Suspense fallback={<PageLoader />}>
      <SubjectContent params={params} />
    </Suspense>
  );
}

async function SubjectContent({ params }: { params: PageProps<"/subjects/[slug]">["params"] }) {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) notFound();

  const [resources, departments, siblings, settings] = await Promise.all([
    getSubjectResources(subject.id),
    getDepartments(),
    getSubjects(null, subject.semester),
    getSiteSettings(),
  ]);

  const modules = parseModules(subject.modules);
  const deptText = departmentLabel(subject.department_slugs, departments);
  const related = siblings
    .filter((s) => s.id !== subject.id && s.department_slugs.some((d) => subject.department_slugs.includes(d)))
    .slice(0, 4);
  const papers = resources.filter((r) => r.type === "pyq").length;
  const firstDept = departments.find((d) => subject.department_slugs.includes(d.slug));

  const aside = (
    <>
      {settings.requests_enabled ? (
        <section className="rounded-xl border border-border bg-lime-soft/60 p-4">
          <h2 className="text-[14px] font-semibold text-ink">Can&apos;t find something?</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Request it — the team sees which modules students need most.</p>
          <div className="mt-3">
            <RequestDialog subjectId={subject.id} subjectName={subject.name} modules={modules} />
          </div>
        </section>
      ) : null}
      {related.length > 0 ? (
        <section aria-label="Other subjects this semester">
          <h2 className="mb-2.5 text-[14px] font-semibold text-ink">More in S{subject.semester}</h2>
          <div className="flex flex-col gap-2.5">
            {related.map((s) => (
              <SubjectCard key={s.id} s={toSubjectCard(s)} className="min-h-[64px] py-2.5 [&>span:first-child]:size-9" />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );

  return (
    <div className="container-page pt-3">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          {
            href: `/notes?sem=${subject.semester}${firstDept && subject.department_slugs.length === 1 ? `&dept=${firstDept.slug}` : ""}`,
            label: `Semester ${subject.semester}`,
          },
          { label: subject.short_name ?? subject.name },
        ]}
      />

      <section className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div aria-hidden className="bg-grid absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div aria-hidden className="absolute -top-16 -right-10 size-56 rounded-full bg-lime-chip/30 blur-3xl" />
        <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 gap-5">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-lime-soft text-brand ring-1 ring-lime-border/50">
              <DynamicIcon name={subject.icon} className="size-8" strokeWidth={1.6} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="rounded-md bg-ink px-2 py-0.5 font-semibold text-lime">S{subject.semester}</span>
                {subject.code ? (
                  <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono font-medium text-ink">{subject.code}</span>
                ) : null}
                {deptText ? <span className="text-muted-foreground">{deptText}</span> : null}
                {subject.credits ? <span className="text-muted-foreground">· {subject.credits} credits</span> : null}
              </div>
              <h1 className="mt-2 text-[28px] leading-[1.08] font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">{subject.name}</h1>
              {subject.description ? <p className="mt-2 max-w-2xl text-[14.5px] text-foreground/75">{subject.description}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <dl className="grid grid-cols-3 gap-2">
              {[
                { icon: FileText, label: "Files", value: resources.length },
                { icon: ScrollText, label: "Papers", value: papers },
                { icon: Download, label: "Downloads", value: subject.download_count },
              ].map((s) => (
                <div key={s.label} className="min-w-[88px] rounded-xl border border-border bg-surface px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <s.icon className="size-3.5" /> {s.label}
                  </dt>
                  <dd className="mt-0.5 text-lg font-bold text-ink tabular-nums">{formatNumber(s.value)}</dd>
                </div>
              ))}
            </dl>
            <Button asChild className="h-10 rounded-lg px-4">
              <Link href={`/contribute?subject=${subject.id}`}>
                <FileUp /> Share notes for this subject
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-8">
        {resources.length === 0 ? (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <EmptyState
              icon={<FileText />}
              title="No files here yet"
              className="py-16"
              action={
                <div className="flex flex-wrap justify-center gap-2.5">
                  {settings.requests_enabled ? (
                    <RequestDialog subjectId={subject.id} subjectName={subject.name} modules={modules} />
                  ) : null}
                  <Button asChild className="h-10 rounded-lg px-4">
                    <Link href={`/contribute?subject=${subject.id}`}>
                      Share yours <ArrowRight />
                    </Link>
                  </Button>
                </div>
              }
            >
              Be the first to share notes for {subject.name}, or ask the team to add them.
            </EmptyState>
            <aside className="flex flex-col gap-5">{related.length ? aside : null}</aside>
          </div>
        ) : (
          <SubjectExplorer resources={resources.map(toCard)} modules={modules} initial={DEFAULT_EXPLORER_STATE} aside={aside} />
        )}
      </div>
    </div>
  );
}
