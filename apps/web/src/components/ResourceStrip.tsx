import type { GameStateDto, SystemHealthDto } from "@rpgo/contracts";
import { GiCastle, GiCoins, GiSpellBook } from "react-icons/gi";

export function ResourceStrip({
  state,
  health,
}: {
  state: GameStateDto;
  health: SystemHealthDto | null;
}) {
  return (
    <div className="resource-strip">
      <div className="resource" title="Gold">
        <GiCoins aria-hidden="true" />
        <span>
          <strong>{state.player.gold}</strong> gold
        </span>
      </div>
      <div className="resource" title="Research points">
        <GiSpellBook aria-hidden="true" />
        <span>
          <strong>{state.player.researchPoints}</strong> research
        </span>
      </div>
      <div className="resource" title="World turn">
        <GiCastle aria-hidden="true" />
        <span>
          turn <strong>{state.world.turn}</strong>
        </span>
      </div>
      <div
        className={`llm-chip ${health?.llm.fallbackActive ? "llm-chip-fallback" : ""}`}
        title={
          health?.llm.fallbackActive
            ? "The local model is unavailable; authored fallback content is being used."
            : `Local model: ${health?.llm.model ?? "checking"}`
        }
      >
        <span className="dot" aria-hidden="true" />
        {health === null
          ? "checking model"
          : health.llm.fallbackActive
            ? "fallback content"
            : `model ready`}
      </div>
    </div>
  );
}
