import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, FolderOpen, ShieldCheck, Users } from "lucide-react";
import { BookStackIllustration, StudyStackIllustration } from "./illustrations";

export function PromoBanners() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.06fr_1fr]">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lime-soft via-[#eef7e4] to-[#e3f2d3] p-7 sm:p-10">
        <div className="relative z-10 max-w-[19rem] sm:max-w-[56%]">
          <span className="section-mark mb-4" aria-hidden />
          <h2 className="text-[24px] leading-tight font-bold tracking-[-0.025em] text-ink sm:text-[26px]">
            Not sure what to study?
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/75">
            Browse notes organised by department, semester and subject. Everything you need in one place.
          </p>
          <Link
            href="/notes"
            className="mt-6 inline-flex h-11 items-center gap-2.5 rounded-lg bg-ink px-5 text-[14.5px] font-medium text-white transition-colors hover:bg-ink/85"
          >
            Explore Notes <ArrowRight className="size-4" />
          </Link>
        </div>
        <StudyStackIllustration className="pointer-events-none absolute -right-4 bottom-0 w-[250px] opacity-90 sm:right-2 sm:w-[44%] sm:max-w-[300px] max-sm:opacity-30" />
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-[#0d110e] p-7 sm:p-10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(120,160,90,0.25),transparent_55%)]" />
        <div className="relative z-10 max-w-[19rem] sm:max-w-[54%]">
          <span className="mb-4 block h-[3px] w-6 rounded-full bg-white/80" aria-hidden />
          <h2 className="text-[24px] leading-tight font-bold tracking-[-0.025em] text-white sm:text-[26px]">Previous Year Papers</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-white/80">
            Access KTU previous year question papers with solutions (where available).
          </p>
          <Link
            href="/papers"
            className="mt-6 inline-flex h-11 items-center gap-2.5 rounded-lg border border-lime/70 bg-white/[0.03] px-5 text-[14.5px] font-medium text-lime transition-colors hover:bg-lime hover:text-ink"
          >
            View Papers <ArrowRight className="size-4" />
          </Link>
        </div>
        <BookStackIllustration className="pointer-events-none absolute -right-4 -bottom-2 w-[260px] sm:right-0 sm:w-[44%] sm:max-w-[300px] max-sm:opacity-30" />
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: FolderOpen, title: "Organised", text: "Department, semester and subject wise" },
  { icon: ShieldCheck, title: "Reliable", text: "Teacher notes, PYQs and verified resources" },
  { icon: Users, title: "Accessible", text: "Free for every student, no sign-up" },
  { icon: ChartNoAxesColumn, title: "Always Growing", text: "New notes and resources added regularly" },
];

export function FeaturesRow() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
      {FEATURES.map((f, i) => (
        <div key={f.title} className={`flex items-start gap-4 lg:px-6 ${i > 0 ? "lg:border-l lg:border-border" : "lg:pl-0"}`}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lime-soft text-ink">
            <f.icon className="size-[21px]" strokeWidth={1.7} />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">{f.title}</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{f.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
