"use client";

import { useEffect, useRef, useState } from "react";
import type { DepartmentOption } from "./class-picker";
import { MainNav } from "./main-nav";

/**
 * Sticky site header. It sits in the page normally, then stays pinned while scrolling;
 * once pinned, `data-stuck` fades in the frosted bar behind the nav (see MainNav).
 */
export function SiteHeader({ departments }: { departments: DepartmentOption[] }) {
  const sentinel = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // The sentinel sits 8px below the header's resting place: once it scrolls past the top, the header is pinned.
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <span ref={sentinel} aria-hidden className="pointer-events-none absolute top-2 left-0 h-px w-px" />
      <header data-stuck={stuck} className="group/header sticky top-0 z-30" style={{ viewTransitionName: "site-header" }}>
        <MainNav departments={departments} />
      </header>
    </>
  );
}
