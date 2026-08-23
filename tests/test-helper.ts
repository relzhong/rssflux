import { newDb } from "pg-mem";
import type { DatabaseService } from "../server/db/index.js";
import type { AppConfig } from "../server/config.js";
import { buildApp } from "../server/app.js";
import { MinifluxService, type MinifluxArticle } from "../server/services/miniflux.js";
import { AIService, type GeneratedSummaryResult, PROMPT_VERSION } from "../server/services/ai.js";

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    databaseUrl: "postgresql://localhost:5432/test",
    authUsername: "admin",
    authPassword: "secretpassword123",
    sessionSecret: "test-session-secret-at-least-32-chars-long",
    minifluxUrl: "http://mock-miniflux",
    minifluxApiToken: "mock-miniflux-token-999",
    aiBaseUrl: "http://mock-ai/v1",
    aiApiKey: "mock-ai-key-888",
    aiModel: "gpt-4o-mini",
    aiPrompt: "Summarize this article",
    sessionTtlDays: 30,
    internalApiKey: "test-internal-secret-key-32-chars",
    summaryAiMinChars: 500,
    nodeEnv: "test",
    isProduction: false,
    trustProxy: true,
    ...overrides,
  };
}

export function createTestDatabase(): DatabaseService {
  const db = newDb({
    autoCreateForeignKeyIndices: true,
  });

  // Register uuid & crypto extension functions in pg-mem
  db.public.registerFunction({
    name: "hashtext",
    args: [db.public.getType("text")],
    returns: db.public.getType("integer"),
    implementation: (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    },
  });

  db.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [db.public.getType("bigint")],
    returns: db.public.getType("integer"),
    implementation: () => 0,
  });

  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();

  const query: DatabaseService["query"] = (text, params) => pool.query(text, params);

  const runMigrations = async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS auth_captcha (
        id UUID PRIMARY KEY,
        answer_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS auth_session (
        id UUID PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS article_summary (
        entry_id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT,
        feed_id BIGINT,
        feed_title TEXT,
        published_at TIMESTAMPTZ,
        content_hash TEXT NOT NULL,
        text_length INTEGER NOT NULL DEFAULT 0,
        tldr TEXT NOT NULL,
        summary TEXT,
        topics TEXT[] NOT NULL DEFAULT '{}',
        importance SMALLINT,
        summary_kind TEXT NOT NULL DEFAULT 'ai',
        model TEXT,
        prompt_version TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        last_error TEXT,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  };

  const close = async () => {
    await pool.end();
  };

  return {
    pool: pool as any,
    query,
    runMigrations,
    close,
  };
}

export class MockMinifluxService extends MinifluxService {
  public articles = new Map<number, MinifluxArticle>();
  public proxyHandler?: (
    path: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body?: unknown
  ) => Promise<{ status: number; headers: Record<string, string>; body: Buffer }>;

  async fetchArticle(entryId: number): Promise<MinifluxArticle | null> {
    return this.articles.get(entryId) || null;
  }

  async proxyRequest(
    path: string,
    method: string,
    headers: Record<string, string | string[] | undefined>,
    body?: unknown,
    query?: string
  ) {
    if (this.proxyHandler) {
      const forwardHeaders = {
        ...headers,
        "X-Auth-Token": (this as any).config.minifluxApiToken,
      };
      return this.proxyHandler(path, method, forwardHeaders, body);
    }
    return super.proxyRequest(path, method, headers, body, query);
  }
}

export class MockAIService extends AIService {
  public generateCallCount = 0;
  public mockSummaryResponse?: GeneratedSummaryResult;
  public shouldFail = false;

  async generateSummary(
    article: MinifluxArticle,
    normalizedPlainText: string
  ): Promise<GeneratedSummaryResult> {
    this.generateCallCount++;

    if (this.shouldFail) {
      throw new Error("AI completion network timeout");
    }

    if (this.mockSummaryResponse) {
      return this.mockSummaryResponse;
    }

    return {
      tldr: `TLDR of ${article.title}: concise summary of core conclusion.`,
      summary: `- Point 1: ${normalizedPlainText.slice(0, 40)}\n- Point 2: Key facts and metrics`,
      topics: ["Technology", "Cloud"],
      importance: 4,
      model: "mock-gpt-4o",
      promptVersion: PROMPT_VERSION,
    };
  }
}

export async function createTestApp(options: {
  configOverrides?: Partial<AppConfig>;
  mockMiniflux?: MockMinifluxService;
  mockAi?: MockAIService;
} = {}) {
  const config = createTestConfig(options.configOverrides);
  const db = createTestDatabase();
  await db.runMigrations();

  const customMinifluxService = options.mockMiniflux || new MockMinifluxService(config);
  const customAiService = options.mockAi || new MockAIService(config);

  const app = await buildApp({
    config,
    db,
    customMinifluxService,
    customAiService,
  });

  return {
    app,
    db,
    config,
    mockMiniflux: customMinifluxService,
    mockAi: customAiService,
  };
}
