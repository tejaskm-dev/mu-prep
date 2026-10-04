import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  action,
  className,
  children,
  as: Tag = "h2",
}: {
  title: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
  children?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div>
        <span className="section-mark mb-3" aria-hidden />
        <Tag className="text-[21px] leading-tight font-bold tracking-[-0.015em] text-ink sm:text-[22px]">{title}</Tag>
      </div>
      <div className="flex min-w-0 items-center gap-4">
        {children}
        {action ? (
          <Link
            href={action.href}
            className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-foreground/80 hover:text-ink"
          >
            {action.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
