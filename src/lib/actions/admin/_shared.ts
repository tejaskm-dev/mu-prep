import "server-only";
import { refresh, updateTag } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { requireAdmin, type AdminContext } from "@/lib/auth";
import { TAGS } from "@/lib/cache-tags";

/** Runs an admin-only mutation, converting thrown errors into ActionResult. */
export async function adminAction<T>(
  fn: (ctx: AdminContext) => Promise<T>,
  options: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireAdmin();
    const data = await fn(ctx);
    if (options.revalidate !== false) {
      // Read-your-writes for every cached public query, then refresh the admin's own view.
      for (const tag of Object.values(TAGS)) updateTag(tag);
      refresh();
    }
    return { ok: true, data };
  } catch (error) {
    console.error("[admin action]", error);
    return fail(error);
  }
}

export function check<R extends { data: unknown; error: { message: string } | null }>(result: R, what: string): R["data"] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}
