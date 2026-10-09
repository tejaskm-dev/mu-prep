import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Flame } from "lucide-react";
import { PageLoader } from "@/components/brand/mu-loader";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { DocumentPreview } from "@/components/site/document-preview";
import { ReportDialog } from "@/components/site/report-dialog";
import { CardBadge, TagPills, VerifiedBadge, badgeLabel } from "@/components/site/resource-bits";
import { ResourceMini } from "@/components/site/resource-card";
import { SaveButton } from "@/components/site/save-button";
import { ShareButton } from "@/components/site/share-button";
import { TrackView } from "@/components/site/track-view";
import { plainText } from "@/components/rich-text";
import { PriorityPill } from "@/components/topic-bits";
import { RESOURCE_TYPE_MAP } from "@/lib/constants";
import { TimeAgo } from "@/components/time-ago";
import { getRecentResourceIds, getRelatedResources, getResource, getResourceTopics, getSubjectBySlug } from "@/lib/data";
import { fileKind, formatBytes, formatDate, formatNumber } from "@/lib/format";
import { toCard } from "@/lib/serialize";
import { parseModules } from "@/lib/subject-utils";

// The latest files are prerendered; older ones render on first visit and are then cached.
export async function generateStaticParams() {
  const ids = await getRecentResourceIds(100);
  return ids.length ? ids.map((id) => ({ id })) : [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export async function generateMetadata({ params }: PageProps<"/notes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const r = await getResource(id);
  if (!r) return { title: "Not found" };
  return {
    title: `${r.title} — ${r.subject_name}`,
    description: `${RESOURCE_TYPE_MAP[r.type].label} for ${r.subject_name} (S${r.semester})${r.module ? `, module ${r.module}` : ""}. Free on µPrep.`,
    openGraph: r.thumbnail_url ? { images: [r.thumbnail_url] } : undefined,
  };
}

export default function ResourcePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <Suspense fallback={<PageLoader />}>
      <ResourceContent params={params} />
    </Suspense>
  );
}

