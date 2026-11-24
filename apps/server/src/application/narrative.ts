import { NarrativeResponseSchema } from "@rpgo/contracts";
import type { GenerationService } from "../infrastructure/llm/generation-service";
import {
  type NarrativeKind,
  narrativeGeneratorPrompt,
} from "../infrastructure/llm/prompts/narrative-generator";

export interface NarrativeInput {
  kind: NarrativeKind;
  title: string;
  location: string;
  partyLevel: number;
  extra?: string;
}

const NARRATIVE_TIMEOUT_MS = 5000;

/**
 * Narrative is optional flavour. Callers must treat null as "use the
 * deterministic text" and must never let failure block a game command.
 */
export async function generateNarrative(
  generation: GenerationService,
  input: NarrativeInput,
  correlationId: string,
): Promise<string | null> {
  const prompt = narrativeGeneratorPrompt.build(input);
  const result = await generation.generate({
    task: "narrative_generator",
    promptVersion: narrativeGeneratorPrompt.version,
    schemaVersion: narrativeGeneratorPrompt.schemaVersion,
    schemaName: narrativeGeneratorPrompt.schemaName,
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    schema: NarrativeResponseSchema,
    correlationId,
    maxOutputTokens: 250,
    timeoutMs: NARRATIVE_TIMEOUT_MS,
    maxAttempts: 1,
  });
  const text = result?.data.text.trim();
  return text ? text : null;
}

export function narrativeLogger(correlationId: string, message: string, error: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      correlationId,
      message,
      error: (error as Error).message,
    }),
  );
}
