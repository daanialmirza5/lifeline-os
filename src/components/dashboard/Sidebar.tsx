import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Session } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/patients", label: "Patients" },
  { href: "/tasks", label: "Tasks" },
  { href: "/recommendations", label: "AI Recommendations" },
  { href: "/approvals", label: "Approval Queue" },
  { href: "/referrals", label: "Referrals" },
  { href: "/documents", label: "Documents" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ session }: { session: Session }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-4">
        <p className="text-sm font-semibold text-foreground">Lifeline OS</p>
        <p className="text-[11px] text-muted">Demo Prototype — Not a Medical Device</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">{session.name}</p>
        <p className="text-xs text-muted">{session.role}</p>
        <form action={logoutAction} className="mt-2">
          <button type="submit" className="text-xs text-accent hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
