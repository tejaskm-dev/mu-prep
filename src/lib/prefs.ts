import "server-only";
import { cookies } from "next/headers";
import { PREF_COOKIES } from "@/lib/constants";

export type Prefs = { department: string | null; semester: number | null; onboarded: boolean };

/** The visitor's chosen branch + semester (no accounts — just cookies). */
export async function getPrefs(): Promise<Prefs> {
  const store = await cookies();
  const department = store.get(PREF_COOKIES.department)?.value ?? null;
  const sem = Number(store.get(PREF_COOKIES.semester)?.value);
  return {
    department: department && /^[a-z0-9-]{1,40}$/.test(department) ? department : null,
    semester: Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null,
    onboarded: store.has(PREF_COOKIES.onboarded) || store.has(PREF_COOKIES.department),
  };
}
