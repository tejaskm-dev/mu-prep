"use client";

// Browser-side document helpers: pdf.js loading, first-page thumbnails, text
// extraction for smart metadata, image downscaling and content hashing.

type PdfJs = typeof import("pdfjs-dist");

let pdfjs: Promise<PdfJs> | null = null;

export function loadPdfjs() {
  pdfjs ??= import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod;
  });
  return pdfjs;
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.78): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (webp && webp.type === "image/webp") return webp;
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export type PdfAnalysis = { pageCount: number; text: string; thumbnail: Blob | null };

/** Reads page count + first-page text and renders a thumbnail, all locally. */
export async function analyzePdf(source: File | ArrayBuffer, thumbWidth = 720): Promise<PdfAnalysis> {
  const lib = await loadPdfjs();
  const data = source instanceof File ? new Uint8Array(await source.arrayBuffer()) : new Uint8Array(source);
  const task = lib.getDocument({ data });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: thumbWidth / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(Math.min(viewport.height, thumbWidth * 1.5));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    await page.render({ canvas, viewport }).promise;
    const thumbnail = await canvasToBlob(canvas);

    let text = "";
    for (let n = 1; n <= Math.min(doc.numPages, 2) && text.length < 1500; n++) {
      const p = n === 1 ? page : await doc.getPage(n);
      const content = await p.getTextContent();
      text += ` ${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}`;
    }
    return { pageCount: doc.numPages, text: text.trim(), thumbnail };
  } finally {
    void task.destroy();
  }
}

/** Downscales a photo/screenshot into a light thumbnail. */
export async function imageThumbnail(file: Blob, maxWidth = 720): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(Math.min(bitmap.height * scale, maxWidth * 1.5));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
    bitmap.close();
    return canvasToBlob(canvas);
  } catch {
    return null;
  }
}

export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Combines photos of handwritten pages into a single PDF (one image per page),
 * downscaling large camera shots so the result stays small.
 */
export async function imagesToPdf(images: File[], name = "notes.pdf", maxSide = 1700): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const img of images) {
    const bitmap = await createImageBitmap(img);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!jpeg) continue;
    const embedded = await pdf.embedJpg(await jpeg.arrayBuffer());
    const page = pdf.addPage([canvas.width, canvas.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  }
  const bytes = await pdf.save();
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}
