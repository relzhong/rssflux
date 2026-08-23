import crypto from "node:crypto";
import type { DatabaseService } from "../db/index.js";
import type { MinifluxService } from "./miniflux.js";
import { AIService, extractPlainText, PROMPT_VERSION } from "./ai.js";
import type { AppConfig } from "../config.js";

export interface ArticleSummaryRecord {
  entry_id: number;
  title: string;
  url: string | null;
  feed_id: number | null;
  feed_title: string | null;
  published_at: Date | null;
  content_hash: string;
  text_length: number;
  tldr: string;
  summary: string | null;
  topics: string[];
  importance: number | null;
  summary_kind: "ai" | "extractive";
  model: string | null;
  prompt_version: string | null;
  status: "pending" | "ready" | "failed";
  last_error: string | null;
  generated_at: Date;
  updated_at: Date;
}

export interface GenerateSummaryResult {
  record: ArticleSummaryRecord;
  cached: boolean;
}

export interface BatchSummaryResultItem {
  entryId: number;
  status: "ready" | "failed";
  cached?: boolean;
  error?: string;
}

export interface BatchSummaryResult {
  results: BatchSummaryResultItem[];
}

export function computeContentHash(normalizedText: string): string {
  return crypto
    .createHash("sha256")
    .update(normalizedText)
    .digest("hex");
}

export function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip potential tokens, bearer headers, keys
  return raw
    .replace(/(?:Bearer|key|token|api[-_]?key)[:=\s]+[A-Za-z0-9_\-\.]{8,}/gi, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{16,}/g, "[REDACTED]")
    .slice(0, 500);
}

export const MAX_BATCH_SIZE = 50;

export class SummaryService {
  constructor(
    private db: DatabaseService,
    private minifluxService: MinifluxService,
    private aiService: AIService,
    private config: AppConfig
  ) {}

  async get(entryId: number): Promise<ArticleSummaryRecord | null> {
    const res = await this.db.query<ArticleSummaryRecord>(
      `SELECT entry_id, title, url, feed_id, feed_title, published_at,
              content_hash, text_length, tldr, summary, topics, importance,
              summary_kind, model, prompt_version, status, last_error,
              generated_at, updated_at
       FROM article_summary
       WHERE entry_id = $1`,
      [entryId]
    );

    if (res.rowCount === 0) {
      return null;
    }

    return res.rows[0];
  }

  async generate(
    entryId: number,
    options: { force?: boolean } = {}
  ): Promise<GenerateSummaryResult> {
    // 1. Fetch article from Miniflux
    const article = await this.minifluxService.fetchArticle(entryId);
    if (!article) {
      throw new Error(`Article ${entryId} not found in Miniflux`);
    }

    const normalizedText = extractPlainText(article.content || "");
    const textLength = normalizedText.length;
    const contentHash = computeContentHash(normalizedText);

    const title = article.title || "Untitled";
    const url = article.url || null;
    const feedId = article.feed?.id || article.feed_id || null;
    const feedTitle = article.feed?.title || article.feed_title || null;
    const publishedAt = article.published_at ? new Date(article.published_at) : null;

    // 2. Check if an existing ready summary matches content_hash (when force is false)
    if (!options.force) {
      const existing = await this.get(entryId);
      if (
        existing &&
        existing.status === "ready" &&
        existing.content_hash === contentHash &&
        existing.tldr
      ) {
        return {
          record: existing,
          cached: true,
        };
      }
    }

    // 3. Acquire database transaction with advisory lock to serialize parallel requests
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [entryId]);

      // Re-check after acquiring lock (in case another parallel worker just finished)
      if (!options.force) {
        const recheck = await client.query<ArticleSummaryRecord>(
          `SELECT entry_id, title, url, feed_id, feed_title, published_at,
                  content_hash, text_length, tldr, summary, topics, importance,
                  summary_kind, model, prompt_version, status, last_error,
                  generated_at, updated_at
           FROM article_summary
           WHERE entry_id = $1`,
          [entryId]
        );

        if (
          recheck.rowCount &&
          recheck.rowCount > 0 &&
          recheck.rows[0].status === "ready" &&
          recheck.rows[0].content_hash === contentHash &&
          recheck.rows[0].tldr
        ) {
          await client.query("COMMIT");
          return {
            record: recheck.rows[0],
            cached: true,
          };
        }
      }

