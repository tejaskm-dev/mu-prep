"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import type { TopicPriority } from "@/lib/database.types";
import { adminAction, check } from "./_shared";

const PRIORITY_VALUES = ["critical", "high", "medium"] as const satisfies readonly TopicPriority[];

const questionSchema = z.object({
  text: z.string().trim().min(1, "A question is empty").max(2000),
  marks: z.number().int().min(1).max(100).nullable(),
  years: z.array(z.string().trim().min(1).max(40)).max(30),
});

const topicSchema = z.object({
  subjectId: z.uuid(),
  module: z.number().int().min(1).max(12),
  title: z.string().trim().min(1, "Give the topic a title").max(200),
  notes: z.string().trim().max(8000).optional().nullable(),
  priority: z.enum(PRIORITY_VALUES),
  questions: z.array(questionSchema).max(60),
  resources: z
    .array(z.object({ id: z.uuid(), page: z.number().int().min(1).max(20000).nullable() }))
    .max(30),
  isPublished: z.boolean(),
});

export type TopicInput = z.input<typeof topicSchema>;

/** Creates or updates a topic and replaces its linked files. */
export async function saveTopic(id: string | null, input: TopicInput): Promise<ActionResult<{ id: string }>> {
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the topic" };
  if (id && !z.uuid().safeParse(id).success) return { ok: false, error: "Invalid id" };
  const t = parsed.data;
  return adminAction(async ({ supabase, user }) => {
    const row = {
      subject_id: t.subjectId,
      module: t.module,
      title: t.title,
      notes: t.notes || null,
      priority: t.priority,
      questions: t.questions.map((q) => ({ text: q.text, marks: q.marks, years: [...new Set(q.years)] })),
      is_published: t.isPublished,
    };
    let topicId = id;
    if (id) {
      check(await supabase.from("important_topics").update(row).eq("id", id), "Updating topic");
    } else {
      // New topics go to the end of their module.
      const { data: last } = await supabase
        .from("important_topics")
        .select("sort_order")
        .eq("subject_id", t.subjectId)
        .eq("module", t.module)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const created = check(
        await supabase
          .from("important_topics")
          .insert({ ...row, sort_order: (last?.sort_order ?? -1) + 1, created_by: user.id })
          .select("id")
          .single(),
        "Creating topic",
      );
      topicId = created?.id ?? null;
    }
    if (!topicId) throw new Error("Topic wasn't saved");

    check(await supabase.from("important_topic_resources").delete().eq("topic_id", topicId), "Updating linked files");
    const unique = [...new Map(t.resources.map((r) => [r.id, r])).values()];
    if (unique.length) {
      check(
        await supabase
          .from("important_topic_resources")
          .insert(unique.map((r, i) => ({ topic_id: topicId!, resource_id: r.id, page: r.page, sort_order: i }))),
        "Linking files",
      );
    }
    return { id: topicId };
  });
}

export async function deleteTopic(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid id" };
  const result = await adminAction(async ({ supabase }) => {
    check(await supabase.from("important_topics").delete().eq("id", id), "Deleting topic");
    return undefined;
  });
  return result.ok ? { ok: true, message: "Topic deleted" } : result;
}

export async function setTopicPublished(id: string, isPublished: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid id" };
  const result = await adminAction(async ({ supabase }) => {
    check(await supabase.from("important_topics").update({ is_published: isPublished }).eq("id", id), "Updating topic");
    return undefined;
  });
  return result.ok ? { ok: true } : result;
}

export async function setTopicPriority(id: string, priority: TopicPriority): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success || !PRIORITY_VALUES.includes(priority)) return { ok: false, error: "Invalid input" };
  const result = await adminAction(async ({ supabase }) => {
    check(await supabase.from("important_topics").update({ priority }).eq("id", id), "Updating topic");
    return undefined;
  });
  return result.ok ? { ok: true } : result;
}

/** Saves the order of a module's topics (ids in display order). */
export async function reorderTopics(ids: string[]): Promise<ActionResult> {
  const valid = z.array(z.uuid()).max(200).safeParse(ids);
  if (!valid.success) return { ok: false, error: "Invalid order" };
  const result = await adminAction(async ({ supabase }) => {
    for (const [i, id] of valid.data.entries()) {
      check(await supabase.from("important_topics").update({ sort_order: i }).eq("id", id), "Reordering");
    }
    return undefined;
  });
  return result.ok ? { ok: true } : result;
}

const bulkSchema = z.object({
  subjectId: z.uuid(),
  module: z.number().int().min(1).max(12),
  topics: z
    .array(z.object({ title: z.string().trim().min(1).max(200), priority: z.enum(PRIORITY_VALUES) }))
    .min(1, "Nothing to add")
    .max(100),
});

/** Adds many topics to a module at once (from the "Paste a list" dialog). */
export async function createTopics(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ created: number }>> {
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the list" };
  const b = parsed.data;
  return adminAction(async ({ supabase, user }) => {
    const { data: last } = await supabase
      .from("important_topics")
      .select("sort_order")
      .eq("subject_id", b.subjectId)
      .eq("module", b.module)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const start = (last?.sort_order ?? -1) + 1;
    const rows = b.topics.map((t, i) => ({
      subject_id: b.subjectId,
      module: b.module,
      title: t.title,
      priority: t.priority,
      sort_order: start + i,
      created_by: user.id,
    }));
    check(await supabase.from("important_topics").insert(rows), "Adding topics");
    return { created: rows.length };
  });
}
