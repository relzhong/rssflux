import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseService } from "../server/db/index.js";
import { createTestApp } from "./test-helper.js";
describe("Auth and Session Integration (HTTP Seam)", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  beforeEach(async () => {
    const context = await createTestApp();
    app = context.app;
    db = context.db;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("creates a valid SVG CAPTCHA challenge and stores the hash in the database", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/captcha",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.image).toContain("<svg");
    expect(body.image).toContain("</svg>");

    // Verify challenge hash exists in DB
    const dbRes = await db.query("SELECT * FROM auth_captcha WHERE id = $1", [body.id]);
    expect(dbRes.rowCount).toBe(1);
    expect(dbRes.rows[0].answer_hash).toBeDefined();
    expect(dbRes.rows[0].used_at).toBeNull();
  });

  it("rejects login when CAPTCHA is missing or invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin",
        password: "secretpassword123",
        captchaId: "00000000-0000-0000-0000-000000000000",
        captcha: "WRONG",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Invalid credentials or captcha");
  });

  it("rejects login when credentials are wrong even with valid CAPTCHA", async () => {
    // 1. Get captcha
    const capRes = await app.inject({ method: "GET", url: "/api/auth/captcha" });
    const { id: captchaId } = JSON.parse(capRes.body);
    const testAnswer = "ABCD";
    const testHash = crypto.createHash("sha256").update(testAnswer).digest("hex");
    await db.query("UPDATE auth_captcha SET answer_hash = $1 WHERE id = $2", [testHash, captchaId]);

    // 2. Submit wrong password
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin",
        password: "wrongpassword",
        captchaId,
        captcha: testAnswer,
      },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe("Invalid credentials or captcha");

    // CAPTCHA must be invalidated immediately even on failed login
    const checkDb = await db.query("SELECT used_at FROM auth_captcha WHERE id = $1", [captchaId]);
    expect(checkDb.rows[0].used_at).not.toBeNull();
  });

  it("succeeds with valid credentials and CAPTCHA, sets HttpOnly session cookie, and allows session retrieval", async () => {
    const capRes = await app.inject({ method: "GET", url: "/api/auth/captcha" });
    const { id: captchaId } = JSON.parse(capRes.body);
    const testAnswer = "XYZ9";
    const testHash = crypto.createHash("sha256").update(testAnswer).digest("hex");
    await db.query("UPDATE auth_captcha SET answer_hash = $1 WHERE id = $2", [testHash, captchaId]);

    // 2. Login
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin",
        password: "secretpassword123",
        captchaId,
        captcha: "xyz9", // case-insensitive test
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.success).toBe(true);

    const cookies = loginRes.cookies;
    const sessionCookie = cookies.find((c) => c.name === "session");
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);

    // 3. GET /api/auth/session with cookie
    const sessionRes = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: {
        session: sessionCookie!.value,
      },
    });

    expect(sessionRes.statusCode).toBe(200);
    const sessionBody = JSON.parse(sessionRes.body);
    expect(sessionBody.authenticated).toBe(true);
    expect(sessionBody.username).toBe("admin");

    // 4. Logout revokes session
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: {
        session: sessionCookie!.value,
      },
    });

    expect(logoutRes.statusCode).toBe(200);

    // 5. Subsequent session check should return 401
    const postLogoutSession = await app.inject({
      method: "GET",
      url: "/api/auth/session",
      cookies: {
        session: sessionCookie!.value,
      },
    });

    expect(postLogoutSession.statusCode).toBe(401);
    expect(JSON.parse(postLogoutSession.body).authenticated).toBe(false);
  });

  it("blocks unauthenticated access to protected /api/* endpoints", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/miniflux/feeds",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Unauthorized");
  });
});
