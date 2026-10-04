import type { Metadata } from "next";
import { PauseCircle } from "lucide-react";
import { ContributeForm } from "@/components/site/contribute-form";
import { EmptyState } from "@/components/site/empty-state";
import { getDepartments, getSiteSettings, getSubjects } from "@/lib/data";

export const metadata: Metadata = {
  title: "Share your notes",
  description: "Upload notes, question papers or lab records for your juniors. Every submission is reviewed before it goes live.",
};

export default async function ContributePage() {
  const [settings, departments, subjects] = await Promise.all([getSiteSettings(), getDepartments(), getSubjects(null, null)]);

  return (
    <div className="container-page pt-6">
      <div className="mb-7 max-w-2xl">
        <p className="font-hand text-[26px] leading-none font-semibold text-brand">Study · Share · Grow</p>
        <h1 className="mt-2 text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">Share your notes</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Good notes deserve a second life. Upload them here — we&apos;ll tidy the details, review, and publish them for every student who
          comes after you.
        </p>
      </div>
      {settings.contributions_enabled ? (
        <ContributeForm
          subjects={subjects.map((s) => ({
            id: s.id,
            name: s.name,
            short_name: s.short_name,
            code: s.code,
            keywords: s.keywords,
            semester: s.semester,
            department_slugs: s.department_slugs,
          }))}
          departments={departments.map((d) => ({ slug: d.slug, code: d.code }))}
        />
      ) : (
        <EmptyState icon={<PauseCircle />} title="Submissions are paused">
          The team isn&apos;t accepting new uploads right now. Please check back soon.
        </EmptyState>
      )}
    </div>
  );
}
