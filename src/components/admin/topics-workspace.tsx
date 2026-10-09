"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ClipboardPaste,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Highlighter,
  List,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Save,
  ScrollText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { MuSpinner } from "@/components/brand/mu-loader";
import { DynamicIcon } from "@/components/dynamic-icon";
import { InlineRich, RichText } from "@/components/rich-text";
import { PriorityBar, PriorityIcon, PriorityPill } from "@/components/topic-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { createTopics, deleteTopic, reorderTopics, saveTopic, setTopicPriority, setTopicPublished } from "@/lib/actions/admin/topics";
import { RESOURCE_TYPE_MAP } from "@/lib/constants";
import type { ResourceStatus, ResourceType, SubjectModule, TopicPriority, TopicQuestion } from "@/lib/database.types";
import { PRIORITIES, PRIORITY_MAP, appearances, topicYears, yearOf } from "@/lib/topics";
import { cn } from "@/lib/utils";

export type WorkspaceTopic = {
  id: string;
  module: number;
  title: string;
  notes: string;
  priority: TopicPriority;
  questions: TopicQuestion[];
  resources: { id: string; page: number | null }[];
  isPublished: boolean;
  updatedAt: string;
};

type FileOption = {
  id: string;
  title: string;
  type: ResourceType;
  module: number | null;
  page_count: number | null;
  status: ResourceStatus;
  thumbnail_url: string | null;
  exam_session: string | null;
};

type Draft = Omit<WorkspaceTopic, "id" | "updatedAt"> & { id: string | null };

type SubjectInfo = { id: string; slug: string; name: string; code: string | null; semester: number; icon: string; isActive: boolean };

function countBy(list: { priority: TopicPriority }[]) {
  const counts: Partial<Record<TopicPriority, number>> = {};
  for (const t of list) counts[t.priority] = (counts[t.priority] ?? 0) + 1;
  return counts;
}

