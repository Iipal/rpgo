import type { EventSummaryDto, GameStateDto } from "@rpgo/contracts";
import { GiCrossedSwords, GiSandsOfTime, GiScrollUnfurled } from "react-icons/gi";
import { EventTypeIcon } from "../../components/Icons";
import { EmptyState, Panel, Pill } from "../../components/ui";
import { difficultyLabel, eventTypeLabel, powerVerdict, statusLabel } from "../../lib/format";

function EventCard({
  event,
  partyPower,
  onOpen,
}: {
  event: EventSummaryDto;
  partyPower: number;
  onOpen: (id: string) => void;
}) {
  const verdict = powerVerdict(partyPower, event.recommendedPower);
  return (
    <button type="button" className="event-card" onClick={() => onOpen(event.id)}>
      <div className="event-card-top">
        <span className={`event-glyph event-${event.type}`}>
          <EventTypeIcon type={event.type} size={24} />
        </span>
        <div className="event-card-heading">
          <div className="event-kicker">
            <span>{eventTypeLabel(event.type)}</span>
            <span aria-hidden="true">·</span>
            <span>{difficultyLabel(event.difficultyBand)}</span>
            {event.source !== "authored" ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="source-label">
                  {event.source === "generated" ? "Model-written" : "Fallback"}
                </span>
              </>
            ) : null}
          </div>
          <h3>{event.title}</h3>
        </div>
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
      <p className="event-hook">{event.hook}</p>
      <div className="event-facts">
        <span>
          <strong>{event.regionName}</strong>
          {event.locationName ? ` · ${event.locationName}` : ""}
        </span>
        <span>
          <GiCrossedSwords aria-hidden="true" />
          {event.encounterCount > 0
            ? `${event.encountersCompleted}/${event.encounterCount} encounters`
            : "Field objective"}
        </span>
        <span className={`verdict verdict-${verdict.tone}`}>
          {verdict.label} · rec. {event.recommendedPower}
        </span>
      </div>
      {event.category === "opportunity" && event.expiresOnTurn !== null ? (
        <div className="event-expiry">
          <GiSandsOfTime aria-hidden="true" />
          Expires after turn {event.expiresOnTurn}
        </div>
      ) : null}
    </button>
  );
}

function BoardSection({
  title,
  description,
  events,
  partyPower,
  onOpen,
  empty,
}: {
  title: string;
  description: string;
  events: EventSummaryDto[];
  partyPower: number;
  onOpen: (id: string) => void;
  empty: string;
}) {
  return (
    <Panel
      eyebrow="Event board"
      title={title}
      actions={<span className="hint">{description}</span>}
    >
      {events.length === 0 ? (
        <EmptyState title={empty}>
          Complete a contract or open a route, then the board will be refreshed.
        </EmptyState>
      ) : (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} partyPower={partyPower} onOpen={onOpen} />
          ))}
        </div>
      )}
    </Panel>
  );
}

export function EventBoardView({
  state,
  onOpen,
}: {
  state: GameStateDto;
  onOpen: (id: string) => void;
}) {
  const active = state.events.filter((event) => event.status === "active");
  const storyline = state.events.filter(
    (event) => event.status === "available" && event.category === "storyline",
  );
  const opportunities = state.events.filter(
    (event) => event.status === "available" && event.category === "opportunity",
  );
  const partyPower = state.party.power;

  return (
    <div className="stack">
      <div className="board-intro">
        <div>
          <p className="eyebrow">Notice board · {state.events.length} postings</p>
          <h2>Work for the Grey Company</h2>
          <p>
            Storyline contracts persist until resolved. Opportunities fade as the world turns.
            Accepting a contract advances the world by one turn.
          </p>
        </div>
        <div className="board-legend">
          <span>
            <GiScrollUnfurled aria-hidden="true" /> Storyline
          </span>
          <span>
            <GiSandsOfTime aria-hidden="true" /> Opportunity
          </span>
          <span className="hint">Party power {partyPower}</span>
        </div>
      </div>

      {active.length > 0 ? (
        <BoardSection
          title="In progress"
          description="Finish these before taking new work."
          events={active}
          partyPower={partyPower}
          onOpen={onOpen}
          empty="No contracts in progress."
        />
      ) : null}

      <BoardSection
        title="Storyline contracts"
        description="Persistent threads"
        events={storyline}
        partyPower={partyPower}
        onOpen={onOpen}
        empty="No storyline contract is posted."
      />

      <BoardSection
        title="Temporary opportunities"
        description="They expire by world turn"
        events={opportunities}
        partyPower={partyPower}
        onOpen={onOpen}
        empty="No opportunity is currently posted."
      />
    </div>
  );
}
