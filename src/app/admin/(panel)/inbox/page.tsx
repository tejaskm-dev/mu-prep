import Link from "next/link";
import { CloudUpload, ExternalLink, FileText, Flag, Inbox as InboxIcon, MessageSquarePlus, Pencil } from "lucide-react";
import { RequestActions, ReportActions, SubmissionActions } from "@/components/admin/inbox-actions";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth";
import { REPORT_REASONS, RESOURCE_TYPE_MAP } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { formatBytes, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Inbox" };

const TABS = [
  { key: "submissions", label: "Submissions", icon: InboxIcon },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "requests", label: "Requests", icon: MessageSquarePlus },
] as const;

export default async function InboxPage({ searchParams }: PageProps<"/admin/inbox">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "submissions";

  const [submissions, details, reports, requests] = await Promise.all([
    supabase.from("resource_feed").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    supabase.from("submission_details").select("*").limit(500),
    supabase.from("reports").select("*, resources(id,title,status)").eq("status", "open").order("created_at", { ascending: false }).limit(200),
    supabase.from("note_requests").select("*, subjects(id,name,semester)").eq("status", "open").order("created_at", { ascending: false }).limit(1000),
  ]);

  const detailById = new Map((details.data ?? []).map((d) => [d.resource_id, d]));
  type Group = { key: string; subjectId: string; subject: string; semester: number; type: ResourceType | null; module: number | null; ids: string[]; messages: string[]; latest: string };
  const groups = new Map<string, Group>();
  for (const r of requests.data ?? []) {
    const subject = r.subjects as unknown as { id: string; name: string; semester: number } | null;
    const key = `${r.subject_id}:${r.type ?? "any"}:${r.module ?? "any"}`;
    const g = groups.get(key) ?? { key, subjectId: r.subject_id, subject: subject?.name ?? "Unknown subject", semester: subject?.semester ?? 0, type: r.type, module: r.module, ids: [], messages: [], latest: r.created_at };
    g.ids.push(r.id);
    if (r.message) g.messages.push(r.message);
    groups.set(key, g);
  }
  const requestGroups = [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
  const counts = { submissions: submissions.data?.length ?? 0, reports: reports.data?.length ?? 0, requests: requests.data?.length ?? 0 };

  return (
    <>
      <PageHeader title="Inbox" description="Review student submissions, fix reported files and see what people are asking for." />
      <div className="mb-5 flex gap-2" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/inbox?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-4 text-[13.5px] font-medium text-foreground/75 hover:text-ink",
              tab === t.key && "border-ink bg-ink text-white hover:text-white",
            )}
          >
            <t.icon className="size-4" /> {t.label}
            {counts[t.key] ? <span className={cn("rounded-full px-1.5 text-[11px] font-bold", tab === t.key ? "bg-lime text-ink" : "bg-lime-chip text-ink")}>{counts[t.key]}</span> : null}
          </Link>
        ))}
      </div>

      {tab === "submissions" ? (
        (submissions.data ?? []).length === 0 ? (
          <Empty text="No submissions waiting. Shared notes from students land here for review." />
        ) : (
          <ul className="space-y-3">
            {(submissions.data ?? []).map((r) => {
              const d = detailById.get(r.id);
              return (
                <li key={r.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-4 shadow-card sm:flex-row">
                  <a href={r.file_url ?? r.external_url ?? "#"} target="_blank" rel="noopener noreferrer" className="flex h-[112px] w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
                    {r.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- submission preview
                      <img src={r.thumbnail_url} alt="" className="size-full object-cover object-top" />
                    ) : (
                      <FileText className="size-6 text-muted-foreground" />
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">{r.title}</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {r.subject_name} · S{r.semester} · {RESOURCE_TYPE_MAP[r.type].label}
                      {r.module ? ` · Module ${r.module}` : ""}
                      {r.exam_session ? ` · ${r.exam_session}` : ""} · {formatBytes(r.file_size)}
                      {r.page_count ? ` · ${r.page_count} pages` : ""}
                    </p>
                    <p className="mt-2 text-[13px] text-ink">
                      From <strong>{r.contributor_name ?? "Anonymous"}</strong>
                      {d?.contributor_contact ? <span className="text-muted-foreground"> · {d.contributor_contact}</span> : null}
                      <span className="text-muted-foreground"> · {timeAgo(r.created_at)}</span>
                    </p>
                    {d?.contributor_note ? <p className="mt-1.5 rounded-lg bg-surface px-3 py-2 text-[13px] text-foreground/80">“{d.contributor_note}”</p> : null}
                    {r.description ? <p className="mt-1.5 text-[13px] text-muted-foreground">{r.description}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <SubmissionActions id={r.id} />
                      <Link href={`/admin/library/${r.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink hover:bg-muted">
                        <Pencil className="size-3.5" /> Fix details first
                      </Link>
                      <a href={r.file_url ?? r.external_url ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink hover:bg-muted">
                        <ExternalLink className="size-3.5" /> Open file
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {tab === "reports" ? (
        (reports.data ?? []).length === 0 ? (
          <Empty text="No open reports. When students flag a broken or wrong file, it shows up here." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <ul className="divide-y divide-border">
              {(reports.data ?? []).map((r) => {
                const res = r.resources as unknown as { id: string; title: string } | null;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Flag className="size-4 shrink-0 text-destructive" />
                    <div className="min-w-0 flex-1">
                      <Link href={`/admin/library/${r.resource_id}`} className="block truncate text-[14px] font-medium text-ink hover:text-brand">
                        {res?.title ?? "Deleted file"}
                      </Link>
                      <p className="text-[12.5px] text-muted-foreground">
                        {REPORT_REASONS.find((x) => x.value === r.reason)?.label}
                        {r.message ? ` — “${r.message}”` : ""} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <ReportActions id={r.id} status={r.status} />
                  </li>
                );
              })}
            </ul>
          </div>
        )
      ) : null}

      {tab === "requests" ? (
        requestGroups.length === 0 ? (
          <Empty text="No open requests. Students can request notes from any subject page." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <ul className="divide-y divide-border">
              {requestGroups.map((g) => (
                <li key={g.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-soft text-[13px] font-bold text-brand tabular-nums">{g.ids.length}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {g.subject} <span className="text-[12px] font-normal text-muted-foreground">S{g.semester}</span>
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {g.type ? RESOURCE_TYPE_MAP[g.type].plural : "Anything"}
                      {g.module ? ` · Module ${g.module}` : ""} · latest {timeAgo(g.latest)}
                      {g.messages.length ? ` · “${g.messages.slice(0, 2).join("”, “")}”` : ""}
                    </p>
                  </div>
                  <Link href={`/admin/upload?subject=${g.subjectId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink/85">
                    <CloudUpload className="size-3.5 text-lime" /> Upload
                  </Link>
                  <RequestActions ids={g.ids} />
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
      <InboxIcon className="size-8 text-muted-foreground" />
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
