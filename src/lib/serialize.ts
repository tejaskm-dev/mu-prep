import type { ResourceFeedRow, SubjectOverviewRow } from "@/lib/database.types";

/** Minimal shapes sent to client components and JSON endpoints. */
export type ResourceCardData = Pick<
  ResourceFeedRow,
  | "id"
  | "title"
  | "type"
  | "module"
  | "tags"
  | "exam_year"
  | "exam_session"
  | "is_verified"
  | "file_size"
  | "mime_type"
  | "file_name"
  | "page_count"
  | "thumbnail_url"
  | "external_url"
  | "download_count"
  | "published_at"
  | "subject_name"
  | "subject_slug"
  | "subject_icon"
  | "semester"
  | "author"
>;

export function toCard(r: ResourceFeedRow): ResourceCardData {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    module: r.module,
    tags: r.tags,
    exam_year: r.exam_year,
    exam_session: r.exam_session,
    is_verified: r.is_verified,
    file_size: r.file_size,
    mime_type: r.mime_type,
    file_name: r.file_name,
    page_count: r.page_count,
    thumbnail_url: r.thumbnail_url,
    external_url: r.external_url,
    download_count: r.download_count,
    published_at: r.published_at,
    subject_name: r.subject_name,
    subject_slug: r.subject_slug,
    subject_icon: r.subject_icon,
    semester: r.semester,
    author: r.author,
  };
}

export type SubjectCardData = Pick<
  SubjectOverviewRow,
  "id" | "slug" | "name" | "short_name" | "code" | "icon" | "semester" | "resource_count" | "department_slugs"
>;

export function toSubjectCard(s: SubjectOverviewRow): SubjectCardData {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    short_name: s.short_name,
    code: s.code,
    icon: s.icon,
    semester: s.semester,
    resource_count: s.resource_count,
    department_slugs: s.department_slugs,
  };
}
