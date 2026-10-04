import { isSupabaseConfigured } from "@/lib/env";

/** Shown only until the Supabase environment variables are configured. */
export function SetupNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[13px] text-amber-900">
      <strong>Almost there:</strong> connect Supabase by setting <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
      <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see README → Setup). The site shows empty states until then.
    </div>
  );
}
