import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { fileKind, formatBytes } from "@/lib/format";
import type { ResourceCardData } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { CardBadge, FileMeta, ResourceThumb, VerifiedBadge, badgeLabel } from "./resource-bits";
import { SaveButton } from "./save-button";

function DownloadLink({ r, className }: { r: ResourceCardData; className?: string }) {
  const isLink = !!r.external_url && !r.file_size;
  const Icon = isLink ? ExternalLink : Download;
  return (
    <a
      href={`/api/download/${r.id}`}
      target="_blank"
      rel="noopener"
      aria-label={isLink ? `Open ${r.title}` : `Download ${r.title}`}
      title={isLink ? "Open link" : "Download"}
      className={cn(
        "relative z-10 inline-flex size-8 items-center justify-center rounded-lg text-ink/80 transition-colors hover:bg-lime-soft hover:text-brand",
        className,
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} />
    </a>
  );
}

/** Card used in the "Recently added" carousel and grids. */
export function ResourceCard({
  r,
  showSubject = true,
  className,
}: {
  r: ResourceCardData;
  showSubject?: boolean;
  className?: string;
}) {
  const isLink = !!r.external_url && !r.file_size;
  const kind = fileKind(r.mime_type, r.file_name, isLink);
  return (
    <article className={cn("interactive-card group relative flex flex-col p-3", className)}>
      <ResourceThumb url={r.thumbnail_url} type={r.type} kind={kind} title={r.title} className="aspect-[2.35/1] w-full" />
      <div className="mt-3 flex items-center gap-2">
        <CardBadge>{badgeLabel(r)}</CardBadge>
        {r.is_verified ? <VerifiedBadge /> : null}
      </div>
      <h3 className="mt-1.5 line-clamp-2 text-[14.5px] leading-snug font-semibold tracking-[-0.01em] text-ink">
        <Link href={`/notes/${r.id}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:underline">
          {r.title}
        </Link>
      </h3>
      {showSubject ? <p className="mt-1 line-clamp-1 text-[12.5px] text-muted-foreground">{r.subject_name}</p> : null}
      <div className="mt-auto flex items-center justify-between pt-3">
        <FileMeta mime={r.mime_type} name={r.file_name} size={r.file_size} isLink={isLink} />
        <div className="-mr-1 flex items-center">
          <SaveButton id={r.id} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100" />
          <DownloadLink r={r} />
        </div>
      </div>
    </article>
  );
}

/** Dense list row for subject pages and search results. */
export function ResourceRow({ r, showSubject = false }: { r: ResourceCardData; showSubject?: boolean }) {
  const isLink = !!r.external_url && !r.file_size;
  const kind = fileKind(r.mime_type, r.file_name, isLink);
  return (
    <article className="interactive-card group relative flex items-center gap-4 p-3 hover:translate-y-0">
      <ResourceThumb url={r.thumbnail_url} type={r.type} kind={kind} title={r.title} className="h-[58px] w-[84px] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardBadge>{badgeLabel(r)}</CardBadge>
          {r.is_verified ? <VerifiedBadge /> : null}
        </div>
        <h3 className="mt-1 truncate text-[14.5px] font-semibold text-ink">
          <Link href={`/notes/${r.id}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:underline">
            {r.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {showSubject ? `${r.subject_name} · ` : ""}
          {r.author ? `by ${r.author} · ` : ""}
          {r.download_count > 0 ? `${r.download_count} downloads` : "New"}
        </p>
      </div>
      <FileMeta mime={r.mime_type} name={r.file_name} size={r.file_size} isLink={isLink} pages={r.page_count} className="hidden md:inline-flex" />
      <div className="flex items-center">
        <SaveButton id={r.id} />
        <DownloadLink r={r} />
      </div>
    </article>
  );
}

/** Compact link used in sidebars ("More from this subject"). */
export function ResourceMini({ r }: { r: ResourceCardData }) {
  const isLink = !!r.external_url && !r.file_size;
  const kind = fileKind(r.mime_type, r.file_name, isLink);
  return (
    <Link href={`/notes/${r.id}`} className="interactive-card flex items-center gap-3 p-2.5 hover:translate-y-0">
      <ResourceThumb url={r.thumbnail_url} type={r.type} kind={kind} title={r.title} className="h-[46px] w-[64px] shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-ink">{r.title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {badgeLabel(r)}
          {r.file_size ? ` · ${kind} · ${formatBytes(r.file_size)}` : isLink ? " · Link" : ""}
        </span>
      </span>
    </Link>
  );
}
