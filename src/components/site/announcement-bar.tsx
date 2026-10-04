import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import type { SiteSettings } from "@/lib/database.types";

export function AnnouncementBar({ settings }: { settings: SiteSettings }) {
  if (!settings.announcement_enabled || !settings.announcement) return null;
  const content = (
    <span className="inline-flex items-center gap-2">
      <Megaphone className="size-4 shrink-0 text-lime" />
      <span>{settings.announcement}</span>
      {settings.announcement_link ? <ArrowRight className="size-3.5 shrink-0" /> : null}
    </span>
  );
  return (
    <div className="bg-ink px-4 py-2 text-center text-[13px] font-medium text-white">
      {settings.announcement_link ? (
        <Link href={settings.announcement_link} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
