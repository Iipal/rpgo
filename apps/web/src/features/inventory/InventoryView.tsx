import type { InventoryItemDto, PartyWithInventoryDto } from "@rpgo/contracts";
import { Button } from "@ui-sdk/react/button";
import { useState } from "react";
import { GiBackpack, GiSwapBag } from "react-icons/gi";
import { EmptyState, Panel, Pill } from "../../components/ui";
import { titleCase } from "../../lib/format";

const slots = ["weapon", "armor", "accessory"] as const;

function bonusSummary(item: InventoryItemDto): string {
  const parts = Object.entries(item.bonuses)
    .filter(([, value]) => typeof value === "number" && value !== 0)
    .map(([key, value]) => `${titleCase(key)} ${value && value > 0 ? "+" : ""}${value}`);
  return parts.join(", ") || "No bonuses";
}

export function InventoryView({
  data,
  busy,
  onEquip,
  onUnequip,
}: {
  data: PartyWithInventoryDto;
  busy: boolean;
  onEquip: (characterId: string, itemId: string) => void;
  onUnequip: (characterId: string, slot: "weapon" | "armor" | "accessory") => void;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const members = data.party.members;

  return (
    <div className="stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Company stores</p>
          <h2>Inventory and kit</h2>
          <p>
            Gear belongs to the company, not to a single character. Equip an owned item on any
            member; the engine enforces ownership and slot rules.
          </p>
        </div>
        <div className="party-summary">
          <span>
            <GiBackpack aria-hidden="true" /> {data.inventory.length} items
          </span>
        </div>
      </div>

      {slots.map((slot) => {
        const items = data.inventory.filter((item) => item.slot === slot);
        return (
          <Panel key={slot} eyebrow="Equipment" title={titleCase(slot)}>
            {items.length === 0 ? (
              <EmptyState title={`No ${slot} in stores.`}>
                Complete contracts to find more equipment.
              </EmptyState>
            ) : (
              <ul className="inventory-list">
                {items.map((item) => {
                  const target = targets[item.instanceId] ?? members[0]?.id ?? "";
                  const equippedBy = item.equippedBy;
                  return (
                    <li className="inventory-row" key={item.instanceId}>
                      <div className="inventory-copy">
                        <div className="inventory-name">
                          <strong>{item.name}</strong>
                          <span className={`rarity rarity-${item.rarity}`}>{item.rarity}</span>
                          <Pill tone={equippedBy ? "info" : "muted"}>
                            {equippedBy ? `Equipped: ${item.equippedByName ?? "member"}` : "Stored"}
                          </Pill>
                        </div>
                        <p>{item.description}</p>
                        <span className="hint">
                          {bonusSummary(item)} · acquired turn {item.acquiredTurn}
                        </span>
                      </div>
                      <div className="inventory-actions">
                        {equippedBy ? (
                          <Button
                            className="btn btn-small btn-quiet"
                            disabled={busy}
                            onClick={() => onUnequip(equippedBy, item.slot)}
                            pendingAnnouncement={`Unequipping ${item.name}`}
                          >
                            Unequip
                          </Button>
                        ) : (
                          <>
                            <label className="select-label">
                              <span className="sr-only">Equip {item.name} on</span>
                              <select
                                value={target}
                                onChange={(event) =>
                                  setTargets((current) => ({
                                    ...current,
                                    [item.instanceId]: event.target.value,
                                  }))
                                }
                              >
                                {members.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Button
                              className="btn btn-small btn-secondary"
                              disabled={busy || !target}
                              onClick={() => target && onEquip(target, item.instanceId)}
                              pendingAnnouncement={`Equipping ${item.name}`}
                            >
                              <GiSwapBag aria-hidden="true" />
                              Equip
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
