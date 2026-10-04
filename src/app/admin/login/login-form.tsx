"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/actions/admin/auth";
import { MuSpinner } from "@/components/brand/mu-loader";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="email" className="mb-1.5 block text-[13px]">
          Email
        </Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 rounded-lg bg-white" />
      </div>
      <div>
        <Label htmlFor="password" className="mb-1.5 block text-[13px]">
          Password
        </Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11 rounded-lg bg-white" />
      </div>
      {state && !state.ok ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-lg text-[15px]">
        {pending ? <MuSpinner /> : null}
        Sign in
      </Button>
    </form>
  );
}
