import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Flame } from "lucide-react";
import { PageLoader } from "@/components/brand/mu-loader";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { EmptyState } from "@/components/site/empty-state";
import { TopicsPortal, TopicsProgress } from "@/components/site/topics-portal";
import { PriorityIcon } from "@/components/topic-bits";
import { getSubjectBySlug, getSubjectSlugs, getSubjectTopics } from "@/lib/data";
import { parseModules } from "@/lib/subject-utils";
import { PRIORITIES, appearances, topicYears } from "@/lib/topics";

export async function generateStaticParams() {
  const slugs = await getSubjectSlugs();
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "_" }];
}

export async function generateMetadata({ params }: PageProps<"/subjects/[slug]/important">): Promise<Metadata> {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) return { title: "Subject not found" };
  return {
    title: `Important topics — ${subject.name} (S${subject.semester})`,
    description: `Module-wise important topics for ${subject.name}${subject.code ? ` (${subject.code})` : ""}: what to study first, the questions asked in past exams, and where to read each topic.`,
  };
}

export default function ImportantTopicsPage({ params }: PageProps<"/subjects/[slug]/important">) {
  return (
    <Suspense fallback={<PageLoader />}>
      <ImportantContent params={params} />
    </Suspense>
  );
}

async function ImportantContent({ params }: { params: PageProps<"/subjects/[slug]/important">["params"] }) {
  const { slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) notFound();

  const topics = await getSubjectTopics(subject.id);
  const modules = parseModules(subject.modules);
  const critical = topics.filter((t) => t.priority === "critical").length;
  const questions = topics.reduce((n, t) => n + t.questions.length, 0);
  const asked = topics.reduce((n, t) => n + (t.questions.length ? appearances(t) : 0), 0);
  const years = [...new Set(topics.flatMap(topicYears))].sort((a, b) => a - b);

  const stats = [
    { label: "Topics", value: topics.length },
    { label: "Must know", value: critical, hot: true },
    { label: "Exam questions", value: questions, hint: asked > questions ? `${asked} times asked` : undefined },
    { label: "Years covered", value: years.length ? (years.length > 1 ? `${years[0]}–${String(years.at(-1)).slice(2)}` : years[0]) : "—" },
  ];

  return (
    <div className="container-page pt-3">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/important", label: "Important topics" },
          { href: `/subjects/${subject.slug}`, label: subject.short_name ?? subject.name },
          { label: "Important" },
        ]}
      />

      <section className="relative overflow-hidden rounded-2xl bg-[#0d110e] px-6 py-8 sm:px-9 sm:py-10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(228,87,46,0.22),transparent_45%),radial-gradient(circle_at_70%_90%,rgba(120,160,90,0.28),transparent_55%)]" />
        <div aria-hidden className="bg-grid absolute inset-y-0 right-0 w-1/2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-hot/15 px-2.5 py-1 text-[12px] font-semibold text-[#ffb59c] ring-1 ring-hot/30">
              <Flame className="size-3.5" strokeWidth={2.4} /> Important topics
            </span>
            <div className="mt-4 flex items-center gap-4">
              <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-lime ring-1 ring-white/10 sm:flex">
                <DynamicIcon name={subject.icon} className="size-7" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <h1 className="text-[28px] leading-[1.08] font-extrabold tracking-[-0.03em] text-white sm:text-[38px]">{subject.name}</h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-white/60">
                  <span className="rounded-md bg-lime px-1.5 py-0.5 text-[12px] font-bold text-ink">S{subject.semester}</span>
                  {subject.code ? <span className="font-mono text-white/75">{subject.code}</span> : null}
                  <span>Know what to study first — module by module.</span>
                </p>
              </div>
            </div>
            <dl className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="min-w-[120px] rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3">
                  <dt className="flex items-center gap-1 text-[11.5px] font-medium text-white/55">
                    {s.hot ? <PriorityIcon priority="critical" className="size-3 text-[#ff9c7a]" strokeWidth={2.4} /> : null}
                    {s.label}
                  </dt>
                  <dd className="mt-0.5 text-[22px] leading-tight font-extrabold text-white tabular-nums">{s.value}</dd>
                  {s.hint ? <dd className="text-[11px] text-white/45">{s.hint}</dd> : null}
                </div>
              ))}
            </dl>
          </div>
          <div className="flex shrink-0 flex-col gap-3 lg:w-[290px]">
            {topics.length ? <TopicsProgress ids={topics.map((t) => t.id)} /> : null}
            <Link
              href={`/subjects/${subject.slug}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[13.5px] font-semibold text-ink hover:bg-lime-soft"
            >
              <ArrowLeft className="size-4" /> All notes & papers
            </Link>
          </div>
        </div>
      </section>

      {topics.length ? (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="What the priorities mean">
            {PRIORITIES.map((p) => (
              <li key={p.value} className="flex items-center gap-3 rounded-xl border border-border bg-white px-3.5 py-2.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${p.badge}`}>
                  <PriorityIcon priority={p.value} className="size-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{p.label}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{p.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <TopicsPortal topics={topics} modules={modules} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Flame />}
          title="No important topics yet"
          className="mt-8 py-16"
          action={
            <Link href={`/subjects/${subject.slug}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white">
              Browse notes & papers <ArrowRight className="size-4" />
            </Link>
          }
        >
          The team hasn&apos;t marked the important topics for {subject.name} yet. Check back closer to exams.
        </EmptyState>
      )}
    </div>
  );
}
