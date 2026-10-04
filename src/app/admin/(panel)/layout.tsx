import { AdminMobileBar, AdminSidebar } from "@/components/admin/admin-nav";
import { requireAdminPage } from "@/lib/auth";

export const instant = false;

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const { user, admin, supabase } = await requireAdminPage();
  const [pending, reports, requests] = await Promise.all([
    supabase.from("resources").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("note_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const inboxCount = (pending.count ?? 0) + (reports.count ?? 0) + (requests.count ?? 0);
  const email = user.email ?? admin.email;

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar email={email} role={admin.role} inboxCount={inboxCount} />
      <div className="min-w-0 flex-1">
        <AdminMobileBar email={email} role={admin.role} inboxCount={inboxCount} />
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
