"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { MuMark } from "@/components/brand/logos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { savePreferences } from "@/lib/actions/preferences";
import { notifyPrefsChanged, usePrefs } from "@/lib/client-prefs";
import { OPEN_CLASS_PICKER } from "@/lib/ui-events";
import { DepartmentGrid, SemesterRow, type DepartmentOption } from "./class-picker";
import { MuSpinner } from "@/components/brand/mu-loader";

/**
 * First-visit welcome: pick a branch + semester so the home page shows the right
 * subjects. Reopened from "My space" to change class later.
 */
export function OnboardingDialog({ departments }: { departments: DepartmentOption[] }) {
  const prefs = usePrefs();
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dept, setDept] = useState<string | null>(null);
  const [sem, setSem] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const firstVisit = prefs.known && !prefs.onboarded && !dismissed;
  const open = departments.length > 0 && (firstVisit || manualOpen);

  useEffect(() => {
    const onOpen = () => {
      setDept(prefs.department);
      setSem(prefs.semester);
      setManualOpen(true);
    };
    window.addEventListener(OPEN_CLASS_PICKER, onOpen);
    return () => window.removeEventListener(OPEN_CLASS_PICKER, onOpen);
  }, [prefs.department, prefs.semester]);

  const close = () => {
    setManualOpen(false);
    setDismissed(true);
  };

  const save = (mode: "save" | "skip" | "clear" = "save") =>
    startTransition(async () => {
      if (mode === "save") await savePreferences({ department: dept, semester: sem });
      else if (mode === "clear") await savePreferences({ department: null, semester: null });
      else await savePreferences({});
      notifyPrefsChanged();
      close();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && firstVisit && !pending) save("skip");
        else if (!next) close();
      }}
    >
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto rounded-2xl border-0 p-0 sm:max-w-[640px]"
        showCloseButton={!firstVisit}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-lime-soft px-6 pt-7 pb-6 sm:px-8">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="relative flex items-start gap-4">
            <MuMark size={44} />
            <div>
              <DialogTitle className="text-[22px] font-extrabold tracking-[-0.03em] text-ink sm:text-2xl">
                {firstVisit ? "Welcome to µPrep" : "Change your class"}
              </DialogTitle>
              <DialogDescription className="mt-1 text-[14px] text-foreground/70">
                Pick your branch and semester and we&apos;ll line up your subjects, notes and papers. No sign-up — it&apos;s
                saved on this device.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 pt-5 pb-6 sm:px-8">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">Your branch</h3>
            <DepartmentGrid
              departments={departments}
              value={dept}
              onChange={setDept}
              size="sm"
              className="grid-cols-3 sm:grid-cols-3"
            />
          </section>
          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">Your semester</h3>
            <SemesterRow value={sem} onChange={setSem} />
          </section>

          <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => save(firstVisit ? "skip" : "clear")}
              disabled={pending}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
            >
              {firstVisit ? "Skip — just browsing" : "Clear my class"}
            </button>
            <Button size="lg" className="h-11 rounded-lg px-5 text-[15px]" disabled={pending || !dept || !sem} onClick={() => save()}>
              {pending ? <MuSpinner /> : null}
              Show my subjects
              {!pending ? <ArrowRight /> : null}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
