"use client";

import { useMemo, useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  EyeOff,
  FileImage,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { importSubjects } from "@/lib/actions/admin/catalog";
import { SEMESTERS } from "@/lib/constants";
import type { SubjectOverviewRow } from "@/lib/database.types";
import { suggestIcon } from "@/lib/suggest-icon";
import { recognizeTimetableFile, parseTimetableText, type ExtractedSubject, type DeptOption } from "@/lib/timetable-ocr";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

export type Dept = DeptOption;

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
  const [mode, setMode] = useState<"timetable" | "text">("timetable");

  // --- Text mode state ---
  const [text, setText] = useState("");
  const [sem, setSem] = useState<string>("none");
  const [depts, setDepts] = useState<string[]>([]);

  // --- Timetable mode state ---
  const [timetableFile, setTimetableFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, status: "" });
  const [detectedSem, setDetectedSem] = useState<number | null>(null);
  const [detectedDepts, setDetectedDepts] = useState<string[]>([]);
  const [extractedSubjects, setExtractedSubjects] = useState<ExtractedSubject[]>([]);
  const [showRawText, setShowRawText] = useState(false);
  const [rawOcrText, setRawOcrText] = useState("");
  const [dragging, setDragging] = useState(false);

  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Parsing text lines (mode === "text") ---
  const rows = useMemo(() => parseLines(text, departments, sem === "none" ? null : Number(sem), depts), [text, departments, sem, depts]);
  const validTextRows = rows.filter((r) => !r.error);

  // --- Process Timetable Image / PDF ---
  const processFile = useCallback(
    async (file: File) => {
      setTimetableFile(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
      setScanning(true);
      setScanProgress({ percent: 10, status: "Starting OCR engine…" });
      try {
        const ocrResult = await recognizeTimetableFile(file, (percent, status) => {
          setScanProgress({ percent, status });
        });
        setRawOcrText(ocrResult);
        const result = parseTimetableText(ocrResult, departments);
        setDetectedSem(result.semester);
        setDetectedDepts(result.deptIds);
        setExtractedSubjects(result.subjects);
        if (result.subjects.length > 0) {
          toast.success(`Found ${result.subjects.length} subjects from timetable!`);
        } else {
          toast.info("No standard subject codes were recognized. You can review the raw text or add rows manually.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to scan timetable");
      } finally {
        setScanning(false);
      }
    },
    [departments],
  );

  // Paste image directly into dialog
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const file = Array.from(e.clipboardData?.files ?? []).find(
        (f) => f.type.startsWith("image/") || f.name.toLowerCase().endsWith(".pdf"),
      );
      if (file) {
        e.preventDefault();
        setMode("timetable");
        void processFile(file);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open, processFile]);

  // Timetable row mutations
  const toggleSubject = (id: string) => {
    setExtractedSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));
  };

  const updateSubject = (id: string, patch: Partial<ExtractedSubject>) => {
    setExtractedSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSubject = (id: string) => {
    setExtractedSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  const addSubjectRow = () => {
    setExtractedSubjects((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        code: "",
        name: "",
        semester: detectedSem,
        deptIds: detectedDepts.length ? [...detectedDepts] : [],
        credits: null,
        selected: true,
      },
    ]);
  };

  const selectAll = (value: boolean) => {
    setExtractedSubjects((prev) => prev.map((s) => ({ ...s, selected: value })));
  };

  // Transfer subjects to text format
  const transferToText = () => {
    const chosen = extractedSubjects.filter((s) => s.name.trim());
    if (chosen.length === 0) return;
    const lines = chosen.map((s) => {
      const semVal = s.semester ?? detectedSem ?? 3;
      const deptCodes = (s.deptIds.length ? s.deptIds : detectedDepts)
        .map((id) => departments.find((d) => d.id === id)?.code)
        .filter(Boolean)
        .join(", ");
      return `${s.code ? s.code + " | " : ""}${s.name} | ${semVal} | ${deptCodes || "all"}`;
    });
    setText(lines.join("\n"));
    setMode("text");
    toast.success(`Transferred ${lines.length} subjects to text editor!`);
  };

  const validTimetableSubjects = extractedSubjects.filter(
    (s) => s.selected && s.name.trim().length >= 2 && (s.semester ?? detectedSem) && (s.deptIds.length > 0 || detectedDepts.length > 0),
  );

  const allSelected = extractedSubjects.length > 0 && extractedSubjects.every((s) => s.selected);

  const submit = () =>
    startTransition(async () => {
      if (mode === "text") {
        const result = await importSubjects(
          validTextRows.map((r) => ({
            code: r.code,
            name: r.name,
            semester: r.semester!,
            departmentIds: r.deptIds,
            credits: r.credits,
            icon: suggestIcon(r.name),
          })),
        );
        if (result.ok) {
          toast.success(
            `Added ${result.data?.created ?? 0} subjects${result.data?.skipped ? ` · ${result.data.skipped} already existed` : ""}`,
          );
          setOpen(false);
          setText("");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        // Timetable mode
        const chosen = extractedSubjects.filter((s) => s.selected && s.name.trim().length >= 2);
        if (chosen.length === 0) {
          toast.error("Please select at least one subject to add");
          return;
        }

        const missingSem = chosen.some((s) => !s.semester && !detectedSem);
        if (missingSem) {
          toast.error("Please select a semester for the subjects");
          return;
        }

        const missingBranch = chosen.some((s) => s.deptIds.length === 0 && detectedDepts.length === 0);
        if (missingBranch) {
          toast.error("Please select at least one branch for the subjects");
          return;
        }

        const toImport = chosen.map((s) => ({
          code: s.code ? s.code.trim().toUpperCase() : null,
          name: s.name.trim(),
          semester: s.semester ?? detectedSem!,
          departmentIds: s.deptIds.length ? s.deptIds : detectedDepts,
          credits: s.credits ?? null,
          icon: suggestIcon(s.name),
        }));

        const result = await importSubjects(toImport);
        if (result.ok) {
          toast.success(
            `Added ${result.data?.created ?? 0} subjects${result.data?.skipped ? ` · ${result.data.skipped} already existed` : ""}`,
          );
          setOpen(false);
          setTimetableFile(null);
          setPreviewUrl(null);
          setExtractedSubjects([]);
          setRawOcrText("");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 rounded-lg bg-white">
          <Camera className="text-brand" /> Bulk add from timetable
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col rounded-2xl sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span>Bulk add subjects</span>
          </DialogTitle>
          <DialogDescription>
            Import a whole semester of subjects at once — upload a timetable image or paste text lines.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Switcher Tabs */}
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-muted/80 p-1 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setMode("timetable")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all",
              mode === "timetable" ? "bg-white text-ink shadow-xs" : "text-muted-foreground hover:text-ink",
            )}
          >
            <Camera className={cn("size-4", mode === "timetable" ? "text-brand" : "text-muted-foreground")} />
            Upload timetable (Image / PDF)
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 transition-all",
              mode === "text" ? "bg-white text-ink shadow-xs" : "text-muted-foreground hover:text-ink",
            )}
          >
            <FileText className="size-4" />
            Paste text lines (<code className="text-[11px]">CODE | Name</code>)
          </button>
        </div>

        {/* Content Container (Scrollable) */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {mode === "timetable" ? (
            <div className="space-y-4 pt-1">
              {!timetableFile ? (
                /* Dropzone when no file selected */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = Array.from(e.dataTransfer.files).find(
                      (f) => f.type.startsWith("image/") || f.name.toLowerCase().endsWith(".pdf"),
                    );
                    if (file) void processFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all",
                    dragging
                      ? "border-brand bg-lime-soft/70"
                      : "border-lime-border/70 bg-lime-soft/30 hover:border-brand hover:bg-lime-soft/50",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void processFile(file);
                    }}
                  />
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-card transition-transform group-hover:scale-105">
                    <UploadCloud className="size-7 text-brand" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">Upload your class timetable</h3>
                  <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                    Drop a photo, scan, screenshot, or PDF of your college timetable here. You can also paste directly with{" "}
                    <kbd className="rounded border bg-white px-1.5 py-0.5 font-mono text-[11px] shadow-xs">Ctrl+V</kbd>.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-xs">
                      <Sparkles className="size-3 text-brand" /> Auto-detects Semester &amp; Branch
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-xs">
                      <Check className="size-3 text-brand" /> Extracts Course Codes &amp; Subject Names
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 shadow-xs">
                      <Check className="size-3 text-brand" /> Filters out teachers &amp; division
                    </span>
                  </div>
                </div>
              ) : scanning ? (
                /* Scanning state */
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white p-10 text-center shadow-card">
                  <MuSpinner className="size-8 text-brand" />
                  <p className="mt-4 text-[15px] font-semibold text-ink">{scanProgress.status || "Scanning timetable…"}</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Running browser-based OCR — extracts subjects, semester, and course codes automatically with zero server uploads.
                  </p>
                  <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${Math.max(10, scanProgress.percent)}%` }}
                    />
                  </div>
                </div>
              ) : (
                /* Scanned results & editor */
                <div className="space-y-4">
                  {/* Detected settings banner */}
                  <div className="rounded-xl border border-border bg-white p-4 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                        {previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewUrl} alt="Timetable" className="size-8 rounded object-cover" />
                        ) : (
                          <FileImage className="size-5 text-brand" />
                        )}
                        <span className="max-w-[200px] truncate" title={timetableFile.name}>
                          {timetableFile.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 px-2 text-[12px] text-muted-foreground hover:text-ink"
                        >
                          <RotateCcw className="size-3" /> Change
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={transferToText}
                          className="h-8 rounded-lg text-[12px]"
                          title="Transfer selected subjects to text editor"
                        >
                          <ClipboardPaste className="size-3.5 text-brand" /> Edit as text lines
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground uppercase">
                          Detected Semester
                        </label>
                        <Select
                          value={detectedSem ? String(detectedSem) : "none"}
                          onValueChange={(v) => {
                            const val = v === "none" ? null : Number(v);
                            setDetectedSem(val);
                            setExtractedSubjects((prev) => prev.map((s) => ({ ...s, semester: val })));
                          }}
                        >
                          <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]">
                            <SelectValue placeholder="Pick semester" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Pick semester</SelectItem>
                            {SEMESTERS.map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                Semester {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11.5px] font-semibold text-muted-foreground uppercase">
                          Detected Branch / Department
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {departments.map((d) => {
                            const on = detectedDepts.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                data-active={on}
                                onClick={() => {
                                  const next = on ? detectedDepts.filter((x) => x !== d.id) : [...detectedDepts, d.id];
                                  setDetectedDepts(next);
                                  setExtractedSubjects((prev) => prev.map((s) => ({ ...s, deptIds: next })));
                                }}
                                className="select-tile h-9 px-3 text-[12px] font-semibold"
                              >
                                {d.code}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subjects table */}
                  <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
                    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectAll(!allSelected)}
                          className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink hover:text-brand"
                        >
                          {allSelected ? <CheckSquare className="size-4 text-brand" /> : <Square className="size-4 text-muted-foreground" />}
                          <span>
                            Select all ({validTimetableSubjects.length} of {extractedSubjects.length} selected)
                          </span>
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={addSubjectRow} className="h-7 gap-1 px-2 text-[12px] text-brand">
                        <Plus className="size-3.5" /> Add row
                      </Button>
                    </div>

                    {extractedSubjects.length === 0 ? (
                      <div className="p-8 text-center text-[13px] text-muted-foreground">
                        <p>No subjects were found. Click &quot;Add row&quot; to enter them manually, or review the raw text below.</p>
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-[12.5px]">
                          <thead className="sticky top-0 bg-surface text-muted-foreground">
                            <tr>
                              <th className="w-9 px-3 py-1.5"></th>
                              <th className="w-32 px-3 py-1.5 font-medium">Code</th>
                              <th className="px-3 py-1.5 font-medium">Subject Name</th>
                              <th className="w-20 px-3 py-1.5 font-medium">Sem</th>
                              <th className="w-24 px-3 py-1.5 font-medium">Branch</th>
                              <th className="w-10 px-2 py-1.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedSubjects.map((s) => (
                              <tr
                                key={s.id}
                                className={cn(
                                  "border-t border-border transition-colors hover:bg-surface/50",
                                  !s.selected && "opacity-50",
                                )}
                              >
                                <td className="px-3 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={s.selected}
                                    onChange={() => toggleSubject(s.id)}
                                    className="size-4 accent-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    value={s.code ?? ""}
                                    onChange={(e) => updateSubject(s.id, { code: e.target.value.toUpperCase() })}
                                    placeholder="CST201"
                                    className="h-8 font-mono text-[12px]"
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    value={s.name}
                                    onChange={(e) => updateSubject(s.id, { name: e.target.value })}
                                    placeholder="Subject name"
                                    className="h-8 text-[12.5px] font-medium"
                                  />
                                </td>
                                <td className="px-3 py-1.5 font-semibold text-ink">
                                  {s.semester ? `S${s.semester}` : detectedSem ? `S${detectedSem}` : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {(s.deptIds.length ? s.deptIds : detectedDepts)
                                    .map((id) => departments.find((d) => d.id === id)?.code)
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeSubject(s.id)}
                                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                    title="Remove row"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Raw OCR text toggle */}
                  {rawOcrText ? (
                    <div className="rounded-xl border border-border bg-white p-3">
                      <button
                        type="button"
                        onClick={() => setShowRawText(!showRawText)}
                        className="flex w-full items-center justify-between text-[12px] font-medium text-muted-foreground hover:text-ink"
                      >
                        <span>View raw recognized text ({rawOcrText.split("\n").length} lines)</span>
                        <ChevronDown className={cn("size-4 transition-transform", showRawText && "rotate-180")} />
                      </button>
                      {showRawText ? (
                        <Textarea
                          readOnly
                          value={rawOcrText}
                          className="mt-2 h-36 rounded-lg font-mono text-[11.5px]"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            /* Mode === "text" (Manual Paste Lines) */
            <div className="space-y-4 pt-1">
              <div className="grid gap-4 md:grid-cols-[1fr_230px]">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    "CST201 | Data Structures | 3 | cse, ai-ds | 4\nCST203 | Logic System Design | 3 | cse\nMAT203 | Discrete Mathematical Structures | 3 | cse\nProfessional Ethics | 3 | all"
                  }
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
                            {r.error ? (
                              <span className="font-medium text-red-700">{r.error}</span>
                            ) : (
                              departments
                                .filter((d) => r.deptIds.includes(d.id))
                                .map((d) => d.code)
                                .join(", ")
                            )}
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
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="mt-2 flex shrink-0 items-center justify-between border-t border-border pt-3">
          <div className="text-[12.5px] text-muted-foreground">
            {mode === "timetable" ? (
              <span>
                Ready to import <strong className="text-ink">{validTimetableSubjects.length}</strong> subjects
                {detectedSem ? ` into Semester ${detectedSem}` : ""}
              </span>
            ) : (
              <span>
                <strong className="text-ink">{validTextRows.length}</strong> valid rows ready
              </span>
            )}
          </div>
          <Button
            onClick={submit}
            disabled={
              (mode === "timetable" ? validTimetableSubjects.length === 0 : validTextRows.length === 0) ||
              pending ||
              scanning
            }
            className="h-10 rounded-lg px-5"
          >
            {pending ? <MuSpinner /> : <Upload />} Add{" "}
            {mode === "timetable" ? validTimetableSubjects.length || "" : validTextRows.length || ""} subjects
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
