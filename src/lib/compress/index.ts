"use client";

import { loadPdfjs } from "@/lib/pdf";
import type { CompressInput, CompressOptions, CompressOutput } from "./core";

export type CompressResult = {
  file: File;
  changed: boolean;
  originalSize: number;
  compressedSize: number;
  detail: string;
};

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, (output: CompressOutput) => void>();
let chain: Promise<unknown> = Promise.resolve();

function getWorker() {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./compress.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ id: number; output: CompressOutput }>) => {
      pending.get(e.data.id)?.(e.data.output);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      workerBroken = true;
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

async function run(input: CompressInput): Promise<CompressOutput> {
  const w = getWorker();
  if (w) {
    const id = nextId++;
    const output = await new Promise<CompressOutput | null>((resolve) => {
      pending.set(id, resolve);
      const copy = input.buffer.slice(0);
      w.postMessage({ id, input: { ...input, buffer: copy } }, [copy]);
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve(null);
        }
      }, 120_000);
    });
    if (output) return output;
  }
  // Fallback: same code on the main thread.
  const { compressBuffer } = await import("./core");
  return compressBuffer(input);
}

async function samePageCount(original: File, compressed: ArrayBuffer) {
  try {
    const lib = await loadPdfjs();
    const taskA = lib.getDocument({ data: new Uint8Array(await original.arrayBuffer()) });
    const taskB = lib.getDocument({ data: new Uint8Array(compressed.slice(0)) });
    try {
      const [a, b] = await Promise.all([taskA.promise, taskB.promise]);
      return a.numPages === b.numPages && (await b.getPage(b.numPages).then(() => true));
    } finally {
      void taskA.destroy();
      void taskB.destroy();
    }
  } catch {
    return false;
  }
}

/**
 * Shrinks a file before upload without visible quality loss. Always resolves —
 * falls back to the original file on any problem. Jobs run one at a time.
 */
export function compressForUpload(file: File, options?: Partial<CompressOptions>): Promise<CompressResult> {
  const job = chain.then(async (): Promise<CompressResult> => {
    const unchanged = (detail: string): CompressResult => ({ file, changed: false, originalSize: file.size, compressedSize: file.size, detail });
    if (file.size < 150_000) return unchanged("Small file kept as-is");
    try {
      const output = await run({ buffer: await file.arrayBuffer(), name: file.name, type: file.type, options });
      if (!output.buffer) return unchanged(output.detail);
      if (output.type === "application/pdf" && !(await samePageCount(file, output.buffer))) return unchanged("Kept original (verification failed)");
      const next = new File([output.buffer], output.name, { type: output.type, lastModified: file.lastModified });
      return { file: next, changed: true, originalSize: file.size, compressedSize: next.size, detail: output.detail };
    } catch {
      return unchanged("Kept original");
    }
  });
  chain = job.catch(() => undefined);
  return job;
}
