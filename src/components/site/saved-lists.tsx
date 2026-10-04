"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, History } from "lucide-react";
import { clearRecent, useRecent, useSaved } from "@/lib/library-store";
import type { ResourceCardData } from "@/lib/serialize";
import { EmptyState } from "./empty-state";
import { ResourceCard } from "./resource-card";

function useResources(ids: string[]) {
  const key = ids.join(",");
  const [items, setItems] = useState<ResourceCardData[] | null>(null);
  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/resources?ids=${key}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { resources: [] }))
      .then((d: { resources: ResourceCardData[] }) => setItems(d.resources))
      .catch(() => {});
    return () => controller.abort();
  }, [key]);
  return items;
}

export function SavedLists() {
  const saved = useSaved();
  const recent = useRecent();
  const savedItems = useResources(saved.map((s) => s.id));
  const recentItems = useResources(recent.slice(0, 12).map((s) => s.id));

  return (
    <div className="mt-8 space-y-12">
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-ink">
          <Bookmark className="size-5 text-brand" /> Saved <span className="text-sm font-medium text-muted-foreground">{saved.length}</span>
        </h2>
        {savedItems === null ? (
          <Grid skeleton />
        ) : savedItems.length === 0 ? (
          <EmptyState icon={<Bookmark />} title="Nothing saved yet" action={<Link href="/notes" className="text-sm font-medium text-brand hover:underline">Browse notes →</Link>}>
            Tap the bookmark on any file to keep it here.
          </EmptyState>
        ) : (
          <Grid items={savedItems} />
        )}
      </section>
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[18px] font-bold text-ink">
          <History className="size-5 text-brand" /> Recently viewed
          {recent.length ? (
            <button type="button" onClick={clearRecent} className="ml-auto text-[13px] font-medium text-muted-foreground hover:text-ink">
              Clear history
            </button>
          ) : null}
        </h2>
        {recentItems === null ? <Grid skeleton /> : recentItems.length === 0 ? <p className="text-sm text-muted-foreground">Files you open will appear here.</p> : <Grid items={recentItems} />}
      </section>
    </div>
  );
}

function Grid({ items = [], skeleton }: { items?: ResourceCardData[]; skeleton?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {skeleton
        ? Array.from({ length: 4 }, (_, i) => <div key={i} className="h-[270px] animate-pulse rounded-xl bg-white/80" />)
        : items.map((r) => <ResourceCard key={r.id} r={r} />)}
    </div>
  );
}
