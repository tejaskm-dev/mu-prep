"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { openSearch } from "@/lib/ui-events";
import type { DepartmentOption } from "./class-picker";
import { MySpace } from "./my-space";

/**
 * Search + My space, kept on screen while scrolling. The overlay spans the whole page,
 * so the buttons scroll with the header and then stick to the top (pure CSS sticky);
 * the frosted pill behind them fades in once they're stuck.
 */
export function HeaderActions({ departments }: { departments: DepartmentOption[] }) {
  const sentinel = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // The sentinel sits where the buttons start (16px); they stick at 12px.
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 12), {
      rootMargin: "-12px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <span ref={sentinel} aria-hidden className="absolute top-4 left-0 h-px w-px" />
      <div className="container-page flex h-full items-start justify-end">
        <div
          data-stuck={stuck}
          className="group/actions pointer-events-auto sticky top-3 isolate mt-4 flex h-10 items-center gap-2.5 sm:gap-3"
          style={{ viewTransitionName: "site-actions" }}
        >
          <span
            aria-hidden
            className="absolute -inset-1.5 -z-10 scale-90 rounded-full bg-white/80 opacity-0 shadow-lift ring-1 ring-border/80 backdrop-blur-md transition-[opacity,scale] duration-300 ease-out group-data-[stuck=true]/actions:scale-100 group-data-[stuck=true]/actions:opacity-100"
          />
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label="Search (press /)"
            title="Search  ⌘K"
            className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-white/70 text-ink transition-colors hover:border-lime-border hover:bg-white group-data-[stuck=true]/actions:border-transparent"
          >
            <Search className="size-[18px]" strokeWidth={2} />
          </button>
          <MySpace departments={departments} />
        </div>
      </div>
    </div>
  );
}
