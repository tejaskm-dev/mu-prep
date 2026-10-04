"use client";

import { useEffect } from "react";
import { trackView } from "@/lib/actions/public";
import { pushRecent } from "@/lib/library-store";

/** Counts one view per resource per browser session and remembers it in "recently viewed". */
export function TrackView({ id }: { id: string }) {
  useEffect(() => {
    pushRecent(id);
    const key = `muprep:viewed:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable — still count it
    }
    void trackView(id);
  }, [id]);
  return null;
}
