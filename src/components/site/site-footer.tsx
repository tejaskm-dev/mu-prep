import Link from "next/link";
import { MuLearnLogo } from "@/components/brand/logos";
import { NAV_LINKS } from "@/lib/constants";

export function SiteFooter({ college }: { college: string }) {
  return (
    <footer className="mt-20 border-t border-border bg-[#f6f6f0]">
      <div className="container-page flex flex-col gap-8 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-10">
          <Link href="/about" aria-label="About µLearn ASI" className="shrink-0">
            <MuLearnLogo className="w-[104px]" />
          </Link>
          <div className="text-[13px] text-muted-foreground">
            <p>Student driven learning initiatives at {college}.</p>
            <p className="mt-1">
              Free forever ·{" "}
              <Link href="/contribute" className="font-medium text-ink underline-offset-4 hover:underline">
                Share your notes
              </Link>
            </p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-foreground/80">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
