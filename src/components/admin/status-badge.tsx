import type { ResourceStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const STYLES: Record<ResourceStatus, string> = {
  published: "bg-lime-soft text-accent-foreground",
  draft: "bg-muted text-foreground/70",
  pending: "bg-amber-100 text-amber-900",
  rejected: "bg-red-50 text-red-700",
};

export function StatusBadge({ status, className }: { status: ResourceStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold capitalize", STYLES[status], className)}>
      {status === "pending" ? "In review" : status}
    </span>
  );
}
