import type {
  BattleReportDto,
  CommandResponseDto,
  EventDetailDto,
  GameStateDto,
  JournalEntryDto,
  PartyWithInventoryDto,
  SystemHealthDto,
} from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  GiBackpack,
  GiCastle,
  GiCrossedSwords,
  GiGears,
  GiOpenBook,
  GiQuillInk,
  GiScrollUnfurled,
  GiTechnoHeart,
} from "react-icons/gi";
import { ResourceStrip } from "./components/ResourceStrip";
import { LoadingBlock } from "./components/ui";
import { BattleReportView } from "./features/combat/BattleReportView";
import { EventBoardView } from "./features/events/EventBoardView";
import { EventDetailView } from "./features/events/EventDetailView";
import { InventoryView } from "./features/inventory/InventoryView";
import { JournalView } from "./features/journal/JournalView";
import { CharacterDetailView } from "./features/party/CharacterDetailView";
import { PartyView } from "./features/party/PartyView";
import { DiagnosticsView } from "./features/settings/DiagnosticsView";
import { WorldView } from "./features/world/WorldView";
import { ApiError, api, type DiagnosticsDto } from "./lib/api";

type View =
  | { kind: "world" }
  | { kind: "events" }
  | { kind: "event"; id: string }
  | { kind: "party" }
  | { kind: "character"; id: string }
  | { kind: "inventory" }
  | { kind: "journal" }
  | { kind: "battle" }
  | { kind: "diagnostics" };

const navigation = [
  { kind: "world" as const, label: "World", icon: GiCastle },
  { kind: "events" as const, label: "Event board", icon: GiScrollUnfurled },
  { kind: "party" as const, label: "Party", icon: GiCrossedSwords },
  { kind: "inventory" as const, label: "Inventory", icon: GiBackpack },
  { kind: "journal" as const, label: "Journal", icon: GiOpenBook },
  { kind: "diagnostics" as const, label: "Diagnostics", icon: GiGears },
];

