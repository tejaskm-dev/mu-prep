import "server-only";
import type { SubjectOption } from "@/components/admin/subject-combobox";
import type { AdminContext } from "@/lib/auth";

/** All subjects (including inactive) as options for admin pickers. */
export async function getSubjectOptions(supabase: AdminContext["supabase"]): Promise<SubjectOption[]> {
  const { data } = await supabase
    .from("subject_overview")
    .select("id,slug,name,short_name,code,semester,icon,keywords,department_slugs")
    .order("semester")
    .order("sort_order")
    .order("name");
  return (data ?? []) as SubjectOption[];
}

export async function getDepartmentOptions(supabase: AdminContext["supabase"]) {
  const { data } = await supabase.from("departments").select("id,slug,code,name,icon,is_active,sort_order").order("sort_order").order("code");
  return data ?? [];
}
