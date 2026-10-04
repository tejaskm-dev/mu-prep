"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="font-hand text-[40px] leading-none font-semibold text-brand">Hmm…</p>
      <h1 className="mt-3 text-[26px] font-extrabold tracking-[-0.03em] text-ink">Something went wrong loading this page</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">It&apos;s probably a hiccup on our side. Give it another go.</p>
      <button type="button" onClick={reset} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white">
        <RotateCcw className="size-4" /> Try again
      </button>
    </div>
  );
}