const sectionCopy: Record<View["kind"], { title: string; blurb: string }> = {
  world: { title: "World", blurb: "Greenreach and the frontier beyond" },
  events: { title: "Event board", blurb: "Contracts, rumours and opportunities" },
  event: { title: "Contract", blurb: "Review the brief before committing the company" },
  party: { title: "Party", blurb: "The Grey Company roster" },
  character: { title: "Character", blurb: "Attributes, equipment and battle behaviour" },
  inventory: { title: "Inventory", blurb: "Company stores and equipped gear" },
  journal: { title: "Journal", blurb: "A record of the company's deeds" },
  battle: { title: "Battle report", blurb: "Deterministic encounter results" },
  diagnostics: { title: "Diagnostics", blurb: "Local model and persistence health" },
};

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.correlationId
      ? `${error.message} (correlation ${error.correlationId})`
      : error.message;
  }
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function App() {
  const [state, setState] = useState<GameStateDto | null>(null);
  const [partyData, setPartyData] = useState<PartyWithInventoryDto | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntryDto[] | null>(null);
  const [health, setHealth] = useState<SystemHealthDto | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsDto | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "events" });
  const [selectedEvent, setSelectedEvent] = useState<EventDetailDto | null>(null);
  const [report, setReport] = useState<BattleReportDto | null>(null);
  const operations = useRef(new Map<string, string>());

  const operation = useCallback((key: string): string => {
    const existing = operations.current.get(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    operations.current.set(key, id);
    return id;
  }, []);

  const refreshSideData = useCallback(async () => {
    const [party, journal, nextHealth, nextDiagnostics] = await Promise.all([
      api.party(),
      api.journal(),
      api.health(),
      api.diagnostics(),
    ]);
    setPartyData(party);
    setJournalEntries(journal);
    setHealth(nextHealth);
    setDiagnostics(nextDiagnostics);
  }, []);

  const bootstrap = useCallback(async () => {
    setBootError(null);
    try {
      const [game, party, journal, nextHealth, nextDiagnostics] = await Promise.all([
        api.game(),
        api.party(),
        api.journal(),
        api.health(),
        api.diagnostics(),
      ]);
      setState(game);
      setPartyData(party);
      setJournalEntries(journal);
      setHealth(nextHealth);
      setDiagnostics(nextDiagnostics);
    } catch (failure) {
      setBootError(errorMessage(failure));
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (view.kind !== "event") return;
    let cancelled = false;
    setSelectedEvent(null);
    api
      .event(view.id)
      .then((event) => {
        if (!cancelled) setSelectedEvent(event);
      })
      .catch((failure) => {
        if (!cancelled) setError(errorMessage(failure));
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const applyCommand = useCallback((response: CommandResponseDto) => {
    setState(response.state);
    if (response.event) {
      setSelectedEvent(response.event);
      setView({ kind: "event", id: response.event.id });
    }
    if (response.report) {
      setReport(response.report);
      setView({ kind: "battle" });
    }
  }, []);

  const runCommand = useCallback(
    async (
      key: string,
      label: string,
      action: () => Promise<CommandResponseDto>,
      success: string,
    ) => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        const response = await action();
        applyCommand(response);
        operations.current.delete(key);
        setNotice(success);
        await refreshSideData();
      } catch (failure) {
        setError(errorMessage(failure));
      } finally {
        setBusy(null);
      }
    },
    [applyCommand, refreshSideData],
  );

  const openEvent = useCallback((id: string) => {
    setError(null);
    setView({ kind: "event", id });
  }, []);

  const acceptEvent = useCallback(async () => {
    if (!selectedEvent) return;
    const key = `accept:${selectedEvent.id}`;
    await runCommand(
      key,
      "Accepting the contract and asking the Event Director for a new posting…",
      () => api.acceptEvent(selectedEvent.id, operation(key)),
      "Contract accepted. The world advanced one turn and the board was refreshed.",
    );
  }, [operation, runCommand, selectedEvent]);

  const fightEncounter = useCallback(async () => {
    if (!selectedEvent) return;
    const id = selectedEvent.id;
    const startKey = `start:${id}:${selectedEvent.currentEncounterIndex}`;
    const resolveKey = `resolve:${id}:${selectedEvent.currentEncounterIndex}`;

    setBusy("The company forms up. Simulating the encounter…");
    setError(null);
    setNotice(null);
    try {
      if (selectedEvent.canStart) {
        const started = await api.startEvent(id, operation(startKey));
        setState(started.state);
        operations.current.delete(startKey);
      }
      const response = await api.resolveEvent(id, operation(resolveKey));
      applyCommand(response);
      operations.current.delete(resolveKey);
      setNotice(
        response.report
          ? `Encounter resolved: ${response.report.outcome}.`
          : "The contract has been resolved.",
      );
      await refreshSideData();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }, [applyCommand, operation, refreshSideData, selectedEvent]);

  const resolveFieldObjective = useCallback(async () => {
    if (!selectedEvent) return;
    const key = `resolve:${selectedEvent.id}:field`;
    await runCommand(
      key,
      "Completing the field objective…",
      () => api.resolveEvent(selectedEvent.id, operation(key)),
      "Objective completed. Rewards were recorded once.",
    );
  }, [operation, runCommand, selectedEvent]);

  const discover = useCallback(
    async (locationId: string) => {
      const key = `discover:${locationId}`;
      await runCommand(
        key,
        "Charting the route and refreshing the board…",
        () => api.discover(locationId, operation(key)),
        "The route is charted. The world advanced one turn.",
      );
    },
    [operation, runCommand],
  );

  const rest = useCallback(async () => {
    const key = "rest";
    await runCommand(
      key,
      "Making camp…",
      () => api.rest(operation(key)),
      "The company is restored. Resting did not advance the world turn.",
    );
  }, [operation, runCommand]);

  const equip = useCallback(
    async (characterId: string, itemId: string) => {
      const key = `equip:${characterId}:${itemId}`;
      await runCommand(
        key,
        "Adjusting equipment…",
        () => api.equip(characterId, itemId, operation(key)),
        "Equipment updated.",
      );
    },
    [operation, runCommand],
  );

  const unequip = useCallback(
    async (characterId: string, slot: "weapon" | "armor" | "accessory") => {
      const key = `unequip:${characterId}:${slot}`;
      await runCommand(
        key,
        "Adjusting equipment…",
        () => api.unequip(characterId, slot, operation(key)),
        "Equipment updated.",
      );
    },
    [operation, runCommand],
  );

  const setFormation = useCallback(
    async (characterId: string, row: "front" | "back") => {
      const key = `formation:${characterId}:${row}`;
      await runCommand(
        key,
        "Reforming the line…",
        () => api.setFormation(characterId, row, operation(key)),
        "Formation updated.",
      );
    },
    [operation, runCommand],
  );

  const refreshDiagnostics = useCallback(async () => {
    setBusy("Refreshing diagnostics…");
    setError(null);
    try {
      await refreshSideData();
      setNotice("Diagnostics refreshed.");
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }, [refreshSideData]);

  const generateEvent = useCallback(async () => {
    setBusy("Asking the local model for a new contract. This can take 20–30 seconds…");
    setError(null);
    setNotice(null);
    try {
      const event = await api.generateEvent("opportunity");
      setSelectedEvent(event);
      setView({ kind: "event", id: event.id });
      setNotice(
        event.source === "generated"
          ? "The local model produced a contract that passed validation."
          : "The model was unavailable; authored fallback content was posted instead.",
      );
      await refreshSideData();
    } catch (failure) {
      setError(errorMessage(failure));
      await refreshSideData().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }, [refreshSideData]);

  if (!state || !partyData || !journalEntries) {
    return (
      <div className="boot-screen">
        <div className="boot-mark" aria-hidden="true">
          <GiCastle size={54} />
        </div>
        <h1>The Grey Company</h1>
        {bootError ? (
          <>
            <p className="boot-error">{bootError}</p>
            <Button className="btn btn-primary" onClick={() => void bootstrap()}>
              Try again
            </Button>
          </>
        ) : (
          <LoadingBlock label="Opening the Greenreach chronicle…" />
        )}
        <p className="boot-hint">
          The game server is expected at{" "}
          {import.meta.env.VITE_API_URL ?? "http://localhost:3001/api"}.
        </p>
      </div>
    );
  }

  const copy = sectionCopy[view.kind];
  const activeCount = state.events.filter((event) => event.status === "active").length;
  const character =
    view.kind === "character"
      ? partyData.party.members.find((member) => member.id === view.id)
      : undefined;

  let content: ReactNode;
  switch (view.kind) {
    case "world":
      content = (
        <WorldView
          state={state}
          busy={busy !== null}
          onDiscover={(locationId) => void discover(locationId)}
          onRest={() => void rest()}
        />
      );
      break;
    case "events":
      content = <EventBoardView state={state} onOpen={openEvent} />;
      break;
    case "event":
      content = selectedEvent ? (
        <EventDetailView
          event={selectedEvent}
          busy={busy !== null}
          onBack={() => setView({ kind: "events" })}
          onAccept={() => void acceptEvent()}
          onFight={() => void fightEncounter()}
          onResolve={() => void resolveFieldObjective()}
        />
      ) : (
        <LoadingBlock label="Reading the contract…" />
      );
      break;
    case "party":
      content = (
        <PartyView data={partyData} onOpenCharacter={(id) => setView({ kind: "character", id })} />
      );
      break;
    case "character":
      content = character ? (
        <CharacterDetailView
          member={character}
          data={partyData}
          busy={busy !== null}
          onBack={() => setView({ kind: "party" })}
          onEquip={(itemId) => void equip(character.id, itemId)}
          onUnequip={(slot) => void unequip(character.id, slot)}
          onFormation={(row) => void setFormation(character.id, row)}
        />
      ) : (
        <LoadingBlock label="Finding the company member…" />
      );
      break;
    case "inventory":
      content = (
        <InventoryView
          data={partyData}
          busy={busy !== null}
          onEquip={(characterId, itemId) => void equip(characterId, itemId)}
          onUnequip={(characterId, slot) => void unequip(characterId, slot)}
        />
      );
      break;
    case "journal":
      content = <JournalView entries={journalEntries} />;
      break;
    case "battle":
      content = report ? (
        <BattleReportView
          report={report}
          onBack={() =>
            selectedEvent
              ? setView({ kind: "event", id: selectedEvent.id })
              : setView({ kind: "events" })
          }
        />
      ) : (
        <LoadingBlock label="Retrieving the battle report…" />
      );
      break;
    case "diagnostics":
      content = health ? (
        <DiagnosticsView
          health={health}
          diagnostics={diagnostics}
          busy={busy !== null}
          onRefresh={() => void refreshDiagnostics()}
          onGenerate={() => void generateEvent()}
        />
      ) : (
        <LoadingBlock label="Checking the local model…" />
      );
      break;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <GiCastle size={26} />
          </span>
          <div>
            <strong>The Grey Company</strong>
            <span>Greenreach chronicle</span>
          </div>
        </div>

        <nav className="nav" aria-label="Game sections">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              view.kind === item.kind ||
              (item.kind === "events" && view.kind === "event") ||
              (item.kind === "party" && view.kind === "character");
            return (
              <button
                key={item.kind}
                type="button"
                className={`nav-item ${active ? "nav-active" : ""}`}
                onClick={() => {
                  setError(null);
                  setView({ kind: item.kind } as View);
                }}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {item.kind === "events" && activeCount > 0 ? (
                  <span
                    className="nav-badge"
                    title={`${activeCount} active contract${activeCount === 1 ? "" : "s"}`}
                  >
                    {activeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Company ledger</p>
          <p className="company-name">{state.party.name}</p>
          <p className="hint">
            {state.party.members.filter((member) => !member.incapacitated).length} of{" "}
            {state.party.members.length} members ready
          </p>
          <div className="sidebar-power">
            <span>Party power</span>
            <strong>{state.party.power}</strong>
          </div>
        </div>

        <div className="sidebar-footer">
          <span className="dot" aria-hidden="true" />
          Local-first · engine authoritative
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">{copy.blurb}</p>
            <h1>{copy.title}</h1>
          </div>
          <div className="topbar-right">
            <ResourceStrip state={state} health={health} />
            <Dialog>
              <DialogTrigger className="btn btn-small btn-quiet">How to play</DialogTrigger>
              <DialogBackdrop className="dialog-backdrop" />
              <DialogContent className="dialog-content">
                <DialogTitle>How the loop works</DialogTitle>
                <DialogDescription>
                  One world turn at a time. The deterministic engine owns every outcome.
                </DialogDescription>
                <ol className="help-list">
                  <li>Open the event board and pick one available contract.</li>
                  <li>Accept it. The world advances one turn and the board refreshes.</li>
                  <li>
                    Fight each encounter automatically. The same seed always gives the same result.
                  </li>
                  <li>Win to receive rewards once. A later defeat keeps earlier progress.</li>
                  <li>Rest, equip, and chart new routes between contracts.</li>
                </ol>
                <p className="hint">
                  The local model proposes contracts and flavour text. It never changes stats,
                  rolls, rewards, or world time. If it is offline, authored fallback content keeps
                  the game playable.
                </p>
                <DialogClose className="btn btn-primary">Understood</DialogClose>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {busy ? (
          <div className="notice notice-busy" role="status" aria-live="polite">
            <span className="loading-mark" aria-hidden="true" />
            {busy}
          </div>
        ) : null}

        {health?.llm.fallbackActive ? (
          <div className="notice notice-warn">
            <GiTechnoHeart aria-hidden="true" />
            The local model is unavailable or its last generation failed. You are seeing authored
            fallback contracts; the game remains fully playable.
          </div>
        ) : null}

        {error ? (
          <div className="notice notice-error" role="alert">
            <span>{error}</span>
            <button type="button" className="notice-dismiss" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {notice ? (
          <div className="notice notice-success" role="status">
            <span>{notice}</span>
            <button type="button" className="notice-dismiss" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="view">{content}</div>

        <footer className="app-footer">
          <GiQuillInk aria-hidden="true" />
          <span>
            The model proposes. The engine decides. World turn {state.world.turn} ·{" "}
            {state.player.name}
          </span>
        </footer>
      </main>
    </div>
  );
}
