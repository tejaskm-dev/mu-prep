"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History, X } from "lucide-react";
import { clearRecent, useRecent } from "@/lib/library-store";
import type { ResourceCardData } from "@/lib/serialize";
import { badgeLabel } from "./resource-bits";

/** "Pick up where you left off" — only renders when this device has history. */
export function ContinueStrip() {
  const recent = useRecent();
  const [items, setItems] = useState<ResourceCardData[]>([]);
  const ids = recent.slice(0, 4).map((r) => r.id).join(",");

  useEffect(() => {
    if (!ids) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/resources?ids=${ids}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { resources: [] }))
      .then((d: { resources: ResourceCardData[] }) => setItems(d.resources))
      .catch(() => {});
    return () => controller.abort();
  }, [ids]);

  if (items.length === 0) return null;

  return (
    <section className="container-page mt-10" aria-label="Continue where you left off">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-white/70 p-2 pl-4">
        <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-ink">
          <History className="size-4 text-brand" /> <span className="hidden sm:inline">Pick up where you left off</span>
        </span>
        <div className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {items.map((r) => (
            <Link
              key={r.id}
              href={`/notes/${r.id}`}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px] hover:bg-lime-soft"
            >
              <span className="max-w-[180px] truncate font-medium text-ink">{r.title}</span>
              <span className="text-xs text-muted-foreground">{badgeLabel(r)}</span>
            </Link>
          ))}
        </div>
        <button type="button" onClick={clearRecent} aria-label="Clear history" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
    </section>
  );
}
