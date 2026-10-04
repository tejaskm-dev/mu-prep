import type { Metadata } from "next";
import { SavedLists } from "@/components/site/saved-lists";

export const metadata: Metadata = { title: "Saved & recently viewed", robots: { index: false } };

export default function SavedPage() {
  return (
    <div className="container-page pt-6">
      <span className="section-mark mb-3" aria-hidden />
      <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.03em] text-ink sm:text-[36px]">My space</h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">Saved files and your history — stored only on this device, no account needed.</p>
      <SavedLists />
    </div>
  );
}
