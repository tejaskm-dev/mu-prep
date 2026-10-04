import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookmarkCheck, FileUp, Search } from "lucide-react";
import { MuLearnLogo, MuMark } from "@/components/brand/logos";
import { FeaturesRow } from "@/components/site/promo-banners";
import { getSiteSettings, getSiteStats } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "About",
  description: "µPrep is a free, student-driven notes hub by µLearn — notes, papers and syllabus for every branch and semester.",
};

const STEPS = [
  { icon: Search, title: "Find", text: "Pick your branch and semester, then open a subject — or just search for a topic or course code." },
  { icon: BookmarkCheck, title: "Study", text: "Preview right in the browser, download for offline, and save what you need for later." },
  { icon: FileUp, title: "Share", text: "Upload your own notes or papers. An admin checks them, then they help everyone after you." },
];

const FAQ = [
  { q: "Is µPrep free?", a: "Yes — completely free, with no sign-up. Your branch, semester and saved files are remembered on your device." },
  { q: "Who uploads the files?", a: "The µLearn team, faculty and students. Teacher-provided and checked files carry a Verified badge." },
  { q: "Is this an official university website?", a: "No. µPrep is a student-driven initiative. Always cross-check with the official syllabus and notifications." },
  { q: "I found a wrong or broken file.", a: "Open it and use “Report a problem”. Admins review every report and fix or remove the file." },
  { q: "Something I need is missing.", a: "On any subject page, use “Request notes”. Requests are grouped, so popular ones get uploaded first." },
];

export default async function AboutPage() {
  const [stats, settings] = await Promise.all([getSiteStats(), getSiteSettings()]);
  return (
    <div className="container-page pt-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-white px-6 py-10 sm:px-12 sm:py-14">
        <div aria-hidden className="bg-grid absolute inset-0 [mask-image:radial-gradient(circle_at_80%_20%,black,transparent_65%)]" />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-3">
            <MuMark size={44} />
            <span className="text-sm font-medium text-muted-foreground">by</span>
            <MuLearnLogo className="w-[96px]" />
          </div>
          <h1 className="mt-6 text-[34px] leading-[1.05] font-extrabold tracking-[-0.035em] text-ink sm:text-[46px]">
            Same concepts. <span className="text-brand">Clearer ideas.</span>
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-foreground/80">
            µPrep is {settings.college_name}&apos;s notes hub, built by µLearn — a student-driven learning community. We collect the best
            lecture notes, handwritten notes, previous papers and syllabus documents in one place, organised the way you actually study:
            by branch, semester, subject and module.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/notes" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white hover:bg-ink/85">
              Start browsing <ArrowRight className="size-4" />
            </Link>
            <Link href="/contribute" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-medium text-ink hover:border-lime-border">
              Share your notes
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Files", value: stats.resources },
          { label: "Previous papers", value: stats.papers },
          { label: "Subjects", value: stats.subjects },
          { label: "Downloads", value: stats.downloads },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white p-5">
            <p className="text-[28px] font-extrabold tracking-[-0.03em] text-ink tabular-nums">{formatNumber(s.value)}</p>
            <p className="text-[13px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <span className="section-mark mb-3" aria-hidden />
        <h2 className="text-[22px] font-bold tracking-[-0.015em] text-ink">How it works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-border bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-lime-soft text-brand">
                  <s.icon className="size-5" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 text-[17px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <span className="section-mark mb-3" aria-hidden />
          <h2 className="text-[22px] font-bold tracking-[-0.015em] text-ink">Questions</h2>
          <p className="mt-2 text-[14.5px] text-muted-foreground">
            Want to help run µPrep? Reach out to the µLearn {settings.college_name} team — we&apos;re always looking for contributors and
            subject maintainers.
          </p>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-white">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink">
                {f.q}
                <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <FeaturesRow />
      </section>
    </div>
  );
}
