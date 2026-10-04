"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestNotes } from "@/lib/actions/public";
import { RESOURCE_TYPES } from "@/lib/constants";
import type { ResourceType, SubjectModule } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { MuSpinner } from "@/components/brand/mu-loader";

/** "Can't find it? Ask for it" — requests show up in the admin inbox, grouped by subject. */
export function RequestDialog({
  subjectId,
  subjectName,
  modules,
  defaultType,
  trigger,
}: {
  subjectId: string;
  subjectName: string;
  modules: SubjectModule[];
  defaultType?: ResourceType;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ResourceType>(defaultType ?? "notes");
  const [module, setModule] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const moduleNumbers = modules.length ? modules.map((m) => m.n) : [1, 2, 3, 4, 5];

  const submit = () =>
    startTransition(async () => {
      const result = await requestNotes({ subjectId, type, module, message });
      if (result.ok) {
        toast.success(result.message ?? "Request sent");
        setOpen(false);
        setMessage("");
      } else {
        toast.error(result.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="h-10 rounded-lg bg-white px-4">
            <MessageSquarePlus /> Request notes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Request for {subjectName}</DialogTitle>
          <DialogDescription>Tell the µLearn team what's missing. Popular requests get uploaded first.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-[13px]">What do you need?</Label>
            <div className="flex flex-wrap gap-2">
              {RESOURCE_TYPES.filter((t) => t.value !== "other").map((t) => (
                <button
                  key={t.value}
                  type="button"
                  data-active={type === t.value}
                  onClick={() => setType(t.value)}
                  className="chip h-8"
                >
                  {t.plural}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-[13px]">Module (optional)</Label>
            <div className="flex flex-wrap gap-2">
              <button type="button" data-active={module === null} onClick={() => setModule(null)} className="chip h-8">
                Any
              </button>
              {moduleNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  data-active={module === n}
                  onClick={() => setModule(n)}
                  className={cn("chip h-8 min-w-10 justify-center")}
                >
                  M{n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="request-message" className="mb-2 block text-[13px]">
              Anything specific? (optional)
            </Label>
            <Textarea
              id="request-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              placeholder="e.g. Solved December 2023 paper, or Module 3 handwritten notes"
              className="min-h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending} className="h-10 rounded-lg px-5">
            {pending ? <MuSpinner /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
