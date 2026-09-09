"use client";

import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/primitives";

const DEMO_ACCOUNTS = [
  { role: "Clinician", email: "clinician@lifeline.demo", password: "LifelineDemo!Clinician1" },
  { role: "Coordinator", email: "coordinator@lifeline.demo", password: "LifelineDemo!Coordinator1" },
  { role: "Admin", email: "admin@lifeline.demo", password: "LifelineDemo!Admin1" },
  { role: "Patient", email: "patient@lifeline.demo", password: "LifelineDemo!Patient1" },
];

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Lifeline OS</h1>
          <p className="mt-1 text-sm text-muted">The intelligent continuity layer for healthcare.</p>
          <p className="mt-2 inline-block rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
            Research / Demonstration Prototype — Not a Medical Device
          </p>
        </div>

        <form action={formAction} className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue="clinician@lifeline.demo"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                defaultValue="LifelineDemo!Clinician1"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary"
              />
            </div>
            {state?.error && <p className="text-sm text-[var(--risk-critical)]">{state.error}</p>}
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>

        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-xs text-muted">
          <p className="mb-2 font-medium text-foreground">Demo accounts (synthetic data only)</p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <span className="font-medium text-foreground">{a.role}:</span> {a.email} / {a.password}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
