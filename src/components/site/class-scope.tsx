"use client";

import { useId, useTransition } from "react";
import { Eye, Filter } from "lucide-react";
import { MuSpinner } from "@/components/brand/mu-loader";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Switch } from "@/components/ui/switch";
import { savePreferences } from "@/lib/actions/preferences";
import { notifyPrefsChanged, usePrefs } from "@/lib/client-prefs";
import type { ClassScope } from "@/lib/constants";
import { openClassPicker } from "@/lib/ui-events";
import { cn } from "@/lib/utils";

// "Only my class" is a global preference (mp_scope cookie). Server pages read it through
// getPrefs().focus; the cookie write in savePreferences re-renders the current route.

function useSetScope() {
  const [pending, startTransition] = useTransition();
  const setScope = (scope: ClassScope) =>
    startTransition(async () => {
      await savePreferences({ scope });
      notifyPrefsChanged();
    });
  return { pending, setScope };
}

/** The switch in My space. */
export function ScopeToggle() {
  const prefs = usePrefs();
  const { pending, setScope } = useSetScope();
  const id = useId();
  const hasClass = Boolean(prefs.department && prefs.semester);
  return (
    <div className={cn("flex items-center gap-3 rounded-lg px-2.5 py-2.5", hasClass && "hover:bg-lime-soft")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-ink">
        {pending ? <MuSpinner className="size-4" /> : <Filter className="size-[17px]" />}
      </span>
      <label htmlFor={id} className={cn("min-w-0 flex-1", hasClass ? "cursor-pointer" : "cursor-default")}>
        <span className="block text-sm font-medium text-ink">Only my class</span>
        <span className="block text-xs text-muted-foreground">
          {hasClass ? "Hide other branches & semesters everywhere" : "Choose your class to turn this on"}
        </span>
      </label>
      <Switch
        id={id}
        checked={prefs.focus}
        disabled={!hasClass || pending}
        onCheckedChange={(on) => setScope(on ? "class" : "all")}
        aria-label="Only show my class"
      />
    </div>
  );
}

/** Shown in place of the branch/semester pickers while "Only my class" is on. */
export function ClassFocusBar({
  department,
  semester,
  className,
}: {
  department: { code: string; name: string; icon: string } | null;
  semester: number;
  className?: string;
}) {
  const { pending, setScope } = useSetScope();
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-lime-border/70 bg-lime-soft/60 px-4 py-3 sm:px-5",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand ring-1 ring-lime-border/60">
        <DynamicIcon name={department?.icon ?? "graduation-cap"} className="size-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">
          Showing only S{semester}
          {department ? ` · ${department.code}` : ""}
        </p>
        <p className="text-[12.5px] text-muted-foreground">Other branches and semesters are hidden. You can switch this in My space.</p>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => openClassPicker()}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-ink hover:border-lime-border sm:flex-none"
        >
          Change class
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          disabled={pending}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-[13px] font-medium text-white hover:bg-ink/85 disabled:opacity-70 sm:flex-none"
        >
          {pending ? <MuSpinner className="size-3.5" /> : <Eye className="size-3.5 text-lime" />} Show all classes
        </button>
      </div>
    </div>
  );
}

/**
 * Hides its children while "Only my class" is on and they belong to another class.
 * For prerendered pages that can't read the preference on the server.
 */
export function ClassOnly({ departments, semester, children }: { departments: string[]; semester: number; children: React.ReactNode }) {
  const prefs = usePrefs();
  if (prefs.focus && (semester !== prefs.semester || !departments.includes(prefs.department ?? ""))) return null;
  return children;
}
