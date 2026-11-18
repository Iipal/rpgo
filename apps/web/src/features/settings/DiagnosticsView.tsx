import type { SystemHealthDto } from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import { GiBrain, GiCog, GiDatabase, GiRun } from "react-icons/gi";
import { EmptyState, KeyValue, Panel, Pill } from "../../components/ui";
import type { DiagnosticsDto } from "../../lib/api";
import { formatDate, formatDuration, titleCase } from "../../lib/format";

function statusTone(status: string): "good" | "warn" | "bad" | "muted" {
  if (status === "success") return "good";
  if (status === "invalid") return "warn";
  if (status === "unavailable" || status === "timeout" || status === "refused") return "bad";
  return "muted";
}

export function DiagnosticsView({
  health,
  diagnostics,
  busy,
  onRefresh,
  onGenerate,
}: {
  health: SystemHealthDto;
  diagnostics: DiagnosticsDto | null;
  busy: boolean;
  onRefresh: () => void;
  onGenerate: () => void;
}) {
  const last = health.llm.lastGeneration;
  return (
    <div className="stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Developer tools</p>
          <h2>System diagnostics</h2>
          <p>
            Health of the API, SQLite database, and the local OpenAI-compatible inference server. No
            secrets are displayed here.
          </p>
        </div>
        <Button
          className="btn btn-secondary"
          disabled={busy}
          onClick={onRefresh}
          pendingAnnouncement="Refreshing diagnostics"
        >
          <GiRun aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="diagnostic-grid">
        <Panel eyebrow="Service" title="API">
          <div className="status-line">
            <span className={`status-dot status-${health.api === "ok" ? "good" : "bad"}`} />
            <strong>OK</strong>
            <Pill tone={health.status === "ok" ? "good" : "warn"}>{health.status}</Pill>
          </div>
          <p className="hint">Correlation ID: {health.correlationId}</p>
        </Panel>

        <Panel eyebrow="Persistence" title="Database">
          <div className="status-line">
            <GiDatabase aria-hidden="true" />
            <span className={`status-dot status-${health.database.ok ? "good" : "bad"}`} />
            <strong>{health.database.ok ? "Connected" : "Unavailable"}</strong>
          </div>
          <KeyValue label="Schema version" value={health.database.schemaVersion ?? "unknown"} />
        </Panel>

        <Panel eyebrow="Generation" title="Local model">
          <div className="status-line">
            <GiBrain aria-hidden="true" />
            <span
              className={`status-dot status-${
                !health.llm.enabled ? "muted" : health.llm.reachable ? "good" : "bad"
              }`}
            />
            <strong>
              {!health.llm.enabled
                ? "Disabled by configuration"
                : health.llm.reachable
                  ? "Reachable"
                  : "Unreachable"}
            </strong>
          </div>
          <KeyValue label="Model" value={health.llm.model} />
          <KeyValue label="Endpoint" value={health.llm.baseUrl} />
          <KeyValue label="Fallback active" value={health.llm.fallbackActive ? "Yes" : "No"} />
        </Panel>
      </div>

      {health.llm.fallbackActive ? (
        <div className="notice notice-warn">
          <strong>Fallback content is in use.</strong> The game remains fully playable with authored
          contracts. Active contracts are never overwritten by a model failure.
        </div>
      ) : null}

      <div className="split-grid">
        <Panel eyebrow="Last attempt" title="Most recent generation">
          {last ? (
            <div className="stack-tight">
              <div className="status-line">
                <Pill tone={statusTone(last.status)}>{titleCase(last.status)}</Pill>
                <strong>{titleCase(last.task)}</strong>
              </div>
              <KeyValue label="Model" value={last.model} />
              <KeyValue label="Prompt" value={last.promptVersion ?? "n/a"} />
              <KeyValue label="Schema" value={last.schemaVersion ?? "n/a"} />
              <KeyValue label="Latency" value={formatDuration(last.latencyMs)} />
              <KeyValue label="When" value={formatDate(last.createdAt)} />
              {last.errorCode ? <KeyValue label="Error" value={last.errorCode} /> : null}
            </div>
          ) : (
            <EmptyState title="No generation has been recorded yet.">
              Accept a contract or use the development generator.
            </EmptyState>
          )}
        </Panel>

        <Panel eyebrow="Developer command" title="Exercise the Event Director">
          <p className="hint">
            Ask the local model for one new opportunity and persist it through the full validation
            pipeline. This can take 20–30 seconds on the local 2B model.
          </p>
          <Button
            className="btn btn-primary"
            disabled={busy || !health.llm.enabled}
            onClick={onGenerate}
            pendingAnnouncement="Generating an event"
          >
            <GiCog aria-hidden="true" />
            Generate opportunity
          </Button>
          <p className="hint">
            If the model is unavailable, the action reports the failure and the board keeps its
            authored fallback content.
          </p>
        </Panel>
      </div>

      <Panel eyebrow="Audit" title="Recent generation attempts">
        {diagnostics && diagnostics.generations.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Latency</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {diagnostics.generations.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.createdAt)}</td>
                    <td>{titleCase(record.task)}</td>
                    <td>
                      <Pill tone={statusTone(record.status)}>{record.status}</Pill>
                    </td>
                    <td className="mono">{record.model}</td>
                    <td>{formatDuration(record.latencyMs)}</td>
                    <td className="mono">{record.errorCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No generation attempts recorded." />
        )}
      </Panel>
    </div>
  );
}
