import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MuMark({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/brand/mu-mark.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn("shrink-0 select-none", className)}
    />
  );
}

/** µ mark + PREP wordmark, as in the mockup. */
export function MuPrepLogo({ className, href = "/", size = "md" }: { className?: string; href?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: { mark: 30, text: "text-[19px]" }, md: { mark: 36, text: "text-[23px]" }, lg: { mark: 52, text: "text-[34px]" } }[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <MuMark size={dims.mark} />
      <span className={cn("font-display leading-none font-black tracking-[-0.04em] text-ink", dims.text)}>PREP</span>
      <span className="sr-only">µPrep home</span>
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="rounded-md outline-offset-4" aria-label="µPrep home">
      {content}
    </Link>
  );
}

export function MuLearnLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny vector logo, no optimisation needed
    <img src="/brand/mulearn-asi.svg" alt="µLearn ASI" width={120} height={33} className={cn("h-auto select-none", className)} />
  );
}
