"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ExternalLink, ImageUp, RefreshCw, Save, Star, Trash2, Upload } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteResources, updateResource } from "@/lib/actions/admin/resources";
import { ACCEPTED_FILE_TYPES, RESOURCE_TAGS, RESOURCE_TYPES } from "@/lib/constants";
import type { ResourceFeedRow, ResourceType } from "@/lib/database.types";
import { fileKind, formatBytes } from "@/lib/format";
import { analyzePdf, imageThumbnail, sha256 } from "@/lib/pdf";
import { uploadFiles } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { SubjectCombobox, type SubjectOption } from "./subject-combobox";
import { MuSpinner } from "@/components/brand/mu-loader";

async function uploadThumbBlob(blob: Blob, name: string) {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const [res] = await uploadFiles("thumbnail", { files: [new File([blob], `${name}.${ext}`, { type: blob.type })] });
  return { key: res.key, url: res.ufsUrl };
}

export function ResourceEditor({ resource, subjects }: { resource: ResourceFeedRow; subjects: SubjectOption[] }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [working, setWorking] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: resource.title,
    subjectId: resource.subject_id,
    type: resource.type,
    module: resource.module,
    tags: resource.tags,
    examSession: resource.exam_session ?? "",
    examYear: resource.exam_year,
    author: resource.author ?? "",
    description: resource.description ?? "",
    isVerified: resource.is_verified,
    isFeatured: resource.is_featured,
    status: resource.status,
    externalUrl: resource.external_url ?? "",
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isLink = !resource.file_url && !!resource.external_url;
  const kind = fileKind(resource.mime_type, resource.file_name, isLink);

  const save = () =>
    startSaving(async () => {
      const result = await updateResource(resource.id, {
        title: form.title,
        subjectId: form.subjectId,
        type: form.type,
        module: form.type === "pyq" ? null : form.module,
        tags: form.tags as never,
        examSession: form.type === "pyq" ? form.examSession : null,
        examYear: form.type === "pyq" ? form.examYear : null,
        author: form.author,
        description: form.description,
        isVerified: form.isVerified,
        isFeatured: form.isFeatured,
        status: form.status,
        ...(isLink ? { externalUrl: form.externalUrl || null } : {}),
      });
      if (result.ok) {
        toast.success("Saved");
        router.refresh();
      } else toast.error(result.error);
    });

  async function replaceFile(file: File) {
    setWorking("Uploading new file…");
    try {
      const [hash, info] = await Promise.all([
        sha256(file).catch(() => null),
        file.type === "application/pdf" ? analyzePdf(file).catch(() => null) : Promise.resolve(null),
      ]);
      const [uploaded] = await uploadFiles("resourceFile", { files: [file] });
      const thumbBlob = info?.thumbnail ?? (file.type.startsWith("image/") ? await imageThumbnail(file) : null);
      const thumb = thumbBlob ? await uploadThumbBlob(thumbBlob, `thumb-${resource.id}`).catch(() => null) : null;
      const result = await updateResource(resource.id, {
        file: {
          key: uploaded.key,
          url: uploaded.ufsUrl,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          hash,
          pageCount: info?.pageCount ?? null,
          thumbnailKey: thumb?.key ?? null,
          thumbnailUrl: thumb?.url ?? null,
        },
      });
      if (!result.ok) throw new Error(result.error);
      toast.success("File replaced — the old one was removed from storage");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't replace the file");
    } finally {
      setWorking(null);
    }
  }

  async function regenerateThumbnail() {
    if (!resource.file_url) return;
    setWorking("Rendering first page…");
    try {
      const response = await fetch(resource.file_url);
      if (!response.ok) throw new Error("Couldn't download the file");
      const blob = await response.blob();
      const thumbBlob = kind === "PDF" ? (await analyzePdf(await blob.arrayBuffer())).thumbnail : await imageThumbnail(blob);
      if (!thumbBlob) throw new Error("Couldn't render a preview");
      const thumb = await uploadThumbBlob(thumbBlob, `thumb-${resource.id}`);
      const result = await updateResource(resource.id, { thumbnail: thumb });
      if (!result.ok) throw new Error(result.error);
      toast.success("Thumbnail updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? `${error.message}. You can upload an image instead.` : "Couldn't regenerate");
    } finally {
      setWorking(null);
    }
  }

  async function customThumbnail(file: File) {
    setWorking("Uploading thumbnail…");
    try {
      const small = (await imageThumbnail(file)) ?? file;
      const thumb = await uploadThumbBlob(small, `thumb-${resource.id}`);
      const result = await updateResource(resource.id, { thumbnail: thumb });
      if (!result.ok) throw new Error(result.error);
      toast.success("Thumbnail updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-5 rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
        <Field label="Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="h-10 rounded-lg text-[15px] font-medium" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px_150px]">
          <Field label="Subject">
            <SubjectCombobox subjects={subjects} value={form.subjectId} onChange={(id) => set("subjectId", id)} className="h-10" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => set("type", v as ResourceType)}>
              <SelectTrigger className="h-10! w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.type === "pyq" ? (
            <Field label="Exam session">
              <Input
                value={form.examSession}
                onChange={(e) => setForm((f) => ({ ...f, examSession: e.target.value, examYear: Number(e.target.value.match(/20\d{2}/)?.[0]) || null }))}
                placeholder="December 2023"
                className="h-10 rounded-lg"
              />
            </Field>
          ) : (
            <Field label="Module">
              <Select value={form.module ? String(form.module) : "full"} onValueChange={(v) => set("module", v === "full" ? null : Number(v))}>
                <SelectTrigger className="h-10! w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">All modules</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Module {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {RESOURCE_TAGS.map((t) => {
              const on = form.tags.includes(t.value);
              return (
                <button key={t.value} type="button" data-active={on} onClick={() => set("tags", on ? form.tags.filter((x) => x !== t.value) : [...form.tags, t.value])} className="chip h-8">
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prepared by">
            <Input value={form.author} onChange={(e) => set("author", e.target.value)} placeholder="e.g. Prof. Meera N" className="h-10 rounded-lg" />
          </Field>
          <Field label="Visibility">
            <Select value={form.status} onValueChange={(v) => set("status", v as typeof form.status)}>
              <SelectTrigger className="h-10! w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft (hidden)</SelectItem>
                <SelectItem value="pending">In review (hidden)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        {isLink ? (
          <Field label="Link">
            <Input value={form.externalUrl} onChange={(e) => set("externalUrl", e.target.value)} className="h-10 rounded-lg" />
          </Field>
        ) : null}
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="min-h-28 rounded-lg" placeholder="Topics covered, source, anything students should know" />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-active={form.isVerified} onClick={() => set("isVerified", !form.isVerified)} className="chip h-9 px-4">
            <BadgeCheck className="size-4" /> Verified
          </button>
          <button type="button" data-active={form.isFeatured} onClick={() => set("isFeatured", !form.isFeatured)} className="chip h-9 px-4">
            <Star className="size-4" /> Featured (pinned first)
          </button>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10">
                <Trash2 /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{resource.title}”?</AlertDialogTitle>
                <AlertDialogDescription>The file is removed from storage too. This can&apos;t be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={async () => {
                    const result = await deleteResources([resource.id]);
                    if (result.ok) {
                      toast.success("Deleted");
                      router.push("/admin/library");
                    } else toast.error(result.error);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={save} disabled={saving || !form.title.trim()} className="h-10 rounded-lg px-5">
            {saving ? <MuSpinner /> : <Save />} Save changes
          </Button>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-card">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface">
            {resource.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- generated preview
              <img src={resource.thumbnail_url} alt="" className="size-full object-cover object-top" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No preview yet</div>
            )}
            {working ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-sm font-medium text-ink">
                <MuSpinner className="size-5  text-brand" /> {working}
              </div>
            ) : null}
          </div>
          <dl className="mt-4 space-y-1.5 text-[13px]">
            {[
              ["File", isLink ? "External link" : (resource.file_name ?? "—")],
              ["Format", kind],
              ["Size", formatBytes(resource.file_size)],
              ["Pages", resource.page_count ?? "—"],
              ["Downloads", resource.download_count],
              ["Views", resource.view_count],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="max-w-[190px] truncate text-right font-medium text-ink" title={String(v)}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid gap-2">
            <Button asChild variant="outline" className="justify-start bg-white">
              <a href={resource.file_url ?? resource.external_url ?? "#"} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Open {isLink ? "link" : "file"}
              </a>
            </Button>
            {resource.status === "published" ? (
              <Button asChild variant="outline" className="justify-start bg-white">
                <Link href={`/notes/${resource.id}`} target="_blank">
                  <ExternalLink /> View on site
                </Link>
              </Button>
            ) : null}
            {!isLink ? (
              <>
                <Button variant="outline" className="justify-start bg-white" disabled={!!working} onClick={() => fileInput.current?.click()}>
                  <Upload /> Replace file
                </Button>
                {kind === "PDF" || kind === "IMG" ? (
                  <Button variant="outline" className="justify-start bg-white" disabled={!!working} onClick={regenerateThumbnail}>
                    <RefreshCw /> Regenerate thumbnail
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button variant="outline" className={cn("justify-start bg-white")} disabled={!!working} onClick={() => thumbInput.current?.click()}>
              <ImageUp /> Upload custom thumbnail
            </Button>
          </div>
          <input ref={fileInput} type="file" accept={ACCEPTED_FILE_TYPES} className="sr-only" onChange={(e) => e.target.files?.[0] && void replaceFile(e.target.files[0])} />
          <input ref={thumbInput} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void customThumbnail(e.target.files[0])} />
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-[13px]">{label}</Label>
      {children}
    </div>
  );
}
