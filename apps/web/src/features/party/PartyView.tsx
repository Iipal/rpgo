import type { CharacterDto, PartyWithInventoryDto } from "@rpgo/contracts";
import { GiBattleGear, GiBootStomp, GiUpgrade } from "react-icons/gi";
import { ArchetypeIcon } from "../../components/Icons";
import { Panel, Pill, StatBar } from "../../components/ui";
import { titleCase } from "../../lib/format";

function MemberCard({ member, onOpen }: { member: CharacterDto; onOpen: (id: string) => void }) {
  const equipped = Object.values(member.equipment).filter(Boolean);
  return (
    <button
      type="button"
      className={`member-card ${member.incapacitated ? "member-down" : ""}`}
      onClick={() => onOpen(member.id)}
    >
      <div className="member-head">
        <span className={`archetype-glyph archetype-${member.archetype}`}>
          <ArchetypeIcon archetype={member.archetype} size={28} />
        </span>
        <div>
          <div className="event-kicker">
            <span>{titleCase(member.archetype)}</span>
            <span aria-hidden="true">·</span>
            <span>Level {member.level}</span>
          </div>
          <h3>{member.name}</h3>
        </div>
        <Pill tone={member.incapacitated ? "bad" : "neutral"}>
          {member.incapacitated ? "Incapacitated" : member.formation === "front" ? "Front" : "Back"}
        </Pill>
      </div>

      <StatBar label="Health" value={member.health} max={member.maxHealth} tone="health" />
      <StatBar label="Mana" value={member.mana} max={member.maxMana} tone="mana" />
      <StatBar
        label="Experience"
        value={member.experience}
        max={member.xpToNext}
        tone="xp"
        compact
      />

      <div className="member-stats">
        <span>ATK {member.derived.attack}</span>
        <span>MAG {member.derived.magicAttack}</span>
        <span>DEF {member.derived.defense}</span>
        <span>SPD {member.derived.speed}</span>
        <span>CRIT {Math.round(member.derived.critChance * 100)}%</span>
      </div>

      <div className="member-gear">
        <GiBattleGear aria-hidden="true" />
        {equipped.length > 0 ? (
          <span>{equipped.map((item) => item?.name).join(" · ")}</span>
        ) : (
          <span className="hint">No equipment</span>
        )}
      </div>
    </button>
  );
}

export function PartyView({
  data,
  onOpenCharacter,
}: {
  data: PartyWithInventoryDto;
  onOpenCharacter: (id: string) => void;
}) {
  const members = data.party.members;
  const totalXp = members.reduce((sum, member) => sum + member.experience, 0);
  return (
    <div className="stack">
      <div className="section-intro">
        <div>
          <p className="eyebrow">The company rolls</p>
          <h2>{data.party.name}</h2>
          <p>
            Four adventurers, one contract at a time. Formation decides who stands in the front rank
            when steel is drawn.
          </p>
        </div>
        <div className="party-summary">
          <span>
            <GiBootStomp aria-hidden="true" /> Power {data.party.power}
          </span>
          <span>
            <GiUpgrade aria-hidden="true" /> {totalXp} total XP
          </span>
        </div>
      </div>

      <div className="member-grid">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} onOpen={onOpenCharacter} />
        ))}
      </div>

      <Panel eyebrow="Formation" title="The line of battle">
        <div className="formation-grid">
          {(["front", "back"] as const).map((row) => (
            <div className="formation-row" key={row}>
              <div className="formation-label">
                <strong>{row === "front" ? "Front rank" : "Back rank"}</strong>
                <span className="hint">
                  {row === "front"
                    ? "Meets melee attackers first."
                    : "Sheltered by the front rank."}
                </span>
              </div>
              <div className="formation-members">
                {members
                  .filter((member) => member.formation === row)
                  .map((member) => (
                    <span className="formation-chip" key={member.id}>
                      <ArchetypeIcon archetype={member.archetype} />
                      {member.name}
                    </span>
                  ))}
                {members.every((member) => member.formation !== row) ? (
                  <span className="hint">Empty</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <p className="hint">
          Open a character to change their formation or equipment. Viewing the roster never advances
          the world turn.
        </p>
      </Panel>
    </div>
  );
}
