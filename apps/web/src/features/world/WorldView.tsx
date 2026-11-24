import type { CharacterDto, GameStateDto, LocationDto, RegionDto } from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import { GiCampfire, GiCastle, GiPathDistance, GiRun } from "react-icons/gi";
import { KeyValue, Panel, Pill, StatBar } from "../../components/ui";
import { percent, titleCase } from "../../lib/format";

const REST_COST = 15;

function statusTone(status: LocationDto["status"]): "good" | "warn" | "muted" {
  return status === "accessible" ? "good" : status === "discovered" ? "warn" : "muted";
}

function LocationRow({
  location,
  regionStatus,
  connectedNames,
  busy,
  onDiscover,
}: {
  location: LocationDto;
  regionStatus: RegionDto["status"];
  connectedNames: string[];
  busy: boolean;
  onDiscover: (locationId: string) => void;
}) {
  const canDiscover =
    (regionStatus === "accessible" || regionStatus === "discovered") &&
    location.status !== "accessible";
  return (
    <li className="location-row">
      <div className="location-copy">
        <div className="location-name">
          <GiPathDistance aria-hidden="true" />
          <strong>{location.name}</strong>
          <Pill tone={statusTone(location.status)}>{titleCase(location.status)}</Pill>
        </div>
        <p>{location.description}</p>
        <span className="hint">
          {location.tags.join(" · ")}
          {connectedNames.length > 0 ? ` · Routes: ${connectedNames.join(", ")}` : ""}
          {location.discoveredTurn !== null
            ? ` · First charted on turn ${location.discoveredTurn}`
            : ""}
        </span>
      </div>
      {canDiscover ? (
        <Button
          className="btn btn-small btn-quiet"
          disabled={busy}
          onClick={() => onDiscover(location.id)}
          pendingAnnouncement="Charting the road"
        >
          <GiRun aria-hidden="true" />
          {location.status === "unknown" ? "Scout" : "Open route"}
        </Button>
      ) : null}
    </li>
  );
}

function RegionCard({
  region,
  current,
  busy,
  onDiscover,
}: {
  region: RegionDto;
  current: boolean;
  busy: boolean;
  onDiscover: (locationId: string) => void;
}) {
  const known = region.locations.filter((location) => location.status !== "unknown").length;
  return (
    <article className={`region-card ${current ? "region-current" : ""}`}>
      <header className="region-head">
        <div className="region-title">
          <GiCastle aria-hidden="true" size={26} />
          <div>
            <div className="eyebrow">
              {current
                ? "You are here"
                : region.status === "unknown"
                  ? "Uncharted"
                  : "Known region"}
            </div>
            <h3>{region.name}</h3>
          </div>
        </div>
        <div className="region-meta">
          <Pill tone={region.status === "accessible" ? "good" : "muted"}>
            {titleCase(region.status)}
          </Pill>
          <Pill tone={region.threatLevel >= 3 ? "bad" : region.threatLevel >= 2 ? "warn" : "good"}>
            Threat {region.threatLevel}
          </Pill>
          <span className="hint">
            Levels {region.levelRange.min}–{region.levelRange.max}
          </span>
        </div>
      </header>
      <p className="region-description">{region.description}</p>
      {region.connections.length > 0 ? (
        <p className="hint region-routes">
          Routes:{" "}
          {region.connections
            .map((connection) => `${connection.name} (${titleCase(connection.status)})`)
            .join(" · ")}
        </p>
      ) : null}
      {region.status !== "unknown" ? (
        <>
          <div className="region-progress">
            <span>
              {known} of {region.locations.length} locations charted
            </span>
            <div className="mini-track">
              <span style={{ width: `${percent(known, region.locations.length)}%` }} />
            </div>
          </div>
          <ul className="location-list">
            {region.locations.map((location) => (
              <LocationRow
                key={location.id}
                location={location}
                regionStatus={region.status}
                connectedNames={location.connectedLocationIds.map(
                  (id) => region.locations.find((candidate) => candidate.id === id)?.name ?? id,
                )}
                busy={busy}
                onDiscover={onDiscover}
              />
            ))}
          </ul>
        </>
      ) : (
        <div className="locked-region">
          <GiPathDistance aria-hidden="true" />
          <p>
            No route is open yet. Complete a frontier contract that reaches this region before the
            company can travel here.
          </p>
        </div>
      )}
    </article>
  );
}

