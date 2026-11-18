import type { Archetype, EventType } from "@rpgo/contracts";
import type { IconType } from "react-icons";
import {
  GiBowArrow,
  GiBroadsword,
  GiCastle,
  GiCrossedSwords,
  GiMagicSwirl,
  GiPrayer,
  GiScrollUnfurled,
  GiSpellBook,
  GiTreasureMap,
} from "react-icons/gi";

export function EventTypeIcon({ type, size = 20 }: { type: EventType; size?: number }) {
  const Icon = eventIcons[type];
  return <Icon aria-hidden="true" size={size} />;
}

export function ArchetypeIcon({ archetype, size = 20 }: { archetype: Archetype; size?: number }) {
  const Icon = archetypeIcons[archetype];
  return <Icon aria-hidden="true" size={size} />;
}

export const eventIcons: Record<EventType, IconType> = {
  dungeon: GiCastle,
  scout: GiTreasureMap,
  research: GiScrollUnfurled,
  attack: GiCrossedSwords,
};

export const archetypeIcons: Record<Archetype, IconType> = {
  warrior: GiBroadsword,
  ranger: GiBowArrow,
  mage: GiSpellBook,
  cleric: GiPrayer,
};

export const icons = {
  sword: GiBroadsword,
  castle: GiCastle,
  spellbook: GiSpellBook,
  map: GiTreasureMap,
  scroll: GiScrollUnfurled,
  crossed: GiCrossedSwords,
  swirl: GiMagicSwirl,
};
