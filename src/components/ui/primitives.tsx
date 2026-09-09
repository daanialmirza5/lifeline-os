import { cn } from "@/lib/cn";
import Link from "next/link";
import { HTMLAttributes, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-border px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-transparent border border-border text-foreground hover:bg-black/[.03] dark:hover:bg-white/[.06]",
  danger: "bg-[var(--risk-critical)] text-white hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-black/[.03] dark:hover:bg-white/[.06]",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonVariants }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant = "secondary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: keyof typeof buttonVariants }) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

const riskStyles: Record<string, string> = {
  LOW: "text-[var(--risk-low)] bg-[var(--risk-low-bg)]",
  MODERATE: "text-[var(--risk-moderate)] bg-[var(--risk-moderate-bg)]",
  HIGH: "text-[var(--risk-high)] bg-[var(--risk-high-bg)]",
  CRITICAL: "text-[var(--risk-critical)] bg-[var(--risk-critical-bg)]",
};

export function RiskBadge({ level }: { level: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        riskStyles[level] ?? "bg-black/5 text-foreground"
      )}
    >
      {level}
    </span>
  );
}

const journeyStateStyles: Record<string, string> = {
  CREATED: "text-muted bg-black/5 dark:bg-white/5",
  ACTIVE: "text-[var(--risk-low)] bg-[var(--risk-low-bg)]",
  ACTION_REQUIRED: "text-[var(--risk-moderate)] bg-[var(--risk-moderate-bg)]",
  IN_PROGRESS: "text-accent bg-accent/10",
  BLOCKED: "text-[var(--risk-high)] bg-[var(--risk-high-bg)]",
  ESCALATED: "text-[var(--risk-critical)] bg-[var(--risk-critical-bg)]",
  COMPLETED: "text-[var(--risk-low)] bg-[var(--risk-low-bg)]",
  CANCELLED: "text-muted bg-black/5 dark:bg-white/5",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        journeyStateStyles[status] ?? "bg-black/5 text-foreground"
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    </div>
  );
}
