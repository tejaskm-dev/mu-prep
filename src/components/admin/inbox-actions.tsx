"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveSubmissions, rejectSubmissions, setReportStatus, setRequestStatus } from "@/lib/actions/admin/resources";
import { MuSpinner } from "@/components/brand/mu-loader";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });
  return { pending, run };
}

export function ReportActions({ id, status }: { id: string; status: "open" | "resolved" | "dismissed" }) {
  const { pending, run } = useRun();
  if (status !== "open") {
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground capitalize">
        {status}
        <button type="button" onClick={() => run(() => setReportStatus([id], "open"), "Reopened")} className="rounded p-1 hover:bg-muted" aria-label="Reopen">
          <RotateCcw className="size-3.5" />
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <Button size="sm" variant="outline" className="h-8 bg-white" disabled={pending} onClick={() => run(() => setReportStatus([id], "resolved"), "Marked resolved")}>
        {pending ? <MuSpinner /> : <Check />} Resolved
      </Button>
      <Button size="sm" variant="ghost" className="h-8" disabled={pending} onClick={() => run(() => setReportStatus([id], "dismissed"), "Dismissed")}>
        Dismiss
      </Button>
    </span>
  );
}

export function RequestActions({ ids }: { ids: string[] }) {
  const { pending, run } = useRun();
  return (
    <span className="inline-flex gap-1.5">
      <Button size="sm" variant="outline" className="h-8 bg-white" disabled={pending} onClick={() => run(() => setRequestStatus(ids, "fulfilled"), "Marked fulfilled")}>
        <Check /> Fulfilled
      </Button>
      <Button size="sm" variant="ghost" className="h-8" disabled={pending} onClick={() => run(() => setRequestStatus(ids, "dismissed"), "Dismissed")}>
        <X /> Dismiss
      </Button>
    </span>
  );
}

export function SubmissionActions({ id }: { id: string }) {
  const { pending, run } = useRun();
  return (
    <span className="inline-flex gap-1.5">
      <Button size="sm" className="h-8" disabled={pending} onClick={() => run(() => approveSubmissions([id]), "Approved and published")}>
        {pending ? <MuSpinner /> : <Check />} Approve
      </Button>
      <Button size="sm" variant="outline" className="h-8 bg-white" disabled={pending} onClick={() => run(() => approveSubmissions([id], { verified: true }), "Approved as verified")}>
        Approve + verify
      </Button>
      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" disabled={pending} onClick={() => run(() => rejectSubmissions([id]), "Rejected and deleted")}>
        <X /> Reject
      </Button>
    </span>
  );
}
