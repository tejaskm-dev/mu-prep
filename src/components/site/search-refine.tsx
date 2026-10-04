"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { pushRecentSearch } from "@/lib/library-store";

export function SearchRefine({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        pushRecentSearch(q);
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex h-[58px] max-w-3xl items-center gap-3 rounded-xl border border-border bg-white pr-2.5 pl-4 shadow-lift focus-within:border-lime-border focus-within:ring-4 focus-within:ring-lime-soft"
    >
      <Search className="size-5 text-ink/80" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for subjects, modules, topics..."
        aria-label="Search"
        autoFocus={!initial}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-full bg-lime text-ink hover:bg-lime-strong">
        <ArrowRight className="size-[18px]" />
      </button>
    </form>
  );
}
