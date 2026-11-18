import type { EventConcept } from "@rpgo/contracts";

export interface GeneratorContext {
  concept: EventConcept;
  partyLevel: number;
  partyPower: number;
  turn: number;
  enemyTemplates: Array<{ id: string; name: string; level: number; behaviorId: string }>;
  allowedBehaviors: string[];
  maxEncounters: number;
}

export const eventGeneratorPrompt = {
  version: "event-generator@1",
  schemaVersion: "GeneratedEvent@1",
  schemaName: "GeneratedEvent",
  build(context: GeneratorContext): { system: string; user: string } {
    const system = `You are the Event Generator for a small, single-player fantasy text RPG.
Expand ONE approved event concept into a complete, playable event definition.

Return ONLY a JSON object with exactly these fields:
{
  "title": string (4-90 chars),
  "description": string (20-600 chars, the board/detail description),
  "introduction": string (20-900 chars, second-person scene-setting),
  "objectives": [
    { "kind": "defeat_enemies" | "discover_location" | "complete_research", "description": string, "targetCount": integer 1-10 optional }
  ],
  "encounters": [
    {
      "title": string,
      "description": string,
      "enemies": [ { "templateId": string, "count": integer 1-4, "behaviorId": string } ]
    }
  ],
  "rewardIntent": [
    { "kind": "gold" | "experience" | "equipment" | "research", "rarity": "common" | "uncommon" | "rare" optional }
  ],
  "completionText": string (10-500 chars, shown on victory),
  "failureText": string (10-500 chars, shown on defeat)
}

Hard rules:
- Use ONLY enemy template IDs from the allowed list. Use ONLY behavior IDs from the allowed list.
- Do not invent stats, damage numbers, loot values, or reward amounts. Reward intent selects categories only.
- The first objective MUST match the concept's objectiveKind.
- Encounter count must be between 0 and the provided maxEncounters.
- Scout and research events must have zero combat encounters.
- Encounters contain at most 3 enemy groups, each with count 1-4.
- Reward intent contains 1-4 categories and should match the event type.
- Keep prose concrete, grounded, and under the stated lengths. Second person for introduction.
- Never output markdown, commentary, code fences, or any text outside the JSON object.`;
    const user = JSON.stringify(
      {
        turn: context.turn,
        party: { level: context.partyLevel, power: context.partyPower },
        concept: context.concept,
        allowedEnemyTemplates: context.enemyTemplates,
        allowedBehaviors: context.allowedBehaviors,
        maxEncounters: context.maxEncounters,
        allowedRewardKinds: ["gold", "experience", "equipment", "research"],
      },
      null,
      2,
    );
    return { system, user };
  },
};
