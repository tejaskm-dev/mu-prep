"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { reportResource } from "@/lib/actions/public";
import { REPORT_REASONS } from "@/lib/constants";
import type { ReportReason } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

export function ReportDialog({ resourceId }: { resourceId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!reason) return;
      const result = await reportResource({ resourceId, reason, message });
      if (result.ok) {
        toast.success(result.message ?? "Report sent");
        setOpen(false);
        setReason(null);
        setMessage("");
      } else toast.error(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-destructive">
          <Flag className="size-3.5" /> Report a problem
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Report this file</DialogTitle>
          <DialogDescription>Admins review every report. Thanks for keeping µPrep accurate.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                "rounded-lg border border-border px-3 py-2.5 text-left text-sm text-ink hover:border-lime-border",
                reason === r.value && "border-lime-border bg-lime-soft",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} placeholder="Add details (optional)" className="min-h-20" />
        <DialogFooter>
          <Button onClick={submit} disabled={!reason || pending} className="h-10 rounded-lg px-5">
            {pending ? <MuSpinner /> : null}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
