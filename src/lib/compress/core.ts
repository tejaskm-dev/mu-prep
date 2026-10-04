// Lossless-looking compression for uploads, runnable in a Web Worker or on the
// main thread. Nothing is ever upscaled, text and vector content in PDFs is left
// untouched, and the original is kept whenever the saving isn't worth it.
//
//  • Photos / screenshots → WebP (JPEG fallback), long side capped at 2400px.
//    PNG screenshots below the cap are re-encoded losslessly.
//  • PDFs → only embedded raster images are re-encoded (scans are usually
//    oversized 300–600 dpi camera JPEGs); they're capped at ~200 dpi for the page
//    they sit on. Text, fonts, vectors, links and structure stay byte-identical.
//  • DOCX / PPTX / XLSX → embedded media is optimised in place, then re-zipped.

import type { PDFDict as PDFDictType } from "pdf-lib";

export type CompressOptions = {
  maxImageSide: number;
  photoQuality: number;
  pdfDpi: number;
  pdfJpegQuality: number;
  minSavings: number; // keep the original unless we save at least this fraction
};

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  maxImageSide: 2400,
  photoQuality: 0.85,
  pdfDpi: 200,
  pdfJpegQuality: 0.85,
  minSavings: 0.1,
};

export type CompressInput = { buffer: ArrayBuffer; name: string; type: string; options?: Partial<CompressOptions> };

export type CompressOutput = {
  buffer: ArrayBuffer | null; // null → keep the original
  name: string;
  type: string;
  originalSize: number;
  compressedSize: number;
  method: "pdf-images" | "pdf-structure" | "image" | "office-media" | "none";
  detail: string;
};

type Canvasish = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): Canvasish {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasBlob(canvas: Canvasish, type: string, quality: number): Promise<Blob | null> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality));
}

function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scaled: scale < 1 };
}

async function drawScaled(source: ImageBitmap, width: number, height: number, opaque: boolean): Promise<Canvasish> {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D canvas unavailable");
  if (opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function swapExtension(name: string, ext: string) {
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name.replace(/\.[a-z0-9]{2,5}$/i, `.${ext}`) : `${name}.${ext}`;
}

function result(input: CompressInput, partial: Partial<CompressOutput> & Pick<CompressOutput, "method" | "detail">): CompressOutput {
  return {
    buffer: null,
    name: input.name,
    type: input.type,
    originalSize: input.buffer.byteLength,
    compressedSize: input.buffer.byteLength,
    ...partial,
  };
}

// ───────────────────────────────────────────── images

async function compressImage(input: CompressInput, o: CompressOptions): Promise<CompressOutput> {
  const type = input.type.toLowerCase();
  if (type === "image/gif" || type === "image/svg+xml") return result(input, { method: "none", detail: "Format kept as-is" });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([input.buffer], { type }), { imageOrientation: "from-image" });
  } catch {
    return result(input, { method: "none", detail: "Couldn't decode image" });
  }
  const isPng = type === "image/png";
  const { width, height, scaled } = fitWithin(bitmap.width, bitmap.height, o.maxImageSide);
  const canvas = await drawScaled(bitmap, width, height, false);
  bitmap.close();

  // Lossless WebP for unscaled screenshots/diagrams, high-quality lossy otherwise.
  const quality = isPng && !scaled ? 1 : isPng ? 0.92 : o.photoQuality;
  let blob = await canvasBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    if (isPng) return result(input, { method: "none", detail: "WebP encoding unavailable" }); // keep transparency
    blob = await canvasBlob(canvas, "image/jpeg", o.photoQuality);
  }
  if (!blob) return result(input, { method: "none", detail: "Encoding failed" });
  const outType = blob.type;
  if (blob.size > input.buffer.byteLength * (1 - o.minSavings)) return result(input, { method: "none", detail: "Already optimised" });
  return result(input, {
    buffer: await blob.arrayBuffer(),
    name: swapExtension(input.name, outType === "image/webp" ? "webp" : "jpg"),
    type: outType,
    compressedSize: blob.size,
    method: "image",
    detail: `${scaled ? `Resized to ${width}×${height}, ` : ""}${outType === "image/webp" ? "WebP" : "JPEG"}`,
  });
}

// ───────────────────────────────────────────── PDFs

function unpredictPng(data: Uint8Array, colors: number, bpc: number, columns: number) {
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowLength = Math.ceil((colors * bpc * columns) / 8);
  const rows = Math.floor(data.length / (rowLength + 1));
  const out = new Uint8Array(rows * rowLength);
  let prev = new Uint8Array(rowLength);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * (rowLength + 1)];
    const src = data.subarray(r * (rowLength + 1) + 1, (r + 1) * (rowLength + 1));
    const cur = out.subarray(r * rowLength, (r + 1) * rowLength);
    for (let i = 0; i < rowLength; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  return out;
}

