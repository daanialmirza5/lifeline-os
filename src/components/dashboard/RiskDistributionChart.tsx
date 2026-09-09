const ORDER = [
  { key: "LOW", label: "Low", color: "var(--chart-good)" },
  { key: "MODERATE", label: "Moderate", color: "var(--chart-warning)" },
  { key: "HIGH", label: "High", color: "var(--chart-serious)" },
  { key: "CRITICAL", label: "Critical", color: "var(--chart-critical)" },
] as const;

export function RiskDistributionChart({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const max = Math.max(1, ...ORDER.map((o) => distribution[o.key] ?? 0));
  const total = ORDER.reduce((sum, o) => sum + (distribution[o.key] ?? 0), 0);

  if (total === 0) {
    return <p className="text-sm text-muted">No risk assessments recorded yet.</p>;
  }

  return (
    <div className="space-y-3" role="img" aria-label="Continuity risk distribution across patients">
      {ORDER.map((o) => {
        const value = distribution[o.key] ?? 0;
        const widthPct = (value / max) * 100;
        return (
          <div key={o.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs font-medium text-[color:var(--chart-ink-secondary)]">
              {o.label}
            </span>
            <div className="h-3 flex-1 rounded-full bg-[color:var(--chart-gridline)]">
              <div
                className="h-3 rounded-full transition-[width]"
                style={{ width: `${Math.max(widthPct, value > 0 ? 4 : 0)}%`, background: o.color }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold text-[color:var(--chart-ink)]">
              {value}
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-muted">{total} patient{total === 1 ? "" : "s"} with a recorded risk assessment</p>
    </div>
  );
}
