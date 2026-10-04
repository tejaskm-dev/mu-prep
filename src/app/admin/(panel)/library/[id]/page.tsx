import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Flag, UserRound } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ReportActions } from "@/components/admin/inbox-actions";
import { ResourceEditor } from "@/components/admin/resource-editor";
import { StatusBadge } from "@/components/admin/status-badge";
import { getSubjectOptions } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/format";

export const metadata = { title: "Edit file" };

export default async function EditResourcePage({ params }: PageProps<"/admin/library/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdminPage();
  const [{ data: resource }, subjects, { data: reports }, { data: submission }] = await Promise.all([
    supabase.from("resource_feed").select("*").eq("id", id).maybeSingle(),
    getSubjectOptions(supabase),
    supabase.from("reports").select("*").eq("resource_id", id).order("created_at", { ascending: false }),
    supabase.from("submission_details").select("*").eq("resource_id", id).maybeSingle(),
  ]);
  if (!resource) notFound();

  return (
    <>
      <Link href="/admin/library" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-4" /> Library
      </Link>
      <PageHeader
        title={resource.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={resource.status} />
            {resource.subject_name} · S{resource.semester} · added {formatDate(resource.created_at)} · edited {timeAgo(resource.updated_at)}
          </span>
        }
      />
      {resource.contributor_name || submission ? (
        <Panel className="mb-5" title={<span className="inline-flex items-center gap-2"><UserRound className="size-4 text-brand" /> Community submission</span>}>
          <dl className="grid gap-3 text-[13.5px] sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Credited as</dt>
              <dd className="font-medium text-ink">{resource.contributor_name ?? "Anonymous"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact (private)</dt>
              <dd className="font-medium text-ink">{submission?.contributor_contact ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Note</dt>
              <dd className="text-ink">{submission?.contributor_note ?? "—"}</dd>
            </div>
          </dl>
        </Panel>
      ) : null}
      {(reports ?? []).length ? (
        <Panel className="mb-5" title={<span className="inline-flex items-center gap-2"><Flag className="size-4 text-destructive" /> Reports</span>}>
          <ul className="divide-y divide-border">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13.5px]">
                <span className="font-medium text-ink">{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</span>
                {r.message ? <span className="text-muted-foreground">“{r.message}”</span> : null}
                <span className="text-[12px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                <span className="ml-auto">
                  <ReportActions id={r.id} status={r.status} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <ResourceEditor resource={resource} subjects={subjects} />
    </>
  );
}
