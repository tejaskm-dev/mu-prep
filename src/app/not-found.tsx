import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MuPrepLogo } from "@/components/brand/logos";

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <MuPrepLogo size="md" />
      <p className="mt-10 font-hand text-[42px] leading-none font-semibold text-brand">Oops!</p>
      <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">It may have moved, or the link is incomplete.</p>
      <Link href="/" className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-5 text-sm font-medium text-white">
        Back to µPrep <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
