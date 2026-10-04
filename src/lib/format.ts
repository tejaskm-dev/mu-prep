export function formatBytes(bytes: number | null | undefined, digits = 1) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value >= 100 || exp === 0 ? Math.round(value) : value.toFixed(digits)} ${units[exp]}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.34524, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "";
  let duration = (new Date(date).getTime() - Date.now()) / 1000;
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return "";
}

export function formatDate(date: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", ...opts }).format(
    new Date(date),
  );
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-IN", { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

export type FileKind = "PDF" | "DOC" | "PPT" | "XLS" | "IMG" | "ZIP" | "TXT" | "LINK" | "FILE";

export function fileKind(mime?: string | null, name?: string | null, isLink = false): FileKind {
  if (isLink) return "LINK";
  const m = (mime ?? "").toLowerCase();
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (m === "application/pdf" || ext === "pdf") return "PDF";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext)) return "IMG";
  if (m.includes("presentation") || m.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) return "PPT";
  if (m.includes("word") || ["doc", "docx"].includes(ext)) return "DOC";
  if (m.includes("sheet") || m.includes("excel") || ["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (m.includes("zip") || ext === "zip") return "ZIP";
  if (m.startsWith("text/") || ext === "txt") return "TXT";
  return "FILE";
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function moduleLabel(module: number | null | undefined) {
  return module ? `Module ${module}` : "Full notes";
}

export function semesterLabel(sem: number | null | undefined) {
  return sem ? `S${sem}` : "";
}

/** Turns a Google Drive / YouTube share link into an embeddable URL when possible. */
export function embeddableUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "drive.google.com") {
      const match = u.pathname.match(/\/file\/d\/([^/]+)/) ?? null;
      const id = match?.[1] ?? u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (u.hostname === "docs.google.com") {
      const match = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
      if (match) return `https://docs.google.com/${match[1]}/d/${match[2]}/preview`;
    }
    if (u.hostname.endsWith("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}`;
  } catch {
    return null;
  }
  return null;
}
