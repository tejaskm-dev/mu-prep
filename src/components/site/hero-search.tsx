"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { usePrefs } from "@/lib/client-prefs";
import { pushRecentSearch } from "@/lib/library-store";
import { cn } from "@/lib/utils";
import { badgeLabel } from "./resource-bits";
import { useSearchResults } from "@/lib/use-search";
import { MuSpinner } from "@/components/brand/mu-loader";

type Option = { key: string; href: string; title: string; meta: string; icon?: string; badge?: string };

export function HeroSearch({ className }: { className?: string }) {
  const router = useRouter();
  const prefs = usePrefs();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const { results, loading } = useSearchResults(query, prefs);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const options: Option[] = q
    ? [
        ...results.subjects.slice(0, 3).map((s) => ({
          key: `s-${s.id}`,
          href: `/subjects/${s.slug}`,
          title: s.name,
          meta: `Subject · S${s.semester}${s.code ? ` · ${s.code}` : ""}`,
          icon: s.icon,
        })),
        ...results.resources.slice(0, 5).map((r) => ({
          key: `r-${r.id}`,
          href: `/notes/${r.id}`,
          title: r.title,
          meta: `${r.subject_name} · ${badgeLabel(r)}`,
          badge: r.type === "pyq" ? "QP" : r.module ? `M${r.module}` : "ALL",
        })),
      ]
    : [];
  const showList = focused && q.length > 0 && (options.length > 0 || !loading);

  const submit = (href?: string) => {
    if (!q && !href) {
      inputRef.current?.focus();
      return;
    }
    if (q) pushRecentSearch(q);
    setFocused(false);
    router.push(href ?? `/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(active >= 0 ? options[active]?.href : undefined);
      }}
    >
      <div
        className={cn(
          "flex h-[58px] items-center gap-3 rounded-xl border border-border bg-white pr-2.5 pl-4 shadow-lift transition-[border-color,box-shadow]",
          focused && "border-lime-border ring-4 ring-lime-soft",
        )}
      >
        <Search className="size-5 shrink-0 text-ink/80" strokeWidth={2} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, -1));
            } else if (e.key === "Escape") {
              setFocused(false);
            }
          }}
          placeholder="Search for subjects, modules, topics..."
          aria-label="Search notes"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#8c9389]"
        />
        <button
          type="submit"
          aria-label="Search"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-ink transition-[transform,background-color] hover:scale-105 hover:bg-lime-strong"
        >
          {loading && focused ? <MuSpinner className="size-[18px]" /> : <ArrowRight className="size-[18px]" strokeWidth={2.2} />}
        </button>
      </div>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-xl border border-border bg-white p-1.5 shadow-float"
        >
          {options.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No quick matches — press Enter to search everything.</p>
          ) : (
            options.map((o, i) => (
              <button
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => submit(o.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                  active === i ? "bg-lime-soft" : "hover:bg-lime-soft/60",
                )}
              >
                {o.icon ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-soft text-brand">
                    <DynamicIcon name={o.icon} className="size-4" />
                  </span>
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-[10px] font-bold text-ink/70">
                    {o.badge}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{o.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{o.meta}</span>
                </span>
              </button>
            ))
          )}
          {q ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit()}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-3 py-2.5 text-left text-sm font-medium text-brand hover:bg-lime-soft"
            >
              <Search className="size-4" /> See all results for “{q}”
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
