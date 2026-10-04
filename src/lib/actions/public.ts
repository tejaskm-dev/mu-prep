"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { RESOURCE_TAGS, RESOURCE_TYPES } from "@/lib/constants";
import { getSiteSettings } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { currentIpHash } from "@/lib/ip";
import { publicClient } from "@/lib/supabase/public";
import { hasServiceRole, serviceClient } from "@/lib/supabase/service";
import { isOwnUploadUrl, uploadDataUrlImage } from "@/lib/uploaded-file";

const TYPE_VALUES = RESOURCE_TYPES.map((t) => t.value) as [string, ...string[]];
const TAG_VALUES = RESOURCE_TAGS.map((t) => t.value) as [string, ...string[]];

export async function trackView(resourceId: string) {
  if (!isSupabaseConfigured() || !z.uuid().safeParse(resourceId).success) return;
  const { error } = await publicClient().rpc("track_resource_event", { p_resource_id: resourceId, p_kind: "view" });
  if (error) console.error("[trackView]", error.message);
}

async function hitsSince(
  table: "note_requests" | "reports" | "submission_details",
  ipHash: string,
  minutes: number,
) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const column = table === "submission_details" ? "resource_id" : "id";
  const { count } = await serviceClient()
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return count ?? 0;
}

const requestSchema = z.object({
  subjectId: z.uuid(),
  type: z.enum(TYPE_VALUES).nullable().optional(),
  module: z.number().int().min(1).max(12).nullable().optional(),
  message: z.string().trim().max(500).optional(),
});

export async function requestNotes(input: z.input<typeof requestSchema>): Promise<ActionResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please pick a subject." };
  if (!hasServiceRole()) return { ok: false, error: "Requests aren't set up yet." };
  const settings = await getSiteSettings();
  if (!settings.requests_enabled) return { ok: false, error: "Requests are paused right now." };

  const ipHash = await currentIpHash();
  if ((await hitsSince("note_requests", ipHash, 60)) >= 10) {
    return { ok: false, error: "You've sent a lot of requests — try again in an hour." };
  }

  const { error } = await serviceClient()
    .from("note_requests")
    .insert({
      subject_id: parsed.data.subjectId,
      type: (parsed.data.type as never) ?? null,
      module: parsed.data.module ?? null,
      message: parsed.data.message || null,
      ip_hash: ipHash,
    });
  if (error) return { ok: false, error: "Couldn't send your request. Please try again." };
  return { ok: true, message: "Request sent — the µLearn team will see it." };
}

const reportSchema = z.object({
  resourceId: z.uuid(),
  reason: z.enum(["broken", "wrong_subject", "wrong_info", "low_quality", "duplicate", "copyright", "other"]),
  message: z.string().trim().max(1000).optional(),
});

export async function reportResource(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a reason for the report." };
  if (!hasServiceRole()) return { ok: false, error: "Reports aren't set up yet." };

  const ipHash = await currentIpHash();
  if ((await hitsSince("reports", ipHash, 60)) >= 8) {
    return { ok: false, error: "Too many reports from you recently — try again later." };
  }

  const { error } = await serviceClient().from("reports").insert({
    resource_id: parsed.data.resourceId,
    reason: parsed.data.reason,
    message: parsed.data.message || null,
    ip_hash: ipHash,
  });
  if (error) return { ok: false, error: "Couldn't send the report. Please try again." };
  return { ok: true, message: "Thanks! An admin will take a look." };
}

const contributionSchema = z.object({
  subjectId: z.uuid(),
  type: z.enum(TYPE_VALUES),
  module: z.number().int().min(1).max(12).nullable(),
  title: z.string().trim().min(3, "Add a short title").max(160),
  description: z.string().trim().max(1000).optional(),
  examSession: z.string().trim().max(40).optional(),
  examYear: z.number().int().min(1990).max(2100).nullable().optional(),
  tags: z.array(z.enum(TAG_VALUES)).max(8).default([]),
  name: z.string().trim().max(80).optional(),
  contact: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  consent: z.literal(true, { error: "Please confirm you're allowed to share this." }),
  files: z
    .array(
      z.object({
        key: z.string().min(4).max(300),
        url: z.url(),
        name: z.string().max(255),
        size: z.number().int().positive(),
        type: z.string().max(160),
        hash: z.string().max(128).optional(),
        pageCount: z.number().int().positive().max(10000).nullable().optional(),
        thumbnail: z.string().max(700_000).nullable().optional(),
      }),
    )
    .min(1, "Add at least one file")
    .max(5),
});

export async function submitContribution(
  input: z.input<typeof contributionSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  if (!hasServiceRole()) return { ok: false, error: "Submissions aren't set up yet." };
  const settings = await getSiteSettings();
  if (!settings.contributions_enabled) return { ok: false, error: "Submissions are paused right now." };

  const data = parsed.data;
  if (data.files.some((f) => !isOwnUploadUrl(f.url, f.key))) {
    return { ok: false, error: "One of the files didn't upload correctly. Please re-upload it." };
  }

  const ipHash = await currentIpHash();
  if ((await hitsSince("submission_details", ipHash, 60)) + data.files.length > 15) {
    return { ok: false, error: "Hourly submission limit reached — thanks for the enthusiasm! Try again later." };
  }

  const db = serviceClient();
  const { data: subject } = await db.from("subjects").select("id").eq("id", data.subjectId).maybeSingle();
  if (!subject) return { ok: false, error: "That subject doesn't exist anymore." };

  const rows = [];
  for (const [index, file] of data.files.entries()) {
    const thumb = file.thumbnail ? await uploadDataUrlImage(file.thumbnail, `thumb-${file.key}`).catch(() => null) : null;
    rows.push({
      subject_id: data.subjectId,
      title: data.files.length > 1 ? `${data.title} (${index + 1}/${data.files.length})` : data.title,
      description: data.description || null,
      type: data.type as never,
      module: data.module,
      tags: data.tags,
      exam_session: data.examSession || null,
      exam_year: data.examYear ?? null,
      status: "pending" as const,
      file_key: file.key,
      file_url: file.url,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      file_hash: file.hash ?? null,
      page_count: file.pageCount ?? null,
      thumbnail_key: thumb?.key ?? null,
      thumbnail_url: thumb?.url ?? null,
      contributor_name: data.name || null,
    });
  }

  const { data: inserted, error } = await db.from("resources").insert(rows).select("id");
  if (error || !inserted) return { ok: false, error: "Couldn't save your submission. Please try again." };

  await db.from("submission_details").insert(
    inserted.map((r) => ({
      resource_id: r.id,
      contributor_contact: data.contact || null,
      contributor_note: data.note || null,
      ip_hash: ipHash,
    })),
  );

  return { ok: true, data: { count: inserted.length }, message: "Submitted for review" };
}
