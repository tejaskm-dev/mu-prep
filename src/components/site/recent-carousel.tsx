"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Inbox } from "lucide-react";
import type { ResourceType } from "@/lib/database.types";
import type { ResourceCardData } from "@/lib/serialize";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { ResourceCard } from "./resource-card";

const FILTERS: { value: "all" | ResourceType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "notes", label: "Notes" },
  { value: "pyq", label: "Previous Papers" },
  { value: "lab", label: "Lab Records" },
  { value: "assignment", label: "Assignments" },
];

export function RecentFilters({ value, onChange }: { value: string; onChange: (v: "all" | ResourceType) => void }) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by type">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          role="tab"
          aria-selected={value === f.value}
          data-active={value === f.value}
          onClick={() => onChange(f.value)}
          className="chip h-[30px] px-3.5 text-[12.5px]"
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function RecentCarousel({
  items,
  viewAllHref,
  heading,
  fallbackNote,
}: {
  items: ResourceCardData[];
  viewAllHref: string;
  heading: React.ReactNode;
  fallbackNote?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | ResourceType>("all");
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const visible = filter === "all" ? items : items.filter((i) => i.type === filter);

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    const frame = requestAnimationFrame(updateEdges);
    return () => cancelAnimationFrame(frame);
  }, [filter, items]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <span className="section-mark mb-3" aria-hidden />
          <h2 className="text-[21px] leading-tight font-bold tracking-[-0.015em] text-ink sm:text-[22px]">{heading}</h2>
        </div>
        <div className="flex min-w-0 items-center gap-4">
          <RecentFilters value={filter} onChange={setFilter} />
          <Link href={viewAllHref} className="group hidden shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground/80 hover:text-ink sm:inline-flex">
            View all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
      {fallbackNote ? <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">{fallbackNote}</p> : null}

      {visible.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Nothing here yet" action={<Link href="/contribute" className="text-sm font-medium text-brand hover:underline">Share yours →</Link>}>
          {filter === "all" ? "New uploads will show up here." : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} have been added for this class yet.`}
        </EmptyState>
      ) : (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={updateEdges}
            className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pt-1 pb-3 sm:mx-0 sm:px-0"
          >
            {visible.map((r) => (
              <ResourceCard key={r.id} r={r} className="w-[228px] shrink-0 snap-start sm:w-[236px]" />
            ))}
          </div>
          {!edges.start ? (
            <CarouselButton dir={-1} onClick={() => scrollBy(-1)} className="-left-5" />
          ) : null}
          {!edges.end ? <CarouselButton dir={1} onClick={() => scrollBy(1)} className="-right-5" /> : null}
        </div>
      )}
    </div>
  );
}

function CarouselButton({ dir, onClick, className }: { dir: 1 | -1; onClick: () => void; className?: string }) {
  const Icon = dir === 1 ? ArrowRight : ArrowLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 1 ? "Scroll right" : "Scroll left"}
      className={cn(
        "absolute top-[40%] z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-ink shadow-lift transition-transform hover:scale-105 md:flex",
        className,
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
