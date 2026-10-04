"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, ImagePlus, Sparkles, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitContribution } from "@/lib/actions/public";
import { usePrefs } from "@/lib/client-prefs";
import { RESOURCE_TAGS, RESOURCE_TYPES, SEMESTERS } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { formatBytes } from "@/lib/format";
import { analyzePdf, blobToDataUrl, imagesToPdf, imageThumbnail, sha256 } from "@/lib/pdf";
import { matchSubject, mergeDetected, parseDocumentText, parseFilename, type SubjectLite } from "@/lib/smart-detect";
import { uploadFiles } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

type Picked = { id: string; file: File; pageCount: number | null; thumbnail: Blob | null };

const MAX_FILES = 5;
const ACCEPT = ".pdf,image/*,.doc,.docx,.ppt,.pptx";

export function ContributeForm({ subjects, departments }: { subjects: SubjectLite[]; departments: { slug: string; code: string }[] }) {
  const prefs = usePrefs();
  const [files, setFiles] = useState<Picked[]>([]);
  const [dept, setDept] = useState<string>("all");
  const [sem, setSem] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const prefilled = useRef(false);

  // The page is static: prefill from ?subject= or the visitor's saved class once in the browser.
  useEffect(() => {
    if (prefilled.current || !prefs.known) return;
    prefilled.current = true;
    const fromUrl = subjects.find((s) => s.id === new URLSearchParams(window.location.search).get("subject"));
    if (fromUrl) {
      setSubjectId(fromUrl.id);
      setSem(String(fromUrl.semester));
      setDept(prefs.department && fromUrl.department_slugs.includes(prefs.department) ? prefs.department : (fromUrl.department_slugs[0] ?? "all"));
    } else {
      if (prefs.department) setDept(prefs.department);
      if (prefs.semester) setSem(String(prefs.semester));
    }
  }, [prefs.known, prefs.department, prefs.semester, subjects]);
  const [type, setType] = useState<ResourceType>("notes");
  const [module, setModule] = useState<string>("full");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [examSession, setExamSession] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"idle" | "preparing" | "uploading" | "saving" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleTouched = useRef(false);

  const subjectOptions = useMemo(
    () =>
      subjects
        .filter((s) => (dept === "all" || s.department_slugs.includes(dept)) && (!sem || String(s.semester) === sem))
        .sort((a, b) => a.semester - b.semester || a.name.localeCompare(b.name)),
    [subjects, dept, sem],
  );
  const images = files.filter((f) => f.file.type.startsWith("image/"));

  async function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).slice(0, MAX_FILES - files.length);
    if (list.length > incoming.length) toast.message(`Up to ${MAX_FILES} files per submission`);
    for (const file of incoming) {
      if (file.size > 32 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 32 MB`);
        continue;
      }
      const picked: Picked = { id: crypto.randomUUID(), file, pageCount: null, thumbnail: null };
      setFiles((prev) => [...prev, picked]);

      // Smart prefill from the first file
      let detected = parseFilename(file.name);
      if (file.type === "application/pdf") {
        try {
          const info = await analyzePdf(file, 480);
          picked.pageCount = info.pageCount;
          picked.thumbnail = info.thumbnail;
          detected = mergeDetected(detected, parseDocumentText(info.text));
        } catch {
          // unreadable PDF — still uploadable
        }
      } else if (file.type.startsWith("image/")) {
        picked.thumbnail = await imageThumbnail(file, 480);
      }
      setFiles((prev) => prev.map((p) => (p.id === picked.id ? { ...picked } : p)));

      if (files.length === 0 && file === incoming[0]) {
        if (!titleTouched.current) setTitle(detected.title);
        if (detected.type) setType(detected.type);
        if (detected.module) setModule(String(detected.module));
        if (detected.examSession) setExamSession(detected.examSession);
        if (detected.tags.length) setTags(detected.tags);
        if (!subjectId) {
          const match = matchSubject({ text: file.name.replace(/\.[^.]+$/, ""), codes: detected.codes, courseName: detected.courseName, semester: detected.semester }, subjects, {
            department: dept === "all" ? null : dept,
            semester: Number(sem) || null,
          });
          if (match) {
            const s = subjects.find((x) => x.id === match.subjectId)!;
            setSubjectId(s.id);
            setSem(String(s.semester));
            if (dept !== "all" && !s.department_slugs.includes(dept)) setDept("all");
            setHint(`We guessed ${s.name} (${match.reason.toLowerCase()}). Change it if that's wrong.`);
          }
        }
      }
    }
  }

  async function mergeImages() {
    if (images.length < 2) return;
    setStage("preparing");
    try {
      const pdf = await imagesToPdf(images.map((i) => i.file), `${(title || "handwritten-notes").replace(/[^\w-]+/g, "-")}.pdf`);
      const info = await analyzePdf(pdf, 480).catch(() => null);
      setFiles((prev) => [
        ...prev.filter((p) => !p.file.type.startsWith("image/")),
        { id: crypto.randomUUID(), file: pdf, pageCount: info?.pageCount ?? images.length, thumbnail: info?.thumbnail ?? null },
      ]);
      if (!tags.includes("handwritten")) setTags((t) => [...t, "handwritten"]);
      toast.success(`Combined ${images.length} photos into one PDF (${formatBytes(pdf.size)})`);
    } catch {
      toast.error("Couldn't combine the photos — you can still upload them separately.");
    } finally {
      setStage("idle");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return toast.error("Add at least one file");
    if (!subjectId) return toast.error("Pick the subject");
    if (title.trim().length < 3) return toast.error("Add a short title");
    if (!consent) return toast.error("Please confirm you're allowed to share these files");

    try {
      setStage("uploading");
      setProgress(0);
      const hashes = await Promise.all(files.map((f) => sha256(f.file).catch(() => undefined)));
      const uploaded = await uploadFiles("contribution", {
        files: files.map((f) => f.file),
        onUploadProgress: ({ totalProgress }) => setProgress(totalProgress),
      });
      setStage("saving");
      const thumbs = await Promise.all(files.map((f) => (f.thumbnail ? blobToDataUrl(f.thumbnail) : Promise.resolve(null))));
      const result = await submitContribution({
        subjectId,
        type,
        module: module === "full" ? null : Number(module),
        title: title.trim(),
        description: description.trim() || undefined,
        examSession: type === "pyq" ? examSession.trim() || undefined : undefined,
        examYear: type === "pyq" ? Number(examSession.match(/20\d{2}/)?.[0]) || null : null,
        tags: tags as never,
        name: name.trim() || undefined,
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
        consent: true,
        files: uploaded.map((u, i) => ({
          key: u.key,
          url: u.ufsUrl,
          name: u.name,
          size: u.size,
          type: u.type || files[i].file.type,
          hash: hashes[i],
          pageCount: files[i].pageCount,
          thumbnail: thumbs[i],
        })),
      });
      if (!result.ok) throw new Error(result.error);
      setStage("done");
    } catch (error) {
      setStage("idle");
      toast.error(error instanceof Error ? error.message : "Upload failed — please try again.");
    }
  }

  if (stage === "done") {
    return (
      <div className="rounded-2xl border border-border bg-white p-10 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-12 text-brand" />
        <h2 className="mt-4 text-[24px] font-extrabold tracking-[-0.02em] text-ink">Thank you!</h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          Your files are with the µLearn team for a quick review. Once approved they&apos;ll appear on the subject page for everyone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()} variant="outline" className="h-10 rounded-lg bg-white px-4">
            Share more
          </Button>
          <Button asChild className="h-10 rounded-lg px-4">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const busy = stage !== "idle";

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {/* Files */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[16px] font-semibold text-ink">1. Your files</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">PDF, photos, Word or PowerPoint · up to {MAX_FILES} files, 32 MB each</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void addFiles(e.dataTransfer.files);
            }}
            disabled={files.length >= MAX_FILES || busy}
            className={cn(
              "mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-lime-border/70 bg-lime-soft/40 px-6 py-10 text-center transition-colors hover:bg-lime-soft disabled:opacity-60",
              dragging && "border-brand bg-lime-soft",
            )}
          >
            <UploadCloud className="size-9 text-brand" strokeWidth={1.6} />
            <span className="text-[15px] font-semibold text-ink">Drop files here or browse</span>
            <span className="text-[13px] text-muted-foreground">Photos of handwritten pages can be combined into one PDF</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {files.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {files.map((f) => (
                <FileItem key={f.id} picked={f} onRemove={() => setFiles((prev) => prev.filter((p) => p.id !== f.id))} disabled={busy} />
              ))}
            </ul>
          ) : null}
          {images.length >= 2 ? (
            <button
              type="button"
              onClick={mergeImages}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-medium text-white hover:bg-ink/85"
            >
              <ImagePlus className="size-4 text-lime" /> Combine {images.length} photos into one PDF
            </button>
          ) : null}
        </section>

        {/* Details */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[16px] font-semibold text-ink">2. What is it?</h2>
          {hint ? (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-lime-soft px-3 py-2 text-[13px] text-accent-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0" /> {hint}
            </p>
          ) : null}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Branch">
              <Select value={dept} onValueChange={(v) => { setDept(v); setSubjectId(""); }}>
                <SelectTrigger className="h-10! w-full rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any branch</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.slug} value={d.slug}>{d.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Semester">
              <Select value={sem || "any"} onValueChange={(v) => { setSem(v === "any" ? "" : v); setSubjectId(""); }}>
                <SelectTrigger className="h-10! w-full rounded-lg"><SelectValue placeholder="Semester" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any semester</SelectItem>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Subject *">
              <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setHint(null); }}>
                <SelectTrigger className="h-10! w-full rounded-lg"><SelectValue placeholder="Choose subject" /></SelectTrigger>
                <SelectContent>
                  {subjectOptions.length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">No subjects for this filter</div> : null}
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>S{s.semester} · {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-5">
            <Label className="mb-2 block text-[13px]">Type</Label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.map((t) => (
                <button key={t.value} type="button" data-active={type === t.value} onClick={() => setType(t.value)} className="chip h-9">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Title *">
              <Input
                value={title}
                onChange={(e) => {
                  titleTouched.current = true;
                  setTitle(e.target.value);
                }}
                placeholder="e.g. Module 2 — Matrices (handwritten)"
                maxLength={160}
                className="h-10 rounded-lg"
              />
            </Field>
            {type === "pyq" ? (
              <Field label="Exam session">
                <Input value={examSession} onChange={(e) => setExamSession(e.target.value)} placeholder="December 2023" className="h-10 rounded-lg" />
              </Field>
            ) : (
              <Field label="Module">
                <Select value={module} onValueChange={setModule}>
                  <SelectTrigger className="h-10! w-full rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">All modules</SelectItem>
                    {[1, 2, 3, 4, 5, 6].map((m) => (
                      <SelectItem key={m} value={String(m)}>Module {m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>

          <div className="mt-5">
            <Label className="mb-2 block text-[13px]">Tags</Label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  data-active={tags.includes(t.value)}
                  onClick={() => setTags((prev) => (prev.includes(t.value) ? prev.filter((x) => x !== t.value) : [...prev, t.value]))}
                  className="chip h-8"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <Field label="Description (optional)">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Which topics does it cover? Anything students should know?" className="min-h-20 rounded-lg" />
            </Field>
          </div>
        </section>
      </div>

      {/* Sidebar */}
      <aside className="space-y-6 lg:sticky lg:top-6">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <h2 className="text-[16px] font-semibold text-ink">3. About you</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Optional — we&apos;ll credit you on the file.</p>
          <div className="mt-4 space-y-3">
            <Field label="Name to credit">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Anagha S, CSE '27" className="h-10 rounded-lg" />
            </Field>
            <Field label="Contact (only admins see this)">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} placeholder="Email or phone" className="h-10 rounded-lg" />
            </Field>
            <Field label="Note to the team">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-16 rounded-lg" />
            </Field>
          </div>
          <label className="mt-4 flex items-start gap-2.5 text-[13px] text-foreground/80">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
            These are my notes or freely shareable material, and I&apos;m happy for students to use them.
          </label>
          <Button type="submit" disabled={busy} className="mt-5 h-11 w-full rounded-lg text-[15px]">
            {busy ? <MuSpinner /> : <UploadCloud />}
            {stage === "preparing" ? "Preparing…" : stage === "uploading" ? `Uploading ${Math.round(progress)}%` : stage === "saving" ? "Submitting…" : "Submit for review"}
          </Button>
          {stage === "uploading" ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </section>
        <p className="px-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Every submission is checked by an admin before it goes live. Please don&apos;t upload copyrighted textbooks or anything you&apos;re not
          allowed to share.
        </p>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-[13px]">{label}</Label>
      {children}
    </div>
  );
}

function FileItem({ picked, onRemove, disabled }: { picked: Picked; onRemove: () => void; disabled: boolean }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!picked.thumbnail) return;
    const url = URL.createObjectURL(picked.thumbnail);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [picked.thumbnail]);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
      <span className="flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        {thumb ? <img src={thumb} alt="" className="size-full object-cover object-top" /> : <FileText className="size-5 text-muted-foreground" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink">{picked.file.name}</span>
        <span className="block text-[12px] text-muted-foreground">
          {formatBytes(picked.file.size)}
          {picked.pageCount ? ` · ${picked.pageCount} pages` : ""}
        </span>
      </span>
      <button type="button" onClick={onRemove} disabled={disabled} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink" aria-label={`Remove ${picked.file.name}`}>
        <X className="size-4" />
      </button>
    </li>
  );
}
