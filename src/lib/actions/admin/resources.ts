"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { RESOURCE_TAGS, RESOURCE_TYPES } from "@/lib/constants";
import type { Database, ResourceStatus, ResourceType } from "@/lib/database.types";
import { deleteUploadedFiles } from "@/lib/utapi";
import { adminAction, check } from "./_shared";

type ResourceInsert = Database["public"]["Tables"]["resources"]["Insert"];
type ResourceUpdate = Database["public"]["Tables"]["resources"]["Update"];

const TYPE_VALUES = RESOURCE_TYPES.map((t) => t.value) as [ResourceType, ...ResourceType[]];
const TAG_VALUES = RESOURCE_TAGS.map((t) => t.value) as [string, ...string[]];
const httpUrl = z.url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) link");

const metaSchema = z.object({
  subjectId: z.uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  type: z.enum(TYPE_VALUES),
  module: z.number().int().min(1).max(12).nullable(),
  tags: z.array(z.enum(TAG_VALUES)).max(12),
  examYear: z.number().int().min(1990).max(2100).nullable().optional(),
  examSession: z.string().trim().max(60).optional().nullable(),
  author: z.string().trim().max(120).optional().nullable(),
  isVerified: z.boolean(),
  isFeatured: z.boolean().optional(),
  status: z.enum(["published", "draft"]),
});

const fileSchema = z.object({
  key: z.string().min(4).max(300),
  url: httpUrl,
  name: z.string().max(255),
  size: z.number().int().nonnegative(),
  mime: z.string().max(160),
  hash: z.string().max(128).optional().nullable(),
  pageCount: z.number().int().positive().max(20000).optional().nullable(),
  thumbnailKey: z.string().max(300).optional().nullable(),
  thumbnailUrl: httpUrl.optional().nullable(),
});

const createSchema = z.array(
  metaSchema.extend({
    file: fileSchema.optional().nullable(),
    externalUrl: httpUrl.optional().nullable(),
  }),
);

export type NewResourceInput = z.input<typeof createSchema>[number];

function toRow(m: z.infer<typeof metaSchema>): ResourceUpdate {
  return {
    subject_id: m.subjectId,
    title: m.title,
    description: m.description || null,
    type: m.type,
    module: m.module,
    tags: m.tags,
    exam_year: m.examYear ?? null,
    exam_session: m.examSession || null,
    author: m.author || null,
    is_verified: m.isVerified,
    ...(m.isFeatured !== undefined ? { is_featured: m.isFeatured } : {}),
    status: m.status,
  };
}

