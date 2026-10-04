"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command as Cmd } from "cmdk";
import { ArrowRight, BookOpenText, Clock, CornerDownLeft, FileUp, History, ScrollText, Search, X } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { clearRecentSearches, pushRecentSearch, useRecentSearches } from "@/lib/library-store";
import { usePrefs } from "@/lib/client-prefs";
import type { SubjectCardData } from "@/lib/serialize";
import { useSearchResults } from "@/lib/use-search";
import { badgeLabel } from "./resource-bits";
import { MuSpinner } from "@/components/brand/mu-loader";

const itemClass =
  "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink outline-none data-[selected=true]:bg-lime-soft";

export function SearchCommand({
  open,
  onOpenChange: setOpen,
  initialQuery,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
}) {
  const router = useRouter();
  const prefs = usePrefs();
  const [query, setQuery] = useState(initialQuery);
  const [quickSubjects, setQuickSubjects] = useState<SubjectCardData[]>([]);
  const recent = useRecentSearches();
  const { results, loading, settled } = useSearchResults(query, prefs);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState("");

  // Async results arrive after cmdk's own first-item selection, so pick the top hit explicitly.
  useEffect(() => {
    const first = results.subjects[0] ? `subject-${results.subjects[0].id}` : results.resources[0] ? `res-${results.resources[0].id}` : "all-results";
    setSelected(query.trim() ? first : "");
  }, [results, query]);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open || (!prefs.department && !prefs.semester)) return;
    const params = new URLSearchParams();
    if (prefs.department) params.set("dept", prefs.department);
    if (prefs.semester) params.set("sem", String(prefs.semester));
    const controller = new AbortController();
    fetch(`/api/subjects?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { subjects: [] }))
      .then((d: { subjects: SubjectCardData[] }) => setQuickSubjects(d.subjects))
      .catch(() => {});
    return () => controller.abort();
  }, [open, prefs.department, prefs.semester]);

  const go = useCallback(
    (href: string, remember?: string) => {
      if (remember) pushRecentSearch(remember);
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const q = query.trim();
  const hasResults = results.subjects.length > 0 || results.resources.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[12dvh] translate-y-0 gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-float sm:max-w-[620px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Search µPrep</DialogTitle>
        <DialogDescription className="sr-only">Search subjects, notes, papers and topics</DialogDescription>
        <Cmd shouldFilter={false} loop value={selected} onValueChange={setSelected} className="flex flex-col" label="Search µPrep">
          <div className="flex items-center gap-3 border-b border-border px-4">
            {loading ? (
              <MuSpinner className="size-5 shrink-0  text-brand" />
            ) : (
              <Search className="size-5 shrink-0 text-muted-foreground" />
            )}
            <Cmd.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search subjects, modules, topics…"
              className="h-14 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="rounded-md p-1 text-muted-foreground hover:text-ink" aria-label="Clear search">
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:block">
                Esc
              </kbd>
            )}
          </div>

          <Cmd.List className="max-h-[min(62dvh,480px)] overflow-y-auto overscroll-contain p-2">
            {!q ? (
              <>
                {recent.length > 0 ? (
                  <Cmd.Group
                    heading={
                      <span className="flex items-center justify-between">
                        Recent searches
                        <button type="button" onClick={clearRecentSearches} className="text-[11px] font-medium normal-case hover:text-ink">
                          Clear
                        </button>
                      </span>
                    }
                    className={groupClass}
                  >
                    {recent.slice(0, 5).map((r) => (
                      <Cmd.Item key={r} value={`recent-${r}`} onSelect={() => setQuery(r)} className={itemClass}>
                        <History className="size-4 text-muted-foreground" />
                        {r}
                      </Cmd.Item>
                    ))}
                  </Cmd.Group>
                ) : null}
                {quickSubjects.length > 0 ? (
                  <Cmd.Group heading="Your subjects" className={groupClass}>
                    {quickSubjects.slice(0, 6).map((s) => (
                      <Cmd.Item key={s.id} value={`subject-${s.id}`} onSelect={() => go(`/subjects/${s.slug}`)} className={itemClass}>
                        <SubjectGlyph icon={s.icon} />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground">S{s.semester}</span>
                      </Cmd.Item>
                    ))}
                  </Cmd.Group>
                ) : null}
                <Cmd.Group heading="Jump to" className={groupClass}>
                  <Cmd.Item value="nav-notes" onSelect={() => go("/notes")} className={itemClass}>
                    <BookOpenText className="size-4 text-brand" /> Browse all notes
                  </Cmd.Item>
                  <Cmd.Item value="nav-papers" onSelect={() => go("/papers")} className={itemClass}>
                    <ScrollText className="size-4 text-brand" /> Previous year papers
                  </Cmd.Item>
                  <Cmd.Item value="nav-saved" onSelect={() => go("/saved")} className={itemClass}>
                    <Clock className="size-4 text-brand" /> Saved &amp; recently viewed
                  </Cmd.Item>
                  <Cmd.Item value="nav-contribute" onSelect={() => go("/contribute")} className={itemClass}>
                    <FileUp className="size-4 text-brand" /> Share your notes
                  </Cmd.Item>
                </Cmd.Group>
              </>
            ) : (
              <>
                {results.subjects.length > 0 ? (
                  <Cmd.Group heading="Subjects" className={groupClass}>
                    {results.subjects.map((s) => (
                      <Cmd.Item key={s.id} value={`subject-${s.id}`} onSelect={() => go(`/subjects/${s.slug}`, q)} className={itemClass}>
                        <SubjectGlyph icon={s.icon} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            S{s.semester}
                            {s.code ? ` · ${s.code}` : ""} · {s.resource_count} {s.resource_count === 1 ? "file" : "files"}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100" />
                      </Cmd.Item>
                    ))}
                  </Cmd.Group>
                ) : null}
                {results.resources.length > 0 ? (
                  <Cmd.Group heading="Notes & papers" className={groupClass}>
                    {results.resources.map((r) => (
                      <Cmd.Item key={r.id} value={`res-${r.id}`} onSelect={() => go(`/notes/${r.id}`, q)} className={itemClass}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-[10px] font-bold text-ink/70">
                          {r.type === "pyq" ? "QP" : r.module ? `M${r.module}` : "ALL"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.subject_name} · {badgeLabel(r)}
                          </span>
                        </span>
                      </Cmd.Item>
                    ))}
                  </Cmd.Group>
                ) : null}
                {!loading && settled === q && !hasResults ? (
                  <div className="px-4 py-10 text-center">
                    <p className="text-sm font-medium text-ink">No matches for “{q}”</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try a subject name, course code (e.g. MAT101) or topic.</p>
                  </div>
                ) : null}
                <Cmd.Item value="all-results" onSelect={() => go(`/search?q=${encodeURIComponent(q)}`, q)} className={`${itemClass} mt-1 text-brand`}>
                  <Search className="size-4" />
                  See all results for “{q}”
                  <CornerDownLeft className="ml-auto size-4 opacity-60" />
                </Cmd.Item>
              </>
            )}
          </Cmd.List>
          <div className="hidden items-center gap-4 border-t border-border bg-surface px-4 py-2.5 text-[11.5px] text-muted-foreground sm:flex">
            <span>
              <kbd className="font-sans font-semibold">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-sans font-semibold">↵</kbd> to open
            </span>
            <span className="ml-auto">
              Tip: press <kbd className="font-sans font-semibold">/</kbd> anywhere to search
            </span>
          </div>
        </Cmd>
      </DialogContent>
    </Dialog>
  );
}

const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase";

function SubjectGlyph({ icon }: { icon: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-soft text-brand">
      <DynamicIcon name={icon} className="size-[18px]" strokeWidth={1.8} />
    </span>
  );
}
