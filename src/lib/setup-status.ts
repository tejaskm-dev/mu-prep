import "server-only";
import { isSupabaseConfigured, serverEnv, uploadthingAppId } from "@/lib/env";
import { publicClient } from "@/lib/supabase/public";
import { hasServiceRole, serviceClient } from "@/lib/supabase/service";

export type SetupCheck = { label: string; ok: boolean; hint: string };

/** Quick health check shown on the login page until everything is wired up. */
export async function getSetupStatus(): Promise<SetupCheck[]> {
  const checks: SetupCheck[] = [];
  const supabase = isSupabaseConfigured();
  checks.push({
    label: "Supabase URL & anon key",
    ok: supabase,
    hint: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Project Settings → API).",
  });

  let schema = false;
  if (supabase) {
    const { error } = await publicClient().from("site_settings").select("id").limit(1);
    schema = !error;
  }
  checks.push({ label: "Database schema", ok: schema, hint: "Run supabase/setup.sql in the Supabase SQL editor." });

  const service = hasServiceRole();
  checks.push({ label: "Service role key", ok: service, hint: "Set SUPABASE_SERVICE_ROLE_KEY (server only) for submissions and team management." });

  let admins = false;
  if (service && schema) {
    const { count } = await serviceClient().from("admins").select("user_id", { count: "exact", head: true });
    admins = (count ?? 0) > 0;
  }
  checks.push({ label: "First admin account", ok: admins, hint: "Run: npm run create-admin -- you@example.com 'a-strong-password'" });

  const ut = Boolean(serverEnv().uploadthingToken && uploadthingAppId());
  checks.push({ label: "UploadThing token", ok: ut, hint: "Set UPLOADTHING_TOKEN (UploadThing dashboard → API Keys)." });
  return checks;
}
