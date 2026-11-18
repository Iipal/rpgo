import {
  DiscoverRequestSchema,
  EquipRequestSchema,
  type EventListDto,
  FormationRequestSchema,
  OperationRequestSchema,
  type PartyWithInventoryDto,
  RestRequestSchema,
  UnequipRequestSchema,
} from "@rpgo/contracts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ZodType } from "zod";
import type { GameService } from "../application/game-service";
import type { Config } from "../config";
import { AppError, InvalidCommandError } from "../domain/errors";

type Env = { Variables: { correlationId: string } };

interface Dependencies {
  service: GameService;
  config: Config;
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidCommandError("Request body must be valid JSON");
  }
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new InvalidCommandError(
      "Invalid request",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

function operationId(
  context: { req: { header(name: string): string | undefined } },
  _command: string,
  provided: string | undefined,
  _detail: unknown,
): string {
  if (provided) return provided;
  const header = context.req.header("x-operation-id");
  if (header) return header;
  // Clients should send an operationId for retry-safe mutating commands.
  // Without one we still issue a unique id rather than risk replaying an
  // older logical action.
  return crypto.randomUUID();
}

export function createApp({ service, config }: Dependencies): Hono<Env> {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    const correlationId = c.req.header("x-correlation-id") ?? crypto.randomUUID();
    c.set("correlationId", correlationId);
    const started = performance.now();
    await next();
    c.header("x-correlation-id", correlationId);
    console.log(
      JSON.stringify({
        level: "info",
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - started),
        correlationId,
      }),
    );
  });

  app.use(
    "*",
    cors({
      origin: config.webOrigin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["content-type", "x-operation-id", "x-correlation-id"],
      exposeHeaders: ["x-correlation-id"],
      maxAge: 600,
    }),
  );

  app.get("/api/health", async (c) => {
    const correlationId = c.get("correlationId");
    return c.json({ data: await service.health(correlationId), correlationId });
  });

  app.get("/api/system/diagnostics", async (c) => {
    const correlationId = c.get("correlationId");
    return c.json({ data: await service.diagnostics(correlationId), correlationId });
  });

  app.get("/api/game", (c) => {
    return c.json({ data: service.state(), correlationId: c.get("correlationId") });
  });

  app.get("/api/world", (c) => {
    return c.json({ data: service.getWorld(), correlationId: c.get("correlationId") });
  });

  app.get("/api/party", (c) => {
    const data: PartyWithInventoryDto = service.getParty();
    return c.json({ data, correlationId: c.get("correlationId") });
  });

  app.get("/api/events", (c) => {
    const data: EventListDto = { turn: service.state().world.turn, events: service.getEvents() };
    return c.json({ data, correlationId: c.get("correlationId") });
  });

  app.get("/api/events/:id", (c) => {
    return c.json({
      data: service.getEvent(c.req.param("id")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/events/:id/accept", async (c) => {
    const body = parse(OperationRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "accept_event", body.operationId, c.req.param("id"));
    return c.json({
      data: await service.acceptEvent(c.req.param("id"), op, c.get("correlationId")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/events/:id/start", async (c) => {
    const body = parse(OperationRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "start_event", body.operationId, c.req.param("id"));
    return c.json({
      data: await service.startEvent(c.req.param("id"), op, c.get("correlationId")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/events/:id/resolve", async (c) => {
    const body = parse(OperationRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "resolve_event", body.operationId, c.req.param("id"));
    return c.json({
      data: await service.resolveEvent(c.req.param("id"), op, c.get("correlationId")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/world/discover", async (c) => {
    const body = parse(DiscoverRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "discover_location", body.operationId, body.locationId);
    return c.json({
      data: await service.discover(body.locationId, op, c.get("correlationId")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/world/rest", async (c) => {
    const body = parse(RestRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "rest", body.operationId, "rest");
    return c.json({
      data: await service.rest(op, c.get("correlationId")),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/party/equip", async (c) => {
    const body = parse(EquipRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "equip_item", body.operationId, body);
    return c.json({
      data: await service.equip(body.characterId, body.itemId, op),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/party/unequip", async (c) => {
    const body = parse(UnequipRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "unequip_item", body.operationId, body);
    return c.json({
      data: await service.unequip(body.characterId, body.slot, op),
      correlationId: c.get("correlationId"),
    });
  });

  app.post("/api/party/formation", async (c) => {
    const body = parse(FormationRequestSchema, await readBody(c.req.raw));
    const op = operationId(c, "set_formation", body.operationId, body);
    return c.json({
      data: await service.setFormation(body.characterId, body.row, op),
      correlationId: c.get("correlationId"),
    });
  });

  app.get("/api/journal", (c) => {
    return c.json({ data: service.getJournal(), correlationId: c.get("correlationId") });
  });

  app.post("/api/dev/generate-event", async (c) => {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    const body = (await readBody(c.req.raw)) as { category?: "storyline" | "opportunity" };
    const category = body.category === "storyline" ? "storyline" : "opportunity";
    return c.json({
      data: await service.generateDevelopmentEvent(c.get("correlationId"), category),
      correlationId: c.get("correlationId"),
    });
  });

  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          correlationId: c.get("correlationId"),
        },
      },
      404,
    );
  });

  app.onError((error, c) => {
    const correlationId = c.get("correlationId");
    if (error instanceof AppError) {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            correlationId,
            details: error.details,
          },
        },
        error.status,
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        correlationId,
        message: error.message,
        stack: error.stack,
      }),
    );
    return c.json(
      {
        error: {
          code: "INTERNAL",
          message: "An unexpected error occurred",
          correlationId,
        },
      },
      500,
    );
  });

  return app;
}
