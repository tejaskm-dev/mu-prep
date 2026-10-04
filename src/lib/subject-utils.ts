import type { Json, SubjectModule } from "@/lib/database.types";

export function parseModules(value: Json | null | undefined): SubjectModule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((m) => (m && typeof m === "object" && !Array.isArray(m) ? m : null))
    .filter((m): m is { [key: string]: Json | undefined } => m !== null)
    .map((m) => ({ n: Number(m.n), title: String(m.title ?? "").trim() }))
    .filter((m) => Number.isInteger(m.n) && m.n >= 1 && m.n <= 12)
    .sort((a, b) => a.n - b.n);
}

export function departmentLabel(slugs: string[], all: { slug: string; code: string }[]) {
  if (all.length > 0 && all.every((d) => slugs.includes(d.slug))) return "All branches";
  const codes = all.filter((d) => slugs.includes(d.slug)).map((d) => d.code);
  return codes.length ? codes.join(" · ") : "";
}
