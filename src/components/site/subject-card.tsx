import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import type { SubjectCardData } from "@/lib/serialize";
import { cn } from "@/lib/utils";

export function SubjectCard({ s, className, showSemester = false }: { s: SubjectCardData; className?: string; showSemester?: boolean }) {
  return (
    <Link href={`/subjects/${s.slug}`} className={cn("interactive-card group flex min-h-[78px] items-center gap-3.5 px-4 py-3.5", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef6e5] text-brand transition-colors group-hover:bg-lime-chip/70">
        <DynamicIcon name={s.icon} className="size-[21px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14px] leading-snug font-semibold tracking-[-0.01em] text-ink">{s.name}</span>
        <span className="mt-1 block text-[12px] text-muted-foreground">
          {showSemester ? `S${s.semester} · ` : ""}
          {s.resource_count > 0 ? `${s.resource_count} ${s.resource_count === 1 ? "note" : "notes"}` : "No notes yet"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
