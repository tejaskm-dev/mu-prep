"use client";

import { loadPdfjs } from "@/lib/pdf";

export type DeptOption = {
  id: string;
  slug: string;
  code: string;
  name?: string;
};

export type ExtractedSubject = {
  id: string;
  code: string | null;
  name: string;
  semester: number | null;
  deptIds: string[];
  credits?: number | null;
  selected: boolean;
};

export type TimetableParseResult = {
  semester: number | null;
  deptIds: string[];
  subjects: ExtractedSubject[];
  rawText: string;
};

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^(and|for|of|the|in|on|at|to|a|an|with|or|by)$/i.test(word)) return word.toLowerCase();
      if (/^[ivx0-9-]+$/i.test(word) || /^[0-9]+[a-z]?$/i.test(word)) return word.toUpperCase();
      if (word.startsWith("(") && word.length > 1) {
        return "(" + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

export function cleanSubjectName(name: string, code: string | null): string {
  // Strip pipe symbols, brackets, and surrounding delimiters
  name = name.replace(/^[|:;.\-\s[\]()]+|[|:;.\-\s[\]()]+$/g, "");
  // Cut off at pipe symbol (separates columns in table rows)
  name = name.replace(/\|.*$/, "").trim();
  // Strip leading 1-2 letter noise from table border OCR artifacts (e.g. "Hc ", "Sa ", "Dy ")
  name = name.replace(/^[a-z]{1,2}\s+/i, "");

  // Cut off teacher/faculty titles and names (Ms. SAJITHA, Dr. John, Prof. Paul, etc.)
  const staffMatch = name.match(/\b(?:Ms|Mr|Mrs|Dr|Prof|Sri|Smt)\.?\s+[A-Za-z\s,.]+/i);
  if (staffMatch && staffMatch.index !== undefined) {
    name = name.slice(0, staffMatch.index).trim();
  }

  // Strip trailing remedy prefixes/suffixes (e.g. "R-OOPS", "R-DELD", "TOC-T", "DS-T")
  name = name.replace(/\s+(?:R-[A-Z0-9]+|[A-Z]+-[TtRr])\b/gi, "").trim();
  // Strip trailing uppercase short-codes like "MATHS", "TOC", "DELD", "EESD", "DS LAB"
  name = name.replace(/\s+(?:DS\s+LAB|DELD\s+LAB|[A-Z]{2,5})\s*$/g, "").trim();
  // Strip noisy intermediate short codes before Lab e.g. "Eni Lab"
  name = name.replace(/\s+[a-z0-9]{1,3}\s+Lab/gi, " Lab");
  // Strip trailing stray 1-3 char noise
  name = name.replace(/\s+[a-z0-9]{1,3}\s*$/i, "").trim();
  // Strip credit mentions like (Credits: 4) or (3-0-0)
  name = name.replace(/\s*\(?(?:Credits?|L-T-P)\s*[:-]?\s*[\d-]+\)?/i, "").trim();
  name = name.replace(/^[|:;.\-\s[\]()]+|[|:;.\-\s[\]()]+$/g, "").trim();

  // Known expansions for partial OCR lines
  if (/object\s+oriented$/i.test(name)) name += " Programming";
  if (/digital\s+electronics(\s+and)?$/i.test(name)) name = "Digital Electronics and Logic Design";
  if (/engineering\s+ethics$/i.test(name)) name = "Engineering Ethics and Sustainable Development";
  if (/python\s+for\s+application$/i.test(name)) name = "Python for Application Development";
  if (code && /L\d{3}$/i.test(code) && !/lab$/i.test(name)) name += " Lab";

  // Avoid duplicate "Lab Lab"
  name = name.replace(/\bLab\s+Lab\b/gi, "Lab");

  // Fix unclosed parenthesis e.g. "(OOP Project" -> "(OOP Project)"
  if (name.includes("(") && !name.includes(")")) {
    name += ")";
  }

  return toTitleCase(name);
}

/**
 * Extracts subjects, semester, and department/branch from raw timetable text.
 */
export function parseTimetableText(text: string, departments: DeptOption[]): TimetableParseResult {
  // 1. Detect Semester (e.g. "S3", "Sem 3", "Semester 3", "3rd Sem", or OCR artifact "$3")
  let semester: number | null = null;
  const semMatch =
    text.match(/\b(?:Class\s*[:-]?\s*)?[S$5]([1-8])\b/i) ||
    text.match(/\bS([1-8])\b/i) ||
    text.match(/\bSem(?:ester)?\s*[:-]?\s*([1-8])\b/i) ||
    text.match(/\b([1-8])(?:st|nd|rd|th)?\s*Sem(?:ester)?\b/i) ||
    text.match(/\bSemester\s*[:-]?\s*([1-8])\b/i);
  if (semMatch) {
    semester = Number(semMatch[1]);
  }

  // 2. Detect Department / Branch (e.g. "Class :- S3 CSE C", "Branch: CSE", "Computer Science")
  // Division letters (like A, B, C) are automatically ignored because we match against department codes
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headerContext = lines.slice(0, 15).join(" ");
  const deptIds: string[] = [];

  for (const d of departments) {
    const codeRegex = new RegExp(`\\b${d.code}\\b`, "i");
    const slugRegex = new RegExp(`\\b${d.slug}\\b`, "i");
    if (codeRegex.test(headerContext) || slugRegex.test(headerContext)) {
      deptIds.push(d.id);
    }
  }

  // If no match in header, check full text
  if (deptIds.length === 0) {
    for (const d of departments) {
      const codeRegex = new RegExp(`\\b${d.code}\\b`, "i");
      if (codeRegex.test(text)) {
        deptIds.push(d.id);
      }
    }
  }

  // 3. Extract Subjects
  const subjectsMap = new Map<string, ExtractedSubject>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    // Strip common noisy row prefixes like "Subject Name 1:", "Tutorial:", "Remedy:", "Lab 1:"
    const cleaned = rawLine
      .replace(/^(?:Subject\s+Name\s*\d*|Remedy|Tutorial|Theory|Lab\s*\d*|Course\s*\d*|Sl\.?\s*No\.?\s*\d*)\s*[:-]?\s*/i, "")
      .trim();

    // Look for KTU / university course code patterns:
    // e.g. GAMAT301, PCCST302, PBCST304, GAEST305, UCHUT347, CST201, MAT101, PCCSL307, etc.
    const codeMatch = cleaned.match(/\b([A-Za-z]{2,7}\s?\d{3}[A-Za-z]?)\b/);
    let code: string | null = null;
    let name = cleaned;

    if (codeMatch) {
      code = codeMatch[1].replace(/\s+/g, "").toUpperCase();
      const codeIdx = codeMatch.index ?? 0;
      name = (cleaned.slice(0, codeIdx) + " " + cleaned.slice(codeIdx + codeMatch[0].length)).trim();
    } else if (/code\s+tandra/i.test(cleaned)) {
      code = "OOP PRJT";
      name = "Code Tandra (OOP Project)";
    } else {
      continue;
    }

    // Join multi-line subject title wrapping (e.g. "MATHEMATICS FOR" on line 1, "COMPUTER AND INFORMATION SCIENCE-3" on line 2)
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (
        !nextLine.match(/\b([A-Za-z]{2,7}\s?\d{3}[A-Za-z]?)\b/) &&
        !/^(?:Subject|Remedy|Tutorial|Lab|Class|Period|Monday|Tuesday|Wednesday|Thursday|Friday)\b/i.test(nextLine)
      ) {
        let continuation = nextLine.replace(/\b(?:Ms|Mr|Mrs|Dr|Prof|Sri|Smt)\.?\s+[A-Za-z\s,.]+/i, "").trim();
        continuation = continuation.replace(/\|.*$/, "").trim();
        continuation = continuation.replace(/\s+(?:DS\s+LAB|DELD\s+LAB|[A-Z]{2,5}(?:-[A-Z0-9]+)?)\s*$/g, "").trim();
        continuation = continuation.replace(/^[|:;.\-\s[\]()]+|[|:;.\-\s[\]()]+$/g, "").trim();

        if (/(?:and|for|of|in|to|with|oriented)$/i.test(name) || name.length < 15) {
          if (continuation.length > 2 && !continuation.includes("==")) {
            name = (name + " " + continuation).trim();
          }
        }
      }
    }

    const cleanedName = cleanSubjectName(name, code);
    if (cleanedName.length < 2) continue;

    // Filter out common timetable header words if mistakenly parsed
    if (
      /^(subject\s+name|course\s+name|staff\s+name|subject\s+code|period\s+\d+|time\b|room\b|monday|tuesday|wednesday|thursday|friday)/i.test(
        cleanedName,
      )
    ) {
      continue;
    }

    const key = code || cleanedName.toLowerCase();

    // Deduplicate / update if a longer or better row is found
    if (!subjectsMap.has(key) || (subjectsMap.get(key)!.name.length < cleanedName.length)) {
      subjectsMap.set(key, {
        id: crypto.randomUUID(),
        code,
        name: cleanedName,
        semester,
        deptIds: deptIds.length ? [...deptIds] : [],
        credits: null,
        selected: true,
      });
    }
  }

  // Deduplicate by normalized subject name (collapses redundant remedy/tutorial codes for the same subject)
  const byName = new Map<string, ExtractedSubject>();
  for (const s of subjectsMap.values()) {
    const norm = s.name.toLowerCase();
    const existing = byName.get(norm);
    if (!existing) {
      byName.set(norm, s);
    } else {
      // Keep canonical course code (e.g. PBCST304 over PBCST301)
      if (s.code && (!existing.code || s.code.length > existing.code.length || s.code.endsWith("4"))) {
        byName.set(norm, s);
      }
    }
  }

  // Fallback: If no course codes were found in the legend, try finding subjects from grid period items
  if (byName.size === 0) {
    const gridItems = new Set<string>();
    for (const match of text.matchAll(/\b([A-Z]{2,6}(?:\s+LAB)?)\s*\([A-Za-z0-9,\s/]+\)/g)) {
      const codeAbbr = match[1].trim();
      if (!["TIME", "PERIOD", "ROOM", "CLASS"].includes(codeAbbr.toUpperCase())) {
        gridItems.add(codeAbbr);
      }
    }
    for (const item of gridItems) {
      byName.set(item.toLowerCase(), {
        id: crypto.randomUUID(),
        code: item,
        name: toTitleCase(item),
        semester,
        deptIds: deptIds.length ? [...deptIds] : [],
        credits: null,
        selected: true,
      });
    }
  }

  return {
    semester,
    deptIds,
    subjects: Array.from(byName.values()),
    rawText: text,
  };
}