export function TopicsWorkspace({
  subject,
  modules,
  topics,
  files,
}: {
  subject: SubjectInfo;
  modules: SubjectModule[];
  topics: WorkspaceTopic[];
  files: FileOption[];
}) {
  const router = useRouter();
  // Local copy for optimistic reorder/toggles; reset whenever the server sends fresh data.
  const [items, setItems] = useState(topics);
  const [prevTopics, setPrevTopics] = useState(topics);
  if (topics !== prevTopics) {
    setPrevTopics(topics);
    setItems(topics);
  }

  const moduleList = useMemo(() => {
    const known = new Map(modules.map((m) => [m.n, m.title]));
    for (const t of topics) if (!known.has(t.module)) known.set(t.module, "");
    if (known.size === 0) for (const n of [1, 2, 3, 4, 5]) known.set(n, "");
    return [...known.entries()].sort((a, b) => a[0] - b[0]).map(([n, title]) => ({ n, title }));
  }, [modules, topics]);

  const [module, setModule] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkspaceTopic | null>(null);
  const [, startTransition] = useTransition();

  const yearSuggestions = useMemo(() => {
    const freq = new Map<string, number>();
    for (const t of topics) for (const q of t.questions) for (const y of q.years) freq.set(y, (freq.get(y) ?? 0) + 1);
    const now = new Date().getFullYear();
    for (let y = now; y > now - 6; y--) if (![...freq.keys()].some((k) => yearOf(k) === y)) freq.set(String(y), 0);
    return [...freq.entries()]
      .sort((a, b) => (yearOf(b[0]) ?? 0) - (yearOf(a[0]) ?? 0) || b[1] - a[1])
      .map(([y]) => y)
      .slice(0, 14);
  }, [topics]);

  const visible = module ? items.filter((t) => t.module === module) : items;
  const groups = moduleList
    .filter((m) => !module || m.n === module)
    .map((m) => ({ ...m, items: items.filter((t) => t.module === m.n) }));

  const newTopic = (n?: number) =>
    setDraft({
      id: null,
      module: n ?? module ?? moduleList[0]?.n ?? 1,
      title: "",
      notes: "",
      priority: "high",
      questions: [],
      resources: [],
      isPublished: true,
    });

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, rollback = true) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        if (rollback) setItems(topics);
      }
    });

  const move = (t: WorkspaceTopic, dir: -1 | 1) => {
    const list = items.filter((x) => x.module === t.module);
    const i = list.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const rest = items.filter((x) => x.module !== t.module);
    setItems([...rest, ...reordered].sort((a, b) => a.module - b.module || reordered.indexOf(a) - reordered.indexOf(b)));
    run(() => reorderTopics(reordered.map((x) => x.id)));
  };

  const patch = (id: string, change: Partial<WorkspaceTopic>) => setItems((list) => list.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const total = items.length;
  const counts = countBy(items);
  const drafts = items.filter((t) => !t.isPublished).length;
  const questions = items.reduce((n, t) => n + t.questions.length, 0);
  const linked = items.reduce((n, t) => n + t.resources.length, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-soft text-brand ring-1 ring-lime-border/50">
            <DynamicIcon name={subject.icon} className="size-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[24px] leading-tight font-extrabold tracking-[-0.025em] text-ink sm:text-[28px]">{subject.name}</h1>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">
              Important topics · S{subject.semester}
              {subject.code ? ` · ${subject.code}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {subject.isActive && total > drafts ? (
            <Button asChild variant="ghost" className="h-10 rounded-lg">
              <Link href={`/subjects/${subject.slug}/important`} target="_blank">
                View on site <ExternalLink />
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" className="h-10 rounded-lg bg-white" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste /> Paste a list
          </Button>
          <Button className="h-10 rounded-lg px-4" onClick={() => newTopic()}>
            <Plus /> New topic
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Topics", value: total },
          ...PRIORITIES.map((p) => ({ label: p.label, value: counts[p.value] ?? 0, priority: p.value })),
          { label: "Exam questions", value: questions },
          { label: "Linked files", value: linked },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
            <p className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
              {"priority" in s && s.priority ? <PriorityIcon priority={s.priority} className={cn("size-3.5", PRIORITY_MAP[s.priority].text)} strokeWidth={2.4} /> : null}
              {s.label}
            </p>
            <p className="mt-0.5 text-[22px] leading-tight font-extrabold text-ink tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* module tabs */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <button
          type="button"
          data-active={module === null}
          onClick={() => setModule(null)}
          className="select-tile flex w-[110px] shrink-0 flex-col justify-between p-3 text-left"
        >
          <span className="text-[12px] font-semibold text-muted-foreground">All modules</span>
          <span className="mt-2 text-[22px] leading-none font-extrabold text-ink tabular-nums">{total}</span>
        </button>
        {moduleList.map((m) => {
          const list = items.filter((t) => t.module === m.n);
          return (
            <button
              key={m.n}
              type="button"
              data-active={module === m.n}
              onClick={() => setModule(module === m.n ? null : m.n)}
              title={m.title || `Module ${m.n}`}
              className="select-tile flex w-[170px] shrink-0 flex-col p-3 text-left"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-muted-foreground">Module {m.n}</span>
                <span className="text-[18px] leading-none font-extrabold text-ink tabular-nums">{list.length}</span>
              </span>
              <span className="mt-1 line-clamp-1 text-[12.5px] font-medium text-ink">{m.title || "Untitled module"}</span>
              <PriorityBar counts={countBy(list)} className="mt-2.5" />
            </button>
          );
        })}
      </div>

      {modules.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-warm-border bg-warm-soft/60 px-4 py-3 text-[13px] text-warm-ink">
          This subject has no module titles yet — topics use modules 1–5.{" "}
          <Link href={`/admin/subjects/${subject.id}`} className="font-semibold underline">
            Add module titles
          </Link>{" "}
          so students see what each module covers.
        </p>
      ) : null}

      {visible.length === 0 && module ? (
        <EmptyModule onAdd={() => newTopic(module)} onPaste={() => setPasteOpen(true)} />
      ) : total === 0 ? (
        <EmptyModule onAdd={() => newTopic()} onPaste={() => setPasteOpen(true)} />
      ) : (
        <div className="space-y-8">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <section key={g.n}>
                <header className="mb-2.5 flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-[13px] font-extrabold text-lime tabular-nums">{g.n}</span>
                  <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{g.title || `Module ${g.n}`}</h2>
                  <Button variant="ghost" size="sm" onClick={() => newTopic(g.n)}>
                    <Plus /> Add
                  </Button>
                </header>
                <ul className="space-y-2">
                  {g.items.map((t, i) => (
                    <TopicRow
                      key={t.id}
                      t={t}
                      first={i === 0}
                      last={i === g.items.length - 1}
                      onEdit={() => setDraft({ ...t })}
                      onDuplicate={() => setDraft({ ...t, id: null, title: `${t.title} (copy)` })}
                      onMove={(dir) => move(t, dir)}
                      onDelete={() => setDeleting(t)}
                      onPriority={(priority) => {
                        patch(t.id, { priority });
                        run(() => setTopicPriority(t.id, priority));
                      }}
                      onPublished={(isPublished) => {
                        patch(t.id, { isPublished });
                        run(() => setTopicPublished(t.id, isPublished));
                      }}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[720px]">
          {draft ? (
            <TopicEditor
              key={draft.id ?? "new"}
              initial={draft}
              subjectId={subject.id}
              modules={moduleList}
              files={files}
              yearSuggestions={yearSuggestions}
              onDone={() => {
                setDraft(null);
                router.refresh();
              }}
              onDelete={draft.id ? () => setDeleting(items.find((x) => x.id === draft.id) ?? null) : undefined}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <PasteDialog
        open={pasteOpen}
        onOpenChange={setPasteOpen}
        subjectId={subject.id}
        modules={moduleList}
        defaultModule={module ?? moduleList[0]?.n ?? 1}
        onDone={() => router.refresh()}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>Its questions, notes and file links go with it. Students&apos; revision ticks for it disappear too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                const id = deleting.id;
                setItems((list) => list.filter((x) => x.id !== id));
                if (draft?.id === id) setDraft(null);
                const r = await deleteTopic(id);
                if (r.ok) toast.success("Topic deleted");
                else {
                  toast.error(r.error);
                  setItems(topics);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EmptyModule({ onAdd, onPaste }: { onAdd: () => void; onPaste: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-lime-border/70 bg-white/70 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-hot-soft text-hot">
        <PriorityIcon priority="critical" className="size-5" strokeWidth={2.2} />
      </span>
      <h3 className="mt-4 text-base font-semibold text-ink">No important topics here yet</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Add topics one by one with their exam questions and notes, or paste a list of titles and fill in the details later.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline" className="h-10 rounded-lg bg-white" onClick={onPaste}>
          <ClipboardPaste /> Paste a list
        </Button>
        <Button className="h-10 rounded-lg" onClick={onAdd}>
          <Plus /> New topic
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- list row

function TopicRow({
  t,
  first,
  last,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onPriority,
  onPublished,
}: {
  t: WorkspaceTopic;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onPriority: (p: TopicPriority) => void;
  onPublished: (v: boolean) => void;
}) {
  const p = PRIORITY_MAP[t.priority];
  const years = topicYears(t);
  return (
    <li
      className={cn(
        "group relative flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-white py-2.5 pr-2 pl-3 shadow-card transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 hover:border-lime-border/70 sm:gap-3",
        p.edge,
        !t.isPublished && "bg-surface",
      )}
    >
      <div className="flex shrink-0 flex-col">
        <button type="button" onClick={() => onMove(-1)} disabled={first} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-ink disabled:opacity-25" aria-label="Move up">
          <ArrowUp className="size-3.5" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={last} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-ink disabled:opacity-25" aria-label="Move down">
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 py-0.5 text-left">
        <span className={cn("line-clamp-2 text-[14.5px] leading-snug font-semibold text-ink", !t.isPublished && "text-ink/60")}>
          <InlineRich text={t.title} />
          {!t.isPublished ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 align-middle text-[10.5px] font-semibold text-muted-foreground uppercase">Draft</span> : null}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", t.questions.length === 0 && "text-warm-ink")}>
            <ScrollText className="size-3.5" />
            {t.questions.length ? `${t.questions.length} ${t.questions.length === 1 ? "question" : "questions"} · asked ${appearances(t)}×` : "No questions"}
          </span>
          {years.length ? <span className="tabular-nums">{years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0]}</span> : null}
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" /> {t.resources.length} {t.resources.length === 1 ? "file" : "files"}
          </span>
          {t.notes ? (
            <span className="inline-flex items-center gap-1">
              <NotebookPen className="size-3.5" /> Notes
            </span>
          ) : null}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="hidden shrink-0 rounded-full sm:block" aria-label="Change priority">
            <PriorityPill priority={t.priority} compact className="cursor-pointer hover:brightness-95" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Priority</DropdownMenuLabel>
          {PRIORITIES.map((x) => (
            <DropdownMenuItem key={x.value} onSelect={() => x.value !== t.priority && onPriority(x.value)} className="items-start gap-2">
              <PriorityIcon priority={x.value} className={cn("mt-0.5 size-4", x.text)} />
              <span>
                <span className="block font-medium">{x.label}</span>
                <span className="block text-[11.5px] text-muted-foreground">{x.hint}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Switch checked={t.isPublished} onCheckedChange={onPublished} aria-label={t.isPublished ? "Published — click to hide" : "Draft — click to publish"} title={t.isPublished ? "Visible to students" : "Hidden (draft)"} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink" aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ---------------------------------------------------------------- editor

/** Wraps the textarea selection (or a placeholder) with markers, keeping the selection on the wrapped text. */
function wrapSelection(el: HTMLTextAreaElement | null, value: string, before: string, after: string, onChange: (v: string) => void) {
  if (!el) return;
  const a = el.selectionStart;
  const b = el.selectionEnd;
  const selected = value.slice(a, b) || "key words";
  onChange(value.slice(0, a) + before + selected + after + value.slice(b));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(a + before.length, a + before.length + selected.length);
  });
}

function bulletLines(el: HTMLTextAreaElement | null, value: string, onChange: (v: string) => void) {
  if (!el) return;
  const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
  const endIdx = value.indexOf("\n", el.selectionEnd);
  const end = endIdx === -1 ? value.length : endIdx;
  const block = value
    .slice(start, end)
    .split("\n")
    .map((l) => (/^\s*[-*•]\s+/.test(l) ? l : `- ${l}`))
    .join("\n");
  onChange(value.slice(0, start) + block + value.slice(end));
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start, start + block.length);
  });
}

function MarkupArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  bullets = false,
  preview = false,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  bullets?: boolean;
  preview?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const tool = "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-ink";
  return (
    <div className={cn("overflow-hidden rounded-lg border border-input bg-white focus-within:border-lime-border focus-within:ring-3 focus-within:ring-lime-soft", className)}>
      {/* mousedown is cancelled so the textarea keeps focus and its selection */}
      <div className="flex items-center gap-0.5 border-b border-border bg-surface px-1.5 py-1" onMouseDown={(e) => e.preventDefault()}>
        <button type="button" className={tool} onClick={() => wrapSelection(ref.current, value, "==", "==", onChange)} title="Highlight (==text==)" disabled={showPreview}>
          <Highlighter className="size-3.5" /> Highlight
        </button>
        <button type="button" className={tool} onClick={() => wrapSelection(ref.current, value, "**", "**", onChange)} title="Bold (**text**)" disabled={showPreview}>
          <Bold className="size-3.5" />
        </button>
        {bullets ? (
          <button type="button" className={tool} onClick={() => bulletLines(ref.current, value, onChange)} title="Bullet list (- item)" disabled={showPreview}>
            <List className="size-3.5" />
          </button>
        ) : null}
        {preview ? (
          <button type="button" className={cn(tool, "ml-auto", showPreview && "bg-lime-soft text-ink")} onClick={() => setShowPreview((v) => !v)} aria-pressed={showPreview}>
            <Eye className="size-3.5" /> Preview
          </button>
        ) : null}
      </div>
      {showPreview ? (
        <div className="min-h-24 bg-[#fffef3] px-3 py-2.5">{value.trim() ? <RichText text={value} /> : <p className="text-[13px] text-muted-foreground">Nothing to preview yet.</p>}</div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-label={label}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

function YearsInput({ value, onChange, suggestions }: { value: string[]; onChange: (v: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const y = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    if (y && !value.includes(y)) onChange([...value, y]);
    setText("");
  };
  const unused = suggestions.filter((s) => !value.includes(s)).slice(0, 8);
  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-white px-2 py-1 focus-within:border-lime-border focus-within:ring-3 focus-within:ring-lime-soft">
        {value.map((y) => (
          <span key={y} className="inline-flex items-center gap-1 rounded-md bg-ink py-0.5 pr-1 pl-2 text-[12px] font-semibold text-lime">
            {y}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== y))} className="rounded p-0.5 text-white/70 hover:text-white" aria-label={`Remove ${y}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? "" : "Dec 2023, May 2022…"}
          className="h-7 min-w-[120px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          aria-label="Exam years"
        />
      </div>
      {unused.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11.5px] text-muted-foreground hover:border-lime-border hover:text-ink">
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TopicEditor({
  initial,
  subjectId,
  modules,
  files,
  yearSuggestions,
  onDone,
  onDelete,
}: {
  initial: Draft;
  subjectId: string;
  modules: { n: number; title: string }[];
  files: FileOption[];
  yearSuggestions: string[];
  onDone: () => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [fileQuery, setFileQuery] = useState("");
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setQuestion = (i: number, patch: Partial<TopicQuestion>) => set("questions", d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const selected = new Map(d.resources.map((r) => [r.id, r.page]));
  const fileList = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    const rank = (f: FileOption) => (f.module === d.module ? 0 : f.module === null ? 1 : 2) + (f.type === "notes" ? 0 : 0.5);
    return files
      .filter((f) => !q || `${f.title} ${RESOURCE_TYPE_MAP[f.type].label} ${f.exam_session ?? ""} m${f.module ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  }, [files, fileQuery, d.module]);
  const chosen = files.filter((f) => selected.has(f.id));

  const toggleFile = (id: string) =>
    set("resources", selected.has(id) ? d.resources.filter((r) => r.id !== id) : [...d.resources, { id, page: null }]);
  const setPage = (id: string, page: number | null) => set("resources", d.resources.map((r) => (r.id === id ? { ...r, page } : r)));

  const save = () =>
    startSaving(async () => {
      const result = await saveTopic(d.id, {
        subjectId,
        module: d.module,
        title: d.title,
        notes: d.notes.trim() || null,
        priority: d.priority,
        questions: d.questions
          .map((q) => ({ text: q.text.trim(), marks: q.marks && q.marks > 0 ? Math.round(q.marks) : null, years: q.years }))
          .filter((q) => q.text),
        resources: d.resources,
        isPublished: d.isPublished,
      });
      if (result.ok) {
        toast.success(d.id ? "Topic saved" : "Topic added");
        onDone();
      } else toast.error(result.error);
    });

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && d.title.trim()) {
          e.preventDefault();
          save();
        }
      }}
    >
      <SheetHeader className="border-b border-border px-5 py-4 pr-12">
        <SheetTitle className="text-[17px] font-bold text-ink">{d.id ? "Edit topic" : "New important topic"}</SheetTitle>
        <SheetDescription>Students see the title, priority, exam questions, notes and files you add here.</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          <Field label="Topic">
            <Input
              autoFocus={!d.id}
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Dijkstra's shortest path algorithm"
              className="h-11 rounded-lg text-[15.5px] font-semibold"
              maxLength={200}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[250px_minmax(0,1fr)]">
            <Field label="Module">
              <Select value={String(d.module)} onValueChange={(v) => set("module", Number(v))}>
                <SelectTrigger className="h-10! w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.n} value={String(m.n)}>
                      Module {m.n}
                      {m.title ? ` · ${m.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => {
                  const on = d.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set("priority", p.value)}
                      title={p.hint}
                      className={cn(
                        "flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition-colors",
                        on ? cn(p.badge, "border-transparent") : "border-input bg-white text-muted-foreground hover:text-ink",
                      )}
                    >
                      <PriorityIcon priority={p.value} className="size-3.5" strokeWidth={2.4} />
                      <span className="truncate">{p.short}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </div>

        <section>
          <SectionTitle icon={NotebookPen} hint="Key points to remember. Use - for bullets and highlight the words that score marks.">
            Quick notes
          </SectionTitle>
          <MarkupArea
            value={d.notes}
            onChange={(v) => set("notes", v)}
            placeholder={"- Greedy: always pick the ==closest unvisited vertex==\n- Fails with **negative edge weights**\n- O((V + E) log V) with a min-heap"}
            rows={5}
            bullets
            preview
            label="Quick notes"
          />
        </section>

        <section>
          <SectionTitle
            icon={ScrollText}
            hint="Previous university questions on this topic. Add every exam it appeared in — the portal counts repeats."
            action={
              <Button variant="outline" size="sm" className="bg-white" onClick={() => set("questions", [...d.questions, { text: "", marks: null, years: [] }])} disabled={d.questions.length >= 60}>
                <Plus /> Add question
              </Button>
            }
          >
            Exam questions {d.questions.length ? <span className="font-normal text-muted-foreground">· {d.questions.length}</span> : null}
          </SectionTitle>
          {d.questions.length === 0 ? (
            <button
              type="button"
              onClick={() => set("questions", [{ text: "", marks: null, years: [] }])}
              className="w-full rounded-xl border border-dashed border-border py-6 text-[13px] text-muted-foreground hover:border-lime-border hover:text-ink"
            >
              Map the first exam question to this topic
            </button>
          ) : (
            <ol className="space-y-3">
              {d.questions.map((q, i) => (
                <li key={i} className={cn("relative rounded-xl border border-border bg-surface p-3 pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-xl", PRIORITY_MAP[d.priority].edge)}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[11.5px] font-bold text-muted-foreground">Q{i + 1}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...d.questions];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          set("questions", next);
                        }}
                        disabled={i === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-25"
                        aria-label="Move question up"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => set("questions", d.questions.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Remove question"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <MarkupArea
                    value={q.text}
                    onChange={(v) => setQuestion(i, { text: v })}
                    placeholder="e.g. Explain ==Dijkstra's algorithm== with an example. Why does it fail for negative edges?"
                    rows={2}
                    label={`Question ${i + 1}`}
                  />
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <div>
                      <Label className="mb-1 block text-[11.5px] text-muted-foreground">Marks</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={q.marks ?? ""}
                        onChange={(e) => setQuestion(i, { marks: e.target.value === "" ? null : Number(e.target.value) })}
                        placeholder="—"
                        className="h-9 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-[11.5px] text-muted-foreground">Asked in</Label>
                      <YearsInput value={q.years} onChange={(years) => setQuestion(i, { years })} suggestions={yearSuggestions} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <SectionTitle icon={FileText} hint="Notes or papers that cover this topic. Add a page number to send students straight to it.">
            Read it in {chosen.length ? <span className="font-normal text-muted-foreground">· {chosen.length}</span> : null}
          </SectionTitle>
          {chosen.length ? (
            <ul className="mb-3 space-y-1.5">
              {chosen.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 rounded-lg border border-lime-border/70 bg-lime-soft/50 px-2.5 py-2">
                  <FileText className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{f.title}</span>
                  <Input
                    type="number"
                    min={1}
                    max={f.page_count ?? 20000}
                    value={selected.get(f.id) ?? ""}
                    onChange={(e) => setPage(f.id, e.target.value === "" ? null : Math.max(1, Math.round(Number(e.target.value))))}
                    placeholder="Page"
                    className="h-8 w-20 rounded-md bg-white text-[12.5px]"
                    aria-label={`Page in ${f.title}`}
                  />
                  <button type="button" onClick={() => toggleFile(f.id)} className="rounded p-1 text-muted-foreground hover:bg-white hover:text-ink" aria-label={`Unlink ${f.title}`}>
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {files.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">This subject has no files yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <label className="relative block border-b border-border">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  placeholder={`Search ${files.length} files…`}
                  className="h-9 w-full bg-white pr-3 pl-8 text-[13px] outline-none placeholder:text-muted-foreground"
                />
              </label>
              <ul className="max-h-56 divide-y divide-border overflow-y-auto bg-white">
                {fileList.map((f) => {
                  const on = selected.has(f.id);
                  return (
                    <li key={f.id}>
                      <button type="button" onClick={() => toggleFile(f.id)} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface", on && "bg-lime-soft/40")}>
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-brand bg-brand text-white" : "border-input bg-white")}>
                          {on ? <span className="text-[10px] leading-none font-bold">✓</span> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">{f.title}</span>
                          <span className="block text-[11.5px] text-muted-foreground">
                            {RESOURCE_TYPE_MAP[f.type].label}
                            {f.module ? ` · Module ${f.module}` : " · All modules"}
                            {f.page_count ? ` · ${f.page_count} pages` : ""}
                            {f.status === "draft" ? " · draft" : ""}
                          </span>
                        </span>
                        {f.module === d.module ? <span className="shrink-0 rounded bg-lime-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-foreground">Same module</span> : null}
                      </button>
                    </li>
                  );
                })}
                {fileList.length === 0 ? <li className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">No files match.</li> : null}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border bg-white px-5 py-3.5">
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <Switch checked={d.isPublished} onCheckedChange={(v) => set("isPublished", v)} />
          {d.isPublished ? "Visible to students" : "Draft (hidden)"}
        </label>
        <div className="ml-auto flex items-center gap-2">
          {onDelete ? (
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={onDelete} disabled={saving}>
              <Trash2 /> Delete
            </Button>
          ) : null}
          <Button onClick={save} disabled={saving || !d.title.trim()} className="h-10 rounded-lg px-4" title="Save (⌘/Ctrl + Enter)">
            {saving ? <MuSpinner /> : <Save />} {d.id ? "Save topic" : "Add topic"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-[13px]">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  hint,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
          <Icon className="size-4 text-brand" /> {children}
        </h3>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- paste a list

function parseLines(text: string, fallback: TopicPriority) {
  return text
    .split(/\r?\n/)
    .map((raw) => {
      let line = raw.trim().replace(/^(?:[-*•]|\d{1,2}[.)])\s+/, "");
      let priority = fallback;
      if (/^!/.test(line)) {
        priority = "critical";
        line = line.replace(/^!+\s*/, "");
      } else if (/^\+/.test(line)) {
        priority = "high";
        line = line.replace(/^\++\s*/, "");
      } else if (/^~/.test(line)) {
        priority = "medium";
        line = line.replace(/^~+\s*/, "");
      }
      return { title: line.slice(0, 200), priority };
    })
    .filter((l) => l.title.length > 0);
}

function PasteDialog({
  open,
  onOpenChange,
  subjectId,
  modules,
  defaultModule,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subjectId: string;
  modules: { n: number; title: string }[];
  defaultModule: number;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [module, setModule] = useState<number | null>(null);
  const [priority, setPriority] = useState<TopicPriority>("high");
  const [pending, startTransition] = useTransition();
  const target = module ?? defaultModule;
  const lines = parseLines(text, priority);

  const submit = () =>
    startTransition(async () => {
      const r = await createTopics({ subjectId, module: target, topics: lines });
      if (r.ok) {
        toast.success(`Added ${r.data?.created ?? lines.length} topics to module ${target}`);
        setText("");
        setModule(null);
        onOpenChange(false);
        onDone();
      } else toast.error(r.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="size-5 text-brand" /> Paste a list of topics
          </DialogTitle>
          <DialogDescription>
            One topic per line. Start a line with <b className="text-hot-ink">!</b> for must know, <b className="text-warm-ink">+</b> for high or{" "}
            <b className="text-accent-foreground">~</b> for good to know. Add questions and notes afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Module">
                <Select value={String(target)} onValueChange={(v) => setModule(Number(v))}>
                  <SelectTrigger className="h-9! w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((m) => (
                      <SelectItem key={m.n} value={String(m.n)}>
                        Module {m.n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default priority">
                <Select value={priority} onValueChange={(v) => setPriority(v as TopicPriority)}>
                  <SelectTrigger className="h-9! w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder={"! Dijkstra's algorithm\n! Kruskal vs Prim\n+ Topological sort\n~ Graph colouring"}
              className="min-h-56 w-full flex-1 resize-y rounded-lg border border-input bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus:border-lime-border focus:ring-3 focus:ring-lime-soft"
              aria-label="Topics, one per line"
            />
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Preview · {lines.length}</p>
            {lines.length ? (
              <ul className="space-y-1.5">
                {lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[13px] text-ink shadow-card">
                    <span className={cn("size-2 shrink-0 rounded-full", PRIORITY_MAP[l.priority].fill)} />
                    <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">Topics will appear here as you type.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || lines.length === 0 || lines.length > 100} className="rounded-lg">
            {pending ? <MuSpinner /> : <Plus />} Add {lines.length || ""} {lines.length === 1 ? "topic" : "topics"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
