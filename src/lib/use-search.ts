"use client";

import { useEffect, useState } from "react";
import type { ResourceCardData, SubjectCardData } from "@/lib/serialize";

export type SearchResults = { subjects: SubjectCardData[]; resources: ResourceCardData[] };

const memo = new Map<string, SearchResults>();

/** Debounced, cancellable search against /api/search with a small in-memory cache. */
export function useSearchResults(query: string, prefs: { department: string | null; semester: number | null }) {
  const [results, setResults] = useState<SearchResults>({ subjects: [], resources: [] });
  const [loading, setLoading] = useState(false);
  const [settled, setSettled] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults({ subjects: [], resources: [] });
      setSettled("");
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ q });
    if (prefs.department) params.set("dept", prefs.department);
    if (prefs.semester) params.set("sem", String(prefs.semester));
    const key = params.toString();
    const hit = memo.get(key);
    if (hit) {
      setResults(hit);
      setSettled(q);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?${key}`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          memo.set(key, data);
          if (memo.size > 60) memo.delete(memo.keys().next().value!);
          setResults(data);
          setSettled(q);
        }
      } catch {
        // aborted or offline — keep previous results
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, prefs.department, prefs.semester]);

  return { results, loading, settled };
}
