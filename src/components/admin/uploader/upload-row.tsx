"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Link2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCE_TAGS, RESOURCE_TYPES } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SubjectCombobox, type SubjectOption } from "../subject-combobox";
import type { ItemMeta, UploadItem } from "./types";
import { MuSpinner } from "@/components/brand/mu-loader";

export function UploadRow({
  item,
  subjects,
  context,
  onMeta,
  onSelect,
  onRemove,
  onRetry,
  onExpand,
}: {
  item: UploadItem;
  subjects: SubjectOption[];
  context: { department: string | null; semester: number | null };
  onMeta: (patch: Partial<ItemMeta>) => void;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
  onRetry: () => void;
  onExpand: () => void;
}) {
  const m = item.meta;
  const published = item.status === "published";
  const thumb = item.thumb.preview ?? item.thumb.url;
  const missingSubject = !m.subjectId;
  const missingTitle = !m.title.trim();

  if (published) {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-lime-border/60 bg-lime-soft/50 px-4 py-3">
        <CheckCircle2 className="size-5 shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink">{m.title}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{subjects.find((s) => s.id === m.subjectId)?.name}</span>
        </span>
        {item.resourceId ? (
          <>
            <Link href={`/admin/library/${item.resourceId}`} className="text-[12.5px] font-medium text-brand hover:underline">
              Edit
            </Link>
            <Link href={`/notes/${item.resourceId}`} target="_blank" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
              View <ExternalLink className="size-3" />
            </Link>
          </>
        ) : null}
      </li>
    );
  }

  return (
    <li
      className={cn(
        "rounded-xl border bg-white shadow-card transition-colors",
        item.selected ? "border-lime-border ring-1 ring-lime-border" : "border-border",
        item.status === "error" && "border-destructive/40",
      )}
    >
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="flex shrink-0 flex-col items-center gap-2.5">
          <input
            type="checkbox"
            checked={item.selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="size-4 accent-[var(--brand)]"
            aria-label={`Select ${item.name}`}
          />
          <div className="relative flex h-[84px] w-[64px] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview / generated thumbnail
              <img src={thumb} alt="" className="size-full object-cover object-top" />
            ) : item.kind === "link" ? (
              <Link2 className="size-5 text-muted-foreground" />
            ) : item.analyzing ? (
              <MuSpinner className="size-4  text-muted-foreground" />
            ) : (
              <FileText className="size-5 text-muted-foreground" />
            )}
            {item.pageCount ? (
              <span className="absolute right-1 bottom-1 rounded bg-ink/80 px-1 text-[9.5px] font-semibold text-white">{item.pageCount}p</span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="min-w-0 truncate" title={item.name}>
              {item.kind === "link" ? item.externalUrl : item.name}
            </span>
            {item.size ? <span className="shrink-0">· {formatBytes(item.size)}</span> : null}
            <span className="ml-auto shrink-0">
              <StatusChip item={item} onRetry={onRetry} />
            </span>
          </div>

          <Input
            value={m.title}
            onChange={(e) => onMeta({ title: e.target.value })}
            placeholder="Title shown to students"
            aria-invalid={missingTitle || undefined}
            className="h-9 rounded-lg bg-white text-[14px] font-medium"
          />

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_130px]">
            <SubjectCombobox subjects={subjects} value={m.subjectId} onChange={(id) => onMeta({ subjectId: id })} context={context} invalid={missingSubject} />
            <Select value={m.type} onValueChange={(v) => onMeta({ type: v as ResourceType })}>
              <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {m.type === "pyq" ? (
              <Input
                value={m.examSession}
                onChange={(e) => {
                  const year = Number(e.target.value.match(/20\d{2}/)?.[0]) || null;
                  onMeta({ examSession: e.target.value, examYear: year });
                }}
                placeholder="Dec 2023"
                aria-label="Exam session"
                className="h-9 rounded-lg bg-white text-[13px]"
              />
            ) : (
              <Select value={m.module ? String(m.module) : "full"} onValueChange={(v) => onMeta({ module: v === "full" ? null : Number(v) })}>
                <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]" aria-label="Module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">All modules</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Module {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {RESOURCE_TAGS.map((t) => {
              const on = m.tags.includes(t.value);
              return (
                <button
                  key={t.value}
                  type="button"
                  data-active={on}
                  onClick={() => onMeta({ tags: on ? m.tags.filter((x) => x !== t.value) : [...m.tags, t.value] })}
                  className="chip h-6 px-2.5 text-[11.5px]"
                >
                  {t.label}
                </button>
              );
            })}
            <button
              type="button"
              data-active={m.isVerified}
              onClick={() => onMeta({ isVerified: !m.isVerified })}
              className="chip h-6 px-2.5 text-[11.5px]"
              title="Mark as checked by faculty / the team"
            >
              <BadgeCheck className="size-3" /> Verified
            </button>
          </div>

          {item.duplicate ? (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {item.duplicate.inBatch ? "Same file appears twice in this batch" : "Already in the library"}
                {item.duplicate.title ? (
                  <>
                    {" "}
                    as{" "}
                    {item.duplicate.id ? (
                      <Link href={`/admin/library/${item.duplicate.id}`} target="_blank" className="font-semibold underline">
                        {item.duplicate.title}
                      </Link>
                    ) : (
                      <strong>{item.duplicate.title}</strong>
                    )}
                    {item.duplicate.subject ? ` (${item.duplicate.subject})` : ""}
                  </>
                ) : null}
                . Remove it or publish anyway.
              </span>
            </p>
          ) : null}

          {item.detection.signals.length || item.detection.reason ? (
            <p className="flex items-start gap-1.5 text-[11.5px] text-brand">
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              <span className="text-foreground/65">
                {[item.detection.reason, ...item.detection.signals.filter((s) => !s.startsWith("Course code") || !item.detection.reason)]
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(" · ")}
              </span>
            </p>
          ) : null}

          {item.expanded ? (
            <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[200px_1fr]">
              <Input value={m.author} onChange={(e) => onMeta({ author: e.target.value })} placeholder="Prepared by (e.g. Prof. Meera N)" className="h-9 rounded-lg bg-white text-[13px]" />
              <Textarea
                value={m.description}
                onChange={(e) => onMeta({ description: e.target.value })}
                placeholder="Description (optional): topics covered, source, notes for students"
                className="min-h-9 rounded-lg bg-white text-[13px]"
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Remove ${item.name}`} title="Remove">
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={onExpand}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink"
            aria-label={item.expanded ? "Fewer fields" : "More fields"}
            aria-expanded={item.expanded}
            title="Author & description"
          >
            <ChevronDown className={cn("size-4 transition-transform", item.expanded && "rotate-180")} />
          </button>
        </div>
      </div>
      {item.status === "uploading" ? (
        <div className="h-1 overflow-hidden rounded-b-xl bg-muted">
          <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${item.progress}%` }} />
        </div>
      ) : null}
    </li>
  );
}

function StatusChip({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  if (item.kind === "link") return <span className="font-medium text-brand">Link</span>;
  switch (item.status) {
    case "queued":
      return <span>Waiting…</span>;
    case "uploading":
      return <span className="font-medium text-ink tabular-nums">Uploading {Math.round(item.progress)}%</span>;
    case "uploaded":
      return (
        <span className="inline-flex items-center gap-1 font-medium text-brand">
          <CheckCircle2 className="size-3.5" /> Uploaded
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
          <span className="max-w-[220px] truncate" title={item.error}>
            {item.error ?? "Failed"}
          </span>
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded px-1 text-ink hover:bg-muted">
            <RotateCcw className="size-3" /> Retry
          </button>
        </span>
      );
    default:
      return null;
  }
}
