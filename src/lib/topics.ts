import type { Json, ResourceType, TopicPriority, TopicQuestion } from "@/lib/database.types";

// Important topics: shared shapes, priority styling and the small bits of maths
// (how often a topic was asked, in which years) used by the portal and the admin.
// Pure — safe on the client and the server.

export const PRIORITIES: {
  value: TopicPriority;
  label: string;
  short: string;
  hint: string;
  weight: number;
  /** solid fill: dots, bars, accents */
  fill: string;
  /** soft pill */
  badge: string;
  /** left accent of a card */
  edge: string;
  text: string;
}[] = [
  {
    value: "critical",
    label: "Must know",
    short: "Must know",
    hint: "Asked almost every time — learn these first",
    weight: 3,
    fill: "bg-hot",
    badge: "bg-hot-soft text-hot-ink ring-1 ring-hot-border",
    edge: "before:bg-hot",
    text: "text-hot-ink",
  },
  {
    value: "high",
    label: "High priority",
    short: "High",
    hint: "Comes up often — high return for the time",
    weight: 2,
    fill: "bg-warm",
    badge: "bg-warm-soft text-warm-ink ring-1 ring-warm-border",
    edge: "before:bg-warm",
    text: "text-warm-ink",
  },
  {
    value: "medium",
    label: "Good to know",
    short: "Good to know",
    hint: "Shows up now and then — cover if time allows",
    weight: 1,
    fill: "bg-lime-strong",
    badge: "bg-lime-soft text-accent-foreground ring-1 ring-lime-border/70",
    edge: "before:bg-lime-strong",
    text: "text-accent-foreground",
  },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.value, p])) as Record<TopicPriority, (typeof PRIORITIES)[number]>;

export type TopicResourceLink = {
  id: string;
  title: string;
  type: ResourceType;
  module: number | null;
  page: number | null;
  page_count: number | null;
  thumbnail_url: string | null;
};

/** A published topic as sent to the portal (client component). */
export type TopicView = {
  id: string;
  module: number;
  title: string;
  notes: string | null;
  priority: TopicPriority;
  questions: TopicQuestion[];
  resources: TopicResourceLink[];
};

export function parseQuestions(value: Json | null | undefined): TopicQuestion[] {
  if (!Array.isArray(value)) return [];
  const out: TopicQuestion[] = [];
  for (const q of value) {
    if (!q || typeof q !== "object" || Array.isArray(q)) continue;
    const text = String(q.text ?? "").trim();
    if (!text) continue;
    const marks = Number(q.marks);
    out.push({
      text,
      marks: Number.isFinite(marks) && marks > 0 ? marks : null,
      years: Array.isArray(q.years) ? q.years.map((y) => String(y ?? "").trim()).filter(Boolean) : [],
    });
  }
  return out;
}

/** "Dec 2023", "2021 (S)", "May '19" → 2023, 2021, 2019 */
export function yearOf(label: string): number | null {
  const full = label.match(/\b(19|20)\d{2}\b/);
  if (full) return Number(full[0]);
  const short = label.match(/['’](\d{2})\b/);
  return short ? 2000 + Number(short[1]) : null;
}

/** How many times the topic has been asked (each listed exam counts once; undated questions count once). */
export function appearances(t: Pick<TopicView, "questions">) {
  return t.questions.reduce((n, q) => n + Math.max(1, q.years.length), 0);
}

export function topicYears(t: Pick<TopicView, "questions">): number[] {
  const years = new Set<number>();
  for (const q of t.questions) for (const y of q.years) {
    const n = yearOf(y);
    if (n) years.add(n);
  }
  return [...years].sort((a, b) => a - b);
}

export function maxMarks(t: Pick<TopicView, "questions">) {
  return t.questions.reduce((m, q) => Math.max(m, q.marks ?? 0), 0);
}

/** Ranking used by "Most important first": priority, then how often it was asked, then how recently. */
export function heatScore(t: Pick<TopicView, "priority" | "questions">) {
  const years = topicYears(t);
  return PRIORITY_MAP[t.priority].weight * 100 + appearances(t) * 6 + years.length * 2 + (years.at(-1) ?? 0) / 10000;
}

export function toTopicViews(
  topics: { id: string; module: number; title: string; notes: string | null; priority: TopicPriority; questions: Json }[],
  links: { topic_id: string; resource_id: string; page: number | null }[],
  resources: { id: string; title: string; type: ResourceType; module: number | null; page_count: number | null; thumbnail_url: string | null }[],
): TopicView[] {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const linksByTopic = new Map<string, TopicResourceLink[]>();
  for (const l of links) {
    const r = byId.get(l.resource_id);
    if (!r) continue; // unpublished or removed file
    const list = linksByTopic.get(l.topic_id) ?? [];
    list.push({ id: r.id, title: r.title, type: r.type, module: r.module, page: l.page, page_count: r.page_count, thumbnail_url: r.thumbnail_url });
    linksByTopic.set(l.topic_id, list);
  }
  return topics.map((t) => ({
    id: t.id,
    module: t.module,
    title: t.title,
    notes: t.notes,
    priority: t.priority,
    questions: parseQuestions(t.questions),
    resources: linksByTopic.get(t.id) ?? [],
  }));
}