async function compressPdf(input: CompressInput, o: CompressOptions): Promise<CompressOutput> {
  const lib = await import("pdf-lib");
  const { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, PDFRawStream, PDFRef, PDFBool, decodePDFRawStream } = lib;
  let doc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    doc = await PDFDocument.load(input.buffer, { updateMetadata: false });
  } catch {
    return result(input, { method: "none", detail: "Encrypted or unreadable PDF" });
  }
  const N = (name: string) => PDFName.of(name);
  const num = (value: unknown) => (value instanceof PDFNumber ? value.asNumber() : undefined);

  // Which page size (in points) each image is drawn on, to cap its resolution.
  const sideByImage = new Map<string, number>();
  const visit = (resources: PDFDictType | undefined, side: number, depth: number) => {
    const xobjects = resources?.lookup(N("XObject"));
    if (!(xobjects instanceof PDFDict)) return;
    for (const [, value] of xobjects.entries()) {
      if (!(value instanceof PDFRef)) continue;
      const obj = doc.context.lookup(value);
      if (!(obj instanceof PDFRawStream)) continue;
      const subtype = obj.dict.lookup(N("Subtype"));
      if (subtype === N("Image")) sideByImage.set(value.toString(), Math.max(side, sideByImage.get(value.toString()) ?? 0));
      else if (subtype === N("Form") && depth < 4) {
        const inner = obj.dict.lookup(N("Resources"));
        visit(inner instanceof PDFDict ? inner : undefined, side, depth + 1);
      }
    }
  };
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    visit(page.node.Resources(), Math.max(width, height), 0);
  }

  let replaced = 0;
  let before = 0;
  let after = 0;
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (dict.lookup(N("Subtype")) !== N("Image")) continue;
    if (obj.contents.byteLength < 48_000) continue; // not worth it
    if (dict.lookup(N("ImageMask")) instanceof PDFBool) continue;
    if (dict.has(N("SMask")) || dict.has(N("Mask")) || dict.has(N("Decode"))) continue;

    const width = num(dict.lookup(N("Width"))) ?? 0;
    const height = num(dict.lookup(N("Height"))) ?? 0;
    const bpc = num(dict.lookup(N("BitsPerComponent"))) ?? 8;
    if (!width || !height || bpc !== 8 || width * height > 60_000_000) continue;

    // Colour space: RGB or grey only (incl. ICC-based equivalents).
    let colors = 0;
    const cs = dict.lookup(N("ColorSpace"));
    if (cs === N("DeviceRGB")) colors = 3;
    else if (cs === N("DeviceGray")) colors = 1;
    else if (cs instanceof PDFArray && cs.lookup(0) === N("ICCBased")) {
      const icc = cs.lookup(1);
      const n = icc instanceof PDFRawStream ? num(icc.dict.lookup(N("N"))) : undefined;
      if (n === 3 || n === 1) colors = n;
    }
    if (!colors) continue;

    const filter = dict.lookup(N("Filter"));
    const filterName = filter instanceof PDFArray ? (filter.size() === 1 ? filter.lookup(0) : null) : filter;
    let bitmap: ImageBitmap | null = null;
    try {
      if (filterName === N("DCTDecode")) {
        if (dict.has(N("DecodeParms"))) continue;
        bitmap = await createImageBitmap(new Blob([obj.contents as BlobPart], { type: "image/jpeg" }));
      } else if (filterName === N("FlateDecode")) {
        let raw = decodePDFRawStream(obj).decode();
        const parms = dict.lookup(N("DecodeParms"));
        if (parms instanceof PDFDict) {
          const predictor = num(parms.lookup(N("Predictor"))) ?? 1;
          if (predictor >= 10) raw = unpredictPng(raw, colors, bpc, width);
          else if (predictor !== 1) continue;
        }
        if (raw.length < width * height * colors) continue;
        const rgba = new Uint8ClampedArray(width * height * 4);
        for (let p = 0, s = 0; p < width * height; p++, s += colors) {
          const r = raw[s];
          rgba[p * 4] = r;
          rgba[p * 4 + 1] = colors === 3 ? raw[s + 1] : r;
          rgba[p * 4 + 2] = colors === 3 ? raw[s + 2] : r;
          rgba[p * 4 + 3] = 255;
        }
        bitmap = await createImageBitmap(new ImageData(rgba, width, height));
      } else continue;
    } catch {
      continue;
    }
    if (!bitmap) continue;

    const pageSide = sideByImage.get(ref.toString());
    const maxSide = pageSide ? Math.ceil((pageSide / 72) * o.pdfDpi) : o.maxImageSide;
    const target = fitWithin(width, height, Math.max(maxSide, 600));
    const canvas = await drawScaled(bitmap, target.width, target.height, true);
    bitmap.close();
    const blob = await canvasBlob(canvas, "image/jpeg", o.pdfJpegQuality);
    if (!blob || blob.size >= obj.contents.byteLength * 0.9) continue;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const next = dict.clone(doc.context);
    next.set(N("Filter"), N("DCTDecode"));
    next.delete(N("DecodeParms"));
    next.set(N("Width"), PDFNumber.of(target.width));
    next.set(N("Height"), PDFNumber.of(target.height));
    next.set(N("BitsPerComponent"), PDFNumber.of(8));
    next.set(N("ColorSpace"), N("DeviceRGB"));
    next.set(N("Length"), PDFNumber.of(bytes.length));
    before += obj.contents.byteLength;
    after += bytes.length;
    doc.context.assign(ref, PDFRawStream.of(next, bytes));
    replaced++;
  }

  const saved = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  if (saved.byteLength > input.buffer.byteLength * (1 - o.minSavings)) {
    return result(input, { method: "none", detail: replaced ? "Saving too small to matter" : "Already optimised" });
  }
  const buffer = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
  return result(input, {
    buffer,
    type: "application/pdf",
    compressedSize: saved.byteLength,
    method: replaced ? "pdf-images" : "pdf-structure",
    detail: replaced ? `Re-encoded ${replaced} scanned ${replaced === 1 ? "image" : "images"} (${Math.round((1 - after / Math.max(before, 1)) * 100)}% smaller)` : "Repacked PDF structure",
  });
}

