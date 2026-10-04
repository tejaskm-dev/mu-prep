"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronRight, Clock, FileUp, GraduationCap, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePrefs } from "@/lib/client-prefs";
import { useRecent, useSaved } from "@/lib/library-store";
import type { ResourceCardData } from "@/lib/serialize";
import { openClassPicker } from "@/lib/ui-events";
import type { DepartmentOption } from "./class-picker";

/** Profile-free personal corner: your class, saved items and recently viewed notes. */
export function MySpace({ departments }: { departments: DepartmentOption[] }) {
  const { department, semester } = usePrefs();
  const [open, setOpen] = useState(false);
  const saved = useSaved();
  const recent = useRecent();
  const [recentItems, setRecentItems] = useState<ResourceCardData[]>([]);
  const dept = departments.find((d) => d.slug === department);

  useEffect(() => {
    if (!open || recent.length === 0) return;
    const ids = recent.slice(0, 4).map((r) => r.id);
    const controller = new AbortController();
    fetch(`/api/resources?ids=${ids.join(",")}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { resources: [] }))
      .then((d: { resources: ResourceCardData[] }) => setRecentItems(d.resources))
      .catch(() => {});
    return () => controller.abort();
  }, [open, recent]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="My space"
          className="relative inline-flex size-10 items-center justify-center rounded-full bg-ink text-lime outline-none transition-transform hover:scale-[1.04] focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <UserRound className="size-[19px]" strokeWidth={2} />
          {saved.length > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-[17px] items-center justify-center rounded-full bg-lime text-[9.5px] font-bold text-ink ring-2 ring-background">
              {saved.length > 9 ? "9+" : saved.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[310px] gap-0 rounded-xl p-0">
        <div className="border-b border-border px-4 pt-3.5 pb-3">
          <p className="text-[13px] font-semibold text-ink">My space</p>
          <p className="text-xs text-muted-foreground">No account needed — kept on this device.</p>
        </div>
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openClassPicker();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-lime-soft"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-lime-soft text-brand">
              <GraduationCap className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-muted-foreground">Your class</span>
              <span className="block truncate text-sm font-semibold text-ink">
                {dept && semester ? `${dept.code} · Semester ${semester}` : "Not set — choose yours"}
              </span>
            </span>
            <span className="text-xs font-medium text-brand">Change</span>
          </button>
          <Link
            href="/saved"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-lime-soft"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-muted text-ink">
              <Bookmark className="size-[17px]" />
            </span>
            <span className="flex-1 text-sm font-medium text-ink">Saved</span>
            <span className="text-xs text-muted-foreground">{saved.length}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
        {recentItems.length > 0 ? (
          <div className="border-t border-border p-2">
            <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Clock className="size-3" /> Recently viewed
            </p>
            {recentItems.map((r) => (
              <Link
                key={r.id}
                href={`/notes/${r.id}`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-2.5 py-2 hover:bg-lime-soft"
              >
                <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.subject_name}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="border-t border-border p-2">
          <Link
            href="/contribute"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg bg-ink px-3 py-2.5 text-sm font-medium text-white hover:bg-ink/90"
          >
            <FileUp className="size-4 text-lime" />
            Share your notes
            <ChevronRight className="ml-auto size-4 opacity-70" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
