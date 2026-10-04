"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-white px-6 py-16 text-center">
      <h1 className="text-[20px] font-bold text-ink">This admin page hit an error</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{error.message || "Unknown error"}</p>
      <button type="button" onClick={reset} className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white">
        <RotateCcw className="size-4" /> Retry
      </button>
    </div>
  );
}
