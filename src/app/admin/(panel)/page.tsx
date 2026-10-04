import Link from "next/link";
import { ArrowRight, CloudUpload, Inbox, SearchX, Sparkles } from "lucide-react";
import { DailyChart } from "@/components/admin/daily-chart";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth";
import { formatNumber, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const RANGES = [7, 30, 90] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const { supabase, user } = await requireAdminPage();
  const sp = await searchParams;
  const range = RANGES.find((r) => String(r) === sp.range) ?? 30;

  const [published, drafts, pending, daily, top, insights, recent, gaps, requests, reports] = await Promise.all([
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.rpc("admin_daily_stats", { p_days: range }),
    supabase.rpc("admin_top_resources", { p_days: range, p_limit: 6 }),
    supabase.rpc("admin_search_insights", { p_days: range, p_limit: 8 }),
    supabase.from("resource_feed").select("id,title,subject_name,status,created_at,type").order("created_at", { ascending: false }).limit(6),
    supabase.from("subject_overview").select("id,name,semester,slug").eq("is_active", true).eq("resource_count", 0).order("semester").order("sort_order").limit(8),
    supabase.from("note_requests").select("subject_id,subjects(name,slug)").eq("status", "open").limit(500),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const days = daily.data ?? [];
  const totals = days.reduce((t, d) => ({ downloads: t.downloads + d.downloads, views: t.views + d.views, uploads: t.uploads + d.uploads }), {
    downloads: 0,
    views: 0,
    uploads: 0,
  });

  const requestCounts = new Map<string, { name: string; count: number }>();
  for (const r of requests.data ?? []) {
    const subject = r.subjects as unknown as { name: string } | null;
    const entry = requestCounts.get(r.subject_id) ?? { name: subject?.name ?? "Unknown", count: 0 };
    entry.count++;
    requestCounts.set(r.subject_id, entry);
  }
  const topRequests = [...requestCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const inboxTotal = (pending.count ?? 0) + (reports.count ?? 0) + (requests.data?.length ?? 0);

  const stats = [
    { label: "Published files", value: published.count ?? 0, hint: `${drafts.count ?? 0} drafts` },
    { label: `Downloads · ${range}d`, value: totals.downloads, hint: `${formatNumber(totals.views)} views` },
    { label: `Uploaded · ${range}d`, value: totals.uploads, hint: "new files" },
    { label: "Needs attention", value: inboxTotal, hint: `${pending.count ?? 0} submissions`, href: "/admin/inbox", accent: inboxTotal > 0 },
  ];

  return (
    <>
      <PageHeader
        title={`Hi${user.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description="Here's how µPrep is doing."
        actions={
          <Button asChild className="h-10 rounded-lg px-4">
            <Link href="/admin/upload">
              <CloudUpload /> Upload files
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex items-center gap-2" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <Link key={r} href={`/admin?range=${r}`} data-active={range === r} className="chip h-8">
            Last {r} days
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-[12.5px] font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-[28px] leading-none font-bold tracking-[-0.02em] text-ink">{formatNumber(s.value)}</p>
              <p className="mt-2 text-[12px] text-muted-foreground">{s.hint}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={cn("rounded-2xl border border-border bg-white p-4 shadow-card hover:border-lime-border", s.accent && "border-lime-border bg-lime-soft/60")}>
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-4 shadow-card">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Downloads per day">
          {days.length ? (
            <DailyChart data={days.map((d) => ({ day: d.day, value: d.downloads }))} unit="downloads" />
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </Panel>
        <Panel title={`Top files · ${range} days`} action={<Link href="/admin/library?sort=popular" className="text-xs font-medium text-brand hover:underline">Library</Link>}>
          {(top.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Downloads will show up here.</p>
          ) : (
            <ol className="space-y-1">
              {(top.data ?? []).map((t, i) => (
                <li key={t.id}>
                  <Link href={`/admin/library/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-lime-soft/60">
                    <span className="w-4 text-[12px] font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{t.title}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{t.subject_name}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[13px] font-semibold text-ink tabular-nums">{t.downloads}</span>
                      <span className="block text-[11px] text-muted-foreground">downloads</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="What students search for" action={<SearchX className="size-4 text-muted-foreground" />}>
          {(insights.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Searches from the results page are logged here.</p>
          ) : (
            <ul className="space-y-1.5">
              {(insights.data ?? []).map((s) => (
                <li key={s.query} className="flex items-center gap-2 text-[13.5px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{s.query}</span>
                  {s.zero_results ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">no results</span>
                  ) : null}
                  <span className="w-8 text-right text-[12px] text-muted-foreground tabular-nums">{s.searches}×</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">Queries with no results are great upload ideas.</p>
        </Panel>

        <Panel title="Most requested" action={<Link href="/admin/inbox?tab=requests" className="text-xs font-medium text-brand hover:underline">Inbox</Link>}>
          {topRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open requests.</p>
          ) : (
            <ul className="space-y-2">
              {topRequests.map((r) => (
                <li key={r.name} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{r.name}</span>
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-lime-soft">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${(r.count / topRequests[0].count) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right text-[12px] font-semibold text-ink tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Content gaps" action={<Sparkles className="size-4 text-muted-foreground" />}>
          {(gaps.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Every active subject has at least one file.</p>
          ) : (
            <ul className="space-y-1">
              {(gaps.data ?? []).map((g) => (
                <li key={g.id}>
                  <Link href={`/admin/upload?subject=${g.id}`} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] hover:bg-lime-soft/60">
                    <span className="rounded bg-muted px-1.5 text-[11px] font-semibold text-ink/70">S{g.semester}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{g.name}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">Subjects with no files yet — click to upload.</p>
        </Panel>
      </div>

      <Panel title="Recently added" className="mt-5" action={<Link href="/admin/library?sort=created" className="text-xs font-medium text-brand hover:underline">View library</Link>}>
        {(recent.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Nothing uploaded yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(recent.data ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/admin/library/${r.id}`} className="flex items-center gap-3 py-2.5 hover:text-brand">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{r.title}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{r.subject_name}</span>
                  </span>
                  <StatusBadge status={r.status} />
                  <span className="hidden w-24 text-right text-[12px] text-muted-foreground sm:block">{timeAgo(r.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
