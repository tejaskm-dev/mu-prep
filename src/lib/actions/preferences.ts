"use server";

import { cookies } from "next/headers";
import { PREF_COOKIES } from "@/lib/constants";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function savePreferences(input: { department?: string | null; semester?: number | null }) {
  const store = await cookies();
  const base = { path: "/", maxAge: ONE_YEAR, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

  if (input.department !== undefined) {
    if (input.department && /^[a-z0-9-]{1,40}$/.test(input.department)) {
      store.set(PREF_COOKIES.department, input.department, base);
    } else {
      store.delete(PREF_COOKIES.department);
    }
  }
  if (input.semester !== undefined) {
    if (input.semester && Number.isInteger(input.semester) && input.semester >= 1 && input.semester <= 8) {
      store.set(PREF_COOKIES.semester, String(input.semester), base);
    } else {
      store.delete(PREF_COOKIES.semester);
    }
  }
  store.set(PREF_COOKIES.onboarded, "1", base);
}
