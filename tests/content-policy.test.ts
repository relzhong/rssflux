import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, type MockMinifluxService } from "./test-helper.js";
import type { DatabaseService } from "../server/db/index.js";
import type { MinifluxArticle } from "../server/services/miniflux.js";

const policy = {
  version: "v1",
  defaultMode: "auto",
  rules: [
    {
      id: "36kr-newsflash",
      host: "36kr.com",
      pathPrefix: "/newsflashes/",
      mode: "feed",
    },
  ],
};

function article(id: number, url: string, content: string): MinifluxArticle {
  return {
    id,
    user_id: 1,
    feed_id: 1,
    title: `Article ${id}`,
    url,
    content,
    comments_url: "",
    author: "",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    status: "unread",
    starred: false,
    reading_time: 1,
  };
}

describe("internal content policy", () => {
  let app: FastifyInstance;
  let db: DatabaseService;
  let miniflux: MockMinifluxService;
  let key: string;

  beforeEach(async () => {
    const context = await createTestApp();
    ({ app, db, mockMiniflux: miniflux } = context);
    key = context.config.internalApiKey;
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
    await db.close();
  });

  const request = (
    app: FastifyInstance,
    key: string,
    entryIds: number[],
    contentPolicy?: unknown,
  ) =>
    app.inject({
      method: "POST",
      url: "/internal/summaries/generate",
      headers: { authorization: `Bearer ${key}` },
      payload:
        contentPolicy === undefined
          ? { entryIds }
          : { entryIds, contentPolicy },
    });

  it("uses Miniflux content for entry 10868 under the newsflash rule without extraction", async () => {
    miniflux.articles.set(
      10868,
      article(
        10868,
        "https://36kr.com/newsflashes/10868",
        "<p>快讯：公司发布季度业绩。</p>",
      ),
    );
    const response = await request(app, key, [10868], policy);
    expect(response.statusCode).toBe(200);
    expect(response.json().results[0]).toMatchObject({
      entryId: 10868,
      status: "ready",
      contentSource: "feed",
      matchedRuleId: "36kr-newsflash",
      reason: "policy_feed",
    });
    expect(miniflux.extractionCalls).toEqual([]);
  });

  it("does not match the newsflash rule for 36kr /p/ and extracts a preview", async () => {
    miniflux.articles.set(
      2,
      article(2, "https://36kr.com/p/123", "<p>这是一篇预览…</p>"),
    );
    miniflux.originalContent.set(2, "<p>完整文章包含更多详细信息。</p>");
    const response = await request(app, key, [2], policy);
    expect(response.json().results[0]).toMatchObject({
      status: "ready",
      contentSource: "web",
      matchedRuleId: null,
      reason: "feed_preview",
    });
    expect(miniflux.extractionCalls).toEqual([2]);
  });

  it("keeps short complete content in auto mode", async () => {
    miniflux.articles.set(
      3,
      article(3, "https://36kr.com/p/short", "<p>完整的短消息。</p>"),
    );
    const response = await request(app, key, [3], policy);
    expect(response.json().results[0]).toMatchObject({
      status: "ready",
      contentSource: "feed",
      matchedRuleId: null,
      reason: "feed_complete",
    });
    expect(miniflux.extractionCalls).toEqual([]);
  });

  it("fails clearly on empty feed content in feed mode without extraction", async () => {
    miniflux.articles.set(
      4,
      article(4, "https://36kr.com/newsflashes/4", "<img src='x'>"),
    );
    const response = await request(app, key, [4], policy);
    expect(response.json().results[0]).toMatchObject({
      status: "failed",
      contentSource: "feed",
      matchedRuleId: "36kr-newsflash",
      reason: "feed_empty",
    });
    expect(response.json().results[0].error).toContain(
      "Miniflux article content is empty",
    );
    expect(miniflux.extractionCalls).toEqual([]);
  });

  it("reports extraction failure and does not summarize preview content", async () => {
    miniflux.articles.set(
      5,
      article(5, "https://36kr.com/p/5", "<p>预览…</p>"),
    );
    miniflux.extractionFails = true;
    const response = await request(app, key, [5], policy);
    expect(response.json().results[0]).toMatchObject({
      status: "failed",
      contentSource: "web",
      matchedRuleId: null,
      reason: "extraction_failed",
    });
    expect(
      await db.query("SELECT * FROM article_summary WHERE entry_id = 5"),
    ).toMatchObject({ rowCount: 0 });
  });

  it("extracts empty feed content in auto mode and explicit extract mode", async () => {
    miniflux.articles.set(8, article(8, "https://36kr.com/p/8", ""));
    miniflux.articles.set(
      9,
      article(9, "https://36kr.com/p/9", "<p>完整的短消息。</p>"),
    );
    miniflux.originalContent.set(8, "<p>网页正文八。</p>");
    miniflux.originalContent.set(9, "<p>网页正文九。</p>");
    const auto = await request(app, key, [8], policy);
    expect(auto.json().results[0]).toMatchObject({
      status: "ready",
      contentSource: "web",
      reason: "feed_empty",
    });
    const extracted = await request(app, key, [9], {
      ...policy,
      defaultMode: "extract",
    });
    expect(extracted.json().results[0]).toMatchObject({
      status: "ready",
      contentSource: "web",
      reason: "policy_extract",
    });
    expect(miniflux.extractionCalls).toEqual([8, 9]);
  });

  it("uses the first matching rule and reuses summaries with the same selected content", async () => {
    miniflux.articles.set(
      10,
      article(10, "https://36kr.com/newsflashes/10", "<p>快讯正文。</p>"),
    );
    const ordered = {
      ...policy,
      rules: [
        policy.rules[0],
        { id: "later", host: "36kr.com", mode: "extract" },
      ],
    };
    const first = await request(app, key, [10], ordered);
    const second = await request(app, key, [10], ordered);
    expect(first.json().results[0]).toMatchObject({
      cached: false,
      matchedRuleId: "36kr-newsflash",
    });
    expect(second.json().results[0]).toMatchObject({
      cached: true,
      contentSource: "feed",
      matchedRuleId: "36kr-newsflash",
    });
    expect(miniflux.extractionCalls).toEqual([]);
  });

  it("preserves legacy feed-only behavior for requests without contentPolicy", async () => {
    miniflux.articles.set(
      6,
      article(6, "https://36kr.com/p/6", "<p>预览…</p>"),
    );
    const response = await request(app, key, [6]);
    expect(response.json().results[0]).toMatchObject({
      status: "ready",
      contentSource: "feed",
      matchedRuleId: null,
      reason: "legacy_feed",
    });
    expect(miniflux.extractionCalls).toEqual([]);
  });

  it("rejects invalid rules with a 400 parameter error", async () => {
    const response = await request(app, key, [7], {
      ...policy,
      rules: [
        {
          id: "bad",
          host: "36kr.com",
          pathPrefix: "newsflashes",
          mode: "feed",
        },
      ],
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("contentPolicy.rules[0]");
  });
});
