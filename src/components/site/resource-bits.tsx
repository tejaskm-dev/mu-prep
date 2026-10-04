import { BadgeCheck, File, FileImage, FileSpreadsheet, FileText, Link2, Presentation } from "lucide-react";
import { RESOURCE_TYPE_MAP, TAG_LABELS } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { fileKind, formatBytes, type FileKind } from "@/lib/format";
import { cn } from "@/lib/utils";

type BadgeSource = {
  type: ResourceType;
  module: number | null;
  exam_session?: string | null;
  exam_year?: number | null;
};

/** The small grey label on cards: MODULE 1 · FULL NOTES · DEC 2023 PAPER … */
export function badgeLabel(r: BadgeSource) {
  if (r.type === "pyq") {
    if (r.exam_session) return `${r.exam_session.replace(/^(\w{3})\w*/, "$1")} paper`;
    return r.exam_year ? `${r.exam_year} paper` : "Question paper";
  }
  if (r.type === "notes") return r.module ? `Module ${r.module}` : "Full notes";
  if (r.type === "syllabus") return "Syllabus";
  return r.module ? `${RESOURCE_TYPE_MAP[r.type].label} · M${r.module}` : RESOURCE_TYPE_MAP[r.type].label;
}

export function CardBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center rounded-[4px] bg-[#ebece6] px-1.5 text-[10.5px] font-medium tracking-[0.02em] text-[#4f544c] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold text-brand", className)}>
      <BadgeCheck className="size-3.5" />
      Verified
    </span>
  );
}

export function TagPills({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, max).map((t) => (
        <span key={t} className="rounded-full bg-lime-soft px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          {TAG_LABELS[t] ?? t}
        </span>
      ))}
    </div>
  );
}

const KIND_ICON: Record<FileKind, typeof File> = {
  PDF: FileText,
  DOC: FileText,
  PPT: Presentation,
  XLS: FileSpreadsheet,
  IMG: FileImage,
  ZIP: File,
  TXT: FileText,
  LINK: Link2,
  FILE: File,
};

export function FileMeta({
  mime,
  name,
  size,
  isLink,
  pages,
  className,
}: {
  mime: string | null;
  name: string | null;
  size: number | null;
  isLink?: boolean;
  pages?: number | null;
  className?: string;
}) {
  const kind = fileKind(mime, name, isLink);
  const Icon = KIND_ICON[kind];
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12px] text-muted-foreground", className)}>
      <Icon className="size-[17px] text-ink/80" strokeWidth={1.6} />
      <span className="font-medium">{kind === "LINK" ? "Link" : kind}</span>
      {kind !== "LINK" && size ? <span>{formatBytes(size)}</span> : null}
      {pages ? <span className="hidden sm:inline">· {pages} pg</span> : null}
    </span>
  );
}

/** Thumbnail, or a paper-like placeholder that hints at the resource type. */
export function ResourceThumb({
  url,
  type,
  kind,
  title,
  className,
}: {
  url: string | null;
  type: ResourceType;
  kind: FileKind;
  title: string;
  className?: string;
}) {
  if (url) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg border border-border bg-[#f5f5f0]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded thumbnails are already resized */}
        <img src={url} alt="" loading="lazy" decoding="async" className="size-full object-cover object-top" />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-lg border border-border",
        type === "notes" ? "paper-lines" : "bg-[#fbfbf7]",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 flex flex-col gap-[7px] px-5 pt-4 opacity-70">
        {type === "pyq" || type === "qbank" ? (
          <>
            <div className="mx-auto h-[5px] w-2/3 rounded-full bg-ink/25" />
            <div className="mx-auto h-[4px] w-1/2 rounded-full bg-ink/15" />
            <div className="mt-1 h-[3px] w-full rounded-full bg-ink/10" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="h-[4px] w-3 rounded-full bg-brand/35" />
                <div className="h-[3px] rounded-full bg-ink/12" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
              </div>
            ))}
          </>
        ) : type === "lab" ? (
          <div className="grid grid-cols-6 gap-[3px] pt-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className={cn("h-[6px] rounded-[1px]", i % 7 === 0 ? "bg-brand/30" : "bg-ink/8")} />
            ))}
          </div>
        ) : (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="ml-3 h-[3px] rounded-full bg-[#2f4fa0]/25"
              style={{ width: `${40 + ((i * 23) % 50)}%`, transform: `rotate(${i % 2 ? -0.6 : 0.5}deg)` }}
            />
          ))
        )}
      </div>
      <span className="absolute right-2 bottom-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink/70 shadow-sm">
        {kind === "LINK" ? "LINK" : kind}
      </span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
