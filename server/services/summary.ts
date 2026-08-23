import crypto from "node:crypto";
import type { DatabaseService } from "../db/index.js";
import type { MinifluxService } from "./miniflux.js";
import { AIService, extractPlainText } from "./ai.js";

export interface ArticleSummaryRecord {
  entry_id: number;
  title: string | null;
  url: string | null;
  content_hash: string | null;
  tldr: string | null;
  summary: string | null;
  model: string | null;
  generated_at: Date;
  updated_at: Date;
}

export function computeContentHash(title: string, url: string, content: string): string {
  const plainText = extractPlainText(content);
  return crypto
    .createHash("sha256")
    .update(`${title}::${url}::${plainText}`)
    .digest("hex");
}

export class SummaryService {
  constructor(
    private db: DatabaseService,
    private minifluxService: MinifluxService,
    private aiService: AIService
  ) {}

  async getSummary(entryId: number): Promise<ArticleSummaryRecord | null> {
    const res = await this.db.query<ArticleSummaryRecord>(
      `SELECT entry_id, title, url, content_hash, tldr, summary, model, generated_at, updated_at
       FROM article_summary
       WHERE entry_id = $1`,
      [entryId]
    );

    if (res.rowCount === 0) {
      return null;
    }

    return res.rows[0];
  }

  async generateSummary(entryId: number): Promise<ArticleSummaryRecord> {
    // 1. Fetch article from Miniflux
    const article = await this.minifluxService.fetchArticle(entryId);
    if (!article) {
      throw new Error(`Article ${entryId} not found in Miniflux`);
    }

    const contentHash = computeContentHash(
      article.title || "",
      article.url || "",
      article.content || ""
    );

    // 2. Check if an existing summary matches content_hash
    const existing = await this.getSummary(entryId);
    if (existing && existing.content_hash === contentHash && existing.summary) {
      return existing;
    }

    // 3. Acquire database client for transactional advisory lock
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");

      // Advisory lock per entryId to prevent parallel duplicate LLM requests
      // entryId is 64-bit int / bigint
      await client.query(
        "SELECT pg_advisory_xact_lock($1)",
        [entryId]
      );

      // Re-check after lock in case another worker just finished generating
      const recheck = await client.query<ArticleSummaryRecord>(
        `SELECT entry_id, title, url, content_hash, tldr, summary, model, generated_at, updated_at
         FROM article_summary
         WHERE entry_id = $1`,
        [entryId]
      );

      if (
        recheck.rowCount &&
        recheck.rowCount > 0 &&
        recheck.rows[0].content_hash === contentHash &&
        recheck.rows[0].summary
      ) {
        await client.query("COMMIT");
        return recheck.rows[0];
      }

      // 4. Generate with AI
      const aiResult = await this.aiService.generateSummary(article);

      // 5. Upsert into database
      const insertRes = await client.query<ArticleSummaryRecord>(
        `INSERT INTO article_summary (entry_id, title, url, content_hash, tldr, summary, model, generated_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         ON CONFLICT (entry_id) DO UPDATE SET
           title = EXCLUDED.title,
           url = EXCLUDED.url,
           content_hash = EXCLUDED.content_hash,
           tldr = EXCLUDED.tldr,
           summary = EXCLUDED.summary,
           model = EXCLUDED.model,
           updated_at = now()
         RETURNING entry_id, title, url, content_hash, tldr, summary, model, generated_at, updated_at`,
        [
          entryId,
          article.title || "",
          article.url || "",
          contentHash,
          aiResult.tldr,
          aiResult.summary,
          aiResult.model,
        ]
      );

      await client.query("COMMIT");
      return insertRes.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
