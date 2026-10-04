"use client";

import { useSyncExternalStore } from "react";

// Saved items, recently viewed items and recent searches live in localStorage —
// there are no accounts on µPrep. Every access is guarded: storage can be
// unavailable (private mode, blocked site data).

export type LibraryEntry = { id: string; at: number };

const KEYS = {
  saved: "muprep:saved",
  recent: "muprep:recent",
  searches: "muprep:searches",
} as const;

type Key = keyof typeof KEYS;

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();
const EMPTY: never[] = [];

function readRaw(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function read<T>(key: Key): T[] {
  if (typeof window === "undefined") return EMPTY;
  const storageKey = KEYS[key];
  const raw = readRaw(storageKey);
  const hit = cache.get(storageKey);
  if (hit && hit.raw === raw) return hit.value as T[];
  let value: T[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    value = EMPTY;
  }
  cache.set(storageKey, { raw, value });
  return value;
}

function write<T>(key: Key, value: T[]) {
  try {
    window.localStorage.setItem(KEYS[key], JSON.stringify(value));
  } catch {
    // ignore — storage unavailable
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || Object.values(KEYS).includes(e.key as (typeof KEYS)[Key])) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function useList<T>(key: Key): T[] {
  return useSyncExternalStore(
    subscribe,
    () => read<T>(key),
    () => EMPTY,
  );
}

export function useSaved() {
  return useList<LibraryEntry>("saved");
}

export function useRecent() {
  return useList<LibraryEntry>("recent");
}

export function useRecentSearches() {
  return useList<string>("searches");
}

export function toggleSaved(id: string) {
  const list = read<LibraryEntry>("saved");
  const exists = list.some((e) => e.id === id);
  write(
    "saved",
    exists ? list.filter((e) => e.id !== id) : [{ id, at: Date.now() }, ...list].slice(0, 200),
  );
  return !exists;
}

export function pushRecent(id: string) {
  const list = read<LibraryEntry>("recent").filter((e) => e.id !== id);
  write("recent", [{ id, at: Date.now() }, ...list].slice(0, 30));
}

export function clearRecent() {
  write("recent", []);
}

export function pushRecentSearch(q: string) {
  const query = q.trim();
  if (query.length < 2) return;
  const list = read<string>("searches").filter((s) => s.toLowerCase() !== query.toLowerCase());
  write("searches", [query, ...list].slice(0, 8));
}

export function clearRecentSearches() {
  write("searches", []);
}
