// Heuristics that turn a file name (and the first page of a PDF) into suggested
// metadata: subject, module, type, exam session, tags and a clean title.
// Pure functions — safe on the client and the server.

import type { ResourceType } from "./database.types";

export type Detected = {
  title: string;
  module: number | null;
  type: ResourceType | null;
  tags: string[];
  examYear: number | null;
  examSession: string | null;
  codes: string[];
  semester: number | null;
  courseName: string | null;
  signals: string[];
};

export type SubjectLite = {
  id: string;
  name: string;
  short_name: string | null;
  code: string | null;
  keywords: string[];
  semester: number;
  department_slugs: string[];
};

export type SubjectMatch = {
  subjectId: string;
  confidence: "high" | "medium";
  reason: string;
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

const NOT_CODES = new Set(["MOD", "MODULE", "UNIT", "PART", "SEM", "PAGE", "NOTES", "PYQ", "QP", "PG", "NO", "SET", "CH"]);

const STOPWORDS = new Set([
  "and",
  "of",
  "the",
  "in",
  "for",
  "to",
  "a",
  "an",
  "on",
  "with",
  "by",
  "at",
  "from",
  "notes",
  "note",
  "pdf",
  "module",
  "mod",
  "unit",
  "part",
  "full",
  "complete",
  "final",
  "new",
  "copy",
  "scan",
  "scanned",
  "img",
  "image",
  "doc",
  "file",
  "sem",
  "semester",
  "ktu",
  "btech",
  "lecture",
  "class",
  "engineering",
]);

const TYPE_RULES: { type: ResourceType; re: RegExp; label: string }[] = [
  { type: "qbank", re: /\b(question\s*bank|q\s*bank|qbank|important\s*questions?|imp\s*questions?)\b/i, label: "Looks like a question bank" },
  { type: "syllabus", re: /\b(syllabus|curriculum)\b/i, label: "Looks like a syllabus" },
  {
    type: "pyq",
    re: /\b(pyqs?|qp|question\s*papers?|previous\s*(year)?|university\s*(exam|paper)|end\s*sem|ese|series\s*(exam|test|1|2|i|ii)?|model\s*(qp|question|paper)|supplementary|supply)\b/i,
    label: "Looks like a question paper",
  },
  { type: "lab", re: /\b(lab|labs|record|experiments?|practicals?|lab\s*manual|viva)\b/i, label: "Looks like a lab record" },
  { type: "assignment", re: /\b(assignments?|assgn|assign|tutorials?|homework)\b/i, label: "Looks like an assignment" },
  { type: "notes", re: /\b(notes?|lecture|handwritten|hand\s*written|class\s*notes|ppt|slides|summary)\b/i, label: "Looks like notes" },
];

const TAG_RULES: { tag: string; re: RegExp }[] = [
  { tag: "handwritten", re: /\b(hand\s*written|handwritten|hw|written\s*notes)\b/i },
  { tag: "teacher-notes", re: /\b(teachers?|faculty|sir|ma'?am|prof|professor|lecturer|hod)\b/i },
  { tag: "solved", re: /\b(solved|solutions?|answer\s*key|answers?|scheme\s*of\s*(valuation|evaluation))\b/i },
  { tag: "important", re: /\b(important|imp|must\s*read)\b/i },
  { tag: "short-notes", re: /\b(short\s*notes|summary|cheat\s*sheet|quick\s*revision|revision)\b/i },
  { tag: "slides", re: /\b(slides|ppt|pptx|presentation)\b/i },
  { tag: "textbook", re: /\b(text\s*book|textbook|reference\s*book|e-?book)\b/i },
  { tag: "model-paper", re: /\bmodel\s*(qp|question|paper)/i },
];

function normalize(name: string) {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.+()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseModule(text: string): number | null {
  const m =
    text.match(/\b(?:mod(?:ule)?|unit|chapter|ch)\s*[-:#]?\s*(\d{1,2}|i{1,3}|iv|v|vi)\b/i) ??
    text.match(/\bm\s?([1-6])\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const n = ROMAN[raw] ?? Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

function parseSession(text: string): { examSession: string | null; examYear: number | null } {
  const month = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[-'’ ]?\s*(20\d{2}|\d{2})\b/i,
  );
  if (month) {
    const full = MONTHS.find((m) => m.startsWith(month[1].toLowerCase().slice(0, 3))) ?? month[1];
    const year = Number(month[2].length === 2 ? `20${month[2]}` : month[2]);
    return { examSession: `${full[0].toUpperCase()}${full.slice(1)} ${year}`, examYear: year };
  }
  const year = text.match(/\b(20[0-4]\d)\b/);
  return { examSession: null, examYear: year ? Number(year[1]) : null };
}

function parseCodes(text: string): string[] {
  const codes = new Set<string>();
  for (const m of text.matchAll(/\b([A-Za-z]{2,7})\s?-?(\d{3})\b/g)) {
    const letters = m[1].toUpperCase();
    if (NOT_CODES.has(letters)) continue;
    codes.add(`${letters}${m[2]}`);
  }
  return [...codes];
}

function parseSemester(text: string): number | null {
  const m = text.match(/\b(?:s|sem|semester)\s*[-:]?\s*([1-8])\b/i) ?? text.match(/\bsemester\s*[-:]?\s*(i{1,3}|iv|v|vi{1,3})\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return ROMAN[raw] ?? Number(raw);
}

const SMALL_WORDS = new Set(["and", "of", "the", "in", "for", "to", "a", "an", "on", "with", "by", "vs"]);

const KNOWN_ACRONYMS = new Set([
  "os", "ai", "ml", "iot", "oop", "oops", "coa", "flat", "cn", "ss", "ds", "dbms", "cse", "ece", "eee", "ce", "me",
  "ktu", "qp", "pyq", "vlsi", "dsp", "dc", "ac", "api", "sql", "html", "css", "cad", "cam", "ic", "pcb", "ldc",
]);

function titleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word, i) => {
      if (/^[A-Z0-9+#&]{2,}$/.test(word)) return word; // already an acronym: DBMS, OS, C++
      const lower = word.toLowerCase();
      if (KNOWN_ACRONYMS.has(lower) || (/^[a-z]{2,5}$/.test(lower) && !/[aeiouy]/.test(lower))) return lower.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Suggests metadata from a file name such as "MAT101_Module1_Sets_Handwritten.pdf". */
export function parseFilename(fileName: string): Detected {
  const base = normalize(fileName);
  const signals: string[] = [];
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  const codes = parseCodes(base);
  if (codes.length) signals.push(`Course code ${codes[0]} in file name`);

  const module = parseModule(base);
  if (module) signals.push(`Module ${module} in file name`);

  let type: ResourceType | null = null;
  for (const rule of TYPE_RULES) {
    if (rule.re.test(base)) {
      type = rule.type;
      signals.push(rule.label);
      break;
    }
  }
  if (!type && ["ppt", "pptx"].includes(ext)) type = "notes";

  const tags = TAG_RULES.filter((r) => r.re.test(base)).map((r) => r.tag);
  if (["ppt", "pptx"].includes(ext) && !tags.includes("slides")) tags.push("slides");
  if (type === "pyq") {
    const i = tags.indexOf("teacher-notes");
    if (i >= 0) tags.splice(i, 1);
  }

  const session = parseSession(base);
  if (!type && session.examSession) {
    type = "pyq";
    signals.push("Looks like a question paper");
  }
  const { examSession, examYear } = type === "pyq" || type === "qbank" ? session : { examSession: null, examYear: null };
  if (examSession) signals.push(`Exam session ${examSession}`);

  const cameraName = /^(img|dsc|pxl|photo|image|scan|cam|whatsapp image|screenshot|doc)\s*\d+/i.test(base);

  const semester = parseSemester(base);

  // Clean title: drop codes, module markers, sessions and type/tag words.
  let title = base
    .replace(/\b[A-Za-z]{2,7}\s?-?\d{3}\b/g, " ")
    .replace(/\b(?:mod(?:ule)?|unit|chapter|ch)\s*[-:#]?\s*(\d{1,2}|i{1,3}|iv|v|vi)\b/gi, " ")
    .replace(/\bm\s?[1-6]\b/gi, " ")
    .replace(/\b(?:s|sem|semester)\s*[-:]?\s*[1-8]\b/gi, " ")
    .replace(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[-'’ ]?\s*(20\d{2}|\d{2})\b/gi,
      " ",
    )
    .replace(/\b20\d{2}\b/g, " ")
    .replace(
      /\b(pyqs?|qp|question\s*papers?|handwritten|hand\s*written|hw|notes?|pdf|final|scanned?|copy|new|ktu|btech|b\s*tech|solved|solutions?|ppt|pptx|slides|teachers?|faculty|sir|ma'?am|prof|full|complete|important|imp)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (cameraName) title = "";

  if (title.length < 2 || /^[\d\s]+$/.test(title)) {
    if (type === "pyq") title = examSession ? `${examSession} Question Paper` : "University Question Paper";
    else if (type === "lab") title = "Lab Record";
    else if (type === "assignment") title = "Assignment";
    else if (type === "qbank") title = "Question Bank";
    else if (type === "syllabus") title = "Syllabus";
    else if (module) title = `Module ${module} Notes`;
    else if (cameraName) title = tags.includes("handwritten") ? "Handwritten Notes" : "Notes";
    else title = "Complete Notes";
  }

  return {
    title: titleCase(title).slice(0, 120),
    module,
    type,
    tags,
    examYear,
    examSession,
    codes,
    semester,
    courseName: null,
    signals,
  };
}

/** Extracts hints from the text of a document's first page (e.g. a KTU question paper header). */
export function parseDocumentText(text: string): Partial<Detected> & { signals: string[] } {
  const clean = text.replace(/\s+/g, " ").trim();
  const signals: string[] = [];
  if (clean.length < 20) return { signals: ["Scanned document (no selectable text)"] };

  const codeMatch = clean.match(/course\s*code\s*[:\-–]?\s*([A-Z]{2,7}\s?\d{3})/i);
  const codes = codeMatch ? [codeMatch[1].replace(/\s/g, "").toUpperCase()] : parseCodes(clean.slice(0, 600));
  if (codes.length) signals.push(`Course code ${codes[0]} on page 1`);

  const nameMatch = clean.match(
    /course\s*name\s*[:\-–]?\s*([A-Za-z][A-Za-z &,\-()]{3,80}?)(?=\s+(?:max|duration|time|marks|part|reg|name|course|$))/i,
  );
  const courseName = nameMatch ? titleCase(nameMatch[1].trim()) : null;

  const isPaper =
    /(max(?:imum)?\.?\s*marks|duration\s*:?\s*\d\s*hours|answer\s+(all|any)\s+(the\s+)?questions|\bpart\s*[-–]?\s*[ab]\b|reg\.?\s*no)/i.test(
      clean,
    );
  const { examSession, examYear } = parseSession(clean.slice(0, 800));
  const type: ResourceType | null = isPaper ? "pyq" : null;
  if (isPaper) signals.push("Question-paper layout detected");
  if (examSession) signals.push(`Exam session ${examSession}`);

  const module = parseModule(clean.slice(0, 400));
  const semester = parseSemester(clean.slice(0, 600));

  return { codes, courseName, type, examSession, examYear, module, semester, signals };
}

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function significantWords(name: string) {
  return tokens(name).filter((t) => t.length > 1 || t === "c");
}

function acronym(name: string) {
  return name
    .split(/[\s&,/-]+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()) && /^[a-z]/i.test(w))
    .map((w) => w[0].toLowerCase())
    .join("");
}

function wordMatches(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

/** Picks the most likely subject for a file, or null when nothing is convincing. */
export function matchSubject(
  input: { text: string; codes: string[]; courseName?: string | null; semester?: number | null },
  subjects: SubjectLite[],
  context: { department?: string | null; semester?: number | null } = {},
): SubjectMatch | null {
  if (subjects.length === 0) return null;
  const sem = input.semester ?? context.semester ?? null;
  const prefer = (list: SubjectLite[]) =>
    list.find((s) => (sem ? s.semester === sem : true) && (context.department ? s.department_slugs.includes(context.department) : true)) ??
    list.find((s) => (context.department ? s.department_slugs.includes(context.department) : false)) ??
    list[0];

  // 1. Exact course code
  for (const code of input.codes) {
    const hits = subjects.filter((s) => s.code && s.code.replace(/\s/g, "").toUpperCase() === code);
    if (hits.length) {
      const s = prefer(hits);
      return { subjectId: s.id, confidence: "high", reason: `Matched course code ${code}` };
    }
  }

  const fileTokens = tokens(`${input.text} ${input.courseName ?? ""}`);
  const tokenSet = new Set(fileTokens);
  const haystack = ` ${fileTokens.join(" ")} `;

  let best: { s: SubjectLite; score: number; reason: string } | null = null;
  let runnerUp = 0;

  for (const s of subjects) {
    let score = 0;
    let reason = "";

    // 2. Course name printed on the document
    if (input.courseName) {
      const a = new Set(significantWords(input.courseName));
      const b = significantWords(s.name);
      const overlap = b.filter((w) => [...a].some((x) => wordMatches(x, w))).length / Math.max(b.length, a.size, 1);
      if (overlap >= 0.75) {
        score = 0.9 + overlap * 0.05;
        reason = `Course name "${input.courseName}" on page 1`;
      }
    }

    // 3. Admin-defined keywords / aliases
    for (const k of s.keywords) {
      const kw = k.toLowerCase().trim();
      if (!kw) continue;
      const hit = kw.includes(" ") ? haystack.includes(` ${kw} `) : tokenSet.has(kw);
      if (hit && score < 0.88) {
        score = kw.length <= 2 ? 0.8 : 0.88;
        reason = `Matched keyword "${k}"`;
      }
    }

    // 4. Acronym (DBMS, OS, COA ...)
    const acr = acronym(s.name);
    if (acr.length >= 2 && tokenSet.has(acr) && score < 0.82) {
      score = 0.82;
      reason = `Matched abbreviation ${acr.toUpperCase()}`;
    }

    // 5. Name words
    const core = significantWords(s.name);
    if (core.length) {
      const matched = core.filter((w) => fileTokens.some((t) => wordMatches(t, w))).length;
      const overlap = matched / core.length;
      if (overlap >= 0.6) {
        const nameScore = 0.55 + overlap * 0.35;
        if (nameScore > score) {
          score = nameScore;
          reason = `Matched subject name`;
        }
      } else if (s.short_name) {
        const shortWords = significantWords(s.short_name);
        if (shortWords.length && shortWords.every((w) => fileTokens.some((t) => wordMatches(t, w))) && score < 0.7) {
          score = 0.7;
          reason = `Matched "${s.short_name}"`;
        }
      }
    }

    if (score > 0) {
      if (sem && s.semester === sem) score += 0.04;
      if (context.department && s.department_slugs.includes(context.department)) score += 0.03;
    }

    if (!best || score > best.score) {
      runnerUp = best?.score ?? 0;
      best = { s, score, reason };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  if (!best || best.score < 0.6) return null;
  const ambiguous = best.score - runnerUp < 0.04;
  const confidence = best.score >= 0.85 && !ambiguous ? "high" : "medium";
  return { subjectId: best.s.id, confidence, reason: best.reason };
}

/** Combines filename hints with document hints; the document wins on facts it states explicitly. */
export function mergeDetected(fromName: Detected, fromDoc: Partial<Detected> & { signals: string[] }): Detected {
  const type = fromDoc.type ?? fromName.type;
  return {
    ...fromName,
    type,
    module: fromName.module ?? fromDoc.module ?? null,
    codes: [...new Set([...(fromDoc.codes ?? []), ...fromName.codes])],
    examSession: fromDoc.examSession ?? fromName.examSession,
    examYear: fromDoc.examYear ?? fromName.examYear,
    semester: fromName.semester ?? fromDoc.semester ?? null,
    courseName: fromDoc.courseName ?? null,
    title:
      type === "pyq" && fromName.type !== "pyq" && (fromDoc.examSession ?? fromName.examSession)
        ? `${fromDoc.examSession ?? fromName.examSession} Question Paper`
        : fromName.title,
    signals: [...fromName.signals, ...fromDoc.signals],
  };
}

/**
 * Once the subject is known, drop words that just repeat it ("DBMS", "Physics")
 * so titles describe the content: "Mechanics Notes - Physics Mod 2" → "Mechanics".
 */
export function refineTitle(detected: Pick<Detected, "title" | "module" | "type" | "examSession">, subject: SubjectLite) {
  const drop = new Set(
    [
      ...significantWords(subject.name),
      ...significantWords(subject.short_name ?? ""),
      ...subject.keywords.flatMap((k) => significantWords(k)),
      acronym(subject.name),
      (subject.code ?? "").toLowerCase(),
    ].filter(Boolean),
  );
  const kept = detected.title.split(" ").filter((w) => w.length < 2 || !drop.has(w.toLowerCase()));
  const refined = kept
    .join(" ")
    .replace(/^(and|of|the|in|for|to|on|with|by)\b\s*/i, "")
    .replace(/\s*\b(and|of|the|in|for|to|on|with|by)$/i, "")
    .trim();
  if (refined.length >= 3 && !/^[\d\s]+$/.test(refined)) return titleCase(refined);
  if (detected.type === "pyq") return detected.examSession ? `${detected.examSession} Question Paper` : "University Question Paper";
  if (detected.type === "qbank") return "Question Bank";
  if (detected.type === "lab") return "Lab Record";
  if (detected.module) return `Module ${detected.module} Notes`;
  return refined.length >= 2 ? titleCase(refined) : "Complete Notes";
}
