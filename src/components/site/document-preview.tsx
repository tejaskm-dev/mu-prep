"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import { embeddableUrl, fileKind } from "@/lib/format";
import { loadPdfjs } from "@/lib/pdf";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

type PdfDoc = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>["promise"]>;

/** Picks the right in-page viewer for the file type. */
export function DocumentPreview({
  url,
  externalUrl,
  mime,
  name,
  title,
  thumbnail,
}: {
  url: string | null;
  externalUrl: string | null;
  mime: string | null;
  name: string | null;
  title: string;
  thumbnail: string | null;
}) {
  const kind = fileKind(mime, name, !url && !!externalUrl);

  if (url && kind === "PDF") return <PdfViewer url={url} title={title} />;

  if (url && kind === "IMG") {
    return (
      <Frame>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded document image */}
        <img src={url} alt={title} className="mx-auto max-h-[80dvh] w-auto max-w-full rounded-lg object-contain" />
      </Frame>
    );
  }

  if (url && (kind === "DOC" || kind === "PPT" || kind === "XLS")) {
    return (
      <Frame className="p-0">
        <iframe
          title={title}
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
          className="h-[78dvh] min-h-[480px] w-full rounded-xl bg-white"
          loading="lazy"
        />
      </Frame>
    );
  }

  const embed = embeddableUrl(externalUrl);
  if (embed) {
    return (
      <Frame className="p-0">
        <iframe
          title={title}
          src={embed}
          className="aspect-video w-full rounded-xl bg-black"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </Frame>
    );
  }

  return (
    <Frame className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated preview
        <img src={thumbnail} alt="" className="max-h-72 rounded-lg border border-border object-contain" />
      ) : null}
      <p className="max-w-sm text-sm text-muted-foreground">
        {externalUrl ? "This resource lives on another site." : "Preview isn't available for this file type."} Use the buttons
        to open or download it.
      </p>
      <a
        href={externalUrl ?? url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white"
      >
        Open {externalUrl ? "link" : "file"} <ExternalLink className="size-4" />
      </a>
    </Frame>
  );
}

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-[#eef0ea] p-3 sm:p-4", className)}>{children}</div>;
}

const ZOOMS = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6, 2];

/** Lightweight pdf.js viewer: renders pages lazily as they scroll into view. */
function PdfViewer({ url, title }: { url: string; title: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(3); // index into ZOOMS (1 = fit width)
  const [current, setCurrent] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const lib = await loadPdfjs();
        const task = lib.getDocument({ url, disableAutoFetch: true, rangeChunkSize: 262144 });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (!cancelled) {
          setRatio(vp.height / vp.width);
          setDoc(pdf);
        }
      } catch (error) {
        console.warn("[pdf] falling back to the browser viewer", error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === container.current?.parentElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const el = container.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  if (failed) {
    return (
      <Frame className="p-0">
        <iframe title={title} src={url} className="h-[80dvh] min-h-[520px] w-full rounded-xl bg-white" />
      </Frame>
    );
  }

  const pageWidth = Math.max(240, (width - 8) * ZOOMS[zoom]);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-[#e9ebe4]", fullscreen && "flex h-full flex-col rounded-none")}>
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-border bg-white/95 px-3 py-2 backdrop-blur">
        <span className="text-[13px] font-medium text-ink tabular-nums">
          {doc ? (
            <>
              Page {current} <span className="text-muted-foreground">/ {doc.numPages}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MuSpinner className="size-3.5" /> Loading preview…
            </span>
          )}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <ToolButton label="Zoom out" disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))}>
            <ZoomOut />
          </ToolButton>
          <button
            type="button"
            onClick={() => setZoom(3)}
            className="h-8 min-w-14 rounded-md px-2 text-[12px] font-medium text-ink tabular-nums hover:bg-muted"
            title="Fit to width"
          >
            {Math.round(ZOOMS[zoom] * 100)}%
          </button>
          <ToolButton label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}>
            <ZoomIn />
          </ToolButton>
          <ToolButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </ToolButton>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-md text-ink hover:bg-muted" aria-label="Open in new tab" title="Open in new tab">
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
      <div
        ref={container}
        className={cn("overflow-auto p-3 sm:p-4", fullscreen ? "flex-1" : "max-h-[82dvh] min-h-[420px]")}
        tabIndex={0}
        aria-label={`${title} preview`}
      >
        {doc && width > 0 ? (
          <div className="mx-auto flex flex-col items-center gap-3" style={{ width: pageWidth }}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i} doc={doc} number={i + 1} width={pageWidth} ratio={ratio} root={container} onVisible={setCurrent} />
            ))}
          </div>
        ) : (
          <div className="mx-auto aspect-[1/1.414] w-full max-w-[640px] animate-pulse rounded-md bg-white/70" />
        )}
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md text-ink hover:bg-muted disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function PdfPage({
  doc,
  number,
  width,
  ratio,
  root,
  onVisible,
}: {
  doc: PdfDoc;
  number: number;
  width: number;
  ratio: number;
  root: React.RefObject<HTMLDivElement | null>;
  onVisible: (n: number) => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(number <= 2);
  const [height, setHeight] = useState(width * ratio);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setNear(true);
          if (e.intersectionRatio > 0.35) onVisible(number);
        }
      },
      { root: root.current, rootMargin: "600px 0px", threshold: [0, 0.35] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [number, onVisible, root]);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return () => {};
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: scale * dpr });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${(viewport.height / dpr).toFixed(0)}px`;
    setHeight(viewport.height / dpr);
    const task = page.render({ canvas, viewport });
    try {
      await task.promise;
    } catch {
      // cancelled by a newer render
    }
    return () => task.cancel();
  }, [doc, number, width]);

  useEffect(() => {
    if (!near) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      void render().then((c) => (cleanup = c));
    }, 60);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [near, render]);

  return (
    <div ref={wrapper} className="relative w-full overflow-hidden rounded-sm bg-white shadow-sm" style={{ height }} data-page={number}>
      <canvas ref={canvasRef} className="block" aria-label={`Page ${number}`} />
    </div>
  );
}
