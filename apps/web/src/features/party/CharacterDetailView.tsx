import type {
  CharacterDto,
  EquipmentItemDto,
  InventoryItemDto,
  PartyWithInventoryDto,
} from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import { GiBattleGear, GiSwapBag, GiUpgrade } from "react-icons/gi";
import { ArchetypeIcon } from "../../components/Icons";
import { KeyValue, Panel, Pill, StatBar } from "../../components/ui";
import { titleCase } from "../../lib/format";

const slots = ["weapon", "armor", "accessory"] as const;
type Slot = (typeof slots)[number];

const behaviorDescriptions: Record<string, string> = {
  party_warrior: "Holds the front line, guards exposed allies, and strikes the strongest foe.",
  party_ranger: "Hunts wounded and vulnerable enemies with focused physical attacks.",
  party_mage: "Casts area magic when the enemy line is crowded, otherwise hurls arcane bolts.",
  party_cleric: "Heals the most injured ally, shields the company, then joins the attack.",
};

function bonusText(item: EquipmentItemDto | null): string {
  if (!item) return "Empty";
  const parts = Object.entries(item.bonuses)
    .filter(([, value]) => typeof value === "number" && value !== 0)
    .map(([key, value]) => `${titleCase(key)} ${value && value > 0 ? "+" : ""}${value}`);
  return parts.join(", ") || "No bonuses";
}

export function CharacterDetailView({
  member,
  data,
  busy,
  onBack,
  onEquip,
  onUnequip,
  onFormation,
}: {
  member: CharacterDto;
  data: PartyWithInventoryDto;
  busy: boolean;
  onBack: () => void;
  onEquip: (itemId: string) => void;
  onUnequip: (slot: Slot) => void;
  onFormation: (row: "front" | "back") => void;
}) {
  const compatible = data.inventory.filter(
    (item) =>
      slots.includes(item.slot as Slot) && (!item.equippedBy || item.equippedBy === member.id),
  );
  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={onBack}>
        ← Company roster
      </button>

      <article className="character-hero">
        <span className={`archetype-glyph archetype-${member.archetype} large`}>
          <ArchetypeIcon archetype={member.archetype} size={48} />
        </span>
        <div>
          <p className="eyebrow">
            {titleCase(member.archetype)} · Level {member.level} · Power {member.power}
          </p>
          <h2>{member.name}</h2>
          <p>
            {behaviorDescriptions[member.combatBehaviorId] ??
              "A steady hand in the company's line."}
          </p>
        </div>
        <div className="hero-badges">
          <Pill tone={member.incapacitated ? "bad" : "good"}>
            {member.incapacitated ? "Incapacitated" : "Ready"}
          </Pill>
          <Pill tone="neutral">{member.formation === "front" ? "Front rank" : "Back rank"}</Pill>
        </div>
      </article>

      <div className="detail-grid">
        <div className="stack">
          <Panel eyebrow="Vitals" title="Condition">
            <StatBar label="Health" value={member.health} max={member.maxHealth} tone="health" />
            <StatBar label="Mana" value={member.mana} max={member.maxMana} tone="mana" />
            <StatBar
              label={`Experience · ${member.experience} XP`}
              value={member.experience}
              max={member.xpToNext}
              tone="xp"
            />
            <p className="hint">
              {Math.max(0, member.xpToNext - member.experience)} XP until level {member.level + 1}.
              Experience is awarded only when a contract is completed.
            </p>
          </Panel>

          <Panel eyebrow="Sheet" title="Attributes and derived stats">
            <div className="attribute-grid">
              <KeyValue label="Strength" value={member.attributes.strength} />
              <KeyValue label="Agility" value={member.attributes.agility} />
              <KeyValue label="Intelligence" value={member.attributes.intelligence} />
              <KeyValue label="Vitality" value={member.attributes.vitality} />
            </div>
            <div className="derived-grid">
              <KeyValue label="Attack" value={member.derived.attack} />
              <KeyValue label="Magic attack" value={member.derived.magicAttack} />
              <KeyValue label="Defense" value={member.derived.defense} />
              <KeyValue label="Speed" value={member.derived.speed} />
              <KeyValue
                label="Crit chance"
                value={`${Math.round(member.derived.critChance * 100)}%`}
              />
              <KeyValue label="Max health" value={member.derived.maxHealth} />
              <KeyValue label="Max mana" value={member.derived.maxMana} />
              <KeyValue label="Equipment power" value={member.power} />
            </div>
            <p className="hint">
              Derived values include equipment bonuses. The formulas are documented in
              docs/GAME_DESIGN.md.
            </p>
          </Panel>

          <Panel eyebrow="Abilities" title="Combat repertoire">
            <div className="ability-list">
              {member.abilityIds.map((ability) => (
                <span className="ability-chip" key={ability}>
                  {titleCase(ability)}
                </span>
              ))}
            </div>
            <div className="behavior-note">
              <GiBattleGear aria-hidden="true" />
              <p>
                <strong>Battle behavior:</strong>{" "}
                {behaviorDescriptions[member.combatBehaviorId] ??
                  "The deterministic preset chooses the best legal action each turn."}
              </p>
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel eyebrow="Kit" title="Equipped gear">
            <div className="equipment-slots">
              {slots.map((slot) => {
                const item = member.equipment[slot];
                return (
                  <div className="equipment-slot" key={slot}>
                    <div>
                      <div className="slot-label">{titleCase(slot)}</div>
                      <strong>{item?.name ?? "Empty"}</strong>
                      <p className="hint">{bonusText(item)}</p>
                    </div>
                    {item ? (
                      <Button
                        className="btn btn-small btn-quiet"
                        disabled={busy}
                        onClick={() => onUnequip(slot)}
                        pendingAnnouncement={`Removing ${item.name}`}
                      >
                        Unequip
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="hint">
              Equipment changes persist immediately and never advance the turn.
            </p>
          </Panel>

          <Panel eyebrow="Stores" title="Available equipment">
            {compatible.length === 0 ? (
              <p className="hint">The company stores hold no further gear for this character.</p>
            ) : (
              <ul className="inventory-pick-list">
                {compatible.map((item: InventoryItemDto) => {
                  const equippedHere = item.equippedBy === member.id;
                  return (
                    <li key={item.instanceId}>
                      <div>
                        <strong>{item.name}</strong>
                        <p className="hint">
                          {titleCase(item.slot)} · {bonusText(item)}
                        </p>
                      </div>
                      <Button
                        className="btn btn-small btn-secondary"
                        disabled={busy || equippedHere}
                        onClick={() => onEquip(item.instanceId)}
                        pendingAnnouncement={`Equipping ${item.name}`}
                      >
                        <GiSwapBag aria-hidden="true" />
                        {equippedHere ? "Equipped" : "Equip"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel eyebrow="Orders" title="Formation">
            <div className="formation-toggle">
              <Button
                className={`btn btn-small ${member.formation === "front" ? "btn-primary" : "btn-quiet"}`}
                disabled={busy || member.formation === "front"}
                onClick={() => onFormation("front")}
              >
                Front rank
              </Button>
              <Button
                className={`btn btn-small ${member.formation === "back" ? "btn-primary" : "btn-quiet"}`}
                disabled={busy || member.formation === "back"}
                onClick={() => onFormation("back")}
              >
                Back rank
              </Button>
            </div>
            <p className="hint">
              Melee attacks prefer the front rank. Ranged and magical attacks follow their ability
              rules. Formation changes never advance the turn.
            </p>
            <div className="xp-note">
              <GiUpgrade aria-hidden="true" />
              <span>
                Level ups grant attribute growth automatically. There is no talent tree in the MVP.
              </span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
