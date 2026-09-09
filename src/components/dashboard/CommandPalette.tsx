"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PatientOption {
  id: string;
  name: string;
  mrn: string;
}

const STATIC_COMMANDS = [
  { label: "Go to dashboard", href: "/" },
  { label: "Find overdue referrals", href: "/referrals" },
  { label: "Show pending approvals", href: "/approvals" },
  { label: "Show high-risk patients", href: "/patients?risk=HIGH" },
  { label: "View audit trail", href: "/audit" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open && patients.length === 0) {
      fetch("/api/patients")
        .then((r) => r.json())
        .then((data) => setPatients(data.patients?.map((p: PatientOption) => ({ id: p.id, name: p.name, mrn: p.mrn })) ?? []))
        .catch(() => {});
    }
  }, [open, patients.length]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const commands = STATIC_COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    const matchedPatients = q
      ? patients.filter((p) => p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q)).slice(0, 8)
      : [];
    return { commands, matchedPatients };
  }, [query, patients]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-black/[.03] dark:hover:bg-white/[.06]"
        aria-label="Open command palette"
      >
        <span>Search...</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patients, or type a command..."
              className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
            />
            <div className="max-h-80 overflow-y-auto py-2">
              {results.commands.map((c) => (
                <button
                  key={c.href}
                  onClick={() => go(c.href)}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                >
                  {c.label}
                </button>
              ))}
              {results.matchedPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/patients/${p.id}`)}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                >
                  {p.name} <span className="text-muted">· {p.mrn}</span>
                </button>
              ))}
              {results.commands.length === 0 && results.matchedPatients.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted">No matches.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
