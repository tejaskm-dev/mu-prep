import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { BulkAddSubjects, SubjectsBrowser } from "@/components/admin/subjects-browser";
import { Button } from "@/components/ui/button";
import { getDepartmentOptions } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";

export const metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const { supabase } = await requireAdminPage();
  const [{ data: subjects }, departments] = await Promise.all([
    supabase.from("subject_overview").select("*").order("semester").order("sort_order").order("name"),
    getDepartmentOptions(supabase),
  ]);
  const deptOptions = departments.map((d) => ({ id: d.id, slug: d.slug, code: d.code }));
  return (
    <>
      <PageHeader
        title="Subjects"
        description={`${subjects?.length ?? 0} subjects across ${departments.length} departments`}
        actions={
          <>
            <BulkAddSubjects departments={deptOptions} />
            <Button asChild className="h-10 rounded-lg px-4">
              <Link href="/admin/subjects/new">
                <Plus /> New subject
              </Link>
            </Button>
          </>
        }
      />
      <SubjectsBrowser subjects={subjects ?? []} departments={deptOptions} />
    </>
  );
}
