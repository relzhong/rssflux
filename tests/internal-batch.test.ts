import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { DatabaseService } from "../server/db/index.js";
import { createTestApp, type MockMinifluxService, type MockAIService } from "./test-helper.js";

describe("Internal Batch Summary Generation (HTTP Seam)", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  let mockMiniflux: MockMinifluxService;
  let mockAi: MockAIService;
  let validInternalKey: string;

  beforeEach(async () => {
    const context = await createTestApp();
    app = context.app;
    db = context.db;
    mockMiniflux = context.mockMiniflux;
    mockAi = context.mockAi;
    validInternalKey = context.config.internalApiKey;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("rejects request with 400 when entryIds is empty or not an array", async () => {
    const resEmpty = await app.inject({
      method: "POST",
      url: "/internal/summaries/generate",
      headers: { authorization: `Bearer ${validInternalKey}` },
      payload: { entryIds: [] },
    });
    expect(resEmpty.statusCode).toBe(400);

    const resInvalid = await app.inject({
      method: "POST",
      url: "/internal/summaries/generate",
      headers: { authorization: `Bearer ${validInternalKey}` },
      payload: { entryIds: "not-an-array" },
    });
    expect(resInvalid.statusCode).toBe(400);
  });

  it("rejects request with 400 when entryIds count exceeds 50", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const res = await app.inject({
      method: "POST",
      url: "/internal/summaries/generate",
      headers: { authorization: `Bearer ${validInternalKey}` },
      payload: { entryIds: ids },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toContain("cannot exceed 50");
  });

  it("processes a batch with mixed cached, newly generated, and failed entries returning 200 with individual statuses", async () => {
    // 1. Setup articles in mock Miniflux
    const longContent = "A".repeat(600);

    // Article 201: Pre-existing ready summary in PG
    mockMiniflux.articles.set(201, {
      id: 201,
      user_id: 1,
      feed_id: 1,
      title: "Article 201 Cached",
      url: "https://example.com/201",
      comments_url: "",
      author: "Author",
      content: `<p>${longContent}</p>`,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: "unread",
      starred: false,
      reading_time: 3,
    });

    // Seed summary for 201
    const crypto = await import("node:crypto");
    const hash201 = crypto.createHash("sha256").update(longContent).digest("hex");
    await db.query(
      `INSERT INTO article_summary (
         entry_id, title, url, feed_id, published_at, content_hash, text_length,
         tldr, summary, topics, importance, summary_kind, model, prompt_version, status,
         generated_at, updated_at
       )
       VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, '{}', 3, 'ai', 'mock-model', 'v1', 'ready', now(), now())`,
      [201, "Article 201 Cached", "https://example.com/201", 1, hash201, 600, "Cached TLDR", "Cached Summary"]
    );

    // Article 202: New article to be generated
    mockMiniflux.articles.set(202, {
      id: 202,
      user_id: 1,
      feed_id: 1,
      title: "Article 202 New",
      url: "https://example.com/202",
      comments_url: "",
      author: "Author",
      content: `<p>${longContent}</p>`,
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: "unread",
      starred: false,
      reading_time: 3,
    });

    // Article 203: Not in Miniflux (will fail)

    // 2. Call batch generate
    const res = await app.inject({
      method: "POST",
      url: "/internal/summaries/generate",
      headers: { authorization: `Bearer ${validInternalKey}` },
      payload: {
        entryIds: [201, 202, 203, 201], // Includes duplicate 201
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.results).toHaveLength(3); // Deduplicated to 3 unique IDs

    const r201 = data.results.find((r: any) => r.entryId === 201);
    expect(r201.status).toBe("ready");
    expect(r201.cached).toBe(true);

    const r202 = data.results.find((r: any) => r.entryId === 202);
    expect(r202.status).toBe("ready");
    expect(r202.cached).toBe(false);

    const r203 = data.results.find((r: any) => r.entryId === 203);
    expect(r203.status).toBe("failed");
    expect(r203.error).toContain("Article 203 not found");
  });
});
