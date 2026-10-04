import { PageHeader } from "@/components/admin/page-header";
import { PasswordForm, SiteSettingsForm, TeamManager } from "@/components/admin/settings-forms";
import { requireAdminPage } from "@/lib/auth";
import { getSiteSettings } from "@/lib/data";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, admin, user } = await requireAdminPage();
  const [settings, { data: admins }] = await Promise.all([getSiteSettings(), supabase.from("admins").select("*").order("created_at")]);
  return (
    <>
      <PageHeader title="Settings" description="Site appearance, community features and your team." />
      <SiteSettingsForm settings={settings} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <TeamManager admins={admins ?? []} currentUserId={user.id} isOwner={admin.role === "owner"} />
        <PasswordForm />
      </div>
    </>
  );
}
