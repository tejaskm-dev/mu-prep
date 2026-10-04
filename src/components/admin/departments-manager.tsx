"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { deleteDepartment, moveDepartment, saveDepartment } from "@/lib/actions/admin/catalog";
import { IconPicker } from "./icon-picker";
import { MuSpinner } from "@/components/brand/mu-loader";

type Dept = { id: string; slug: string; code: string; name: string; icon: string; is_active: boolean; subjects: number };

export function DepartmentsManager({ departments }: { departments: Dept[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Partial<Dept> | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button className="h-10 rounded-lg" onClick={() => setEditing({ icon: "graduation-cap", is_active: true })}>
          <Plus /> Add department
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <ul className="divide-y divide-border">
          {departments.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-lime-soft text-brand">
                <DynamicIcon name={d.icon} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">
                  {d.code} {!d.is_active ? <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Hidden</span> : null}
                </p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {d.name} · /{d.slug} · {d.subjects} subjects
                </p>
              </div>
              <button type="button" disabled={i === 0 || pending} onClick={() => run(() => moveDepartment(d.id, -1))} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={i === departments.length - 1 || pending} onClick={() => run(() => moveDepartment(d.id, 1))} className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="size-4" />
              </button>
              <Button variant="outline" size="sm" className="bg-white" onClick={() => setEditing(d)}>
                <Pencil /> Edit
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">The order here is the order of the branch cards on the home page.</p>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${editing.code}` : "New department"}</DialogTitle>
            <DialogDescription>Short code shows on cards (e.g. CSE); the full name appears in tooltips.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div>
                  <Label className="mb-1.5 block text-[13px]">Code</Label>
                  <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="CSE" className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-[13px]">Full name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Computer Science & Engineering" className="h-10 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div>
                  <Label className="mb-1.5 block text-[13px]">URL slug</Label>
                  <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto from code" className="h-10 rounded-lg" />
                </div>
                <IconPicker value={editing.icon ?? "graduation-cap"} onChange={(icon) => setEditing({ ...editing, icon })} />
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-[13.5px]">
                Visible on site
                <Switch checked={editing.is_active ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
              </label>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {editing?.id ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (!confirm(`Delete ${editing.code}? Subjects stay, but lose this branch link.`)) return;
                  run(() => deleteDepartment(editing.id!), () => setEditing(null));
                }}
              >
                <Trash2 /> Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={pending || !editing?.code || !editing?.name}
              onClick={() =>
                run(
                  () =>
                    saveDepartment(editing?.id ?? null, {
                      code: editing!.code!,
                      name: editing!.name!,
                      slug: editing!.slug || null,
                      icon: editing!.icon ?? "graduation-cap",
                      isActive: editing!.is_active ?? true,
                    }),
                  () => setEditing(null),
                )
              }
              className="h-10 rounded-lg px-5"
            >
              {pending ? <MuSpinner /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
