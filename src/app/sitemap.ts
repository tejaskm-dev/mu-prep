import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { SITE_URL, isSupabaseConfigured } from "@/lib/env";
import { publicClient } from "@/lib/supabase/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAGS.catalog, TAGS.resources, TAGS.topics);
  const pages: MetadataRoute.Sitemap = ["", "/notes", "/important", "/syllabus", "/papers", "/about", "/contribute"].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.7,
  }));
  if (!isSupabaseConfigured()) return pages;

  const [subjects, resources, topics] = await Promise.all([
    publicClient().from("subjects").select("id,slug,updated_at").eq("is_active", true),
    publicClient().from("resources").select("id,updated_at").eq("status", "published").order("published_at", { ascending: false }).limit(5000),
    publicClient().from("topic_stats").select("subject_id,updated_at"),
  ]);
  const topicsUpdated = new Map((topics.data ?? []).map((t) => [t.subject_id, t.updated_at]));
  return [
    ...pages,
    ...(subjects.data ?? []).map((s) => ({ url: `${SITE_URL}/subjects/${s.slug}`, lastModified: s.updated_at, priority: 0.8 })),
    ...(subjects.data ?? [])
      .filter((s) => topicsUpdated.has(s.id))
      .map((s) => ({ url: `${SITE_URL}/subjects/${s.slug}/important`, lastModified: topicsUpdated.get(s.id), priority: 0.8 })),
    ...(resources.data ?? []).map((r) => ({ url: `${SITE_URL}/notes/${r.id}`, lastModified: r.updated_at, priority: 0.5 })),
  ];
}
