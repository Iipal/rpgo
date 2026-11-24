import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../apps/server/src/http/server";
import { createTestService, type TestService } from "./helpers";

let harness: TestService;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  harness = createTestService();
  app = createApp({ service: harness.service, config: harness.config });
});

afterEach(() => {
  harness.close();
});

function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("http api", () => {
  test("wraps read models in a data envelope with a correlation id", async () => {
    const response = await app.request("/api/game", {
      headers: { "x-correlation-id": "corr-http-0001" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-correlation-id")).toBe("corr-http-0001");
    const body = await json(response);
    expect(body.correlationId).toBe("corr-http-0001");
    expect((body.data as { world: { turn: number } }).world.turn).toBe(1);
  });

  test("generates a correlation id when the client does not supply one", async () => {
    const response = await app.request("/api/world");
    expect(response.headers.get("x-correlation-id")).toBeTruthy();
    const body = await json(response);
    expect((body.data as { regions: unknown[] }).regions.length).toBeGreaterThan(0);
  });

  test("returns the event board with the current turn", async () => {
    const response = await app.request("/api/events");
    const body = await json(response);
    const data = body.data as { turn: number; events: unknown[] };
    expect(data.turn).toBe(1);
    expect(data.events.length).toBeGreaterThanOrEqual(3);
  });

  test("rejects malformed JSON with an INVALID_COMMAND envelope", async () => {
    const response = await app.request("/api/events/any/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    const body = await json(response);
    expect((body.error as { code: string }).code).toBe("INVALID_COMMAND");
  });

  test("rejects a body that fails schema validation", async () => {
    const response = await app.request("/api/world/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const body = await json(response);
    expect((body.error as { code: string }).code).toBe("INVALID_COMMAND");
    expect((body.error as { details: unknown[] }).details.length).toBeGreaterThan(0);
  });

  test("accepting an event is idempotent through the x-operation-id header", async () => {
    const scout = harness.service.getEvents().find((event) => event.type === "scout");
    if (!scout) throw new Error("no scout event");

    const first = await app.request(`/api/events/${scout.id}/accept`, {
      method: "POST",
      headers: { "x-operation-id": "http-accept-0001" },
    });
    expect(first.status).toBe(200);
    const firstBody = await json(first);
    const firstTurn = (firstBody.data as { state: { world: { turn: number } } }).state.world.turn;

    const again = await app.request(`/api/events/${scout.id}/accept`, {
      method: "POST",
      headers: { "x-operation-id": "http-accept-0001" },
    });
    const againBody = await json(again);
    expect(againBody.data).toEqual(firstBody.data);
    expect((againBody.data as { state: { world: { turn: number } } }).state.world.turn).toBe(
      firstTurn,
    );
  });

  test("returns typed errors for unknown routes and unknown events", async () => {
    const missingRoute = await app.request("/api/nope");
    expect(missingRoute.status).toBe(404);
    expect(((await json(missingRoute)).error as { code: string }).code).toBe("NOT_FOUND");

    const missingEvent = await app.request("/api/events/does-not-exist");
    expect(missingEvent.status).toBe(404);
    expect(((await json(missingEvent)).error as { code: string }).code).toBe("NOT_FOUND");
  });

  test("reports health without exposing configuration secrets", async () => {
    const response = await app.request("/api/system/diagnostics");
    expect(response.status).toBe(200);
    const text = JSON.stringify(await json(response));
    expect(text).not.toContain('"apiKey"');
    expect(text).not.toContain('"api_key"');
  });
});
