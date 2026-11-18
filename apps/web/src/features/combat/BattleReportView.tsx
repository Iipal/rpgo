import type { BattleLogEntryDto, BattleReportDto, CombatantResultDto } from "@rpgo/contracts";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible";
import {
  GiBrokenShield,
  GiCrossedSwords,
  GiDeathSkull,
  GiScrollQuill,
  GiTrophy,
} from "react-icons/gi";
import { Panel, Pill, StatBar } from "../../components/ui";
import { titleCase } from "../../lib/format";

function CombatantList({ title, combatants }: { title: string; combatants: CombatantResultDto[] }) {
  return (
    <div className="report-side">
      <h3>{title}</h3>
      <ul className="combatant-list">
        {combatants.map((combatant) => (
          <li key={combatant.id} className={combatant.alive ? "" : "combatant-down"}>
            <div className="combatant-head">
              <strong>{combatant.name}</strong>
              <Pill tone={combatant.alive ? "good" : "bad"}>
                {combatant.alive ? "Standing" : "Down"}
              </Pill>
            </div>
            <StatBar
              label="Health"
              value={combatant.hp}
              max={combatant.maxHp}
              tone="health"
              compact
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogEntry({ entry }: { entry: BattleLogEntryDto }) {
  return (
    <li className={`log-entry log-${entry.type}`}>
      <div className="log-main">
        <strong>{entry.actorName}</strong>
        <span>{entry.text}</span>
      </div>
      <div className="log-meta">
        <span>{entry.actionName}</span>
        {entry.amount !== undefined ? (
          <span className="numeric">
            {entry.type === "heal" ? "+" : "−"}
            {entry.amount}
          </span>
        ) : null}
        {entry.crit ? <span className="crit">crit</span> : null}
        <span className="reason">{titleCase(entry.reason)}</span>
      </div>
    </li>
  );
}

export function BattleReportView({
  report,
  onBack,
}: {
  report: BattleReportDto;
  onBack: () => void;
}) {
  const rounds = new Map<number, BattleLogEntryDto[]>();
  for (const entry of report.actionLog) {
    const list = rounds.get(entry.round) ?? [];
    list.push(entry);
    rounds.set(entry.round, list);
  }
  const roundNumbers = [...rounds.keys()].sort((a, b) => a - b);
  const outcomeTone =
    report.outcome === "victory" ? "victory" : report.outcome === "defeat" ? "defeat" : "draw";

  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={onBack}>
        ← Back to contract
      </button>

      <article className={`battle-banner battle-${outcomeTone}`}>
        <div className="battle-seal" aria-hidden="true">
          {report.outcome === "victory" ? (
            <GiTrophy size={44} />
          ) : report.outcome === "defeat" ? (
            <GiBrokenShield size={44} />
          ) : (
            <GiCrossedSwords size={44} />
          )}
        </div>
        <div>
          <p className="eyebrow">Encounter report · {report.encounterTitle}</p>
          <h2>
            {report.outcome === "victory"
              ? "The field is won"
              : report.outcome === "defeat"
                ? "The company falls back"
                : "Neither side yields"}
          </h2>
          <p>
            {report.outcome === "victory"
              ? "The encounter is recorded as cleared. Progress remains even if the next battle goes badly."
              : report.outcome === "defeat"
                ? "Defeated companions are incapacitated. Cleared encounters and spent consumables remain recorded."
                : "The turn limit was reached. The encounter is recorded as unresolved."}
          </p>
        </div>
        <div className="battle-stats">
          <span>
            <GiCrossedSwords aria-hidden="true" /> {report.rounds} rounds
          </span>
          <span className="numeric">seed {report.seed}</span>
          <span className="hint">Encounter {report.encounterIndex + 1}</span>
        </div>
      </article>

      <Panel eyebrow="After action" title="Order of battle">
        <div className="report-grid">
          <CombatantList title="The Grey Company" combatants={report.partyAfter} />
          <CombatantList title="Enemies" combatants={report.enemiesAfter} />
        </div>
      </Panel>

      <Panel
        eyebrow="Record"
        title="Action log"
        actions={<span className="hint">{report.actionLog.length} entries</span>}
      >
        {report.actionLog.length === 0 ? (
          <p className="hint">No actions were recorded.</p>
        ) : (
          <div className="round-list">
            {roundNumbers.map((round) => {
              const entries = rounds.get(round) ?? [];
              return (
                <Collapsible key={round} defaultOpen={round === roundNumbers[0]}>
                  <CollapsibleTrigger className="round-trigger">
                    <span>Round {round}</span>
                    <span className="hint">{entries.length} actions</span>
                  </CollapsibleTrigger>
                  <CollapsiblePanel className="round-panel">
                    <ol className="log-list">
                      {entries.map((entry) => (
                        <LogEntry
                          key={`${round}-${entry.actorId}-${entry.actionId}-${entry.targetIds.join(",")}-${entry.amount ?? 0}`}
                          entry={entry}
                        />
                      ))}
                    </ol>
                  </CollapsiblePanel>
                </Collapsible>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="report-footnote">
        <GiScrollQuill aria-hidden="true" />
        <p>
          This battle is an immutable result. Reloading the page or repeating the command returns
          the stored report instead of re-simulating it.
        </p>
        <GiDeathSkull aria-hidden="true" className="muted-icon" />
      </div>
    </div>
  );
}
