"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Eye,
  EyeOff,
  FileText,
  Link2,
  MoreHorizontal,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkUpdateResources, deleteResources } from "@/lib/actions/admin/resources";
import { RESOURCE_TYPE_MAP, RESOURCE_TYPES, SEMESTERS } from "@/lib/constants";
import type { ResourceFeedRow, ResourceType } from "@/lib/database.types";
import { formatBytes, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { SubjectCombobox, type SubjectOption } from "./subject-combobox";
import { MuSpinner } from "@/components/brand/mu-loader";

export type LibraryRow = Pick<
  ResourceFeedRow,
  | "id"
  | "title"
  | "type"
  | "module"
  | "status"
  | "is_verified"
  | "is_featured"
  | "file_size"
  | "thumbnail_url"
  | "external_url"
  | "download_count"
  | "view_count"
  | "created_at"
  | "subject_name"
  | "semester"
  | "exam_session"
>;

export function LibraryFilters({ subjects }: { subjects: SubjectOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative min-w-[220px] flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q });
        }}
      >
        {pending ? (
          <MuSpinner className="absolute top-1/2 left-3 size-4 -translate-y-1/2  text-brand" />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q !== (params.get("q") ?? "") && set({ q })}
          placeholder="Search title, subject or file name… (Enter)"
          className="h-10 w-full rounded-lg border border-border bg-white pr-8 pl-9 text-sm outline-none focus:border-lime-border focus:ring-3 focus:ring-lime-soft"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); set({ q: null }); }} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-ink" aria-label="Clear">
            <X className="size-3.5" />
          </button>
        ) : null}
      </form>
      <FilterSelect value={params.get("status") ?? "all"} onChange={(v) => set({ status: v })} label="Status" options={[["all", "Any status"], ["published", "Published"], ["draft", "Drafts"], ["pending", "In review"]]} />
      <FilterSelect value={params.get("type") ?? "all"} onChange={(v) => set({ type: v })} label="Type" options={[["all", "Any type"], ...RESOURCE_TYPES.map((t) => [t.value, t.plural] as [string, string])]} />
      <FilterSelect value={params.get("sem") ?? "all"} onChange={(v) => set({ sem: v, subject: null })} label="Semester" options={[["all", "Any sem"], ...SEMESTERS.map((s) => [String(s), `S${s}`] as [string, string])]} />
      <div className="w-[230px]">
        <SubjectCombobox
          subjects={subjects}
          value={params.get("subject")}
          onChange={(id) => set({ subject: id })}
          context={{ semester: Number(params.get("sem")) || null }}
          placeholder="Any subject"
          className="h-10"
        />
      </div>
      {params.get("subject") ? (
        <Button variant="ghost" size="sm" className="h-10" onClick={() => set({ subject: null })}>
          Clear subject
        </Button>
      ) : null}
      <FilterSelect
        value={params.get("sort") ?? "created"}
        onChange={(v) => set({ sort: v === "created" ? null : v })}
        label="Sort"
        options={[["created", "Newest uploads"], ["popular", "Most downloaded"], ["views", "Most viewed"], ["title", "Title A–Z"], ["updated", "Recently edited"]]}
      />
    </div>
  );
}

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-10! w-[150px] rounded-lg bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LibraryTable({ rows, subjects }: { rows: LibraryRow[]; subjects: SubjectOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const all = rows.length > 0 && selected.length === rows.length;

  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(label);
        setSelected([]);
        router.refresh();
      } else toast.error(result.error ?? "Something went wrong");
    });

  const bulk = (patch: Parameters<typeof bulkUpdateResources>[1], label: string, ids = selected) =>
    run(label, () => bulkUpdateResources(ids, patch));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-lime-soft/60 px-4 py-2.5">
          <span className="mr-1 text-[13px] font-semibold text-ink">{selected.length} selected</span>
          <Button size="sm" variant="outline" className="h-8 bg-white" disabled={busy} onClick={() => bulk({ status: "published" }, "Published")}>
            <Eye /> Publish
          </Button>
          <Button size="sm" variant="outline" className="h-8 bg-white" disabled={busy} onClick={() => bulk({ status: "draft" }, "Moved to drafts")}>
            <EyeOff /> Unpublish
          </Button>
          <Button size="sm" variant="outline" className="h-8 bg-white" disabled={busy} onClick={() => bulk({ isVerified: true }, "Marked verified")}>
            <BadgeCheck /> Verify
          </Button>
          <Button size="sm" variant="outline" className="h-8 bg-white" disabled={busy} onClick={() => bulk({ isFeatured: true }, "Featured")}>
            <Star /> Feature
          </Button>
          <div className="w-[210px]">
            <SubjectCombobox subjects={subjects} value={null} onChange={(id) => bulk({ subjectId: id }, "Moved")} placeholder="Move to subject…" size="sm" />
          </div>
          <Select onValueChange={(v) => bulk({ type: v as ResourceType }, "Type updated")}>
            <SelectTrigger className="h-8! w-[130px] rounded-lg bg-white text-[13px]">
              <SelectValue placeholder="Set type…" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" disabled={busy} onClick={() => setConfirmDelete(selected)}>
            <Trash2 /> Delete
          </Button>
          {busy ? <MuSpinner className="size-4  text-brand" /> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13.5px]">
          <thead className="border-b border-border bg-surface text-[12px] font-semibold text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--brand)]"
                  checked={all}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="px-2 py-2.5">File</th>
              <th className="px-3 py-2.5">Subject</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Downloads</th>
              <th className="px-3 py-2.5">Added</th>
              <th className="w-12 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const isSelected = selected.includes(r.id);
              return (
                <tr key={r.id} className={cn("hover:bg-surface", isSelected && "bg-lime-soft/40")}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--brand)]"
                      checked={isSelected}
                      onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                      aria-label={`Select ${r.title}`}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <Link href={`/admin/library/${r.id}`} className="flex items-center gap-3">
                      <span className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface">
                        {r.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small generated thumbnail
                          <img src={r.thumbnail_url} alt="" className="size-full object-cover object-top" loading="lazy" />
                        ) : r.external_url ? (
                          <Link2 className="size-3.5 text-muted-foreground" />
                        ) : (
                          <FileText className="size-3.5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="max-w-[280px] truncate font-medium text-ink hover:text-brand">{r.title}</span>
                          {r.is_verified ? <BadgeCheck className="size-3.5 shrink-0 text-brand" aria-label="Verified" /> : null}
                          {r.is_featured ? <Star className="size-3.5 shrink-0 fill-lime-chip text-brand" aria-label="Featured" /> : null}
                        </span>
                        <span className="block text-[12px] text-muted-foreground">
                          {r.module ? `Module ${r.module}` : r.exam_session ?? "All modules"}
                          {r.file_size ? ` · ${formatBytes(r.file_size)}` : r.external_url ? " · Link" : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <span className="block truncate text-ink">{r.subject_name}</span>
                    <span className="text-[12px] text-muted-foreground">S{r.semester}</span>
                  </td>
                  <td className="px-3 py-2.5 text-foreground/80">{RESOURCE_TYPE_MAP[r.type].label}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.download_count}
                    <span className="block text-[11px] text-muted-foreground">{r.view_count} views</span>
                  </td>
                  <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap text-muted-foreground">{timeAgo(r.created_at)}</td>
                  <td className="px-3 py-2.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink" aria-label={`Actions for ${r.title}`}>
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/library/${r.id}`}>
                            <Pencil /> Edit
                          </Link>
                        </DropdownMenuItem>
                        {r.status === "published" ? (
                          <DropdownMenuItem asChild>
                            <Link href={`/notes/${r.id}`} target="_blank">
                              <Eye /> View on site
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onSelect={() => bulk({ status: r.status === "published" ? "draft" : "published" }, r.status === "published" ? "Unpublished" : "Published", [r.id])}>
                          {r.status === "published" ? <EyeOff /> : <Eye />} {r.status === "published" ? "Unpublish" : "Publish"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => bulk({ isFeatured: !r.is_featured }, r.is_featured ? "Unfeatured" : "Featured", [r.id])}>
                          <Star /> {r.is_featured ? "Unfeature" : "Feature"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete([r.id])}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.length === 1 ? "this file" : `${confirmDelete?.length} files`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll disappear from µPrep and the uploaded files are removed from storage. This can&apos;t be undone — unpublish instead if
              you might need them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const ids = confirmDelete ?? [];
                setConfirmDelete(null);
                run(`Deleted ${ids.length}`, () => deleteResources(ids));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