// ───────────────────────────────────────────── Office (zip) documents

async function compressOffice(input: CompressInput, o: CompressOptions): Promise<CompressOutput> {
  const { unzipSync, zipSync } = await import("fflate");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(input.buffer));
  } catch {
    return result(input, { method: "none", detail: "Couldn't open document" });
  }
  let optimised = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (!/^(word|ppt|xl)\/media\//.test(path) || data.byteLength < 120_000) continue;
    const isJpeg = /\.jpe?g$/i.test(path);
    const isPng = /\.png$/i.test(path);
    if (!isJpeg && !isPng) continue;
    try {
      const bitmap = await createImageBitmap(new Blob([data as BlobPart], { type: isJpeg ? "image/jpeg" : "image/png" }));
      const target = fitWithin(bitmap.width, bitmap.height, o.maxImageSide);
      if (isPng && !target.scaled) {
        bitmap.close();
        continue; // PNG re-encoding without resizing rarely helps
      }
      const canvas = await drawScaled(bitmap, target.width, target.height, isJpeg);
      bitmap.close();
      // Keep each file's format so document relationships stay valid.
      const blob = await canvasBlob(canvas, isJpeg ? "image/jpeg" : "image/png", o.photoQuality);
      if (blob && blob.size < data.byteLength * 0.9) {
        entries[path] = new Uint8Array(await blob.arrayBuffer());
        optimised++;
      }
    } catch {
      // leave this media file untouched
    }
  }
  const zipped = zipSync(entries, { level: 9 });
  if (zipped.byteLength > input.buffer.byteLength * (1 - o.minSavings)) {
    return result(input, { method: "none", detail: optimised ? "Saving too small to matter" : "Already optimised" });
  }
  return result(input, {
    buffer: zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer,
    compressedSize: zipped.byteLength,
    method: "office-media",
    detail: optimised ? `Optimised ${optimised} embedded ${optimised === 1 ? "image" : "images"}` : "Repacked document",
  });
}

export async function compressBuffer(input: CompressInput): Promise<CompressOutput> {
  const o = { ...DEFAULT_COMPRESS_OPTIONS, ...input.options };
  const type = input.type.toLowerCase();
  const ext = input.name.toLowerCase().split(".").pop() ?? "";
  try {
    if (type === "application/pdf" || ext === "pdf") return await compressPdf(input, o);
    if (type.startsWith("image/")) return await compressImage(input, o);
    if (["docx", "pptx", "xlsx"].includes(ext) || /officedocument/.test(type)) return await compressOffice(input, o);
  } catch (error) {
    return result(input, { method: "none", detail: error instanceof Error ? error.message : "Compression failed" });
  }
  return result(input, { method: "none", detail: "Format kept as-is" });
}
