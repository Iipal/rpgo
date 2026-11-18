import type { ReactNode } from "react";

export function Panel({
  eyebrow,
  title,
  actions,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(eyebrow || title || actions) && (
        <header className="panel-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "muted";
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function StatBar({
  label,
  value,
  max,
  tone = "health",
  compact = false,
}: {
  label: string;
  value: number;
  max: number;
  tone?: "health" | "mana" | "xp" | "progress";
  compact?: boolean;
}) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`stat-bar ${compact ? "stat-bar-compact" : ""}`.trim()}>
      <div className="stat-bar-label">
        <span>{label}</span>
        <span className="numeric">
          {value} / {max}
        </span>
      </div>
      <div
        className={`stat-track stat-${tone}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function LoadingBlock({ label = "Reading the chronicle…" }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
