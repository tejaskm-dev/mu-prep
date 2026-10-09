import type { ReportReason, ResourceType } from "@/lib/database.types";

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const RESOURCE_TYPES: {
  value: ResourceType;
  label: string;
  plural: string;
  icon: string;
  description: string;
}[] = [
  { value: "notes", label: "Notes", plural: "Notes", icon: "notebook-text", description: "Lecture, handwritten and teacher notes" },
  { value: "pyq", label: "Previous Paper", plural: "Previous Papers", icon: "scroll-text", description: "University question papers" },
  { value: "lab", label: "Lab Record", plural: "Lab Records", icon: "flask-round", description: "Lab manuals, records and programs" },
  { value: "assignment", label: "Assignment", plural: "Assignments", icon: "clipboard-list", description: "Assignments and tutorials" },
  { value: "qbank", label: "Question Bank", plural: "Question Banks", icon: "list-checks", description: "Important questions and banks" },
  { value: "syllabus", label: "Syllabus", plural: "Syllabus", icon: "book-marked", description: "Official syllabus documents" },
  { value: "other", label: "Other", plural: "Other", icon: "files", description: "Anything else useful" },
];

export const RESOURCE_TYPE_MAP = Object.fromEntries(RESOURCE_TYPES.map((t) => [t.value, t])) as Record<
  ResourceType,
  (typeof RESOURCE_TYPES)[number]
>;

export const RESOURCE_TAGS = [
  { value: "handwritten", label: "Handwritten" },
  { value: "teacher-notes", label: "Teacher Notes" },
  { value: "solved", label: "Solved" },
  { value: "important", label: "Important" },
  { value: "short-notes", label: "Short Notes" },
  { value: "slides", label: "Slides" },
  { value: "textbook", label: "Textbook" },
  { value: "model-paper", label: "Model Paper" },
] as const;

export const TAG_LABELS: Record<string, string> = Object.fromEntries(RESOURCE_TAGS.map((t) => [t.value, t.label]));

export const MODULE_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "broken", label: "File doesn't open / broken link" },
  { value: "wrong_subject", label: "Wrong subject or semester" },
  { value: "wrong_info", label: "Wrong title, module or year" },
  { value: "low_quality", label: "Unreadable or low quality" },
  { value: "duplicate", label: "Duplicate of another file" },
  { value: "copyright", label: "Copyright / shouldn't be here" },
  { value: "other", label: "Something else" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most downloaded" },
  { value: "module", label: "Module order" },
  { value: "title", label: "Title A–Z" },
  { value: "oldest", label: "Oldest first" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const PREF_COOKIES = {
  department: "mp_dept",
  semester: "mp_sem",
  onboarded: "mp_onboarded",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/notes", label: "Notes" },
  { href: "/important", label: "Important" },
  { href: "/syllabus", label: "Syllabus" },
  { href: "/papers", label: "Previous Papers" },
  { href: "/about", label: "About" },
] as const;

/** Accepted upload formats (admin + contributions). */
export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/*",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
].join(",");

/** Default hero photo (free Unsplash licence) until an admin uploads a campus photo. */
export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1769490315499-046551b96944?w=1400&q=75&auto=format&fit=crop";
