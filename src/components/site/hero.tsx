import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { DEFAULT_HERO_IMAGE } from "@/lib/constants";
import type { SubjectOverviewRow } from "@/lib/database.types";
import { HeroSearch } from "./hero-search";
import { Sparkle, Squiggle } from "./illustrations";

export function HeroChips({ chips }: { chips: Pick<SubjectOverviewRow, "id" | "slug" | "name" | "short_name">[] }) {
  if (!chips.length) return null;
  return (
    <div className="scrollbar-none -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:mr-[-220px]">
      {chips.map((c) => (
        <Link key={c.id} href={`/subjects/${c.slug}`} className="chip h-9 px-4">
          <Search className="size-3.5 opacity-70" strokeWidth={2.2} />
          {c.short_name ?? c.name}
        </Link>
      ))}
    </div>
  );
}

export function HeroChipsSkeleton() {
  return (
    <div className="mt-5 flex gap-2.5" aria-hidden>
      {[112, 120, 92, 104, 96].map((w, i) => (
        <span key={i} className="h-9 animate-pulse rounded-full bg-chip" style={{ width: w }} />
      ))}
    </div>
  );
}

export function Hero({
  college,
  heroImage,
  heroNote,
  chips,
}: {
  college: string;
  heroImage: string | null;
  heroNote: string;
  chips: React.ReactNode;
}) {
  const noteWords = heroNote.split(/\s+/).filter(Boolean).slice(0, 6);

  return (
    <section className="relative">
      {/* faint decorative arc on the left edge */}
      <svg aria-hidden viewBox="0 0 120 600" className="pointer-events-none absolute top-0 left-0 hidden h-[560px] w-[90px] text-lime-border/40 xl:block">
        <path d="M-40 20c120 90 150 330 20 560" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>

      <div className="container-page relative grid grid-cols-1 items-start gap-10 pt-6 pb-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] lg:gap-6 lg:pt-8">
        <div className="relative z-20 min-w-0 animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-7 items-center rounded-md bg-lime-soft px-3 text-[13px] font-medium text-brand">
              Notes Hub
            </span>
            <span className="text-[13px] text-muted-foreground">for {college} · by µLearn</span>
          </div>

          <h1 className="mt-6 text-[44px] leading-[0.98] font-extrabold tracking-[-0.042em] text-ink sm:text-[58px] lg:text-[64px] xl:text-[70px]">
            Everything
            <br />
            you need.
            <br />
            <span className="text-brand">All in one place.</span>
          </h1>

          <p className="mt-5 max-w-[30rem] text-[16px] leading-relaxed text-foreground/80 sm:text-[17px]">
            Lecture notes, handwritten notes, previous papers, syllabus and more — for every department, semester and
            subject at {college}.
          </p>

          <HeroSearch className="mt-7 lg:mr-[-72px]" />

          {chips}
        </div>

        <div className="relative hidden h-[452px] lg:block">
          <Sparkle className="absolute top-[52px] -left-[20px] z-10 size-7 text-brand/80" />
          <div aria-hidden className="absolute top-0 left-[6%] h-[70px] w-[148px] rounded-md bg-lime-chip/80" />
          <div aria-hidden className="bg-grid absolute top-0 right-0 h-[170px] w-[78%] rounded-sm opacity-90" />
          <div aria-hidden className="absolute top-[170px] -right-3 h-[180px] w-[34px] rounded-md bg-lime-chip/55" />
          <div aria-hidden className="absolute right-[22%] bottom-[6px] h-[120px] w-[178px] rounded-lg bg-gradient-to-b from-lime-chip/80 to-lime-soft/30" />

          <figure className="absolute top-[42px] right-[2%] bottom-[60px] left-0 overflow-hidden rounded-2xl bg-lime-soft shadow-float">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-configurable remote hero image */}
            <img
              src={heroImage || DEFAULT_HERO_IMAGE}
              alt={`${college} campus`}
              fetchPriority="high"
              className="size-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-black/10 via-transparent to-white/25" />
            <figcaption className="absolute top-[7%] right-[7%] origin-top-right -rotate-[9deg] text-right">
              <span className="relative block font-hand text-[31px] leading-[1.02] font-semibold text-ink [text-shadow:0_1px_12px_rgba(255,255,255,0.85)]">
                {noteWords.map((w, i) => (
                  <span key={i} className="block">
                    {w}
                  </span>
                ))}
              </span>
              <Squiggle className="ml-auto block w-[88px] text-ink/80" />
            </figcaption>
          </figure>

          <Link
            href="/contribute"
            className="group absolute -right-2 -bottom-6 z-10 flex h-[132px] w-[136px] -rotate-6 flex-col justify-between rounded-sm bg-sticky p-4 shadow-float transition-transform duration-300 hover:-translate-y-1 hover:-rotate-3"
          >
            <span className="font-hand text-[26px] leading-[0.98] font-semibold text-ink">
              Study
              <br />
              Share
              <br />
              Grow
            </span>
            <ArrowRight className="ml-auto size-5 text-ink transition-transform group-hover:translate-x-1" />
            <span className="sr-only">Share your notes with juniors</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
