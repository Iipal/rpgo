import type {
  BattleReportDto,
  CommandResponseDto,
  EventDetailDto,
  EventListDto,
  GameStateDto,
  GenerationRecordDto,
  JournalEntryDto,
  PartyWithInventoryDto,
  SystemHealthDto,
  WorldDto,
} from "@rpgo/contracts";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001/api";

interface Envelope<T> {
  data: T;
  correlationId: string;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    correlationId?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly correlationId: string | null;

  constructor(message: string, code = "INTERNAL", correlationId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.correlationId = correlationId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      `Could not reach the game server at ${API_BASE}. Is it running? (${(error as Error).message})`,
      "NETWORK",
    );
  }

  const text = await response.text();
  let payload: Envelope<T> | ErrorEnvelope | null = null;
  try {
    payload = text ? (JSON.parse(text) as Envelope<T> | ErrorEnvelope) : null;
  } catch {
    throw new ApiError(
      `The server returned an unreadable response (${response.status}).`,
      "BAD_RESPONSE",
    );
  }

  if (!response.ok) {
    const failure = payload as ErrorEnvelope | null;
    throw new ApiError(
      failure?.error?.message ?? `Request failed with status ${response.status}.`,
      failure?.error?.code ?? `HTTP_${response.status}`,
      failure?.error?.correlationId ?? null,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiError("The server response did not contain game data.", "BAD_RESPONSE");
  }
  return payload.data;
}

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export interface DiagnosticsDto {
  generations: GenerationRecordDto[];
  health: SystemHealthDto;
}

export const api = {
  game: () => request<GameStateDto>("/game"),
  world: () => request<WorldDto>("/world"),
  party: () => request<PartyWithInventoryDto>("/party"),
  events: () => request<EventListDto>("/events"),
  event: (id: string) => request<EventDetailDto>(`/events/${encodeURIComponent(id)}`),
  journal: () => request<JournalEntryDto[]>("/journal"),
  health: () => request<SystemHealthDto>("/health"),
  diagnostics: () => request<DiagnosticsDto>("/system/diagnostics"),

  acceptEvent: (id: string, operationId: string) =>
    post<CommandResponseDto>(`/events/${encodeURIComponent(id)}/accept`, { operationId }),
  startEvent: (id: string, operationId: string) =>
    post<CommandResponseDto>(`/events/${encodeURIComponent(id)}/start`, { operationId }),
  resolveEvent: (id: string, operationId: string) =>
    post<CommandResponseDto>(`/events/${encodeURIComponent(id)}/resolve`, { operationId }),
  discover: (locationId: string, operationId: string) =>
    post<CommandResponseDto>("/world/discover", { locationId, operationId }),
  rest: (operationId: string) => post<CommandResponseDto>("/world/rest", { operationId }),
  equip: (characterId: string, itemId: string, operationId: string) =>
    post<CommandResponseDto>("/party/equip", { characterId, itemId, operationId }),
  unequip: (characterId: string, slot: "weapon" | "armor" | "accessory", operationId: string) =>
    post<CommandResponseDto>("/party/unequip", { characterId, slot, operationId }),
  setFormation: (characterId: string, row: "front" | "back", operationId: string) =>
    post<CommandResponseDto>("/party/formation", { characterId, row, operationId }),
  generateEvent: (category: "storyline" | "opportunity" = "opportunity") =>
    post<EventDetailDto>("/dev/generate-event", { category }),
};

export function reportFromCommand(response: CommandResponseDto): BattleReportDto | null {
  return response.report ?? null;
}
