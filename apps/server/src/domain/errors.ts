export type ErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_COMMAND"
  | "UNAUTHORIZED"
  | "LLM_UNAVAILABLE"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: 400 | 404 | 409 | 500 | 503 = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, 409, details);
  }
}

export class InvalidCommandError extends AppError {
  constructor(message: string, details?: unknown) {
    super("INVALID_COMMAND", message, 400, details);
  }
}

export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    readonly kind: "unavailable" | "timeout" | "refused" | "invalid_response" = "unavailable",
  ) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}
