import Link from "next/link";
import { ChevronLeft, ChevronRight, CloudUpload, FileSearch } from "lucide-react";
import { LibraryFilters, LibraryTable } from "@/components/admin/library-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { getSubjectOptions } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { RESOURCE_TYPES } from "@/lib/constants";
import type { ResourceStatus, ResourceType } from "@/lib/database.types";

export const metadata = { title: "Library" };

const PAGE_SIZE = 40;

export default async function LibraryPage({ searchParams }: PageProps<"/admin/library">) {
  const { supabase } = await requireAdminPage();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const page = Math.max(1, Number(get("page")) || 1);

  let query = supabase
    .from("resource_feed")
    .select(
      "id,title,type,module,status,is_verified,is_featured,file_size,thumbnail_url,external_url,download_count,view_count,created_at,subject_name,semester,exam_session",
      { count: "exact" },
    );
  const q = get("q").trim().replace(/[%,()]/g, " ");
  if (q) query = query.or(`title.ilike.%${q}%,subject_name.ilike.%${q}%,file_name.ilike.%${q}%,subject_code.ilike.%${q}%`);
  if (["published", "draft", "pending", "rejected"].includes(get("status"))) query = query.eq("status", get("status") as ResourceStatus);
  if (RESOURCE_TYPES.some((t) => t.value === get("type"))) query = query.eq("type", get("type") as ResourceType);
  if (Number(get("sem"))) query = query.eq("semester", Number(get("sem")));
  if (/^[0-9a-f-]{36}$/.test(get("subject"))) query = query.eq("subject_id", get("subject"));
  switch (get("sort")) {
    case "popular":
      query = query.order("download_count", { ascending: false });
      break;
    case "views":
      query = query.order("view_count", { ascending: false });
      break;
    case "title":
      query = query.order("title");
      break;
    case "updated":
      query = query.order("updated_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const [{ data, count, error }, subjects] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    getSubjectOptions(supabase),
  ]);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (n: number) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    p.set("page", String(n));
    return `/admin/library?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Library"
        description={`${total} ${total === 1 ? "file" : "files"}${error ? " · couldn't load: " + error.message : ""}`}
        actions={
          <Button asChild className="h-10 rounded-lg px-4">
            <Link href="/admin/upload">
              <CloudUpload /> Upload
            </Link>
          </Button>
        }
      />
      <LibraryFilters subjects={subjects} />
      <div className="mt-4">
        {(data ?? []).length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-white py-16 text-center">
            <FileSearch className="size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold text-ink">No files match</p>
            <p className="mt-1 text-sm text-muted-foreground">Try clearing filters, or upload something new.</p>
          </div>
        ) : (
          <LibraryTable rows={data ?? []} subjects={subjects} />
        )}
      </div>
      {pages > 1 ? (
        <div className="mt-5 flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="bg-white" disabled={page <= 1}>
              <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
                <ChevronLeft /> Prev
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-white" disabled={page >= pages}>
              <Link href={pageHref(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
                Next <ChevronRight />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
