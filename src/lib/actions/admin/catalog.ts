"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { slugify } from "@/lib/format";
import { adminAction, check } from "./_shared";

const moduleSchema = z.object({ n: z.number().int().min(1).max(12), title: z.string().trim().max(160) });

const subjectSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  shortName: z.string().trim().max(60).optional().nullable(),
  code: z.string().trim().max(20).optional().nullable(),
  semester: z.number().int().min(1).max(8),
  description: z.string().trim().max(2000).optional().nullable(),
  icon: z.string().trim().min(1).max(40),
  credits: z.number().int().min(0).max(20).nullable().optional(),
  modules: z.array(moduleSchema).max(12),
  keywords: z.array(z.string().trim().min(1).max(40)).max(30),
  isActive: z.boolean(),
  departmentIds: z.array(z.uuid()).min(1, "Pick at least one department"),
  slug: z.string().trim().max(80).optional().nullable(),
});

export type SubjectInput = z.input<typeof subjectSchema>;

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  base: string,
  excludeId?: string,
) {
  const root = slugify(base) || "subject";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    let q = supabase.from("subjects").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now()}`;
}

function subjectRow(s: z.infer<typeof subjectSchema>) {
  return {
    name: s.name,
    short_name: s.shortName || null,
    code: s.code ? s.code.toUpperCase().replace(/\s+/g, "") : null,
    semester: s.semester,
    description: s.description || null,
    icon: s.icon,
    credits: s.credits ?? null,
    modules: s.modules.filter((m) => m.title || m.n).sort((a, b) => a.n - b.n),
    keywords: [...new Set(s.keywords.map((k) => k.toLowerCase()))],
    is_active: s.isActive,
  };
}

export async function saveSubject(id: string | null, input: SubjectInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const s = parsed.data;
  return adminAction(async ({ supabase }) => {
    const slug = await uniqueSlug(supabase, s.slug || `${s.name}${s.code ? `-${s.code}` : ""}`, id ?? undefined);
    let subjectId = id;
    if (id) {
      check(await supabase.from("subjects").update({ ...subjectRow(s), slug }).eq("id", id), "Updating subject");
    } else {
      const created = check(await supabase.from("subjects").insert({ ...subjectRow(s), slug }).select("id").single(), "Creating subject");
      subjectId = created?.id ?? null;
    }
    if (!subjectId) throw new Error("Subject wasn't saved");
    check(await supabase.from("subject_departments").delete().eq("subject_id", subjectId), "Updating departments");
    check(
      await supabase.from("subject_departments").insert(s.departmentIds.map((department_id) => ({ subject_id: subjectId!, department_id }))),
      "Linking departments",
    );
    return { id: subjectId, slug };
  });
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Invalid id" };
  const result = await adminAction(async ({ supabase }) => {
    const { count } = await supabase.from("resources").select("id", { count: "exact", head: true }).eq("subject_id", id);
    if ((count ?? 0) > 0) throw new Error(`Move or delete its ${count} files first (Library → filter by subject).`);
    check(await supabase.from("subjects").delete().eq("id", id), "Deleting subject");
    return undefined;
  });
  return result.ok ? { ok: true, message: "Subject deleted" } : result;
}

export async function setSubjectActive(ids: string[], isActive: boolean): Promise<ActionResult> {
  const valid = ids.filter((id) => z.uuid().safeParse(id).success);
  const result = await adminAction(async ({ supabase }) => {
    check(await supabase.from("subjects").update({ is_active: isActive }).in("id", valid), "Updating subjects");
    return undefined;
  });
  return result.ok ? { ok: true } : result;
}

const importRow = z.object({
  code: z.string().trim().max(20).optional().nullable(),
  name: z.string().trim().min(2).max(160),
  semester: z.number().int().min(1).max(8),
  departmentIds: z.array(z.uuid()).min(1),
  credits: z.number().int().min(0).max(20).nullable().optional(),
  icon: z.string().max(40).optional(),
});

/** Creates many subjects at once from the bulk-add dialog. Existing codes are skipped. */
export async function importSubjects(rows: z.input<typeof importRow>[]): Promise<ActionResult<{ created: number; skipped: number }>> {
  const parsed = z.array(importRow).max(200).safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the rows" };
  return adminAction(async ({ supabase }) => {
    const existing = check(await supabase.from("subjects").select("code,name,semester"), "Loading subjects") ?? [];
    const codes = new Set(existing.map((e) => e.code?.toUpperCase()).filter(Boolean));
    const names = new Set(existing.map((e) => `${e.semester}:${e.name.toLowerCase()}`));
    let created = 0;
    let skipped = 0;
    for (const r of parsed.data) {
      const code = r.code ? r.code.toUpperCase().replace(/\s+/g, "") : null;
      if ((code && codes.has(code)) || names.has(`${r.semester}:${r.name.toLowerCase()}`)) {
        skipped++;
        continue;
      }
      const slug = await uniqueSlug(supabase, `${r.name}${code ? `-${code}` : ""}`);
      const subject = check(
        await supabase
          .from("subjects")
          .insert({ name: r.name, code, semester: r.semester, credits: r.credits ?? null, icon: r.icon || "book-open", slug, sort_order: created })
          .select("id")
          .single(),
        `Creating ${r.name}`,
      );
      if (!subject) continue;
      check(
        await supabase.from("subject_departments").insert(r.departmentIds.map((department_id) => ({ subject_id: subject.id, department_id }))),
        "Linking departments",
      );
      if (code) codes.add(code);
      names.add(`${r.semester}:${r.name.toLowerCase()}`);
      created++;
    }
    return { created, skipped };
  });
}

const departmentSchema = z.object({
  code: z.string().trim().min(1).max(16),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(40).optional().nullable(),
  icon: z.string().trim().min(1).max(40),
  isActive: z.boolean(),
});

export async function saveDepartment(id: string | null, input: z.input<typeof departmentSchema>): Promise<ActionResult> {
  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  const slug = slugify(d.slug || d.code) || "dept";
  const result = await adminAction(async ({ supabase }) => {
    if (id) {
      check(await supabase.from("departments").update({ code: d.code, name: d.name, slug, icon: d.icon, is_active: d.isActive }).eq("id", id), "Updating department");
    } else {
      const { data: last } = await supabase.from("departments").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      check(
        await supabase.from("departments").insert({ code: d.code, name: d.name, slug, icon: d.icon, is_active: d.isActive, sort_order: (last?.sort_order ?? 0) + 1 }),
        "Creating department",
      );
    }
    return undefined;
  });
  return result.ok ? { ok: true, message: "Department saved" } : result;
}

export async function moveDepartment(id: string, direction: -1 | 1): Promise<ActionResult> {
  const result = await adminAction(async ({ supabase }) => {
    const all = check(await supabase.from("departments").select("id,sort_order").order("sort_order").order("code"), "Loading") ?? [];
    const index = all.findIndex((d) => d.id === id);
    const swap = all[index + direction];
    if (index < 0 || !swap) return undefined;
    const ordered = [...all];
    [ordered[index], ordered[index + direction]] = [ordered[index + direction], ordered[index]];
    for (const [i, d] of ordered.entries()) {
      if (d.sort_order !== i + 1) check(await supabase.from("departments").update({ sort_order: i + 1 }).eq("id", d.id), "Reordering");
    }
    return undefined;
  });
  return result.ok ? { ok: true } : result;
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const result = await adminAction(async ({ supabase }) => {
    check(await supabase.from("departments").delete().eq("id", id), "Deleting department");
    return undefined;
  });
  return result.ok ? { ok: true, message: "Department deleted" } : result;
}
