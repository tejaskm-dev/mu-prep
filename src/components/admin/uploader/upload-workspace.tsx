"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CloudUpload, Link2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createResources, findDuplicates } from "@/lib/actions/admin/resources";
import { deleteOrphans } from "@/lib/actions/admin/site";
import { ACCEPTED_FILE_TYPES, RESOURCE_TAGS, RESOURCE_TYPES, SEMESTERS } from "@/lib/constants";
import type { ResourceType } from "@/lib/database.types";
import { analyzePdf, imageThumbnail, imagesToPdf, sha256 } from "@/lib/pdf";
import { matchSubject, mergeDetected, parseDocumentText, parseFilename, refineTitle, type Detected } from "@/lib/smart-detect";
import { uploadFiles } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { SubjectCombobox, type SubjectOption } from "../subject-combobox";
import { EMPTY_DEFAULTS, type BatchDefaults, type ItemMeta, type UploadItem } from "./types";
import { UploadRow } from "./upload-row";
import { MuSpinner } from "@/components/brand/mu-loader";

const STORAGE_KEY = "muprep:admin-upload";
const UPLOAD_CONCURRENCY = 3;
const ANALYSIS_CONCURRENCY = 2;

type Action =
  | { type: "add"; items: UploadItem[] }
  | { type: "patch"; id: string; patch: Partial<UploadItem> }
  | { type: "thumb"; id: string; thumb: Partial<UploadItem["thumb"]> }
  | { type: "meta"; id: string; meta: Partial<ItemMeta> }
  | { type: "detect"; id: string; meta: Partial<ItemMeta>; detection: UploadItem["detection"] }
  | { type: "remove"; ids: string[] }
  | { type: "select"; ids: string[] | "all"; value: boolean }
  | { type: "bulkMeta"; ids: string[]; meta: Partial<ItemMeta> }
  | { type: "published"; map: Record<string, string> }
  | { type: "clearPublished" }
  | { type: "restore"; items: UploadItem[] };

function reducer(state: UploadItem[], action: Action): UploadItem[] {
  switch (action.type) {
    case "add":
      return [...state, ...action.items];
    case "restore":
      return [...action.items, ...state.filter((i) => !action.items.some((r) => r.id === i.id))];
    case "patch":
      return state.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i));
    case "thumb":
      return state.map((i) => (i.id === action.id ? { ...i, thumb: { ...i.thumb, ...action.thumb } } : i));
    case "meta":
      return state.map((i) =>
        i.id === action.id
          ? { ...i, meta: { ...i.meta, ...action.meta }, touched: [...new Set([...i.touched, ...(Object.keys(action.meta) as (keyof ItemMeta)[])])] }
          : i,
      );
    case "detect":
      return state.map((i) => {
        if (i.id !== action.id) return i;
        const meta = { ...i.meta };
        for (const [k, v] of Object.entries(action.meta) as [keyof ItemMeta, never][]) {
          if (!i.touched.includes(k)) meta[k] = v;
        }
        return { ...i, meta, detection: action.detection };
      });
    case "remove":
      return state.filter((i) => !action.ids.includes(i.id));
    case "select":
      return state.map((i) => (action.ids === "all" || action.ids.includes(i.id) ? { ...i, selected: i.status === "published" ? false : action.value } : i));
    case "bulkMeta":
      return state.map((i) =>
        action.ids.includes(i.id)
          ? { ...i, meta: { ...i.meta, ...action.meta }, touched: [...new Set([...i.touched, ...(Object.keys(action.meta) as (keyof ItemMeta)[])])] }
          : i,
      );
    case "published":
      return state.map((i) => (action.map[i.id] ? { ...i, status: "published", resourceId: action.map[i.id], selected: false } : i));
    case "clearPublished":
      return state.filter((i) => i.status !== "published");
  }
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/status 503|not configured/i.test(msg)) return "Uploads aren't configured (UPLOADTHING_TOKEN)";
  if (/status 40[13]|forbidden|admins only/i.test(msg)) return "Not allowed — sign in again";
  if (/too large|file size|exceed/i.test(msg)) return "File is too large";
  if (/network|fetch/i.test(msg)) return "Network problem — retry";
  return "Upload failed — retry";
}

