// Centralised access to configuration. Public values are inlined at build time.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Server-only secrets. Never import these values into client components. */
export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",
    uploadthingToken: process.env.UPLOADTHING_TOKEN ?? "",
    ipSalt: process.env.IP_HASH_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "muprep",
  };
}

/** UploadThing tokens are base64 JSON: { apiKey, appId, regions }. */
export function uploadthingAppId(): string | null {
  const token = serverEnv().uploadthingToken;
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as { appId?: string };
    return decoded.appId ?? null;
  } catch {
    return null;
  }
}
