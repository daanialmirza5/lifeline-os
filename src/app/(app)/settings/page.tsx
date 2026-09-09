import { getSession } from "@/lib/auth";
import { getRecentAIEvents } from "@/ai/orchestrator";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardBody, EmptyState } from "@/components/ui/primitives";
import { formatTime } from "@/lib/format";

export default async function SettingsPage() {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";

  const configuredProvider = process.env.AI_PROVIDER ?? "mock";
  const keys = {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    google: Boolean(process.env.GOOGLE_API_KEY),
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <Card>
          <CardBody>
            <p className="text-sm text-muted">
              System configuration is visible to administrators only. Signed in as {session?.role ?? "guest"}.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const [userCount, patientCount, auditCount, syncBacklog, aiEvents] = await Promise.all([
    db.user.count(),
    db.patient.count(),
    db.auditEvent.count(),
    db.syncOperation.count({ where: { syncStatus: { in: ["PENDING", "CONFLICT"] } } }),
    Promise.resolve(getRecentAIEvents()),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Settings & System Health</h1>
        <p className="text-sm text-muted">Configuration and observability — visible to administrators only.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI Configuration</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p>
              Preferred provider: <span className="font-medium text-foreground">{configuredProvider}</span>
            </p>
            <ul className="space-y-1 text-muted">
              <li>Anthropic key configured: {keys.anthropic ? "yes" : "no"}</li>
              <li>OpenAI key configured: {keys.openai ? "yes" : "no"}</li>
              <li>Google key configured: {keys.google ? "yes" : "no"}</li>
            </ul>
            <p className="text-xs text-muted">
              If the preferred provider is unavailable or misconfigured, requests automatically fall back through
              any other configured provider, and finally to the deterministic mock provider — the system never
              fails outright for lack of an API key.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Counts</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm text-foreground">
            <p>Users: {userCount}</p>
            <p>Patients: {patientCount}</p>
            <p>Audit events: {auditCount}</p>
            <p>Sync operations pending/conflicted: {syncBacklog}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent AI Calls (this server process, in-memory)</CardTitle>
        </CardHeader>
        <CardBody>
          {aiEvents.length === 0 ? (
            <EmptyState title="No AI calls logged yet in this process" />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Task</th>
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 pr-4 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {aiEvents.slice(0, 50).map((e, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-muted">{formatTime(e.at)}</td>
                    <td className="py-2 pr-4 text-foreground">{e.task}</td>
                    <td className="py-2 pr-4 text-muted">{e.provider}</td>
                    <td className="py-2 pr-4 text-muted">{e.model ?? "—"}</td>
                    <td className="py-2 pr-4">{e.success ? "success" : `failed: ${e.error ?? "unknown"}`}</td>
                    <td className="py-2 pr-4 text-muted">{e.latencyMs ? `${e.latencyMs}ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
