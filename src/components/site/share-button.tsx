"use client";

import { useEffect, useState } from "react";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const triggerClass =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-sm font-medium text-ink hover:border-lime-border";

export function ShareButton({ title, path }: { title: string; path: string }) {
  const [nativeShare, setNativeShare] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setNativeShare(typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const url = `${origin}${path}`;

  if (nativeShare) {
    return (
      <button
        type="button"
        className={triggerClass}
        onClick={() => navigator.share({ title, text: `${title} — on µPrep`, url }).catch(() => {})}
      >
        <Share2 className="size-4" /> Share
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass}>
          <Share2 className="size-4" /> Share
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onSelect={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => toast.success("Link copied"))
              .catch(() => toast.error("Couldn't copy the link"))
          }
        >
          <Copy /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle /> Share on WhatsApp
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
