import type { EventDetailDto } from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import {
  GiBrokenShield,
  GiCrossedSwords,
  GiSandsOfTime,
  GiScrollUnfurled,
  GiTrophy,
} from "react-icons/gi";
import { EventTypeIcon } from "../../components/Icons";
import { KeyValue, Panel, Pill, StatBar } from "../../components/ui";
import { difficultyLabel, eventTypeLabel, powerVerdict, statusLabel } from "../../lib/format";

function EnemyList({ enemies }: { enemies: EventDetailDto["encounters"][number]["enemies"] }) {
  return (
    <div className="enemy-list">
      {enemies.map((enemy) => (
        <span className="enemy-chip" key={`${enemy.name}-${enemy.count}`}>
          {enemy.name}
          {enemy.count > 1 ? <strong> ×{enemy.count}</strong> : null}
        </span>
      ))}
    </div>
  );
}

export function EventDetailView({
  event,
  busy,
  onBack,
  onAccept,
  onFight,
  onResolve,
}: {
  event: EventDetailDto;
  busy: boolean;
  onBack: () => void;
  onAccept: () => void;
  onFight: () => void;
  onResolve: () => void;
}) {
  const verdict = powerVerdict(event.partyPower, event.recommendedPower);
  const hasEncounters = event.encounterCount > 0;
  const currentEncounter = event.encounters[event.currentEncounterIndex];

  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={onBack}>
        ← Event board
      </button>

      <article className="event-detail-hero">
        <div className={`event-detail-glyph event-${event.type}`}>
          <EventTypeIcon type={event.type} size={42} />
        </div>
        <div className="event-detail-copy">
          <div className="event-kicker">
            <span>{eventTypeLabel(event.type)}</span>
            <span aria-hidden="true">·</span>
            <span>{difficultyLabel(event.difficultyBand)}</span>
            <span aria-hidden="true">·</span>
            <span>{event.category === "storyline" ? "Storyline" : "Opportunity"}</span>
            {event.source !== "authored" ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="source-label">
                  {event.source === "generated" ? "Model-written" : "Fallback content"}
                </span>
              </>
            ) : null}
          </div>
          <h2>{event.title}</h2>
          <p>{event.description}</p>
          <div className="detail-facts">
            <span>
              {event.regionName}
              {event.locationName ? ` · ${event.locationName}` : ""}
            </span>
            <span>Posted turn {event.createdTurn}</span>
            {event.expiresOnTurn !== null ? (
              <span className="expiry">
                <GiSandsOfTime aria-hidden="true" /> Expires after turn {event.expiresOnTurn}
              </span>
            ) : null}
            <Pill
              tone={
                event.status === "available"
                  ? "good"
                  : event.status === "active"
                    ? "info"
                    : event.status === "completed"
                      ? "good"
                      : "bad"
              }
            >
              {statusLabel(event.status)}
            </Pill>
          </div>
        </div>
      </article>

      {event.resultText ? (
        <div className="result-banner">
          <GiTrophy aria-hidden="true" size={26} />
          <div>
            <strong>Chronicle entry</strong>
            <p>{event.resultText}</p>
          </div>
        </div>
      ) : null}

      <div className="detail-grid">
        <div className="stack">
          <Panel eyebrow="Briefing" title="What waits ahead">
            <p className="prose">{event.introduction}</p>

            {hasEncounters ? (
              <div className="encounter-list">
                {event.encounters.map((encounter) => {
                  const isCurrent =
                    encounter.index === event.currentEncounterIndex && event.status === "active";
                  return (
                    <div
                      key={encounter.index}
                      className={`encounter-row ${isCurrent ? "encounter-current" : ""} ${
                        encounter.status === "completed" ? "encounter-done" : ""
                      }`}
                    >
                      <div className="encounter-number" aria-hidden="true">
                        {encounter.status === "completed" ? "✓" : encounter.index + 1}
                      </div>
                      <div className="encounter-copy">
                        <div className="encounter-title">
                          <h3>{encounter.title}</h3>
                          <Pill
                            tone={
                              encounter.status === "completed"
                                ? "good"
                                : encounter.status === "failed"
                                  ? "bad"
                                  : encounter.status === "active"
                                    ? "info"
                                    : "muted"
                            }
                          >
                            {encounter.status === "pending"
                              ? "Unresolved"
                              : encounter.status === "active"
                                ? "Ready"
                                : encounter.status === "completed"
                                  ? "Cleared"
                                  : "Failed"}
                          </Pill>
                        </div>
                        <p>{encounter.description}</p>
                        <EnemyList enemies={encounter.enemies} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="field-objective">
                <GiScrollUnfurled aria-hidden="true" size={30} />
                <div>
                  <strong>Field objective</strong>
                  <p>
                    This contract is completed by reaching the objective site. No battle is
                    required.
                  </p>
                </div>
              </div>
            )}
          </Panel>

          {event.status === "completed" ? (
            <Panel eyebrow="Aftermath" title="Contract complete">
              <p className="prose">{event.completionText}</p>
            </Panel>
          ) : event.status === "failed" ? (
            <Panel eyebrow="Aftermath" title="The company withdraws">
              <p className="prose">{event.failureText}</p>
            </Panel>
          ) : null}
        </div>

        <div className="stack">
          <Panel eyebrow="Company orders" title="Contract status">
            <div className="quick-stats quick-stats-tight">
              <KeyValue label="Party power" value={event.partyPower} />
              <KeyValue label="Recommended" value={event.recommendedPower} />
              <KeyValue
                label="Match"
                value={<span className={`verdict verdict-${verdict.tone}`}>{verdict.label}</span>}
              />
              <KeyValue
                label="Encounters"
                value={`${event.encountersCompleted}/${event.encounterCount}`}
              />
            </div>

            {event.status === "available" ? (
              <div className="action-block">
                <p className="hint">
                  Accepting posts the contract to your ledger, advances the world one turn, and
                  refreshes the board.
                </p>
                <Button
                  className="btn btn-primary btn-block"
                  disabled={busy}
                  onClick={onAccept}
                  pendingAnnouncement="Accepting the contract"
                >
                  <GiScrollUnfurled aria-hidden="true" />
                  Accept contract
                </Button>
              </div>
            ) : null}

            {event.status === "active" ? (
              <div className="action-block">
                {currentEncounter ? (
                  <>
                    <p className="hint">
                      The next encounter is <strong>{currentEncounter.title}</strong>. The battle
                      resolves automatically from the seeded simulation.
                    </p>
                    <Button
                      className="btn btn-primary btn-block"
                      disabled={busy}
                      onClick={onFight}
                      pendingAnnouncement="Resolving the encounter"
                    >
                      <GiCrossedSwords aria-hidden="true" />
                      Fight encounter {event.currentEncounterIndex + 1}
                    </Button>
                    {event.canResolve && !event.canStart ? (
                      <Button
                        className="btn btn-secondary btn-block"
                        disabled={busy}
                        onClick={onResolve}
                        pendingAnnouncement="Resolving the contract"
                      >
                        Resolve encounter
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="hint">
                      The site is charted. Complete the field objective to close the contract.
                    </p>
                    <Button
                      className="btn btn-primary btn-block"
                      disabled={busy}
                      onClick={onResolve}
                      pendingAnnouncement="Completing the objective"
                    >
                      <GiScrollUnfurled aria-hidden="true" />
                      Complete objective
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="outcome-callout">
                {event.status === "completed" ? (
                  <GiTrophy aria-hidden="true" size={28} />
                ) : (
                  <GiBrokenShield aria-hidden="true" size={28} />
                )}
                <p>
                  {event.status === "completed"
                    ? "Rewards were recorded once, on the turn the contract closed."
                    : "No completion rewards were granted. Cleared encounters remain recorded."}
                </p>
              </div>
            )}
          </Panel>

          <Panel eyebrow="Objectives" title="Success conditions">
            <ul className="objective-list">
              {event.objectives.map((objective) => (
                <li key={`${objective.kind}-${objective.description}`}>
                  <div className="objective-head">
                    <span>{objective.description}</span>
                    <Pill tone={objective.completed ? "good" : "muted"}>
                      {objective.completed ? "Complete" : "Open"}
                    </Pill>
                  </div>
                  <StatBar
                    label={objective.kind.replaceAll("_", " ")}
                    value={objective.progress}
                    max={objective.targetCount ?? 1}
                    tone="progress"
                    compact
                  />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel eyebrow="Ledger" title="Reward preview">
            <ul className="reward-list">
              <li>
                <span>Gold</span>
                <strong>{event.rewardPreview.gold}</strong>
              </li>
              <li>
                <span>Experience per character</span>
                <strong>{event.rewardPreview.experiencePerCharacter}</strong>
              </li>
              {event.rewardPreview.researchPoints > 0 ? (
                <li>
                  <span>Research points</span>
                  <strong>{event.rewardPreview.researchPoints}</strong>
                </li>
              ) : null}
              {event.rewardPreview.equipment.map((item) => (
                <li key={item.name}>
                  <span>Equipment</span>
                  <strong>
                    {item.name}{" "}
                    <span className={`rarity rarity-${item.rarity}`}>{item.rarity}</span>
                  </strong>
                </li>
              ))}
            </ul>
            <p className="hint">
              The engine derives final quantities. Rewards are granted only after a confirmed
              victory.
            </p>
          </Panel>

          {event.generation ? (
            <p className="generation-note">
              Generated by {event.generation.model ?? "the local model"} ·{" "}
              {event.generation.promptVersion ?? "prompt n/a"} ·{" "}
              {event.generation.schemaVersion ?? "schema n/a"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
