import type { DifficultyBand, EventStatus, EventType } from "@rpgo/contracts";

export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function eventTypeLabel(type: EventType): string {
  switch (type) {
    case "dungeon":
      return "Dungeon";
    case "scout":
      return "Scouting";
    case "research":
      return "Research";
    case "attack":
      return "Strike";
  }
}

export function statusLabel(status: EventStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "active":
      return "In progress";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "expired":
      return "Expired";
  }
}

export function difficultyLabel(band: DifficultyBand): string {
  return band === "easy" ? "Easy" : band === "hard" ? "Hard" : "Normal";
}

export function powerVerdict(
  partyPower: number,
  recommended: number,
): {
  label: string;
  tone: "good" | "warn" | "bad";
} {
  if (partyPower >= recommended * 1.1) return { label: "Favourable", tone: "good" };
  if (partyPower >= recommended * 0.85) return { label: "Even match", tone: "warn" };
  return { label: "Risky", tone: "bad" };
}

export function percent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
