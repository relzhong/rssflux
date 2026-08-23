import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseService } from "../server/db/index.js";
import { createTestApp, type MockMinifluxService, type MockAIService } from "./test-helper.js";

describe("Article Summary Integration (HTTP Seam)", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  let mockMiniflux: MockMinifluxService;
  let mockAi: MockAIService;
  let sessionCookie: string;

  beforeEach(async () => {
    const context = await createTestApp();
    app = context.app;
    db = context.db;
    mockMiniflux = context.mockMiniflux;
    mockAi = context.mockAi;
    await app.ready();

    // Create session in DB for authenticated requests
    const sessionId = "22222222-2222-2222-2222-222222222222";
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

  it("returns 401 when anonymous user tries to query or generate summary", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/api/summary/100",
    });
    expect(getRes.statusCode).toBe(401);

    const postRes = await app.inject({
      method: "POST",
      url: "/api/summary/100/generate",
    });
    expect(postRes.statusCode).toBe(401);
  });

  it("returns 404 when summary does not exist yet", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/summary/999",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe("Summary not found");
  });

  it("generates and persists summary for long articles (> 500 chars), then reuses it on subsequent requests", async () => {
    const longContent = "Fastify is a high-performance web framework. ".repeat(20); // > 500 chars

    // 1. Seed Miniflux article
    mockMiniflux.articles.set(101, {
      id: 101,
      user_id: 1,
      feed_id: 10,
      feed: { id: 10, title: "Node Weekly" },
      title: "How Fastify Scales",
      url: "https://example.com/fastify",
      comments_url: "",
      author: "Fastify Team",
      content: `<p>${longContent}</p>`,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: "unread",
      starred: false,
      reading_time: 2,
    });

    // 2. Generate summary
    const genRes = await app.inject({
      method: "POST",
      url: "/api/summary/101/generate",
      cookies: { session: sessionCookie },
    });

    expect(genRes.statusCode).toBe(200);
    const genData = JSON.parse(genRes.body);
    expect(genData.entryId).toBe(101);
    expect(genData.title).toBe("How Fastify Scales");
    expect(genData.summaryKind).toBe("ai");
    expect(genData.topics).toContain("Technology");
    expect(genData.importance).toBe(4);
    expect(genData.promptVersion).toBe("article-summary-v1");
    expect(mockAi.generateCallCount).toBe(1);

    // 3. Verify record was written to PostgreSQL
    const dbRes = await db.query("SELECT * FROM article_summary WHERE entry_id = 101");
    expect(dbRes.rowCount).toBe(1);
    expect(dbRes.rows[0].status).toBe("ready");
    expect(dbRes.rows[0].content_hash).toBeDefined();

    // 4. Query summary with GET
    const getRes = await app.inject({
      method: "GET",
      url: "/api/summary/101",
      cookies: { session: sessionCookie },
    });

    expect(getRes.statusCode).toBe(200);
    const getData = JSON.parse(getRes.body);
    expect(getData.entryId).toBe(101);
    expect(getData.summary).toBe(genData.summary);

    // 5. Generate again with unchanged article -> content hash matches -> AI should NOT be called again
    const regenRes = await app.inject({
      method: "POST",
      url: "/api/summary/101/generate",
      cookies: { session: sessionCookie },
    });

    expect(regenRes.statusCode).toBe(200);
    expect(mockAi.generateCallCount).toBe(1); // Still 1! Cache hit
    expect(JSON.parse(regenRes.body).cached).toBe(true);

    // 6. Force regeneration with { force: true } -> calls AI again
    const forceRes = await app.inject({
      method: "POST",
      url: "/api/summary/101/generate",
      cookies: { session: sessionCookie },
      payload: { force: true },
    });

    expect(forceRes.statusCode).toBe(200);
    expect(mockAi.generateCallCount).toBe(2); // Called again!
  });

  it("handles short articles (<= 500 chars) using extractive summary without calling LLM", async () => {
    const shortContent = "A concise tweet-sized update about release 1.0.";

    mockMiniflux.articles.set(103, {
      id: 103,
      user_id: 1,
      feed_id: 5,
      title: "Short Update",
      url: "https://example.com/short",
      comments_url: "",
      author: "Author",
      content: `<p>${shortContent}</p>`,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: "unread",
      starred: false,
      reading_time: 1,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/summary/103/generate",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.entryId).toBe(103);
    expect(data.summaryKind).toBe("extractive");
    expect(data.tldr).toBe(shortContent);
    expect(mockAi.generateCallCount).toBe(0); // ZERO LLM calls!
  });

  it("records failed status and sanitized error in database when AI fails", async () => {
    const longContent = "A".repeat(600);

    mockMiniflux.articles.set(104, {
      id: 104,
      user_id: 1,
      feed_id: 1,
      title: "Failing Article",
      url: "https://example.com/fail",
      comments_url: "",
      author: "Author",
      content: `<p>${longContent}</p>`,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: "unread",
      starred: false,
      reading_time: 2,
    });

    mockAi.shouldFail = true;

    const res = await app.inject({
      method: "POST",
      url: "/api/summary/104/generate",
      cookies: { session: sessionCookie },
    });

    expect(res.statusCode).toBe(500);

    // Verify failure is recorded in database
    const dbRes = await db.query("SELECT * FROM article_summary WHERE entry_id = 104");
    expect(dbRes.rowCount).toBe(1);
    expect(dbRes.rows[0].status).toBe("failed");
    expect(dbRes.rows[0].last_error).toContain("network timeout");
  });
});
