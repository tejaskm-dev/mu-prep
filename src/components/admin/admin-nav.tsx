"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  CloudUpload,
  ExternalLink,
  HardDrive,
  Inbox,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Settings,
} from "lucide-react";
import { MuPrepLogo } from "@/components/brand/logos";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/actions/admin/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/upload", label: "Upload", icon: CloudUpload },
  { href: "/admin/library", label: "Library", icon: Library },
  { href: "/admin/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
  { href: "/admin/subjects", label: "Subjects", icon: BookOpen },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/storage", label: "Storage", icon: HardDrive },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavList({ inboxCount, onNavigate }: { inboxCount: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-foreground/70 transition-colors hover:bg-lime-soft hover:text-ink",
              active && "bg-ink text-white hover:bg-ink hover:text-white",
            )}
          >
            <item.icon className={cn("size-[18px]", active ? "text-lime" : "")} strokeWidth={1.8} />
            {item.label}
            {item.badge === "inbox" && inboxCount > 0 ? (
              <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[11px] font-bold", active ? "bg-lime text-ink" : "bg-lime-chip text-ink")}>
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ email, role }: { email: string; role: string }) {
  return (
    <div className="space-y-1 border-t border-border pt-3">
      <Link href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-foreground/70 hover:bg-lime-soft hover:text-ink">
        <ExternalLink className="size-4" /> View site
      </Link>
      <div className="flex items-center gap-2 rounded-lg px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-soft text-[12px] font-bold text-brand uppercase">
          {email[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{email}</span>
          <span className="block text-[11px] text-muted-foreground capitalize">{role}</span>
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ink" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminSidebar({ email, role, inboxCount }: { email: string; role: string; inboxCount: number }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-white px-3 py-5 lg:flex">
      <div className="flex items-center gap-2 px-3 pb-6">
        <MuPrepLogo size="sm" href="/admin" />
        <span className="rounded-md bg-lime-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">Admin</span>
      </div>
      <NavList inboxCount={inboxCount} />
      <div className="mt-auto">
        <Footer email={email} role={role} />
      </div>
    </aside>
  );
}

export function AdminMobileBar({ email, role, inboxCount }: { email: string; role: string; inboxCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white/95 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button type="button" className="-ml-1.5 rounded-lg p-2 hover:bg-lime-soft" aria-label="Open admin menu">
            <Menu className="size-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[270px] gap-0 p-3 pt-5">
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <SheetDescription className="sr-only">Admin navigation</SheetDescription>
          <div className="px-3 pb-5">
            <MuPrepLogo size="sm" href="/admin" />
          </div>
          <NavList inboxCount={inboxCount} onNavigate={() => setOpen(false)} />
          <div className="mt-auto">
            <Footer email={email} role={role} />
          </div>
        </SheetContent>
      </Sheet>
      <MuPrepLogo size="sm" href="/admin" />
      <span className="rounded-md bg-lime-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand">Admin</span>
    </div>
  );
}
