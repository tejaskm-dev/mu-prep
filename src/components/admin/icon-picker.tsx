"use client";

import { useState } from "react";
import { DynamicIcon, ICON_NAMES } from "@/components/dynamic-icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const icons = ICON_NAMES.filter((n) => n.includes(q.toLowerCase()));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-10 items-center gap-2.5 rounded-lg border border-input bg-white px-3 text-[13px] text-ink hover:border-lime-border" aria-label="Choose icon">
          <span className="flex size-7 items-center justify-center rounded-full bg-lime-soft text-brand">
            <DynamicIcon name={value} className="size-4" />
          </span>
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons…" className="mb-2 h-9 w-full rounded-md border border-border px-2.5 text-[13px] outline-none focus:border-lime-border" />
        <div className="grid max-h-64 grid-cols-7 gap-1 overflow-y-auto">
          {icons.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={cn("flex size-9 items-center justify-center rounded-md text-ink/80 hover:bg-lime-soft hover:text-brand", value === name && "bg-ink text-lime hover:bg-ink hover:text-lime")}
            >
              <DynamicIcon name={name} className="size-[18px]" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
