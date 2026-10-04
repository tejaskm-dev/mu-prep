"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteSubject, saveSubject } from "@/lib/actions/admin/catalog";
import { SEMESTERS } from "@/lib/constants";
import type { SubjectModule } from "@/lib/database.types";
import { suggestIcon } from "@/lib/suggest-icon";
import { cn } from "@/lib/utils";
import { IconPicker } from "./icon-picker";
import { MuSpinner } from "@/components/brand/mu-loader";

export type SubjectFormValue = {
  id: string | null;
  name: string;
  shortName: string;
  code: string;
  semester: number;
  credits: number | null;
  icon: string;
  description: string;
  keywords: string[];
  modules: SubjectModule[];
  departmentIds: string[];
  isActive: boolean;
  resourceCount: number;
  slug: string | null;
};

export function SubjectForm({ initial, departments }: { initial: SubjectFormValue; departments: { id: string; code: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [keyword, setKeyword] = useState("");
  const [pending, startTransition] = useTransition();
  const [iconTouched, setIconTouched] = useState(Boolean(initial.id));
  const set = <K extends keyof SubjectFormValue>(k: K, value: SubjectFormValue[K]) => setV((s) => ({ ...s, [k]: value }));
  const allDepts = departments.length > 0 && departments.every((d) => v.departmentIds.includes(d.id));

  const save = () =>
    startTransition(async () => {
      const result = await saveSubject(v.id, {
        name: v.name,
        shortName: v.shortName || null,
        code: v.code || null,
        semester: v.semester,
        description: v.description || null,
        icon: v.icon,
        credits: v.credits,
        modules: v.modules.map((m, i) => ({ n: i + 1, title: m.title.trim() })).filter((m) => m.title),
        keywords: v.keywords,
        isActive: v.isActive,
        departmentIds: v.departmentIds,
        slug: v.slug,
      });
      if (result.ok) {
        toast.success(v.id ? "Subject saved" : "Subject created");
        if (!v.id && result.data) router.replace(`/admin/subjects/${result.data.id}`);
        else router.refresh();
      } else toast.error(result.error);
    });

  const addKeyword = () => {
    const k = keyword.trim().toLowerCase();
    if (k && !v.keywords.includes(k)) set("keywords", [...v.keywords, k]);
    setKeyword("");
  };

  const moveModule = (i: number, dir: -1 | 1) => {
    const next = [...v.modules];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("modules", next);
  };

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Subject name *">
              <Input
                value={v.name}
                onChange={(e) => {
                  setV((s) => ({ ...s, name: e.target.value, icon: iconTouched ? s.icon : suggestIcon(e.target.value) }));
                }}
                placeholder="e.g. Data Structures"
                className="h-10 rounded-lg text-[15px] font-medium"
              />
            </Field>
            <Field label="Course code">
              <Input value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="CST201" className="h-10 rounded-lg font-mono" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px_120px]">
            <Field label="Short name (chips & breadcrumbs)">
              <Input value={v.shortName} onChange={(e) => set("shortName", e.target.value)} placeholder="e.g. DS" className="h-10 rounded-lg" />
            </Field>
            <Field label="Semester *">
              <Select value={String(v.semester)} onValueChange={(s) => set("semester", Number(s))}>
                <SelectTrigger className="h-10! w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Semester {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Credits">
              <Input type="number" min={0} max={20} value={v.credits ?? ""} onChange={(e) => set("credits", e.target.value === "" ? null : Number(e.target.value))} className="h-10 rounded-lg" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="One or two lines shown on the subject page" className="min-h-20 rounded-lg" />
          </Field>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Modules</h2>
              <p className="text-[12.5px] text-muted-foreground">Shown on the subject and syllabus pages; files can be filtered by module.</p>
            </div>
            <Button variant="outline" size="sm" className="bg-white" onClick={() => set("modules", [...v.modules, { n: v.modules.length + 1, title: "" }])} disabled={v.modules.length >= 12}>
              <Plus /> Add module
            </Button>
          </div>
          {v.modules.length === 0 ? (
            <button
              type="button"
              onClick={() => set("modules", [1, 2, 3, 4, 5].map((n) => ({ n, title: "" })))}
              className="w-full rounded-lg border border-dashed border-border py-6 text-[13px] text-muted-foreground hover:border-lime-border hover:text-ink"
            >
              Add the usual 5 modules
            </button>
          ) : (
            <ol className="space-y-2">
              {v.modules.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-[12px] font-bold text-ink/70">{i + 1}</span>
                  <Input
                    value={m.title}
                    onChange={(e) => set("modules", v.modules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder={`Module ${i + 1} title`}
                    className="h-9 rounded-lg"
                  />
                  <button type="button" onClick={() => moveModule(i, -1)} disabled={i === 0} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => moveModule(i, 1)} disabled={i === v.modules.length - 1} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => set("modules", v.modules.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove module">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-semibold text-ink">Search aliases</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Nicknames students type (e.g. “ds”, “dbms”, “maths 1”). They improve search and auto-detection of uploaded files.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {v.keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-full bg-lime-soft py-1 pr-1.5 pl-3 text-[12.5px] font-medium text-accent-foreground">
                {k}
                <button type="button" onClick={() => set("keywords", v.keywords.filter((x) => x !== k))} className="rounded-full p-0.5 hover:bg-white/60" aria-label={`Remove ${k}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              onBlur={addKeyword}
              placeholder="Type and press Enter"
              className="h-7 min-w-[160px] flex-1 rounded-md px-2 text-[13px] outline-none"
            />
          </div>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-6">
        <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-card">
          <Field label="Icon">
            <div className="flex items-center gap-2">
              <IconPicker
                value={v.icon}
                onChange={(icon) => {
                  setIconTouched(true);
                  set("icon", icon);
                }}
              />
              {iconTouched ? (
                <Button variant="ghost" size="sm" onClick={() => { setIconTouched(false); set("icon", suggestIcon(v.name)); }} title="Suggest from name">
                  <Wand2 />
                </Button>
              ) : null}
            </div>
          </Field>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-[13px]">Departments *</Label>
              <button
                type="button"
                className="text-[12px] font-medium text-brand hover:underline"
                onClick={() => set("departmentIds", allDepts ? [] : departments.map((d) => d.id))}
              >
                {allDepts ? "Clear" : "All branches"}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {departments.map((d) => {
                const on = v.departmentIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    title={d.name}
                    data-active={on}
                    onClick={() => set("departmentIds", on ? v.departmentIds.filter((x) => x !== d.id) : [...v.departmentIds, d.id])}
                    className="select-tile h-9 text-[12.5px] font-semibold text-ink"
                  >
                    {d.code}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-[13.5px]">
            <span>
              <span className="block font-medium text-ink">Visible on site</span>
              <span className="text-[12px] text-muted-foreground">Hidden subjects keep their files hidden too.</span>
            </span>
            <Switch checked={v.isActive} onCheckedChange={(c) => set("isActive", c)} />
          </label>
          <Button onClick={save} disabled={pending || v.name.trim().length < 2 || v.departmentIds.length === 0} className="h-10 w-full rounded-lg">
            {pending ? <MuSpinner /> : <Save />} {v.id ? "Save subject" : "Create subject"}
          </Button>
        </section>
        {v.id ? (
          <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 className="text-[14px] font-semibold text-ink">Danger zone</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {v.resourceCount ? `This subject has ${v.resourceCount} files — move or delete them first, or just hide the subject.` : "No files use this subject."}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className={cn("mt-3 text-destructive hover:bg-destructive/10")} disabled={v.resourceCount > 0}>
                  <Trash2 /> Delete subject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {v.name}?</AlertDialogTitle>
                  <AlertDialogDescription>Requests linked to it are removed as well.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={async () => {
                      const r = await deleteSubject(v.id!);
                      if (r.ok) {
                        toast.success("Subject deleted");
                        router.push("/admin/subjects");
                      } else toast.error(r.error);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        ) : null}
      </aside>
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
