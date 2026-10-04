import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { MuPrepLogo } from "@/components/brand/logos";
import { getSession } from "@/lib/auth";
import { getSetupStatus } from "@/lib/setup-status";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const [sp, session, checks] = await Promise.all([searchParams, getSession(), getSetupStatus()]);
  if (session.user && session.admin) redirect("/admin");
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  const notAdmin = sp.error === "not-admin";
  const pending = checks.filter((c) => !c.ok);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <MuPrepLogo size="md" />
          <h1 className="mt-10 text-[28px] font-extrabold tracking-[-0.03em] text-ink">Admin sign in</h1>
          <p className="mt-1.5 text-[14.5px] text-muted-foreground">Manage notes, papers, subjects and submissions.</p>
          {notAdmin ? (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
              You&apos;re signed in, but this account isn&apos;t on the admin team.
            </p>
          ) : null}
          <LoginForm next={next} />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(168,228,114,0.28),transparent_55%)]" />
        <div aria-hidden className="bg-grid absolute inset-0 opacity-20" />
        <div className="relative flex h-full flex-col justify-end p-12">
          {pending.length ? (
            <div className="max-w-md rounded-2xl bg-white/95 p-6 shadow-float">
              <h2 className="text-[16px] font-semibold text-ink">Setup checklist</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">A few things still need configuring:</p>
              <ul className="mt-4 space-y-3">
                {checks.map((c) => (
                  <li key={c.label} className="flex gap-3">
                    {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                    <div>
                      <p className="text-[13.5px] font-medium text-ink">{c.label}</p>
                      {!c.ok ? <p className="text-[12.5px] text-muted-foreground">{c.hint}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="max-w-md">
              <p className="font-hand text-[44px] leading-[1.02] font-semibold text-lime">Study. Share. Grow.</p>
              <p className="mt-3 text-[15px] text-white/70">Every file you publish helps a junior pass with a little less panic.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
