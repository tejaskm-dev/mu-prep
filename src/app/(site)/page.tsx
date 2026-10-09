import { Suspense } from "react";
import Link from "next/link";
import { GraduationCap, Sparkles } from "lucide-react";
import {
  ClassLabel,
  ClassProvider,
  HomeDepartmentPicker,
  HomeSemesterPicker,
  PendingArea,
} from "@/components/site/class-sections";
import { ClassFocusBar } from "@/components/site/class-scope";
import { ContinueStrip } from "@/components/site/continue-strip";
import { EmptyState } from "@/components/site/empty-state";
import { Hero, HeroChips, HeroChipsSkeleton } from "@/components/site/hero";
import { FeaturesRow, PromoBanners } from "@/components/site/promo-banners";
import { RecentCarousel } from "@/components/site/recent-carousel";
import { SectionHeading } from "@/components/site/section-heading";
import { SubjectCard } from "@/components/site/subject-card";
import type { Department } from "@/lib/database.types";
import { getDepartments, getPopularSubjects, getRecentResources, getSiteSettings, getSubjects } from "@/lib/data";
import { getPrefs } from "@/lib/prefs";
import { toCard, toSubjectCard } from "@/lib/serialize";

// Static shell (hero, banners, features) + streamed, personalised class sections.
export default async function HomePage() {
  const [settings, departments] = await Promise.all([getSiteSettings(), getDepartments()]);

  return (
    <>
      <Hero
        college={settings.college_name}
        heroImage={settings.hero_image_url}
        heroNote={settings.hero_note}
        chips={
          <Suspense fallback={<HeroChipsSkeleton />}>
            <PersonalChips />
          </Suspense>
        }
      />

      <Suspense fallback={<ClassSectionsSkeleton departments={departments} />}>
        <ClassSections departments={departments} />
      </Suspense>

      <section className="container-page mt-14">
        <PromoBanners />
      </section>

      <section className="container-page mt-12">
        <FeaturesRow />
      </section>
    </>
  );
}

async function PersonalChips() {
  const prefs = await getPrefs();
  return <HeroChips chips={await getPopularSubjects(prefs.department, prefs.semester, 5)} />;
}

async function ClassSections({ departments }: { departments: Department[] }) {
  const prefs = await getPrefs();
  const hasClass = Boolean(prefs.department && prefs.semester);
  const [subjects, recentForClass] = await Promise.all([
    hasClass ? getSubjects(prefs.department, prefs.semester) : Promise.resolve([]),
    getRecentResources({ department: prefs.department, semester: prefs.semester, limit: 24 }),
  ]);

  // If nothing has been uploaded for this class yet, show the latest from everywhere —
  // unless "Only my class" is on, which hides other classes everywhere.
  const needsFallback = !prefs.focus && Boolean(prefs.department || prefs.semester) && recentForClass.length === 0;
  const recent = needsFallback ? await getRecentResources({ limit: 24 }) : recentForClass;
  const deptOptions = departments.map((d) => ({ slug: d.slug, code: d.code, name: d.name, icon: d.icon }));
  const dept = departments.find((d) => d.slug === prefs.department);
  const classQuery = new URLSearchParams({
    ...(prefs.department ? { dept: prefs.department } : {}),
    ...(prefs.semester ? { sem: String(prefs.semester) } : {}),
  }).toString();

  return (
    <ClassProvider department={prefs.department} semester={prefs.semester}>
      {prefs.focus && prefs.semester ? (
        <section className="container-page mt-12 lg:mt-14" aria-label="Your class">
          <ClassFocusBar department={dept ?? null} semester={prefs.semester} />
        </section>
      ) : (
        <>
          <section className="container-page mt-12 lg:mt-14" aria-label="Choose your department">
            {deptOptions.length > 0 ? (
              <HomeDepartmentPicker departments={deptOptions} />
            ) : (
              <EmptyState icon={<GraduationCap />} title="No departments yet">
                An admin can add departments from the admin panel.
              </EmptyState>
            )}
          </section>

          <section className="container-page mt-11">
            <SectionHeading title="Select your semester" action={{ href: `/syllabus${classQuery ? `?${classQuery}` : ""}`, label: "View curriculum" }} />
            <HomeSemesterPicker />
          </section>
        </>
      )}

      <PendingArea>
        <section className="container-page mt-11">
          <SectionHeading
            title={
              <>
                Subjects
                <ClassLabel departments={deptOptions} />
              </>
            }
            action={{ href: `/notes${classQuery ? `?${classQuery}` : ""}`, label: "View all" }}
          />
          {!hasClass ? (
            <EmptyState icon={<GraduationCap />} title="Pick your branch and semester">
              Choose them above and your subjects will show up here — saved on this device, no sign-up.
            </EmptyState>
          ) : subjects.length === 0 ? (
            <EmptyState
              icon={<Sparkles />}
              title={`Subjects for S${prefs.semester} ${dept?.code ?? ""} are on their way`}
              action={
                <Link href="/contribute" className="text-sm font-medium text-brand hover:underline">
                  Have notes? Share them →
                </Link>
              }
            >
              The µLearn team is still adding this semester.{" "}
              {prefs.focus ? "Meanwhile, share what you have or check back soon." : "Meanwhile, try searching or browse other semesters."}
            </EmptyState>
          ) : (
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {subjects.map((s) => (
                <SubjectCard key={s.id} s={toSubjectCard(s)} />
              ))}
            </div>
          )}
        </section>

        <ContinueStrip />

        <section className="container-page mt-12">
          <RecentCarousel
            heading="Recently added"
            items={recent.map(toCard)}
            viewAllHref={`/notes${classQuery ? `?${classQuery}` : ""}`}
            fallbackNote={
              needsFallback && recent.length > 0
                ? `Nothing uploaded for ${[prefs.semester ? `S${prefs.semester}` : null, dept?.code].filter(Boolean).join(" ")} yet — here's the latest from everyone.`
                : null
            }
          />
        </section>
      </PendingArea>
    </ClassProvider>
  );
}

function ClassSectionsSkeleton({ departments }: { departments: Department[] }) {
  return (
    <div aria-busy="true" aria-label="Loading your subjects">
      <section className="container-page mt-12 lg:mt-14">
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {(departments.length ? departments : Array.from({ length: 6 })).map((_, i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-xl border border-border bg-white sm:h-[92px]" />
          ))}
        </div>
      </section>
      <section className="container-page mt-11">
        <span className="section-mark mb-3" aria-hidden />
        <div className="mb-4 h-6 w-52 rounded bg-muted" />
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-8 sm:gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl border border-border bg-white" />
          ))}
        </div>
      </section>
      <section className="container-page mt-11">
        <span className="section-mark mb-3" aria-hidden />
        <div className="mb-4 h-6 w-40 rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[78px] animate-pulse rounded-xl border border-border bg-white" />
          ))}
        </div>
      </section>
    </div>
  );
}
