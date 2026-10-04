import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="font-hand text-[42px] leading-none font-semibold text-brand">Oops!</p>
      <h1 className="mt-4 text-[28px] font-extrabold tracking-[-0.03em] text-ink sm:text-[34px]">This page took a semester off</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">The link may be old, or the file was moved. Try searching or head back home.</p>
      <div className="mt-7 flex gap-3">
        <Link href="/" className="inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white">
          Go home <ArrowRight className="size-4" />
        </Link>
        <Link href="/notes" className="inline-flex h-11 items-center rounded-lg border border-border bg-white px-5 text-sm font-medium text-ink">
          Browse notes
        </Link>
      </div>
    </div>
  );
}
