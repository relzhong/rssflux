import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseService } from "../server/db/index.js";
import { createTestApp, type MockMinifluxService } from "./test-helper.js";

describe("Miniflux Proxy Integration (HTTP Seam)", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  let mockMiniflux: MockMinifluxService;
  let sessionCookie: string;

  beforeEach(async () => {
    const context = await createTestApp();
    app = context.app;
    db = context.db;
    mockMiniflux = context.mockMiniflux;
    await app.ready();

    // Create session in DB for authenticated requests
    const sessionId = "11111111-1111-1111-1111-111111111111";
    await db.query(
      "INSERT INTO auth_session (id, expires_at) VALUES ($1, now() + interval '1 day')",
      [sessionId]
    );
    sessionCookie = sessionId;
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("returns 401 when anonymous user attempts to access Miniflux proxy", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/miniflux/feeds",
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Unauthorized");
  });

  it("forwards authenticated request to Miniflux upstream with injected auth token", async () => {
    let capturedHeaders: Record<string, unknown> = {};
    let capturedPath = "";

    mockMiniflux.proxyHandler = async (path, method, headers) => {
      capturedPath = path;
      capturedHeaders = headers;
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from(JSON.stringify([{ id: 1, title: "Test Feed" }])),
      };
    };

    const res = await app.inject({
      method: "GET",
      url: "/api/miniflux/feeds",
      cookies: {
        session: sessionCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Test Feed");

    expect(capturedPath.replace(/^\/+/, "")).toBe("feeds");
    // Verify server injected the secret token and did not require it from client
    expect(capturedHeaders["X-Auth-Token"]).toBe("mock-miniflux-token-999");
  });

  it("never reflects the secret Miniflux token to the client", async () => {
    mockMiniflux.proxyHandler = async () => {
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: Buffer.from(JSON.stringify({ status: "ok" })),
      };
    };

    const res = await app.inject({
      method: "GET",
      url: "/api/miniflux/me",
      cookies: {
        session: sessionCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-auth-token"]).toBeUndefined();
    expect(res.body).not.toContain("mock-miniflux-token-999");
  });
});
