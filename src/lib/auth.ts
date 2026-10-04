import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AdminRow } from "@/lib/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  user: User;
  admin: AdminRow;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

/** Resolves the signed-in user and their admin row (deduped per request). */
export const getSession = cache(async () => {
  if (!isSupabaseConfigured()) return { user: null, admin: null } as const;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: null, supabase } as const;
  const { data: admin } = await supabase.from("admins").select("*").eq("user_id", user.id).maybeSingle();
  return { user, admin: admin ?? null, supabase } as const;
});

/** For pages/layouts: redirects away unless the visitor is an admin. */
export async function requireAdminPage(): Promise<AdminContext> {
  const session = await getSession();
  if (!session.user) redirect("/admin/login");
  if (!session.admin || !session.supabase) redirect("/admin/login?error=not-admin");
  return { user: session.user, admin: session.admin, supabase: session.supabase };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to be signed in as an admin to do that.");
  }
}

/** For server actions and route handlers: throws unless the caller is an admin. */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await getSession();
  if (!session.user || !session.admin || !session.supabase) throw new UnauthorizedError();
  return { user: session.user, admin: session.admin, supabase: session.supabase };
}
