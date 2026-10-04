"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import { hasServiceRole, serviceClient } from "@/lib/supabase/service";
import { deleteUploadedFiles, isUploadthingConfigured, utapi } from "@/lib/utapi";
import { adminAction, check } from "./_shared";

const settingsSchema = z.object({
  collegeName: z.string().trim().min(2).max(60),
  heroNote: z.string().trim().min(2).max(60),
  announcement: z.string().trim().max(200).optional().nullable(),
  announcementLink: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || v.startsWith("/") || /^https?:\/\//.test(v), "Link must start with / or http")
    .optional()
    .nullable(),
  announcementEnabled: z.boolean(),
  contributionsEnabled: z.boolean(),
  requestsEnabled: z.boolean(),
  heroImage: z.object({ key: z.string().nullable(), url: z.url().nullable() }).optional(),
});

export async function updateSiteSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  const s = parsed.data;
  const result = await adminAction(async ({ supabase }) => {
    const current = check(await supabase.from("site_settings").select("hero_image_key").eq("id", true).maybeSingle(), "Loading settings");
    check(
      await supabase
        .from("site_settings")
        .update({
          college_name: s.collegeName,
          hero_note: s.heroNote,
          announcement: s.announcement || null,
          announcement_link: s.announcementLink || null,
          announcement_enabled: s.announcementEnabled,
          contributions_enabled: s.contributionsEnabled,
          requests_enabled: s.requestsEnabled,
          ...(s.heroImage ? { hero_image_key: s.heroImage.key, hero_image_url: s.heroImage.url } : {}),
        })
        .eq("id", true),
      "Saving settings",
    );
    if (s.heroImage && current?.hero_image_key && current.hero_image_key !== s.heroImage.key) {
      await deleteUploadedFiles([current.hero_image_key]);
    }
    return undefined;
  });
  return result.ok ? { ok: true, message: "Settings saved" } : result;
}

const newAdminSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Temporary password needs 8+ characters").max(72).optional().or(z.literal("")),
  role: z.enum(["owner", "editor"]),
});

/** Adds a teammate. Creates their login if needed (only owners can do this). */
export async function addAdmin(input: z.input<typeof newAdminSchema>): Promise<ActionResult> {
  const parsed = newAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  if (!hasServiceRole()) return { ok: false, error: "Set SUPABASE_SERVICE_ROLE_KEY to manage the team." };
  const result = await adminAction(async ({ admin }) => {
    if (admin.role !== "owner") throw new Error("Only owners can add admins.");
    const db = serviceClient();
    const email = parsed.data.email.toLowerCase();
    let userId: string | null = null;

    // Find an existing auth user with this email.
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (data.users.length < 200) break;
    }
    if (!userId) {
      if (!parsed.data.password) throw new Error("No account with that email yet — set a temporary password to create one.");
      const { data, error } = await db.auth.admin.createUser({ email, password: parsed.data.password, email_confirm: true });
      if (error || !data.user) throw new Error(error?.message ?? "Couldn't create the user");
      userId = data.user.id;
    }
    check(await db.from("admins").upsert({ user_id: userId, email, role: parsed.data.role }), "Adding admin");
    return undefined;
  });
  return result.ok ? { ok: true, message: "Teammate added" } : result;
}

export async function removeAdmin(userId: string): Promise<ActionResult> {
  if (!hasServiceRole()) return { ok: false, error: "Set SUPABASE_SERVICE_ROLE_KEY to manage the team." };
  const result = await adminAction(async ({ admin, user }) => {
    if (admin.role !== "owner") throw new Error("Only owners can remove admins.");
    if (userId === user.id) throw new Error("You can't remove yourself.");
    const db = serviceClient();
    const owners = check(await db.from("admins").select("user_id").eq("role", "owner"), "Loading team") ?? [];
    if (owners.length === 1 && owners[0].user_id === userId) throw new Error("Keep at least one owner.");
    check(await db.from("admins").delete().eq("user_id", userId), "Removing admin");
    return undefined;
  });
  return result.ok ? { ok: true, message: "Removed from team" } : result;
}

export type StorageFile = { key: string; name: string; size: number; uploadedAt: number; status: string };

/** Every file in the UploadThing app plus which ones the database still references. */
export async function scanStorage(): Promise<ActionResult<{ files: StorageFile[]; used: string[]; usage: { totalBytes: number; limitBytes: number; filesUploaded: number } | null }>> {
  if (!isUploadthingConfigured()) return { ok: false, error: "Set UPLOADTHING_TOKEN to manage storage." };
  try {
    const { supabase } = await requireAdmin();
    const api = utapi();
    const files: StorageFile[] = [];
    for (let offset = 0; offset < 20000; offset += 500) {
      const page = await api.listFiles({ limit: 500, offset });
      files.push(...page.files.map((f) => ({ key: f.key, name: f.name, size: f.size, uploadedAt: f.uploadedAt, status: f.status })));
      if (!page.hasMore) break;
    }
    const [resources, settings] = await Promise.all([
      supabase.from("resources").select("file_key,thumbnail_key"),
      supabase.from("site_settings").select("hero_image_key").maybeSingle(),
    ]);
    const used = new Set<string>();
    for (const r of resources.data ?? []) {
      if (r.file_key) used.add(r.file_key);
      if (r.thumbnail_key) used.add(r.thumbnail_key);
    }
    if (settings.data?.hero_image_key) used.add(settings.data.hero_image_key);
    const usage = await api.getUsageInfo().catch(() => null);
    return {
      ok: true,
      data: {
        files,
        used: [...used],
        usage: usage ? { totalBytes: usage.appTotalBytes, limitBytes: usage.limitBytes, filesUploaded: usage.filesUploaded } : null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't read storage" };
  }
}

/** Deletes files that no resource uses (e.g. abandoned uploads). Re-checks usage server-side. */
export async function deleteOrphans(keys: string[]): Promise<ActionResult<{ deleted: number }>> {
  return adminAction(async ({ supabase }) => {
    const clean = [...new Set(keys)].filter((k) => typeof k === "string" && k.length > 3).slice(0, 1000);
    const [resources, settings] = await Promise.all([
      supabase.from("resources").select("file_key,thumbnail_key"),
      supabase.from("site_settings").select("hero_image_key").maybeSingle(),
    ]);
    const used = new Set<string>([settings.data?.hero_image_key ?? ""]);
    for (const r of resources.data ?? []) {
      if (r.file_key) used.add(r.file_key);
      if (r.thumbnail_key) used.add(r.thumbnail_key);
    }
    const orphans = clean.filter((k) => !used.has(k));
    if (orphans.length) await utapi().deleteFiles(orphans);
    return { deleted: orphans.length };
  });
}