/**
 * Prepares an image for high-accuracy OCR by upscaling small images to ~2200px width
 * and applying canvas bicubic smoothing for crisp text characters.
 */
async function prepareImageCanvas(file: File): Promise<HTMLCanvasElement> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load timetable image"));
      img.src = url;
    });

    // Target ~2200px width for ideal 300 DPI character recognition
    const targetWidth = Math.max(img.width, 2200);
    const scale = targetWidth / img.width;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Runs OCR or text extraction on a timetable image or PDF in the browser.
 * Zero external servers or keys required — operates purely on client-side WebAssembly.
 */
export async function recognizeTimetableFile(
  file: File,
  onProgress?: (percent: number, status: string) => void,
): Promise<string> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    onProgress?.(15, "Loading PDF…");
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjs.getDocument({ data });
    const doc = await task.promise;
    try {
      const page = await doc.getPage(1);

      // Check if the PDF has embedded native digital text
      const textContent = await page.getTextContent();
      const extractedText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();

      if (extractedText.length > 120) {
        onProgress?.(100, "Done!");
        return extractedText;
      }

      // If it's a scanned/raster PDF, render page 1 to canvas and run Tesseract OCR
      onProgress?.(30, "Rendering scanned PDF page…");
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(1.8, 2200 / baseViewport.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      await page.render({ canvas, viewport }).promise;

      return await runTesseract(canvas, onProgress);
    } finally {
      void task.destroy().catch(() => {});
    }
  }

  // Image files (PNG, JPEG, WebP)
  onProgress?.(10, "Optimizing image resolution…");
  const canvas = await prepareImageCanvas(file);
  return await runTesseract(canvas, onProgress);
}

async function runTesseract(
  source: HTMLCanvasElement,
  onProgress?: (percent: number, status: string) => void,
): Promise<string> {
  onProgress?.(20, "Initializing OCR engine…");
  const { createWorker, PSM } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const pct = Math.round(30 + (m.progress || 0) * 60);
        onProgress?.(pct, `Reading timetable text… ${Math.round((m.progress || 0) * 100)}%`);
      } else if (m.status.includes("loading") || m.status.includes("initializing")) {
        onProgress?.(25, "Preparing OCR worker…");
      }
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
    const result1 = await worker.recognize(source);
    let combinedText = result1.data.text;

    // If fewer than 4 course codes found, run a fast sparse pass to catch isolated table rows
    const codeMatches = [...combinedText.matchAll(/\b([A-Za-z]{2,7}\d{3}[A-Za-z]?)\b/g)];
    if (codeMatches.length < 5) {
      onProgress?.(92, "Scanning table cells…");
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      const result2 = await worker.recognize(source);
      combinedText = combinedText + "\n" + result2.data.text;
    }

    onProgress?.(100, "Finished!");
    return combinedText;
  } finally {
    await worker.terminate();
  }
}
