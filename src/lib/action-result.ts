export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

export function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof Error) return { ok: false, error: error.message };
  if (typeof error === "string") return { ok: false, error };
  return { ok: false, error: "Something went wrong. Please try again." };
}
