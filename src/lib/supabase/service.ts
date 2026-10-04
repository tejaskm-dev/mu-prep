import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL, serverEnv } from "@/lib/env";

let client: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Bypasses RLS — only use it after validating input and,
 * for admin operations, after `requireAdmin()`.
 */
export function serviceClient() {
  const key = serverEnv().serviceRoleKey;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  client ??= createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function hasServiceRole() {
  return Boolean(serverEnv().serviceRoleKey);
}
