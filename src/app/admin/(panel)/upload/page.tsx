import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { UploadWorkspace } from "@/components/admin/uploader/upload-workspace";
import { getDepartmentOptions, getSubjectOptions } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { isUploadthingConfigured } from "@/lib/utapi";

export const metadata = { title: "Upload" };

export default async function UploadPage({ searchParams }: PageProps<"/admin/upload">) {
  const { supabase } = await requireAdminPage();
  const [sp, subjects, departments] = await Promise.all([searchParams, getSubjectOptions(supabase), getDepartmentOptions(supabase)]);
  const initialSubjectId = typeof sp.subject === "string" ? sp.subject : null;

  return (
    <>
      <PageHeader
        title="Upload resources"
        description="Drop a whole folder of notes or papers. Files upload instantly while you review the auto-filled details."
      />
      {!isUploadthingConfigured() ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          <strong>UploadThing isn&apos;t configured.</strong> Set <code>UPLOADTHING_TOKEN</code> to enable file uploads — links still work.
        </div>
      ) : null}
      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-10 text-center">
          <BookOpen className="mx-auto size-8 text-brand" />
          <p className="mt-3 font-semibold text-ink">Add subjects first</p>
          <p className="mt-1 text-sm text-muted-foreground">Every file belongs to a subject.</p>
          <Link href="/admin/subjects" className="mt-4 inline-block text-sm font-medium text-brand hover:underline">
            Go to Subjects →
          </Link>
        </div>
      ) : (
        <UploadWorkspace
          subjects={subjects}
          departments={departments.filter((d) => d.is_active).map((d) => ({ slug: d.slug, code: d.code }))}
          initialSubjectId={initialSubjectId}
        />
      )}
    </>
  );
}
