import { cn } from "@/lib/utils";

// The µ from the logo, drawn as two pen strokes so it can "write itself".
const STEM = "M37.8 15.8 C37.4 33 36.4 47 32.6 60 C29.4 71 23.2 80.6 12.5 91";
const BOWL =
  "M34.6 51 C35 66.5 40.8 75.4 49.6 75.4 C58.2 75.4 64.8 67.4 65.8 56 L66.3 26.5 L66.1 65.5 C66.1 72.6 71 75.6 76.2 72.8 C79.2 71.1 81.6 67.9 83.1 64.3";

function MuGlyph({ ripple }: { ripple: boolean }) {
  return (
    <svg viewBox="-12 -12 124 124" className="size-full overflow-visible" aria-hidden>
      <defs>
        <clipPath id="mu-loader-clip">
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      {ripple ? <circle className="mu-ripple" cx="50" cy="50" r="47" fill="none" stroke="var(--mu)" strokeWidth="3" /> : null}
      <g className="mu-disc">
        <circle cx="50" cy="50" r="47" fill="var(--mu)" />
        <g clipPath="url(#mu-loader-clip)" fill="none" stroke="var(--ink)" strokeWidth="10.4" strokeLinecap="round" strokeLinejoin="round">
          <path className="mu-stroke-a" d={STEM} pathLength={1} />
          <path className="mu-stroke-b" d={BOWL} pathLength={1} />
        </g>
      </g>
    </svg>
  );
}

/** Brand loader: the µ writes itself, settles, and ripples. */
export function MuLoader({ size = 56, className, label = "Loading" }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("mu-loader inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <MuGlyph ripple />
    </span>
  );
}

/** Inline version for buttons and small pending states (replaces generic spinners). */
export function MuSpinner({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Working" className={cn("mu-loader mu-loader--sm inline-block size-[1.15em] shrink-0", className)}>
      <MuGlyph ripple={false} />
    </span>
  );
}

/** Full-area loading state used by route `loading.tsx` files. */
export function PageLoader({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[55vh] items-center justify-center", className)}>
      <div className="loader-reveal flex flex-col items-center gap-3">
        <MuLoader size={58} />
        <span className="text-[13px] font-medium tracking-wide text-muted-foreground">{label}…</span>
      </div>
    </div>
  );
}
