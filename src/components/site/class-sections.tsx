"use client";

import { createContext, use, useOptimistic, useTransition } from "react";
import { savePreferences } from "@/lib/actions/preferences";
import { notifyPrefsChanged } from "@/lib/client-prefs";
import { cn } from "@/lib/utils";
import { DepartmentGrid, SemesterRow, type DepartmentOption } from "./class-picker";

type ClassState = { department: string | null; semester: number | null };
type Ctx = ClassState & { pending: boolean; change: (next: Partial<ClassState>) => void };

const ClassContext = createContext<Ctx | null>(null);

function useClass() {
  const ctx = use(ClassContext);
  if (!ctx) throw new Error("ClassProvider missing");
  return ctx;
}

/** Shares the selected branch/semester (optimistically) across the home page sections. */
export function ClassProvider({ department, semester, children }: ClassState & { children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic<ClassState, Partial<ClassState>>({ department, semester }, (s, next) => ({
    ...s,
    ...next,
  }));

  const change = (next: Partial<ClassState>) =>
    startTransition(async () => {
      setOptimistic(next);
      await savePreferences(next);
      notifyPrefsChanged();
    });

  return <ClassContext value={{ ...state, pending, change }}>{children}</ClassContext>;
}

export function HomeDepartmentPicker({ departments }: { departments: DepartmentOption[] }) {
  const { department, change } = useClass();
  return (
    <DepartmentGrid
      departments={departments}
      value={department}
      onChange={(slug) => change({ department: slug })}
      className="grid-cols-3 sm:grid-cols-3 md:grid-cols-6"
    />
  );
}

export function HomeSemesterPicker() {
  const { semester, change } = useClass();
  return <SemesterRow value={semester} onChange={(s) => change({ semester: s })} />;
}

/** Dims dependent sections while a new class is loading. */
export function PendingArea({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useClass();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-55", className)}>
      {children}
    </div>
  );
}

export function ClassLabel({ departments }: { departments: DepartmentOption[] }) {
  const { department, semester } = useClass();
  const dept = departments.find((d) => d.slug === department);
  if (!dept && !semester) return null;
  return (
    <>
      {" "}
      ({[semester ? `S${semester}` : null, dept?.code].filter(Boolean).join(" ")})
    </>
  );
}