      // 4. Short Article Strategy (<= SUMMARY_AI_MIN_CHARS chars) -> extractive
      if (textLength <= this.config.summaryAiMinChars) {
        const tldr = normalizedText.slice(0, 300).trim() || title;
        const summary = normalizedText || title;
        const topics: string[] = [];
        const importance = 3;
        const summaryKind: "extractive" = "extractive";
        const model = "extractive";
        const promptVersion = "extractive-v1";
        const status: "ready" = "ready";

        const insertRes = await client.query<ArticleSummaryRecord>(
          `INSERT INTO article_summary (
             entry_id, title, url, feed_id, feed_title, published_at,
             content_hash, text_length, tldr, summary, topics, importance,
             summary_kind, model, prompt_version, status, last_error,
             generated_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NULL, now(), now())
           ON CONFLICT (entry_id) DO UPDATE SET
             title = EXCLUDED.title,
             url = EXCLUDED.url,
             feed_id = EXCLUDED.feed_id,
             feed_title = EXCLUDED.feed_title,
             published_at = EXCLUDED.published_at,
             content_hash = EXCLUDED.content_hash,
             text_length = EXCLUDED.text_length,
             tldr = EXCLUDED.tldr,
             summary = EXCLUDED.summary,
             topics = EXCLUDED.topics,
             importance = EXCLUDED.importance,
             summary_kind = EXCLUDED.summary_kind,
             model = EXCLUDED.model,
             prompt_version = EXCLUDED.prompt_version,
             status = EXCLUDED.status,
             last_error = NULL,
             updated_at = now()
           RETURNING *`,
          [
            entryId,
            title,
            url,
            feedId,
            feedTitle,
            publishedAt,
            contentHash,
            textLength,
            tldr,
            summary,
            topics,
            importance,
            summaryKind,
            model,
            promptVersion,
            status,
          ]
        );

        await client.query("COMMIT");
        return {
          record: insertRes.rows[0],
          cached: false,
        };
      }

      // 5. Long Article -> Call AI Service
      try {
        const aiResult = await this.aiService.generateSummary(article, normalizedText);

        const insertRes = await client.query<ArticleSummaryRecord>(
          `INSERT INTO article_summary (
             entry_id, title, url, feed_id, feed_title, published_at,
             content_hash, text_length, tldr, summary, topics, importance,
             summary_kind, model, prompt_version, status, last_error,
             generated_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ai', $13, $14, 'ready', NULL, now(), now())
           ON CONFLICT (entry_id) DO UPDATE SET
             title = EXCLUDED.title,
             url = EXCLUDED.url,
             feed_id = EXCLUDED.feed_id,
             feed_title = EXCLUDED.feed_title,
             published_at = EXCLUDED.published_at,
             content_hash = EXCLUDED.content_hash,
             text_length = EXCLUDED.text_length,
             tldr = EXCLUDED.tldr,
             summary = EXCLUDED.summary,
             topics = EXCLUDED.topics,
             importance = EXCLUDED.importance,
             summary_kind = 'ai',
             model = EXCLUDED.model,
             prompt_version = EXCLUDED.prompt_version,
             status = 'ready',
             last_error = NULL,
             updated_at = now()
           RETURNING *`,
          [
            entryId,
            title,
            url,
            feedId,
            feedTitle,
            publishedAt,
            contentHash,
            textLength,
            aiResult.tldr,
            aiResult.summary,
            aiResult.topics,
            aiResult.importance,
            aiResult.model,
            aiResult.promptVersion || PROMPT_VERSION,
          ]
        );

        await client.query("COMMIT");
        return {
          record: insertRes.rows[0],
          cached: false,
        };
      } catch (aiErr: unknown) {
        const sanitizedErr = sanitizeErrorMessage(aiErr);

        // Record failure in database
        await client.query(
          `INSERT INTO article_summary (
             entry_id, title, url, feed_id, feed_title, published_at,
             content_hash, text_length, tldr, summary, topics, importance,
             summary_kind, model, prompt_version, status, last_error,
             generated_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '', '', '{}', NULL, 'ai', $9, $10, 'failed', $11, now(), now())
           ON CONFLICT (entry_id) DO UPDATE SET
             title = EXCLUDED.title,
             url = EXCLUDED.url,
             feed_id = EXCLUDED.feed_id,
             feed_title = EXCLUDED.feed_title,
             published_at = EXCLUDED.published_at,
             content_hash = EXCLUDED.content_hash,
             text_length = EXCLUDED.text_length,
             status = 'failed',
             last_error = EXCLUDED.last_error,
             updated_at = now()`,
          [
            entryId,
            title,
            url,
            feedId,
            feedTitle,
            publishedAt,
            contentHash,
            textLength,
            this.config.aiModel,
            PROMPT_VERSION,
            sanitizedErr,
          ]
        );

        await client.query("COMMIT");
        throw new Error(sanitizedErr);
      }
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  async generateBatch(
    entryIds: number[],
    options: { force?: boolean } = {}
  ): Promise<BatchSummaryResult> {
    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      throw new Error("entryIds must be a non-empty array of numbers");
    }

    if (entryIds.length > MAX_BATCH_SIZE) {
      throw new Error(`entryIds count cannot exceed ${MAX_BATCH_SIZE}`);
    }

    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(entryIds.filter((id) => typeof id === "number" && !isNaN(id))));
    if (uniqueIds.length === 0) {
      throw new Error("entryIds must contain valid numbers");
    }

    const results: BatchSummaryResultItem[] = [];

    for (const id of uniqueIds) {
      try {
        const res = await this.generate(id, options);
        results.push({
          entryId: id,
          status: "ready",
          cached: res.cached,
        });
      } catch (err: unknown) {
        const errorMsg = sanitizeErrorMessage(err);
        results.push({
          entryId: id,
          status: "failed",
          error: errorMsg,
        });
      }
    }

    return { results };
  }
}
