import "server-only";
import { cookies } from "next/headers";
import { PREF_COOKIES, type ClassScope } from "@/lib/constants";

export type Prefs = {
  department: string | null;
  semester: number | null;
  onboarded: boolean;
  scope: ClassScope;
  /** A class is chosen and other classes are hidden site-wide (the default once a class is picked). */
  focus: boolean;
};

/** The visitor's chosen branch + semester (no accounts — just cookies). */
export async function getPrefs(): Promise<Prefs> {
  const store = await cookies();
  const raw = store.get(PREF_COOKIES.department)?.value ?? null;
  const sem = Number(store.get(PREF_COOKIES.semester)?.value);
  const department = raw && /^[a-z0-9-]{1,40}$/.test(raw) ? raw : null;
  const semester = Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null;
  const scope: ClassScope = store.get(PREF_COOKIES.scope)?.value === "all" ? "all" : "class";
  return {
    department,
    semester,
    onboarded: store.has(PREF_COOKIES.onboarded) || store.has(PREF_COOKIES.department),
    scope,
    focus: Boolean(department && semester) && scope === "class",
  };
}
