import Link from "next/link";
import { ArrowRight, Flame } from "lucide-react";
import { ModuleHeatStrip } from "@/components/topic-bits";
import type { SubjectModule, TopicPriority } from "@/lib/database.types";
import type { TopicView } from "@/lib/topics";

/** Subject-page call-out that leads into the important-topics portal. */
export function TopicsBanner({ slug, topics, modules }: { slug: string; topics: TopicView[]; modules: SubjectModule[] }) {
  const counts = new Map<number, Partial<Record<TopicPriority, number>>>(modules.map((m) => [m.n, {}]));
  for (const t of topics) {
    const c = counts.get(t.module) ?? {};
    c[t.priority] = (c[t.priority] ?? 0) + 1;
    counts.set(t.module, c);
  }
  const strip = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => ({ n, counts: c }));
  const critical = topics.filter((t) => t.priority === "critical").length;
  const questions = topics.reduce((n, t) => n + t.questions.length, 0);
  const moduleCount = new Set(topics.map((t) => t.module)).size;

  return (
    <Link
      href={`/subjects/${slug}/important`}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-[#0d110e] p-5 text-white shadow-card transition-shadow hover:shadow-lift sm:flex-row sm:items-center sm:p-6"
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(228,87,46,0.28),transparent_40%),radial-gradient(circle_at_90%_120%,rgba(120,160,90,0.35),transparent_55%)]" />
      <div className="relative flex min-w-0 flex-1 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-hot text-white shadow-[0_8px_24px_-8px_rgb(228_87_46/0.8)]">
          <Flame className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] leading-tight font-bold tracking-[-0.01em]">Important topics</p>
          <p className="mt-1 text-[13px] text-white/65">
            {topics.length} topics across {moduleCount} {moduleCount === 1 ? "module" : "modules"}
            {critical ? ` · ${critical} must know` : ""}
            {questions ? ` · ${questions} exam questions` : ""}
          </p>
        </div>
      </div>
      <div className="relative flex items-center gap-5">
        <ModuleHeatStrip modules={strip} tone="dark" className="w-[180px]" />
        <span className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-lime px-4 text-[13.5px] font-semibold text-ink transition-colors group-hover:bg-lime-strong">
          Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