/** Creates resources for files that were already uploaded (or for external links). */
export async function createResources(input: NewResourceInput[]): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Row ${Number(issue?.path[0] ?? 0) + 1}: ${issue?.message ?? "invalid data"}` };
  }
  if (parsed.data.some((r) => !r.file && !r.externalUrl)) return { ok: false, error: "Every item needs a file or a link." };

  return adminAction(async ({ supabase, user }) => {
    const rows: ResourceInsert[] = parsed.data.map((r) => ({
      ...(toRow(r) as ResourceInsert),
      subject_id: r.subjectId,
      title: r.title,
      created_by: user.id,
      file_key: r.file?.key ?? null,
      file_url: r.file?.url ?? null,
      file_name: r.file?.name ?? null,
      file_size: r.file?.size ?? null,
      mime_type: r.file?.mime ?? null,
      file_hash: r.file?.hash ?? null,
      page_count: r.file?.pageCount ?? null,
      thumbnail_key: r.file?.thumbnailKey ?? null,
      thumbnail_url: r.file?.thumbnailUrl ?? null,
      external_url: r.file ? null : (r.externalUrl ?? null),
    }));
    const data = check(await supabase.from("resources").insert(rows).select("id"), "Saving resources");
    return { ids: (data ?? []).map((d) => d.id) };
  });
}

/** Files already in the library with the same content hash. */
export async function findDuplicates(hashes: string[]): Promise<ActionResult<Record<string, { id: string; title: string; subject: string; status: ResourceStatus }>>> {
  const clean = [...new Set(hashes.filter((h) => /^[0-9a-f]{32,128}$/.test(h)))].slice(0, 200);
  return adminAction(async ({ supabase }) => {
    if (!clean.length) return {};
    const data = check(
      await supabase.from("resource_feed").select("id,title,subject_name,status,file_hash").in("file_hash", clean),
      "Checking duplicates",
    );
    return Object.fromEntries((data ?? []).map((r) => [r.file_hash!, { id: r.id, title: r.title, subject: r.subject_name, status: r.status }]));
  }, { revalidate: false });
}

const updateSchema = metaSchema.partial().extend({
  externalUrl: httpUrl.optional().nullable(),
  file: fileSchema.optional(),
  thumbnail: z.object({ key: z.string().max(300).nullable(), url: httpUrl.nullable() }).optional(),
  status: z.enum(["published", "draft", "pending", "rejected"]).optional(),
});

export async function updateResource(id: string, input: z.input<typeof updateSchema>): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid id" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const p = parsed.data;

  const result = await adminAction(async ({ supabase }) => {
    const current = check(await supabase.from("resources").select("file_key,thumbnail_key").eq("id", id).maybeSingle(), "Loading resource");
    if (!current) throw new Error("This resource no longer exists.");
    const patch: ResourceUpdate = {};
    if (p.subjectId) patch.subject_id = p.subjectId;
    if (p.title !== undefined) patch.title = p.title;
    if (p.description !== undefined) patch.description = p.description || null;
    if (p.type) patch.type = p.type;
    if (p.module !== undefined) patch.module = p.module;
    if (p.tags) patch.tags = p.tags;
    if (p.examYear !== undefined) patch.exam_year = p.examYear;
    if (p.examSession !== undefined) patch.exam_session = p.examSession || null;
    if (p.author !== undefined) patch.author = p.author || null;
    if (p.isVerified !== undefined) patch.is_verified = p.isVerified;
    if (p.isFeatured !== undefined) patch.is_featured = p.isFeatured;
    if (p.status) patch.status = p.status;
    if (p.externalUrl !== undefined) patch.external_url = p.externalUrl;
    const staleKeys: (string | null)[] = [];
    if (p.file) {
      Object.assign(patch, {
        file_key: p.file.key,
        file_url: p.file.url,
        file_name: p.file.name,
        file_size: p.file.size,
        mime_type: p.file.mime,
        file_hash: p.file.hash ?? null,
        page_count: p.file.pageCount ?? null,
        external_url: null,
      });
      if (current.file_key !== p.file.key) staleKeys.push(current.file_key);
    }
    if (p.thumbnail) {
      patch.thumbnail_key = p.thumbnail.key;
      patch.thumbnail_url = p.thumbnail.url;
      if (current.thumbnail_key !== p.thumbnail.key) staleKeys.push(current.thumbnail_key);
    } else if (p.file?.thumbnailKey !== undefined) {
      patch.thumbnail_key = p.file.thumbnailKey ?? null;
      patch.thumbnail_url = p.file.thumbnailUrl ?? null;
      if (current.thumbnail_key !== patch.thumbnail_key) staleKeys.push(current.thumbnail_key);
    }
    check(await supabase.from("resources").update(patch).eq("id", id), "Updating resource");
    await deleteUploadedFiles(staleKeys);
    return undefined;
  });
  return result.ok ? { ok: true, message: "Saved" } : result;
}

const bulkSchema = z.object({
  subjectId: z.uuid().optional(),
  type: z.enum(TYPE_VALUES).optional(),
  module: z.number().int().min(1).max(12).nullable().optional(),
  status: z.enum(["published", "draft"]).optional(),
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  addTag: z.enum(TAG_VALUES).optional(),
});

export async function bulkUpdateResources(ids: string[], input: z.input<typeof bulkSchema>): Promise<ActionResult<{ count: number }>> {
  const parsed = bulkSchema.safeParse(input);
  const validIds = ids.filter((id) => z.uuid().safeParse(id).success);
  if (!parsed.success || !validIds.length) return { ok: false, error: "Nothing to update" };
  const p = parsed.data;
  return adminAction(async ({ supabase }) => {
    const patch: ResourceUpdate = {};
    if (p.subjectId) patch.subject_id = p.subjectId;
    if (p.type) patch.type = p.type;
    if (p.module !== undefined) patch.module = p.module;
    if (p.status) patch.status = p.status;
    if (p.isVerified !== undefined) patch.is_verified = p.isVerified;
    if (p.isFeatured !== undefined) patch.is_featured = p.isFeatured;
    if (Object.keys(patch).length) check(await supabase.from("resources").update(patch).in("id", validIds), "Updating");
    if (p.addTag) {
      const rows = check(await supabase.from("resources").select("id,tags").in("id", validIds), "Loading tags");
      for (const r of rows ?? []) {
        if (r.tags.includes(p.addTag)) continue;
        check(await supabase.from("resources").update({ tags: [...r.tags, p.addTag] }).eq("id", r.id), "Tagging");
      }
    }
    return { count: validIds.length };
  });
}

/** Deletes resources and their files on UploadThing. */
export async function deleteResources(ids: string[]): Promise<ActionResult<{ count: number }>> {
  const validIds = ids.filter((id) => z.uuid().safeParse(id).success);
  if (!validIds.length) return { ok: false, error: "Nothing selected" };
  return adminAction(async ({ supabase }) => {
    const rows = check(await supabase.from("resources").select("id,file_key,thumbnail_key").in("id", validIds), "Loading");
    check(await supabase.from("resources").delete().in("id", validIds), "Deleting");
    // Only delete files no other resource still points to.
    const keys = (rows ?? []).flatMap((r) => [r.file_key, r.thumbnail_key]).filter((k): k is string => Boolean(k));
    if (keys.length) {
      const stillUsed = check(await supabase.from("resources").select("file_key,thumbnail_key").or(`file_key.in.(${keys.map((k) => `"${k}"`).join(",")}),thumbnail_key.in.(${keys.map((k) => `"${k}"`).join(",")})`), "Checking files");
      const used = new Set((stillUsed ?? []).flatMap((r) => [r.file_key, r.thumbnail_key]));
      await deleteUploadedFiles(keys.filter((k) => !used.has(k)));
    }
    return { count: validIds.length };
  });
}

/** Approve community submissions (optionally fixing metadata first). */
export async function approveSubmissions(ids: string[], options: { verified?: boolean } = {}): Promise<ActionResult<{ count: number }>> {
  const validIds = ids.filter((id) => z.uuid().safeParse(id).success);
  if (!validIds.length) return { ok: false, error: "Nothing selected" };
  return adminAction(async ({ supabase }) => {
    check(
      await supabase
        .from("resources")
        .update({ status: "published", ...(options.verified ? { is_verified: true } : {}) })
        .in("id", validIds)
        .eq("status", "pending"),
      "Approving",
    );
    return { count: validIds.length };
  });
}

export async function rejectSubmissions(ids: string[]): Promise<ActionResult<{ count: number }>> {
  return deleteResources(ids);
}

export async function setReportStatus(ids: string[], status: "open" | "resolved" | "dismissed"): Promise<ActionResult> {
  const validIds = ids.filter((id) => z.uuid().safeParse(id).success);
  const r = await adminAction(async ({ supabase }) => {
    check(await supabase.from("reports").update({ status }).in("id", validIds), "Updating reports");
    return undefined;
  });
  return r.ok ? { ok: true } : r;
}

export async function setRequestStatus(ids: string[], status: "open" | "fulfilled" | "dismissed"): Promise<ActionResult> {
  const validIds = ids.filter((id) => z.uuid().safeParse(id).success);
  const r = await adminAction(async ({ supabase }) => {
    check(await supabase.from("note_requests").update({ status }).in("id", validIds), "Updating requests");
    return undefined;
  });
  return r.ok ? { ok: true } : r;
}