export function UploadWorkspace({
  subjects,
  departments,
  initialSubjectId,
}: {
  subjects: SubjectOption[];
  departments: { slug: string; code: string }[];
  initialSubjectId: string | null;
}) {
  const [items, dispatch] = useReducer(reducer, []);
  const [defaults, setDefaults] = useState<BatchDefaults>(() => {
    const subject = subjects.find((s) => s.id === initialSubjectId);
    return subject ? { ...EMPTY_DEFAULTS, subjectId: subject.id, semester: subject.semester } : EMPTY_DEFAULTS;
  });
  const [publishing, setPublishing] = useState(false);
  const [restoredCount, setRestoredCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const itemsRef = useRef(items);
  const defaultsRef = useRef(defaults);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const started = useRef(new Set<string>());
  const analysisQueue = useRef<string[]>([]);
  const analyzingCount = useRef(0);
  const pendingHashes = useRef(new Map<string, string>());
  const seenHashes = useRef(new Map<string, { id: string; name: string }>());
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    itemsRef.current = items;
    defaultsRef.current = defaults;
  });

  const context = { department: defaults.department, semester: defaults.semester };

  // ---------- persistence: uploaded-but-unpublished work survives a refresh ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { items?: UploadItem[]; defaults?: BatchDefaults };
      const restorable = (saved.items ?? []).filter((i) => i.status === "uploaded" && (i.upload || i.kind === "link"));
      if (restorable.length) {
        dispatch({ type: "restore", items: restorable.map((i) => ({ ...i, thumb: { ...i.thumb, preview: undefined }, selected: false })) });
        setRestoredCount(restorable.length);
      }
      if (saved.defaults && !initialSubjectId) setDefaults({ ...EMPTY_DEFAULTS, ...saved.defaults });
    } catch {
      // ignore corrupt state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const persist = items
        .filter((i) => i.status === "uploaded")
        .map(({ file: _file, ...rest }) => ({ ...rest, thumb: { ...rest.thumb, preview: undefined } }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: persist, defaults }));
    } catch {
      // storage full/unavailable
    }
  }, [items, defaults]);

  // ---------- duplicate detection ----------
  const flushDuplicates = useCallback(async () => {
    const entries = [...pendingHashes.current.entries()];
    pendingHashes.current.clear();
    if (!entries.length) return;
    const result = await findDuplicates(entries.map(([, h]) => h));
    if (!result.ok || !result.data) return;
    for (const [id, hash] of entries) {
      const hit = result.data[hash];
      if (hit) dispatch({ type: "patch", id, patch: { duplicate: { id: hit.id, title: hit.title, subject: hit.subject } } });
    }
  }, []);

  // ---------- thumbnails ----------
  const uploadThumbnail = useCallback(async (id: string, blob: Blob) => {
    dispatch({ type: "thumb", id, thumb: { status: "uploading" } });
    try {
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const [res] = await uploadFiles("thumbnail", { files: [new File([blob], `thumb-${id}.${ext}`, { type: blob.type })] });
      dispatch({ type: "thumb", id, thumb: { status: "done", key: res.key, url: res.ufsUrl } });
    } catch {
      dispatch({ type: "thumb", id, thumb: { status: "error" } });
    }
  }, []);

  // ---------- smart analysis ----------
  const buildMeta = useCallback(
    (detected: Detected, fileName: string): { meta: Partial<ItemMeta>; detection: UploadItem["detection"] } => {
      const d = defaultsRef.current;
      let subjectId = d.subjectId;
      let reason: string | undefined;
      let confidence: "high" | "medium" | undefined;
      if (!subjectId) {
        const match = matchSubject(
          { text: fileName.replace(/\.[^.]+$/, ""), codes: detected.codes, courseName: detected.courseName, semester: detected.semester },
          subjects,
          { department: d.department, semester: d.semester },
        );
        if (match) {
          subjectId = match.subjectId;
          reason = match.reason;
          confidence = match.confidence;
        }
      }
      const subject = subjects.find((s) => s.id === subjectId);
      const title = subject ? refineTitle(detected, subject) : detected.title;
      return {
        meta: {
          title,
          subjectId: subjectId ?? null,
          type: d.type !== "auto" ? d.type : (detected.type ?? "notes"),
          module: detected.module,
          examSession: detected.examSession ?? "",
          examYear: detected.examYear,
          tags: [...new Set([...d.tags, ...detected.tags])],
        },
        detection: { reason, confidence, signals: detected.signals },
      };
    },
    [subjects],
  );

  const analyze = useCallback(
    async (id: string) => {
      const file = files.current.get(id);
      if (!file) return;
      dispatch({ type: "patch", id, patch: { analyzing: true } });
      try {
        const hash = await sha256(file).catch(() => undefined);
        if (hash) {
          const twin = seenHashes.current.get(hash);
          const twinAlive = twin && twin.id !== id && itemsRef.current.some((i) => i.id === twin.id && i.status !== "published");
          if (!twinAlive) seenHashes.current.set(hash, { id, name: file.name });
          dispatch({ type: "patch", id, patch: { hash, ...(twinAlive ? { duplicate: { title: twin.name, inBatch: true } } : {}) } });
          pendingHashes.current.set(id, hash);
          if (dupTimer.current) clearTimeout(dupTimer.current);
          dupTimer.current = setTimeout(() => void flushDuplicates(), 400);
        }

        let detected = parseFilename(file.name);
        let thumbBlob: Blob | null = null;
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          const info = await analyzePdf(file).catch(() => null);
          if (info) {
            thumbBlob = info.thumbnail;
            detected = mergeDetected(detected, parseDocumentText(info.text));
            dispatch({ type: "patch", id, patch: { pageCount: info.pageCount } });
          }
        } else if (file.type.startsWith("image/")) {
          thumbBlob = await imageThumbnail(file);
        }
        const { meta, detection } = buildMeta(detected, file.name);
        dispatch({ type: "detect", id, meta, detection });
        if (thumbBlob) {
          dispatch({ type: "thumb", id, thumb: { status: "pending", preview: URL.createObjectURL(thumbBlob) } });
          void uploadThumbnail(id, thumbBlob);
        }
      } finally {
        dispatch({ type: "patch", id, patch: { analyzing: false } });
      }
    },
    [buildMeta, flushDuplicates, uploadThumbnail],
  );

  const pumpAnalysis = useCallback(() => {
    while (analyzingCount.current < ANALYSIS_CONCURRENCY && analysisQueue.current.length) {
      const id = analysisQueue.current.shift()!;
      analyzingCount.current++;
      void analyze(id).finally(() => {
        analyzingCount.current--;
        pumpAnalysis();
      });
    }
  }, [analyze]);

  // ---------- uploads ----------
  const startUpload = useCallback(async (id: string) => {
    const file = files.current.get(id);
    if (!file || started.current.has(id)) return;
    started.current.add(id);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    dispatch({ type: "patch", id, patch: { status: "uploading", progress: 0, error: undefined } });
    let last = 0;
    try {
      const [res] = await uploadFiles("resourceFile", {
        files: [file],
        signal: controller.signal,
        onUploadProgress: ({ progress }) => {
          if (progress - last >= 2 || progress >= 100) {
            last = progress;
            dispatch({ type: "patch", id, patch: { progress } });
          }
        },
      });
      dispatch({ type: "patch", id, patch: { status: "uploaded", progress: 100, upload: { key: res.key, url: res.ufsUrl } } });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: "patch", id, patch: { status: "error", error: errorMessage(error) } });
    } finally {
      controllers.current.delete(id);
      started.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const active = items.filter((i) => i.status === "uploading").length;
    const queued = items.filter((i) => i.status === "queued" && !started.current.has(i.id));
    for (const item of queued.slice(0, Math.max(0, UPLOAD_CONCURRENCY - active))) void startUpload(item.id);
  }, [items, startUpload]);

  // ---------- adding files ----------
  const addFiles = useCallback(
    (list: File[], overrides?: Partial<ItemMeta>) => {
      if (!list.length) return;
      const d = defaultsRef.current;
      const created: UploadItem[] = list.map((file) => {
        const id = newId();
        files.current.set(id, file);
        const detected = parseFilename(file.name);
        const { meta, detection } = buildMeta(detected, file.name);
        return {
          id,
          kind: "file",
          file,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          status: "queued",
          progress: 0,
          analyzing: true,
          pageCount: null,
          thumb: { status: "none" },
          meta: {
            title: meta.title ?? detected.title,
            subjectId: meta.subjectId ?? null,
            type: meta.type ?? "notes",
            module: meta.module ?? null,
            tags: meta.tags ?? [],
            examSession: meta.examSession ?? "",
            examYear: meta.examYear ?? null,
            author: d.author,
            description: "",
            isVerified: d.isVerified,
            ...overrides,
          },
          touched: overrides ? (Object.keys(overrides) as (keyof ItemMeta)[]) : [],
          detection,
          selected: false,
          expanded: false,
        };
      });
      dispatch({ type: "add", items: created });
      analysisQueue.current.push(...created.map((c) => c.id));
      // let React commit the new rows before heavy work starts
      setTimeout(pumpAnalysis, 0);
      toast.success(`${list.length} ${list.length === 1 ? "file" : "files"} added — uploading in the background`);
    },
    [buildMeta, pumpAnalysis],
  );

  // paste screenshots / files anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const pasted = Array.from(e.clipboardData?.files ?? []);
      if (pasted.length) {
        e.preventDefault();
        addFiles(pasted.map((f, i) => (f.name === "image.png" ? new File([f], `pasted-${Date.now()}-${i}.png`, { type: f.type }) : f)));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // ---------- row operations ----------
  const removeItems = useCallback((ids: string[]) => {
    const keys: string[] = [];
    for (const id of ids) {
      controllers.current.get(id)?.abort();
      files.current.delete(id);
      const item = itemsRef.current.find((i) => i.id === id);
      if (item && item.status !== "published") {
        if (item.upload?.key) keys.push(item.upload.key);
        if (item.thumb.key) keys.push(item.thumb.key);
      }
      if (item?.thumb.preview) URL.revokeObjectURL(item.thumb.preview);
    }
    dispatch({ type: "remove", ids });
    if (keys.length) void deleteOrphans(keys); // server re-checks they're unused
  }, []);

  const mergeSelectedImages = useCallback(async () => {
    const chosen = itemsRef.current.filter((i) => i.selected && i.mime.startsWith("image/") && files.current.get(i.id));
    if (chosen.length < 2) return toast.message("Select two or more photos to combine");
    const toastId = toast.loading(`Combining ${chosen.length} photos…`);
    try {
      const first = chosen[0].meta;
      const title = first.title && first.title !== "Notes" ? first.title : "Handwritten Notes";
      const pdf = await imagesToPdf(chosen.map((c) => files.current.get(c.id)!), `${title}.pdf`.replace(/[^\w.-]+/g, "-"));
      removeItems(chosen.map((c) => c.id));
      addFiles([pdf], {
        title,
        ...(first.subjectId ? { subjectId: first.subjectId } : {}),
        ...(first.module ? { module: first.module } : {}),
        type: first.type,
        tags: [...new Set([...first.tags, "handwritten"])],
      });
      toast.success("Photos combined into one PDF", { id: toastId });
    } catch {
      toast.error("Couldn't combine those photos", { id: toastId });
    }
  }, [addFiles, removeItems]);

  // ---------- publish ----------
  const pending = items.filter((i) => i.status !== "published");
  const ready = pending.filter((i) => (i.kind === "file" && i.status === "uploaded") || i.kind === "link");
  const invalid = ready.filter((i) => !i.meta.subjectId || !i.meta.title.trim());
  const uploading = pending.filter((i) => i.status === "uploading" || i.status === "queued").length;
  const failed = pending.filter((i) => i.status === "error").length;
  const selectedIds = pending.filter((i) => i.selected).map((i) => i.id);
  const publishedCount = items.length - pending.length;

  async function publish() {
    if (!ready.length) return;
    if (invalid.length) {
      toast.error(`${invalid.length} ${invalid.length === 1 ? "file needs" : "files need"} a subject and title`);
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setPublishing(true);
    // give in-flight thumbnails a moment so cards get previews
    for (let i = 0; i < 30 && itemsRef.current.some((x) => ready.some((r) => r.id === x.id) && x.thumb.status === "uploading"); i++) {
      await new Promise((r) => setTimeout(r, 300));
    }
    const batch = itemsRef.current.filter((x) => ready.some((r) => r.id === x.id));
    const result = await createResources(
      batch.map((i) => ({
        subjectId: i.meta.subjectId!,
        title: i.meta.title.trim(),
        description: i.meta.description || null,
        type: i.meta.type,
        module: i.meta.type === "pyq" ? null : i.meta.module,
        tags: i.meta.tags as never,
        examYear: i.meta.type === "pyq" ? i.meta.examYear : null,
        examSession: i.meta.type === "pyq" ? i.meta.examSession || null : null,
        author: i.meta.author || null,
        isVerified: i.meta.isVerified,
        status: defaultsRef.current.publish ? "published" : "draft",
        file:
          i.kind === "file" && i.upload
            ? {
                key: i.upload.key,
                url: i.upload.url,
                name: i.name,
                size: i.size,
                mime: i.mime,
                hash: i.hash ?? null,
                pageCount: i.pageCount,
                thumbnailKey: i.thumb.status === "done" ? (i.thumb.key ?? null) : null,
                thumbnailUrl: i.thumb.status === "done" ? (i.thumb.url ?? null) : null,
              }
            : null,
        externalUrl: i.kind === "link" ? i.externalUrl : null,
      })),
    );
    setPublishing(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const ids = result.data?.ids ?? [];
    dispatch({ type: "published", map: Object.fromEntries(batch.map((b, i) => [b.id, ids[i]]).filter(([, rid]) => rid)) });
    toast.success(`${ids.length} ${ids.length === 1 ? "file" : "files"} ${defaultsRef.current.publish ? "published" : "saved as drafts"}`);
  }

  const applyDefaultsToAll = () => {
    const ids = pending.map((i) => i.id);
    if (!ids.length) return;
    const patch: Partial<ItemMeta> = { isVerified: defaults.isVerified };
    if (defaults.subjectId) patch.subjectId = defaults.subjectId;
    if (defaults.type !== "auto") patch.type = defaults.type;
    if (defaults.author) patch.author = defaults.author;
    dispatch({ type: "bulkMeta", ids, meta: patch });
    if (defaults.tags.length) {
      for (const i of pending) dispatch({ type: "meta", id: i.id, meta: { tags: [...new Set([...i.meta.tags, ...defaults.tags])] } });
    }
    toast.success(`Applied to ${ids.length} files`);
  };

  const stats = useMemo(
    () => [
      { label: "files", value: pending.length },
      { label: "uploading", value: uploading },
      { label: "ready", value: ready.length - invalid.length },
      { label: "need details", value: invalid.length + failed, warn: invalid.length + failed > 0 },
    ],
    [pending.length, uploading, ready.length, invalid.length, failed],
  );

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-lime-soft/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-brand bg-white px-10 py-8 text-center shadow-float">
            <CloudUpload className="mx-auto size-10 text-brand" />
            <p className="mt-2 text-lg font-semibold text-ink">Drop to upload</p>
          </div>
        </div>
      ) : null}

      {restoredCount > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-lime-border bg-lime-soft/60 px-4 py-3 text-[13.5px] text-ink">
          <Sparkles className="size-4 text-brand" />
          Restored {restoredCount} uploaded {restoredCount === 1 ? "file" : "files"} from your last session — finish the details and publish.
          <button type="button" onClick={() => setRestoredCount(0)} className="ml-auto text-[13px] font-medium text-brand hover:underline">
            Got it
          </button>
        </div>
      ) : null}

      {/* Batch defaults */}
      <section className="rounded-2xl border border-border bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Wand2 className="size-4 text-brand" /> Batch defaults
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Applied to new files. Leave subject &amp; type on auto and µPrep reads file names and first pages (course codes, KTU paper headers,
              modules) to fill them in.
            </p>
          </div>
          {pending.length > 0 ? (
            <Button variant="outline" size="sm" className="rounded-lg bg-white" onClick={applyDefaultsToAll}>
              Apply to all {pending.length}
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[120px_130px_minmax(0,1fr)_150px_170px]">
          <DefaultsField label="Branch">
            <Select value={defaults.department ?? "any"} onValueChange={(v) => setDefaults((d) => ({ ...d, department: v === "any" ? null : v }))}>
              <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.slug} value={d.slug}>
                    {d.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DefaultsField>
          <DefaultsField label="Semester">
            <Select value={defaults.semester ? String(defaults.semester) : "any"} onValueChange={(v) => setDefaults((d) => ({ ...d, semester: v === "any" ? null : Number(v) }))}>
              <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    S{s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DefaultsField>
          <DefaultsField label="Subject">
            <div className="flex gap-1.5">
              <SubjectCombobox
                subjects={subjects}
                value={defaults.subjectId}
                onChange={(id) => setDefaults((d) => ({ ...d, subjectId: id }))}
                context={context}
                placeholder="✨ Auto-detect per file"
              />
              {defaults.subjectId ? (
                <Button variant="ghost" size="sm" className="h-9 px-2 text-[12px]" onClick={() => setDefaults((d) => ({ ...d, subjectId: null }))}>
                  Auto
                </Button>
              ) : null}
            </div>
          </DefaultsField>
          <DefaultsField label="Type">
            <Select value={defaults.type} onValueChange={(v) => setDefaults((d) => ({ ...d, type: v as ResourceType | "auto" }))}>
              <SelectTrigger className="h-9! w-full rounded-lg bg-white text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">✨ Auto-detect</SelectItem>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DefaultsField>
          <DefaultsField label="Prepared by">
            <Input value={defaults.author} onChange={(e) => setDefaults((d) => ({ ...d, author: e.target.value }))} placeholder="Optional" className="h-9 rounded-lg bg-white text-[13px]" />
          </DefaultsField>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {RESOURCE_TAGS.map((t) => {
            const on = defaults.tags.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                data-active={on}
                onClick={() => setDefaults((d) => ({ ...d, tags: on ? d.tags.filter((x) => x !== t.value) : [...d.tags, t.value] }))}
                className="chip h-7 px-3 text-[12px]"
              >
                {t.label}
              </button>
            );
          })}
          <button type="button" data-active={defaults.isVerified} onClick={() => setDefaults((d) => ({ ...d, isVerified: !d.isVerified }))} className="chip h-7 px-3 text-[12px]">
            <BadgeCheck className="size-3.5" /> Verified
          </button>
          <div className="ml-auto flex items-center rounded-lg border border-border p-0.5 text-[12.5px]" role="radiogroup" aria-label="Visibility">
            {[
              { v: true, l: "Publish now" },
              { v: false, l: "Save as drafts" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={defaults.publish === o.v}
                onClick={() => setDefaults((d) => ({ ...d, publish: o.v }))}
                className={cn("rounded-md px-2.5 py-1 font-medium text-muted-foreground", defaults.publish === o.v && "bg-ink text-white")}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Dropzone */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-lime-border/70 bg-lime-soft/30 px-5 py-6 text-left transition-colors hover:border-brand hover:bg-lime-soft/60"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-card transition-transform group-hover:-translate-y-0.5">
            <CloudUpload className="size-6" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-ink">Drop files anywhere, browse, or paste (⌘V)</span>
            <span className="block text-[12.5px] text-muted-foreground">PDF, photos, Word, PowerPoint, Excel, ZIP · up to 128 MB each · uploads start immediately</span>
          </span>
        </button>
        <Button variant="outline" className="h-auto rounded-2xl bg-white px-5 py-4" onClick={() => setLinkOpen(true)}>
          <Link2 /> Add a link
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {/* Bulk bar */}
      {pending.length > 0 ? (
        <div className="sticky top-14 z-20 mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white/95 px-3 py-2 shadow-card backdrop-blur lg:top-2">
          <label className="flex items-center gap-2 pr-2 text-[13px] font-medium text-ink">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand)]"
              checked={selectedIds.length > 0 && selectedIds.length === pending.length}
              ref={(el) => {
                if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < pending.length;
              }}
              onChange={(e) => dispatch({ type: "select", ids: "all", value: e.target.checked })}
              aria-label="Select all"
            />
            {selectedIds.length ? `${selectedIds.length} selected` : "Select all"}
          </label>
          {selectedIds.length ? (
            <>
              <div className="w-[230px]">
                <SubjectCombobox subjects={subjects} value={null} onChange={(id) => dispatch({ type: "bulkMeta", ids: selectedIds, meta: { subjectId: id } })} context={context} placeholder="Set subject…" size="sm" />
              </div>
              <Select onValueChange={(v) => dispatch({ type: "bulkMeta", ids: selectedIds, meta: { type: v as ResourceType } })}>
                <SelectTrigger className="h-8! w-[130px] rounded-lg bg-white text-[13px]">
                  <SelectValue placeholder="Set type…" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => dispatch({ type: "bulkMeta", ids: selectedIds, meta: { module: v === "full" ? null : Number(v) } })}>
                <SelectTrigger className="h-8! w-[130px] rounded-lg bg-white text-[13px]">
                  <SelectValue placeholder="Set module…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">All modules</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Module {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 rounded-lg bg-white" onClick={() => dispatch({ type: "bulkMeta", ids: selectedIds, meta: { isVerified: true } })}>
                <BadgeCheck /> Verify
              </Button>
              {items.filter((i) => i.selected && i.mime.startsWith("image/")).length >= 2 ? (
                <Button variant="outline" size="sm" className="h-8 rounded-lg bg-white" onClick={mergeSelectedImages}>
                  Combine photos → PDF
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => removeItems(selectedIds)}>
                <Trash2 /> Remove
              </Button>
            </>
          ) : (
            <span className="text-[12.5px] text-muted-foreground">Select rows to edit many at once.</span>
          )}
        </div>
      ) : null}

      {/* Rows */}
      {items.length === 0 ? (
        <div className="mt-8 grid gap-3 text-[13px] text-muted-foreground sm:grid-cols-3">
          {[
            ["Name files like MAT101_Module2_Matrices.pdf", "Course codes, modules and words like “handwritten” or “QP” are picked up automatically."],
            ["Question papers read themselves", "KTU paper headers (course code, exam month & year) are parsed from page 1."],
            ["Photos of notes?", "Drop several pictures, select them and combine them into one clean PDF."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border bg-white p-4">
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Sparkles className="size-3.5 text-brand" /> {t}
              </p>
              <p className="mt-1">{d}</p>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              subjects={subjects}
              context={context}
              onMeta={(meta) => dispatch({ type: "meta", id: item.id, meta })}
              onSelect={(value) => dispatch({ type: "select", ids: [item.id], value })}
              onRemove={() => removeItems([item.id])}
              onRetry={() => dispatch({ type: "patch", id: item.id, patch: { status: "queued", error: undefined, progress: 0 } })}
              onExpand={() => dispatch({ type: "patch", id: item.id, patch: { expanded: !item.expanded } })}
            />
          ))}
        </ul>
      )}

      {/* Footer */}
      {items.length > 0 ? (
        <div className="sticky bottom-3 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-ink px-4 py-3 text-white shadow-float">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            {stats.map((s) => (
              <span key={s.label} className={cn("text-white/70", s.warn && "text-amber-300")}>
                <strong className="font-semibold text-white tabular-nums">{s.value}</strong> {s.label}
              </span>
            ))}
            {publishedCount ? (
              <button type="button" onClick={() => dispatch({ type: "clearPublished" })} className="text-white/70 underline-offset-2 hover:text-white hover:underline">
                Clear {publishedCount} published
              </button>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {publishedCount && !pending.length ? (
              <Button asChild variant="outline" className="h-10 rounded-lg border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/admin/library">Open library</Link>
              </Button>
            ) : null}
            <Button onClick={publish} disabled={!ready.length || publishing} className="h-10 rounded-lg bg-lime px-5 text-ink hover:bg-lime-strong">
              {publishing ? <MuSpinner /> : <Plus />}
              {defaults.publish ? "Publish" : "Save"} {ready.length || ""} {ready.length === 1 ? "file" : "files"}
              {uploading ? <span className="text-ink/60">({uploading} still uploading)</span> : null}
            </Button>
          </div>
        </div>
      ) : null}

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onAdd={(url, title) => {
          const detected = parseFilename(title);
          const { meta, detection } = buildMeta({ ...detected, title }, title);
          dispatch({
            type: "add",
            items: [
              {
                id: newId(),
                kind: "link",
                name: title,
                size: 0,
                mime: "",
                status: "uploaded",
                progress: 100,
                analyzing: false,
                pageCount: null,
                externalUrl: url,
                thumb: { status: "none" },
                meta: {
                  title,
                  subjectId: meta.subjectId ?? null,
                  type: meta.type ?? "notes",
                  module: meta.module ?? null,
                  tags: meta.tags ?? [],
                  examSession: meta.examSession ?? "",
                  examYear: meta.examYear ?? null,
                  author: defaults.author,
                  description: "",
                  isVerified: defaults.isVerified,
                },
                touched: ["title"],
                detection,
                selected: false,
                expanded: false,
              },
            ],
          });
        }}
      />
    </div>
  );
}

function DefaultsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label className="mb-1 block text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  );
}

function LinkDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (url: string, title: string) => void }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const valid = /^https?:\/\/\S+\.\S+/.test(url.trim()) && title.trim().length > 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a link</DialogTitle>
          <DialogDescription>Google Drive, YouTube playlists, NPTEL lectures… Drive and YouTube links get an inline preview.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-[13px]">URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" className="h-10 rounded-lg" autoFocus />
          </div>
          <div>
            <Label className="mb-1.5 block text-[13px]">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Module 3 video lectures" className="h-10 rounded-lg" />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!valid}
            onClick={() => {
              onAdd(url.trim(), title.trim());
              setUrl("");
              setTitle("");
              onOpenChange(false);
            }}
            className="h-10 rounded-lg px-5"
          >
            Add link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
