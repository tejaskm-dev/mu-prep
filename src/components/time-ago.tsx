"use client";

import { useEffect, useState } from "react";
import { formatDate, timeAgo } from "@/lib/format";

/** Absolute date on the server (prerender-safe), relative time once in the browser. */
export function TimeAgo({ date, prefix = "" }: { date: string | null; prefix?: string }) {
  const [text, setText] = useState(() => (date ? formatDate(date) : ""));
  useEffect(() => {
    if (date) setText(timeAgo(date));
  }, [date]);
  if (!date) return null;
  return (
    <time dateTime={date} title={formatDate(date, { hour: "numeric", minute: "2-digit" })} suppressHydrationWarning>
      {prefix}
      {text}
    </time>
  );
}
