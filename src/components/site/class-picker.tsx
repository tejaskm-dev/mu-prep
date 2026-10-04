"use client";

import { DynamicIcon } from "@/components/dynamic-icon";
import { SEMESTERS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type DepartmentOption = { slug: string; code: string; name: string; icon: string };

export function DepartmentGrid({
  departments,
  value,
  onChange,
  className,
  size = "md",
}: {
  departments: DepartmentOption[];
  value: string | null;
  onChange: (slug: string) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label="Department" className={cn("grid gap-3", className)}>
      {departments.map((d) => {
        const active = value === d.slug;
        return (
          <button
            key={d.slug}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            title={d.name}
            onClick={() => onChange(d.slug)}
            className={cn(
              "select-tile group flex flex-col items-center justify-center gap-2 px-2 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              size === "md" ? "h-[88px] sm:h-[92px]" : "h-[76px]",
            )}
          >
            <DynamicIcon
              name={d.icon}
              strokeWidth={1.7}
              className={cn(
                "size-6 transition-colors",
                active ? "text-brand" : "text-ink/85 group-hover:text-brand",
              )}
            />
            <span className="text-[14px] leading-none font-semibold tracking-[-0.01em] text-ink sm:text-[15px]">
              {d.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SemesterRow({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (sem: number) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Semester" className={cn("grid grid-cols-4 gap-2.5 sm:grid-cols-8 sm:gap-3", className)}>
      {SEMESTERS.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(s)}
            className="select-tile h-10 text-[15px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            S{s}
          </button>
        );
      })}
    </div>
  );
}
