import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type {
  Department,
  ResourceFeedRow,
  ResourceType,
  SiteSettings,
  SubjectOverviewRow,
} from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import type { SortValue } from "@/lib/constants";
import { publicClient } from "@/lib/supabase/public";
import { TAGS } from "@/lib/cache-tags";

// Public, read-only queries. Everything goes through RLS as the anon role, so
// only published resources and active subjects/departments are ever returned.
//
// Each query runs inside a "use cache" scope tagged by what it depends on; admin
// mutations call updateTag() so students see changes immediately. Errors are
// thrown inside the cached scope (so a failure is never cached) and caught by
// `safe()` outside it, degrading to empty UI instead of an error page.

const DEFAULT_SETTINGS: SiteSettings = {
  id: true,
  college_name: "ASIET",
  hero_image_url: null,
  hero_image_key: null,
  hero_note: "Same Concepts. Clearer Ideas.",
  announcement: null,
  announcement_link: null,
  announcement_enabled: false,
  contributions_enabled: true,
  requests_enabled: true,
  updated_at: new Date(0).toISOString(),
};

async function safe<T>(scope: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  try {
    return await fn();
  } catch (error) {
    console.error(`[data] ${scope}:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

function must<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ---------------------------------------------------------------- settings

async function cachedSettings() {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  return must(await publicClient().from("site_settings").select("*").maybeSingle()) ?? DEFAULT_SETTINGS;
}

export function getSiteSettings(): Promise<SiteSettings> {
  return safe("site_settings", DEFAULT_SETTINGS, cachedSettings);
}

// ---------------------------------------------------------------- catalog

async function cachedDepartments() {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("hours");
  return (
    must(await publicClient().from("departments").select("*").eq("is_active", true).order("sort_order").order("code")) ?? []
  );
}

export function getDepartments(): Promise<Department[]> {
  return safe("departments", [], cachedDepartments);
}

async function cachedSubjects(department: string | null, semester: number | null) {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.resources);
  cacheLife("hours");
  let query = publicClient().from("subject_overview").select("*").eq("is_active", true);
  if (department) query = query.contains("department_slugs", [department]);
  if (semester) query = query.eq("semester", semester);
  return must(await query.order("semester").order("sort_order").order("name")) ?? [];
}

export function getSubjects(department: string | null, semester: number | null): Promise<SubjectOverviewRow[]> {
  return safe("subjects", [], () => cachedSubjects(department, semester));
}

async function cachedPopularSubjects(department: string | null, semester: number | null, limit: number) {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.resources);
  cacheLife("hours");
  let query = publicClient().from("subject_overview").select("*").eq("is_active", true);
  if (department) query = query.contains("department_slugs", [department]);
  if (semester) query = query.eq("semester", semester);
  return (
    must(
      await query
        .order("download_count", { ascending: false })
        .order("resource_count", { ascending: false })
        .order("sort_order")
        .limit(limit),
    ) ?? []
  );
}

export function getPopularSubjects(department: string | null, semester: number | null, limit = 5) {
  return safe("popular subjects", [] as SubjectOverviewRow[], () => cachedPopularSubjects(department, semester, limit));
}

async function cachedSubjectBySlug(slug: string) {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.resources);
  cacheLife("hours");
  return must(await publicClient().from("subject_overview").select("*").eq("slug", slug).eq("is_active", true).maybeSingle());
}

export function getSubjectBySlug(slug: string): Promise<SubjectOverviewRow | null> {
  return safe("subject", null, () => cachedSubjectBySlug(slug));
}

async function cachedSubjectSlugs() {
  "use cache";
  cacheTag(TAGS.catalog);
  cacheLife("hours");
  return (must(await publicClient().from("subjects").select("slug").eq("is_active", true)) ?? []).map((s) => s.slug);
}

export function getSubjectSlugs(): Promise<string[]> {
  return safe("subject slugs", [], cachedSubjectSlugs);
}

// ---------------------------------------------------------------- resources

async function cachedSubjectResources(subjectId: string) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  return (
    must(
      await publicClient()
        .from("resource_feed")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(500),
    ) ?? []
  );
}

export function getSubjectResources(subjectId: string): Promise<ResourceFeedRow[]> {
  return safe("subject resources", [], () => cachedSubjectResources(subjectId));
}

async function cachedRecent(department: string | null, semester: number | null, limit: number) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  let query = publicClient().from("resource_feed").select("*").eq("status", "published");
  if (department) query = query.contains("department_slugs", [department]);
  if (semester) query = query.eq("semester", semester);
  return must(await query.order("published_at", { ascending: false }).limit(limit)) ?? [];
}

export function getRecentResources(opts: { department?: string | null; semester?: number | null; limit?: number }) {
  return safe("recent resources", [] as ResourceFeedRow[], () =>
    cachedRecent(opts.department ?? null, opts.semester ?? null, opts.limit ?? 24),
  );
}

async function cachedTrending(department: string | null, semester: number | null, limit: number) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  return (
    must(
      await publicClient().rpc("trending_resources", {
        p_days: 7,
        p_department: department,
        p_semester: semester,
        p_limit: limit,
      }),
    ) ?? []
  );
}

export function getTrendingResources(opts: { department?: string | null; semester?: number | null; limit?: number }) {
  return safe("trending", [] as ResourceFeedRow[], () => cachedTrending(opts.department ?? null, opts.semester ?? null, opts.limit ?? 8));
}

async function cachedResource(id: string) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  return must(await publicClient().from("resource_feed").select("*").eq("id", id).eq("status", "published").maybeSingle());
}

export function getResource(id: string): Promise<ResourceFeedRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Promise.resolve(null);
  return safe("resource", null, () => cachedResource(id));
}

async function cachedRecentIds(limit: number) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("hours");
  return (
    must(await publicClient().from("resources").select("id").eq("status", "published").order("published_at", { ascending: false }).limit(limit)) ?? []
  ).map((r) => r.id);
}

/** Most recent resource ids — prerendered at build so popular pages are static. */
export function getRecentResourceIds(limit = 100): Promise<string[]> {
  return safe("recent ids", [], () => cachedRecentIds(limit));
}

async function cachedRelated(subjectId: string, excludeId: string) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  return (
    must(
      await publicClient()
        .from("resource_feed")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("status", "published")
        .neq("id", excludeId)
        .order("published_at", { ascending: false })
        .limit(40),
    ) ?? []
  );
}

export async function getRelatedResources(resource: ResourceFeedRow, limit = 6): Promise<ResourceFeedRow[]> {
  const rows = await safe("related", [] as ResourceFeedRow[], () => cachedRelated(resource.subject_id, resource.id));
  // Same module first, then same type, then everything else.
  const score = (r: ResourceFeedRow) => (resource.module && r.module === resource.module ? 2 : 0) + (r.type === resource.type ? 1 : 0);
  return [...rows].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

async function cachedByIds(ids: string[]) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  return must(await publicClient().from("resource_feed").select("*").in("id", ids).eq("status", "published")) ?? [];
}

export async function getResourcesByIds(ids: string[]): Promise<ResourceFeedRow[]> {
  const clean = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 60);
  if (clean.length === 0) return [];
  const rows = await safe("resources by id", [] as ResourceFeedRow[], () => cachedByIds([...clean].sort()));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return clean.map((id) => byId.get(id)).filter((r): r is ResourceFeedRow => Boolean(r));
}

export type BrowseFilters = {
  q?: string;
  department?: string | null;
  semester?: number | null;
  subject?: string | null;
  type?: ResourceType | null;
  module?: number | "full" | null;
  tag?: string | null;
  year?: number | null;
  sort?: SortValue;
  page?: number;
  pageSize?: number;
};

function sortRows(rows: ResourceFeedRow[], sort: SortValue | undefined) {
  const copy = [...rows];
  switch (sort) {
    case "popular":
      return copy.sort((a, b) => b.download_count - a.download_count);
    case "title":
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    case "oldest":
      return copy.sort((a, b) => (a.published_at ?? "").localeCompare(b.published_at ?? ""));
    case "module":
      return copy.sort((a, b) => (a.module ?? 99) - (b.module ?? 99) || a.title.localeCompare(b.title));
    case "newest":
      return copy.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
    default:
      return copy; // relevance order from the search function
  }
}

async function cachedBrowse(filters: BrowseFilters): Promise<{ rows: ResourceFeedRow[]; total: number }> {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  const pageSize = filters.pageSize ?? 24;
  const page = Math.max(1, filters.page ?? 1);
  const q = filters.q?.trim();

  if (q) {
    // Ranked search, then narrow by the remaining filters.
    let query = publicClient().rpc("search_resources", {
      q,
      p_department: filters.department ?? null,
      p_semester: filters.semester ?? null,
      p_type: filters.type ?? null,
      p_limit: 100,
    });
    if (filters.subject) query = query.eq("subject_slug", filters.subject);
    if (filters.module === "full") query = query.is("module", null);
    else if (filters.module) query = query.eq("module", filters.module);
    if (filters.tag) query = query.contains("tags", [filters.tag]);
    if (filters.year) query = query.eq("exam_year", filters.year);
    const rows = sortRows(must(await query) ?? [], filters.sort === "newest" ? undefined : filters.sort);
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }

  let query = publicClient().from("resource_feed").select("*", { count: "exact" }).eq("status", "published");
  if (filters.department) query = query.contains("department_slugs", [filters.department]);
  if (filters.semester) query = query.eq("semester", filters.semester);
  if (filters.subject) query = query.eq("subject_slug", filters.subject);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.module === "full") query = query.is("module", null);
  else if (filters.module) query = query.eq("module", filters.module);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.year) query = query.eq("exam_year", filters.year);

  switch (filters.sort) {
    case "popular":
      query = query.order("download_count", { ascending: false }).order("published_at", { ascending: false });
      break;
    case "title":
      query = query.order("title");
      break;
    case "oldest":
      query = query.order("published_at", { ascending: true });
      break;
    case "module":
      query = query.order("subject_name").order("module", { nullsFirst: false }).order("title");
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("published_at", { ascending: false });
  }

  const result = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw new Error(result.error.message);
  return { rows: result.data ?? [], total: result.count ?? 0 };
}

export function browseResources(filters: BrowseFilters) {
  return safe("browse", { rows: [] as ResourceFeedRow[], total: 0 }, () => cachedBrowse(filters));
}

async function cachedSearch(
  q: string,
  department: string | null,
  semester: number | null,
  type: ResourceType | null,
  limit: number,
) {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.resources);
  cacheLife("minutes");
  const client = publicClient();
  const [subjects, resources] = await Promise.all([
    client.rpc("search_subjects", { q, p_boost_department: department, p_boost_semester: semester, p_limit: 6 }),
    client.rpc("search_resources", { q, p_type: type, p_boost_department: department, p_boost_semester: semester, p_limit: limit }),
  ]);
  return { subjects: must(subjects) ?? [], resources: must(resources) ?? [] };
}

export function searchEverything(
  q: string,
  opts: { department?: string | null; semester?: number | null; type?: ResourceType | null; limit?: number } = {},
) {
  const query = q.trim().slice(0, 80);
  const empty = { subjects: [] as SubjectOverviewRow[], resources: [] as ResourceFeedRow[] };
  if (!query) return Promise.resolve(empty);
  return safe("search", empty, () =>
    cachedSearch(query.toLowerCase(), opts.department ?? null, opts.semester ?? null, opts.type ?? null, opts.limit ?? 8),
  );
}

async function cachedPapers(department: string | null, semester: number | null) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("minutes");
  let query = publicClient().from("resource_feed").select("*").eq("status", "published").eq("type", "pyq");
  if (department) query = query.contains("department_slugs", [department]);
  if (semester) query = query.eq("semester", semester);
  return (
    must(
      await query
        .order("semester")
        .order("subject_name")
        .order("exam_year", { ascending: false, nullsFirst: false })
        .order("published_at", { ascending: false })
        .limit(400),
    ) ?? []
  );
}

export function getPapers(filters: { department?: string | null; semester?: number | null }) {
  return safe("papers", [] as ResourceFeedRow[], () => cachedPapers(filters.department ?? null, filters.semester ?? null));
}

async function cachedSyllabus(subjectIds: string[]) {
  "use cache";
  cacheTag(TAGS.resources);
  cacheLife("hours");
  return (
    must(
      await publicClient()
        .from("resource_feed")
        .select("*")
        .eq("status", "published")
        .eq("type", "syllabus")
        .in("subject_id", subjectIds)
        .order("published_at", { ascending: false }),
    ) ?? []
  );
}

export function getSyllabusResources(subjectIds: string[]): Promise<ResourceFeedRow[]> {
  if (subjectIds.length === 0) return Promise.resolve([]);
  return safe("syllabus", [], () => cachedSyllabus([...subjectIds].sort()));
}

async function cachedStats() {
  "use cache";
  cacheTag(TAGS.catalog, TAGS.resources);
  cacheLife("hours");
  const client = publicClient();
  const [resources, papers, subjects] = await Promise.all([
    client.from("resources").select("id", { count: "exact", head: true }).eq("status", "published"),
    client.from("resources").select("id", { count: "exact", head: true }).eq("status", "published").eq("type", "pyq"),
    client.from("subject_overview").select("download_count").eq("is_active", true),
  ]);
  const rows = must(subjects) ?? [];
  return {
    resources: resources.count ?? 0,
    papers: papers.count ?? 0,
    subjects: rows.length,
    downloads: rows.reduce((sum, s) => sum + (s.download_count ?? 0), 0),
  };
}

export function getSiteStats() {
  return safe("stats", { resources: 0, subjects: 0, downloads: 0, papers: 0 }, cachedStats);
}
