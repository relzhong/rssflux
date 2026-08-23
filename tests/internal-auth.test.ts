import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseService } from "../server/db/index.js";
import { createTestApp } from "./test-helper.js";

describe("Internal Bearer Auth & Isolation (HTTP Seam)", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  let validInternalKey: string;

  beforeEach(async () => {
    const context = await createTestApp();
    app = context.app;
    db = context.db;
    validInternalKey = context.config.internalApiKey;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("returns 401 when no authorization header is provided to /internal/health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/health",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when invalid bearer token is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/health",
      headers: {
        authorization: "Bearer wrong-token-xyz",
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Unauthorized");
  });

  it("returns 200 with { ok: true } when valid internal API key is provided", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/health",
      headers: {
        authorization: `Bearer ${validInternalKey}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
  });

  it("ensures browser session cookie cannot access /internal/* endpoints", async () => {
    // Create valid browser session
    const sessionId = "33333333-3333-3333-3333-333333333333";
    await db.query(
      "INSERT INTO auth_session (id, expires_at) VALUES ($1, now() + interval '1 day')",
      [sessionId]
    );

    const res = await app.inject({
      method: "GET",
      url: "/internal/health",
      cookies: {
        session: sessionId,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Unauthorized");
  });

  it("ensures internal bearer token cannot be used to bypass browser /api/session auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/miniflux/feeds",
      headers: {
        authorization: `Bearer ${validInternalKey}`,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Unauthorized");
  });
});