export function WorldView({
  state,
  busy,
  onDiscover,
  onRest,
}: {
  state: GameStateDto;
  busy: boolean;
  onDiscover: (locationId: string) => void;
  onRest: () => void;
}) {
  const currentRegion =
    state.world.regions.find((region) => region.id === state.world.currentRegionId) ??
    state.world.regions[0];
  const partyHealth = state.party.members.reduce((total, member) => total + member.health, 0);
  const partyMaxHealth = state.party.members.reduce((total, member) => total + member.maxHealth, 0);
  const incapacitated = state.party.members.filter((member) => member.incapacitated).length;
  const exhausted = state.party.members.filter(
    (member: CharacterDto) => member.health < member.maxHealth * 0.5,
  ).length;

  return (
    <div className="stack">
      <div className="hero-banner">
        <div>
          <p className="eyebrow">The Greenreach Chronicle</p>
          <h2>An old road, a cold wind, and work to be done.</h2>
          <p>
            Lead the Grey Company from the safety of Thornbury into the woods and ruins beyond.
            Every accepted contract moves the world one turn closer to whatever waits in the Ashen
            March.
          </p>
        </div>
        <div className="hero-emblem" aria-hidden="true">
          <GiCastle size={62} />
        </div>
      </div>

      <div className="split-grid">
        <Panel eyebrow="Current posting" title={currentRegion?.name ?? "Greenreach"}>
          <div className="quick-stats">
            <KeyValue label="World turn" value={state.world.turn} />
            <KeyValue label="Party power" value={state.party.power} />
            <KeyValue label="Gold" value={state.player.gold} />
            <KeyValue label="Research" value={state.player.researchPoints} />
          </div>
          <StatBar label="Company health" value={partyHealth} max={partyMaxHealth} tone="health" />
          <div className="rest-block">
            <div>
              <h3 className="subhead">
                <GiCampfire aria-hidden="true" /> Make camp
              </h3>
              <p className="hint">
                Restore every member to full health and mana. Costs {REST_COST} gold. Resting does
                not advance the world turn.
              </p>
            </div>
            <Button
              className="btn btn-secondary"
              disabled={busy || state.player.gold < REST_COST}
              onClick={onRest}
              pendingAnnouncement="Making camp"
            >
              Rest · {REST_COST} gold
            </Button>
          </div>
          {incapacitated > 0 ? (
            <p className="notice notice-warn">
              {incapacitated} {incapacitated === 1 ? "companion is" : "companions are"}{" "}
              incapacitated. Rest will bring them back to their feet.
            </p>
          ) : exhausted > 0 ? (
            <p className="notice notice-info">
              {exhausted} {exhausted === 1 ? "companion is" : "companions are"} below half health.
              Consider resting before a hard contract.
            </p>
          ) : null}
        </Panel>

        <Panel eyebrow="Region ledger" title="Known ground">
          <div className="region-summary-list">
            {state.world.regions.map((region) => (
              <div className="region-summary" key={region.id}>
                <div>
                  <strong>{region.name}</strong>
                  <p className="hint">
                    {region.locations.filter((location) => location.status === "accessible").length}{" "}
                    accessible ·{" "}
                    {region.locations.filter((location) => location.status === "discovered").length}{" "}
                    charted
                  </p>
                </div>
                <Pill tone={region.status === "accessible" ? "good" : "muted"}>
                  {titleCase(region.status)}
                </Pill>
              </div>
            ))}
          </div>
          <p className="hint">
            Discovery is permanent. Opening a route costs a world turn and may unlock new contracts
            on the board.
          </p>
        </Panel>
      </div>

      <div className="region-grid">
        {state.world.regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            current={region.id === state.world.currentRegionId}
            busy={busy}
            onDiscover={onDiscover}
          />
        ))}
      </div>
    </div>
  );
}
