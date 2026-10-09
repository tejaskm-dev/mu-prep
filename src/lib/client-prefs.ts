"use client";

import { useSyncExternalStore } from "react";
import { PREF_COOKIES, type ClassScope } from "@/lib/constants";

// The visitor's branch/semester live in plain (non-httpOnly) cookies so the
// static page shell can personalise itself in the browser without making the
// server render dynamic.

export type ClientPrefs = {
  department: string | null;
  semester: number | null;
  onboarded: boolean;
  scope: ClassScope;
  /** A class is chosen and other classes are hidden (see getPrefs). */
  focus: boolean;
  known: boolean;
};

const EVENT = "muprep:prefs";
const SERVER: ClientPrefs = { department: null, semester: null, onboarded: true, scope: "class", focus: false, known: false };
let lastRaw: string | null = null;
let last: ClientPrefs = SERVER;

function read(): ClientPrefs {
  const raw = document.cookie;
  if (raw === lastRaw) return last;
  const jar = new Map(
    raw
      .split(";")
      .map((c) => c.trim().split("="))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
  );
  const dept = jar.get(PREF_COOKIES.department) ?? null;
  const sem = Number(jar.get(PREF_COOKIES.semester));
  const department = dept && /^[a-z0-9-]{1,40}$/.test(dept) ? dept : null;
  const semester = Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null;
  const scope: ClassScope = jar.get(PREF_COOKIES.scope) === "all" ? "all" : "class";
  lastRaw = raw;
  last = {
    department,
    semester,
    onboarded: jar.has(PREF_COOKIES.onboarded) || jar.has(PREF_COOKIES.department),
    scope,
    focus: Boolean(department && semester) && scope === "class",
    known: true,
  };
  return last;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("focus", cb);
  };
}

export function usePrefs(): ClientPrefs {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}

/** Call after the preferences server action resolves (its Set-Cookie is applied by then). */
export function notifyPrefsChanged() {
  window.dispatchEvent(new Event(EVENT));
}
