import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { SubjectForm, type SubjectFormValue } from "@/components/admin/subject-form";
import { getDepartmentOptions } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { parseModules } from "@/lib/subject-utils";

export const metadata = { title: "Subject" };

export default async function SubjectEditPage({ params }: PageProps<"/admin/subjects/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdminPage();
  const departments = await getDepartmentOptions(supabase);
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let initial: SubjectFormValue = {
    id: null,
    name: "",
    shortName: "",
    code: "",
    semester: 1,
    credits: null,
    icon: "book-open",
    description: "",
    keywords: [],
    modules: [],
    departmentIds: [],
    isActive: true,
    resourceCount: 0,
    slug: null,
  };
  if (!isNew) {
    const { data: s } = await supabase.from("subject_overview").select("*").eq("id", id).maybeSingle();
    if (!s) notFound();
    initial = {
      id: s.id,
      name: s.name,
      shortName: s.short_name ?? "",
      code: s.code ?? "",
      semester: s.semester,
      credits: s.credits,
      icon: s.icon,
      description: s.description ?? "",
      keywords: s.keywords,
      modules: parseModules(s.modules),
      departmentIds: s.department_ids,
      isActive: s.is_active,
      resourceCount: s.resource_count,
      slug: s.slug,
    };
  }

  return (
    <>
      <Link href="/admin/subjects" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-4" /> Subjects
      </Link>
      <PageHeader
        title={isNew ? "New subject" : initial.name}
        description={isNew ? "Add a subject, its modules and the branches that take it." : `${initial.resourceCount} files · /subjects/${initial.slug}`}
        actions={
          !isNew && initial.isActive ? (
            <Link href={`/subjects/${initial.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
              View on site <ExternalLink className="size-3.5" />
            </Link>
          ) : null
        }
      />
      <SubjectForm initial={initial} departments={departments.map((d) => ({ id: d.id, code: d.code, name: d.name }))} />
    </>
  );
}