async function ResourceContent({ params }: { params: PageProps<"/notes/[id]">["params"] }) {
  const { id } = await params;
  const r = await getResource(id);
  if (!r) notFound();

  const [related, subject, topics] = await Promise.all([getRelatedResources(r), getSubjectBySlug(r.subject_slug), getResourceTopics(r.id)]);
  const moduleTitle = r.module ? parseModules(subject?.modules ?? null).find((m) => m.n === r.module)?.title : null;
  const isLink = !r.file_url && !!r.external_url;
  const kind = fileKind(r.mime_type, r.file_name, isLink);

  const details: [string, React.ReactNode][] = [
    ["Type", RESOURCE_TYPE_MAP[r.type].label],
    ["Module", r.module ? `Module ${r.module}${moduleTitle ? ` · ${moduleTitle}` : ""}` : "All modules"],
    ...(r.exam_session || r.exam_year ? ([["Exam", r.exam_session ?? r.exam_year]] as [string, React.ReactNode][]) : []),
    ["Format", isLink ? "External link" : kind],
    ...(r.file_size ? ([["Size", formatBytes(r.file_size)]] as [string, React.ReactNode][]) : []),
    ...(r.page_count ? ([["Pages", r.page_count]] as [string, React.ReactNode][]) : []),
    ...(r.author ? ([["Prepared by", r.author]] as [string, React.ReactNode][]) : []),
    ...(r.contributor_name ? ([["Shared by", r.contributor_name]] as [string, React.ReactNode][]) : []),
    ["Added", r.published_at ? formatDate(r.published_at) : "—"],
    ["Downloads", formatNumber(r.download_count)],
  ];

  return (
    <div className="container-page pt-3">
      <TrackView id={r.id} />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: `/notes?sem=${r.semester}`, label: `Semester ${r.semester}` },
          { href: `/subjects/${r.subject_slug}`, label: r.subject_short_name ?? r.subject_name },
          { label: r.title },
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <header className="mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <CardBadge>{badgeLabel(r)}</CardBadge>
              <span className="text-[12px] font-medium text-muted-foreground">{RESOURCE_TYPE_MAP[r.type].label}</span>
              {r.is_verified ? <VerifiedBadge /> : null}
              <TagPills tags={r.tags} max={6} />
            </div>
            <h1 className="mt-3 text-[26px] leading-[1.12] font-extrabold tracking-[-0.03em] text-ink sm:text-[34px]">{r.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-muted-foreground">
              <Link href={`/subjects/${r.subject_slug}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-brand">
                <DynamicIcon name={r.subject_icon} className="size-4 text-brand" />
                {r.subject_name}
              </Link>
              <span>·</span>
              <span>S{r.semester}</span>
              {r.published_at ? (
                <>
                  <span>·</span>
                  <TimeAgo date={r.published_at} prefix="Added " />
                </>
              ) : null}
            </p>
          </header>

          <DocumentPreview url={r.file_url} externalUrl={r.external_url} mime={r.mime_type} name={r.file_name} title={r.title} thumbnail={r.thumbnail_url} />

          {r.description ? (
            <section className="mt-6 rounded-xl border border-border bg-white p-5">
              <h2 className="text-[15px] font-semibold text-ink">About this file</h2>
              <p className="mt-2 text-[14.5px] leading-relaxed whitespace-pre-line text-foreground/80">{r.description}</p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <a
              href={`/api/download/${r.id}`}
              target="_blank"
              rel="noopener"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-semibold text-white transition-colors hover:bg-ink/85"
            >
              {isLink ? <ExternalLink className="size-[18px] text-lime" /> : <Download className="size-[18px] text-lime" />}
              {isLink ? "Open link" : `Download ${kind === "LINK" ? "" : kind}`}
              {r.file_size ? <span className="font-normal text-white/60">· {formatBytes(r.file_size)}</span> : null}
            </a>
            <div className="mt-3 flex gap-2">
              <SaveButton id={r.id} withLabel className="flex-1" />
              <div className="flex-1 [&>button]:w-full [&>button]:justify-center">
                <ShareButton title={r.title} path={`/notes/${r.id}`} />
              </div>
            </div>
            <dl className="mt-5 divide-y divide-border text-[13.5px]">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 border-t border-border pt-3">
              <ReportDialog resourceId={r.id} />
            </div>
          </section>

          {topics.length > 0 ? (
            <section aria-label="Important topics in this file" className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
              <h2 className="flex items-center gap-2 border-b border-border bg-hot-soft/60 px-4 py-3 text-[14px] font-semibold text-ink">
                <Flame className="size-4 text-hot" strokeWidth={2.4} /> Important topics in this file
              </h2>
              <ul className="divide-y divide-border">
                {topics.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/subjects/${r.subject_slug}/important#topic-${t.id}`}
                        className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-ink hover:text-brand"
                      >
                        {plainText(t.title)}
                      </Link>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <PriorityPill priority={t.priority} compact className="h-5 px-1.5 text-[10.5px]" />
                        <span className="text-[11.5px] text-muted-foreground">Module {t.module}</span>
                      </div>
                    </div>
                    {t.page && kind === "PDF" ? (
                      <a
                        href={`#page=${t.page}`}
                        className="shrink-0 rounded-md bg-sticky px-2 py-1 text-[11.5px] font-bold text-ink tabular-nums hover:bg-lime-chip"
                        title={`Jump to page ${t.page}`}
                      >
                        p.{t.page}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Link
                href={`/subjects/${r.subject_slug}/important`}
                className="block border-t border-border px-4 py-2.5 text-[12.5px] font-medium text-brand hover:bg-lime-soft/50"
              >
                All important topics for {r.subject_short_name ?? r.subject_name} →
              </Link>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section aria-label="Related files">
              <h2 className="mb-2.5 flex items-center justify-between text-[14px] font-semibold text-ink">
                More from {r.subject_short_name ?? r.subject_name}
                <Link href={`/subjects/${r.subject_slug}`} className="text-xs font-medium text-brand hover:underline">
                  View all
                </Link>
              </h2>
              <div className="flex flex-col gap-2">
                {related.map((x) => (
                  <ResourceMini key={x.id} r={toCard(x)} />
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
