export type NarrativeKind = "teaser" | "introduction" | "discovery" | "victory" | "defeat";

export interface NarrativeContext {
  kind: NarrativeKind;
  title: string;
  location: string;
  partyLevel: number;
  extra?: string;
}

export const narrativeGeneratorPrompt = {
  version: "narrative-generator@1",
  schemaVersion: "NarrativeResponse@1",
  schemaName: "NarrativeResponse",
  build(context: NarrativeContext): { system: string; user: string } {
    const system = `You write short flavour text for a grounded low-fantasy text RPG.
Return ONLY a JSON object: { "text": string }.

Rules:
- 1-3 sentences, at most 400 characters.
- Concrete sensory detail, no game mechanics, no numbers, no rewards.
- Never change the outcome of an action or imply a different result.
- Never output markdown, commentary, code fences, or text outside the JSON object.`;
    const user = JSON.stringify(context, null, 2);
    return { system, user };
  },
};
