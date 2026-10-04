"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { toggleSaved, useSaved } from "@/lib/library-store";
import { cn } from "@/lib/utils";

export function SaveButton({ id, className, withLabel = false }: { id: string; className?: string; withLabel?: boolean }) {
  const saved = useSaved().some((e) => e.id === id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      title={saved ? "Saved" : "Save for later"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = toggleSaved(id);
        toast(now ? "Saved to your list" : "Removed from saved", {
          description: now ? "Find it any time under My space → Saved." : undefined,
        });
      }}
      className={cn(
        "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-muted-foreground transition-colors hover:bg-lime-soft hover:text-brand",
        saved && "text-brand",
        withLabel ? "h-10 border border-border bg-white px-3.5 text-sm font-medium text-ink" : "size-8",
        className,
      )}
    >
      <Icon className={cn("size-[18px]", saved && "fill-lime-chip")} strokeWidth={1.8} />
      {withLabel ? (saved ? "Saved" : "Save") : null}
    </button>
  );
}
