"use client";

import { useState, ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { MuLearnLogo, MuPrepLogo } from "@/components/brand/logos";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_LINKS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const IMPORTANT_PATH = /^\/subjects\/[^/]+\/important/;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/important") return pathname.startsWith("/important") || IMPORTANT_PATH.test(pathname);
  if (href === "/notes") return (pathname.startsWith("/notes") || pathname.startsWith("/subjects")) && !IMPORTANT_PATH.test(pathname);
  return pathname.startsWith(href);
}

export function MainNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="container-page flex h-[72px] items-center gap-4">
      <div className="flex flex-1 items-center gap-3">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="-ml-2 inline-flex size-10 items-center justify-center rounded-lg text-ink hover:bg-lime-soft lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[290px] gap-0 bg-background p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Site navigation</SheetDescription>
            <div className="border-b border-border px-5 py-5">
              <MuPrepLogo size="sm" />
            </div>
            <nav className="flex flex-col p-3">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground/75 hover:bg-lime-soft hover:text-ink",
                    isActive(pathname, l.href) && "bg-lime-soft text-ink",
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/contribute"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-foreground/75 hover:bg-lime-soft hover:text-ink"
              >
                Contribute
              </Link>
            </nav>
            <div className="mt-auto border-t border-border px-5 py-5">
              <MuLearnLogo className="w-[96px]" />
              <p className="mt-2 text-xs text-muted-foreground">Student driven learning initiative.</p>
            </div>
          </SheetContent>
        </Sheet>
        <MuPrepLogo size="sm" className="sm:hidden" />
        <MuPrepLogo size="md" className="max-sm:hidden" />
      </div>

      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {NAV_LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                active ? "text-ink" : "text-foreground/60 hover:text-ink",
              )}
            >
              {l.label}
              {active ? (
                <ViewTransition name="nav-indicator" share="nav-indicator" default="none">
                  <span aria-hidden className="absolute inset-x-3.5 -bottom-[13px] h-[2.5px] rounded-full bg-lime-strong" />
                </ViewTransition>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2.5 sm:gap-3">
        <Link href="/about" className="mr-3 hidden xl:block" aria-label="About µLearn ASI">
          <MuLearnLogo className="w-[104px]" />
        </Link>
        {/* Search + My space float above the page (HeaderActions) so they stay on screen while scrolling. */}
        <span aria-hidden className="w-[90px] shrink-0 sm:w-[92px]" />
      </div>
    </div>
  );
}
