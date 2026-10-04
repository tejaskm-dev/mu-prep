"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_START } from "@/lib/ui-events";

/** Thin lime progress bar for client-side navigations (starts on click, finishes on route change). */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const route = `${pathname}?${searchParams}`;
  const lastRoute = useRef(route);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    const start = () => {
      clear();
      setProgress(0.12);
      timers.current.push(window.setTimeout(() => setProgress(0.45), 120));
      timers.current.push(window.setTimeout(() => setProgress(0.72), 600));
      timers.current.push(window.setTimeout(() => setProgress(0.86), 1800));
      timers.current.push(window.setTimeout(() => setProgress(null), 12000));
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START, start);
      clear();
    };
  }, []);

  useEffect(() => {
    if (route === lastRoute.current) return;
    lastRoute.current = route;
    clear();
    setProgress((p) => (p === null ? null : 1));
    timers.current.push(window.setTimeout(() => setProgress(null), 320));
  }, [route]);

  return (
    <div
      aria-hidden
      className="nav-progress"
      style={{ transform: `scaleX(${progress ?? 0})`, opacity: progress === null || progress >= 1 ? 0 : 1 }}
    />
  );
}
