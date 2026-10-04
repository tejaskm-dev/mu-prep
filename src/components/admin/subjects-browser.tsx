"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardPaste, EyeOff, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { importSubjects } from "@/lib/actions/admin/catalog";
import { SEMESTERS } from "@/lib/constants";
import type { SubjectOverviewRow } from "@/lib/database.types";
import { suggestIcon } from "@/lib/suggest-icon";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

type Dept = { id: string; slug: string; code: string };

export function SubjectsBrowser({ subjects, departments }: { subjects: SubjectOverviewRow[]; departments: Dept[] }) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [sem, setSem] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return subjects.filter(
      (s) =>
        (dept === "all" || s.department_slugs.includes(dept)) &&
        (sem === "all" || String(s.semester) === sem) &&
        (!query || `${s.name} ${s.code ?? ""} ${s.short_name ?? ""} ${s.keywords.join(" ")}`.toLowerCase().includes(query)),
    );
  }, [subjects, q, dept, sem]);

  const bySemester = SEMESTERS.map((n) => ({ n, items: filtered.filter((s) => s.semester === n) })).filter((g) => g.items.length);
  const allDeptCount = departments.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code or alias…"
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 text-sm outline-none focus:border-lime-border focus:ring-3 focus:ring-lime-soft"
          />
        </label>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="h-10! w-[150px] rounded-lg bg-white" aria-label="Department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.slug}>
                {d.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sem} onValueChange={setSem}>
          <SelectTrigger className="h-10! w-[140px] rounded-lg bg-white" aria-label="Semester">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All semesters</SelectItem>
            {SEMESTERS.map((s) => (
              <SelectItem key={s} value={String(s)}>
                Semester {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {bySemester.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No subjects match. Add one, or bulk-add a whole semester.</p>
      ) : (
        <div className="mt-5 space-y-6">
          {bySemester.map((g) => (
            <section key={g.n}>
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Semester {g.n} <span className="font-normal normal-case">· {g.items.length}</span>
              </h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
                <ul className="divide-y divide-border">
                  {g.items.map((s) => {
                    const modules = Array.isArray(s.modules) ? s.modules.length : 0;
                    const branches = s.department_slugs.length === allDeptCount && allDeptCount > 0 ? "All branches" : departments.filter((d) => s.department_slugs.includes(d.slug)).map((d) => d.code).join(" · ");
                    return (
                      <li key={s.id}>
                        <Link href={`/admin/subjects/${s.id}`} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-surface", !s.is_active && "opacity-60")}>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-soft text-brand">
                            <DynamicIcon name={s.icon} className="size-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-medium text-ink">{s.name}</span>
                              {s.code ? <span className="font-mono text-[11.5px] text-muted-foreground">{s.code}</span> : null}
                              {!s.is_active ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                                  <EyeOff className="size-3" /> Hidden
                                </span>
                              ) : null}
                            </span>
                            <span className="block truncate text-[12px] text-muted-foreground">
                              {branches || "No branches"} · {modules ? `${modules} modules` : "no modules"}
                              {s.keywords.length ? ` · aliases: ${s.keywords.slice(0, 4).join(", ")}` : ""}
                            </span>
                          </span>
                          <span className="text-right text-[12.5px] text-muted-foreground tabular-nums">
                            <span className="block font-semibold text-ink">{s.resource_count}</span> files
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type ParsedRow = { code: string | null; name: string; semester: number | null; deptIds: string[]; credits: number | null; error?: string };

function parseLines(text: string, departments: Dept[], fallbackSem: number | null, fallbackDepts: string[]): ParsedRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = (line.includes("|") ? line.split("|") : line.includes("\t") ? line.split("\t") : line.split(",")).map((p) => p.trim());
      let code: string | null = null;
      let rest = parts;
      if (/^[A-Za-z]{2,7}\s?\d{3}[A-Za-z]?$/.test(parts[0] ?? "")) {
        code = parts[0].replace(/\s/g, "").toUpperCase();
        rest = parts.slice(1);
      }
      const name = rest[0] ?? "";
      const semMatch = (rest[1] ?? "").match(/[1-8]/);
      const semester = semMatch ? Number(semMatch[0]) : fallbackSem;
      const deptText = (rest[2] ?? "").toLowerCase();
      let deptIds = fallbackDepts;
      if (deptText) {
        deptIds = deptText === "all" ? departments.map((d) => d.id) : departments.filter((d) => deptText.split(/[\s,/;+]+/).some((t) => t && (t === d.slug || t === d.code.toLowerCase().replace(/\s/g, "")))).map((d) => d.id);
      }
      const credits = rest[3] && /^\d+$/.test(rest[3]) ? Number(rest[3]) : null;
      const error = name.length < 2 ? "Missing name" : !semester ? "Missing semester" : deptIds.length === 0 ? "No branch" : undefined;
      return { code, name, semester, deptIds, credits, error };
    });
}

export function BulkAddSubjects({ departments }: { departments: Dept[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sem, setSem] = useState<string>("none");
  const [depts, setDepts] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const rows = useMemo(() => parseLines(text, departments, sem === "none" ? null : Number(sem), depts), [text, departments, sem, depts]);
  const valid = rows.filter((r) => !r.error);

  const submit = () =>
    startTransition(async () => {
      const result = await importSubjects(
        valid.map((r) => ({ code: r.code, name: r.name, semester: r.semester!, departmentIds: r.deptIds, credits: r.credits, icon: suggestIcon(r.name) })),
      );
      if (result.ok) {
        toast.success(`Added ${result.data?.created ?? 0} subjects${result.data?.skipped ? ` · ${result.data.skipped} already existed` : ""}`);
        setOpen(false);
        setText("");
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 rounded-lg bg-white">
          <ClipboardPaste /> Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk add subjects</DialogTitle>
          <DialogDescription>
            Paste one subject per line — straight from the university syllabus or a spreadsheet. Format:{" "}
            <code className="rounded bg-muted px-1">CODE | Name | Semester | Branches | Credits</code> (code, branches and credits are optional;
            commas and tabs work too). Icons are picked automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_230px]">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"CST201 | Data Structures | 3 | cse, ai-ds | 4\nCST203 | Logic System Design | 3 | cse\nMAT203 | Discrete Mathematical Structures | 3 | cse\nProfessional Ethics | 3 | all"}
            className="min-h-56 rounded-lg font-mono text-[12.5px]"
          />
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground uppercase">Default semester</p>
              <Select value={sem} onValueChange={setSem}>
                <SelectTrigger className="h-9! w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">From each line</SelectItem>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Semester {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-muted-foreground uppercase">Default branches</p>
              <div className="grid grid-cols-3 gap-1.5">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    data-active={depts.includes(d.id)}
                    onClick={() => setDepts((x) => (x.includes(d.id) ? x.filter((y) => y !== d.id) : [...x, d.id]))}
                    className="select-tile h-8 text-[12px] font-semibold"
                  >
                    {d.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {rows.length ? (
          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Code</th>
                  <th className="px-3 py-1.5 font-medium">Name</th>
                  <th className="px-3 py-1.5 font-medium">Sem</th>
                  <th className="px-3 py-1.5 font-medium">Branches</th>
                  <th className="px-3 py-1.5 font-medium">Icon</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cn("border-t border-border", r.error && "bg-red-50")}>
                    <td className="px-3 py-1.5 font-mono">{r.code ?? "—"}</td>
                    <td className="px-3 py-1.5">{r.name || "—"}</td>
                    <td className="px-3 py-1.5">{r.semester ? `S${r.semester}` : "—"}</td>
                    <td className="px-3 py-1.5">
                      {r.error ? <span className="font-medium text-red-700">{r.error}</span> : departments.filter((d) => r.deptIds.includes(d.id)).map((d) => d.code).join(", ")}
                    </td>
                    <td className="px-3 py-1.5">
                      <DynamicIcon name={suggestIcon(r.name)} className="size-4 text-brand" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <DialogFooter>
          <Button onClick={submit} disabled={!valid.length || pending} className="h-10 rounded-lg px-5">
            {pending ? <MuSpinner /> : <Upload />} Add {valid.length || ""} subjects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
