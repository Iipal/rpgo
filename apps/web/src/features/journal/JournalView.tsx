import type { JournalEntryDto } from "@rpgo/contracts";
import { GiOpenBook } from "react-icons/gi";
import { EmptyState, Panel, Pill } from "../../components/ui";
import { formatDate, titleCase } from "../../lib/format";

export function JournalView({ entries }: { entries: JournalEntryDto[] }) {
  const ordered = [...entries].sort((a, b) => {
    if (b.turn !== a.turn) return b.turn - a.turn;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return (
    <div className="stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">The chronicle</p>
          <h2>Company journal</h2>
          <p>
            A record of every meaningful action. Reading the journal never advances the world turn.
          </p>
        </div>
        <div className="party-summary">
          <span>
            <GiOpenBook aria-hidden="true" /> {entries.length} entries
          </span>
        </div>
      </div>

      <Panel>
        {ordered.length === 0 ? (
          <EmptyState title="The pages are still blank.">
            Accept a contract or open a route to begin the chronicle.
          </EmptyState>
        ) : (
          <ol className="journal-list">
            {ordered.map((entry) => (
              <li key={entry.id}>
                <div className="journal-marker" aria-hidden="true" />
                <div className="journal-copy">
                  <div className="journal-head">
                    <Pill tone="muted">Turn {entry.turn}</Pill>
                    <span className="hint">{titleCase(entry.kind)}</span>
                    <span className="hint journal-date">{formatDate(entry.createdAt)}</span>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
