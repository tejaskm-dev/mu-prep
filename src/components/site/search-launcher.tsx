"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { OPEN_SEARCH } from "@/lib/ui-events";

const loadPalette = () => import("./search-command").then((m) => m.SearchCommand);
const SearchCommand = dynamic(loadPalette, { ssr: false });

/** Tiny always-on listener; the palette itself is code-split and preloaded when idle. */
export function SearchLauncher() {
  const [state, setState] = useState({ open: false, query: "", mounted: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setState((s) => ({ open: !s.open, query: "", mounted: true }));
      }
    };
    const onOpen = (e: Event) => setState({ open: true, query: (e as CustomEvent<{ query?: string }>).detail?.query ?? "", mounted: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, onOpen);
    const preload = () => void loadPalette();
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(preload) : setTimeout(preload, 2500);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, onOpen);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle as number);
      else clearTimeout(idle as ReturnType<typeof setTimeout>);
    };
  }, []);

  if (!state.mounted) return null;
  return <SearchCommand open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))} initialQuery={state.query} />;
}
