import { DepartmentsManager } from "@/components/admin/departments-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/lib/auth";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const { supabase } = await requireAdminPage();
  const [{ data: departments }, { data: links }] = await Promise.all([
    supabase.from("departments").select("*").order("sort_order").order("code"),
    supabase.from("subject_departments").select("department_id"),
  ]);
  const counts = new Map<string, number>();
  for (const l of links ?? []) counts.set(l.department_id, (counts.get(l.department_id) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Departments" description="Branches students pick when they first visit." />
      <DepartmentsManager departments={(departments ?? []).map((d) => ({ ...d, subjects: counts.get(d.id) ?? 0 }))} />
    </>
  );
}
