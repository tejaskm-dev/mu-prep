"use client";

import { useMemo, useState } from "react";
import { Command as Cmd } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SubjectOption = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  code: string | null;
  semester: number;
  icon: string;
  keywords: string[];
  department_slugs: string[];
};

/** Searchable subject picker; subjects matching the current context are listed first. */
export function SubjectCombobox({
  subjects,
  value,
  onChange,
  context,
  placeholder = "Choose subject",
  className,
  invalid,
  size = "md",
}: {
  subjects: SubjectOption[];
  value: string | null;
  onChange: (id: string) => void;
  context?: { department?: string | null; semester?: number | null };
  placeholder?: string;
  className?: string;
  invalid?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const selected = subjects.find((s) => s.id === value);

  const { suggested, rest } = useMemo(() => {
    const matches = (s: SubjectOption) =>
      (!context?.department || s.department_slugs.includes(context.department)) && (!context?.semester || s.semester === context.semester);
    const hasContext = Boolean(context?.department || context?.semester);
    const sorted = [...subjects].sort((a, b) => a.semester - b.semester || a.name.localeCompare(b.name));
    return {
      suggested: hasContext ? sorted.filter(matches) : [],
      rest: hasContext ? sorted.filter((s) => !matches(s)) : sorted,
    };
  }, [subjects, context?.department, context?.semester]);

  const item = (s: SubjectOption) => (
    <Cmd.Item
      key={s.id}
      value={`${s.name} ${s.short_name ?? ""} ${s.code ?? ""} s${s.semester} ${s.keywords.join(" ")} ${s.id}`}
      onSelect={() => {
        onChange(s.id);
        setOpen(false);
      }}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink data-[selected=true]:bg-lime-soft"
    >
      <DynamicIcon name={s.icon} className="size-4 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate">{s.name}</span>
      {s.code ? <span className="font-mono text-[11px] text-muted-foreground">{s.code}</span> : null}
      <span className="rounded bg-muted px-1.5 text-[10.5px] font-semibold text-ink/70">S{s.semester}</span>
      {value === s.id ? <Check className="size-3.5 text-brand" /> : null}
    </Cmd.Item>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-input bg-white px-2.5 text-left text-[13px] outline-none hover:border-lime-border focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
            size === "sm" ? "h-8" : "h-9",
            className,
          )}
        >
          {selected ? (
            <>
              <DynamicIcon name={selected.icon} className="size-3.5 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate text-ink">
                <span className="mr-1.5 text-[11px] font-semibold text-muted-foreground">S{selected.semester}</span>
                {selected.name}
              </span>
            </>
          ) : (
            <span className="flex-1 truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] p-0">
        <Cmd loop className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-muted-foreground" />
            <Cmd.Input autoFocus placeholder="Search name, code or alias…" className="h-10 w-full bg-transparent text-[13px] outline-none" />
          </div>
          <Cmd.List className="max-h-72 overflow-y-auto p-1.5">
            <Cmd.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground">No subject found. Add it under Subjects.</Cmd.Empty>
            {suggested.length ? (
              <Cmd.Group heading="Suggested" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase">
                {suggested.map(item)}
              </Cmd.Group>
            ) : null}
            <Cmd.Group heading={suggested.length ? "All subjects" : undefined} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase">
              {rest.map(item)}
            </Cmd.Group>
          </Cmd.List>
        </Cmd>
      </PopoverContent>
    </Popover>
  );
}
