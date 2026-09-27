import { extractPlainText } from "./ai.js";
import type { MinifluxArticle, MinifluxService } from "./miniflux.js";

export type ContentMode = "feed" | "extract" | "auto";
export type ContentSource = "feed" | "web";
export interface ContentRule {
  id: string;
  host: string;
  pathPrefix?: string;
  mode: ContentMode;
}
export interface ContentPolicy {
  version: "v1";
  defaultMode: ContentMode;
  rules: ContentRule[];
}
export interface ContentSelection {
  text: string;
  contentSource: ContentSource;
  matchedRuleId: string | null;
  reason: string;
}

export class ContentSelectionError extends Error {
  constructor(
    message: string,
    public contentSource: ContentSource | null,
    public matchedRuleId: string | null,
    public reason: string,
  ) {
    super(message);
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isMode = (value: unknown): value is ContentMode =>
  value === "feed" || value === "extract" || value === "auto";

export function parseContentPolicy(value: unknown): ContentPolicy {
  if (
    !isObject(value) ||
    value.version !== "v1" ||
    !isMode(value.defaultMode) ||
    !Array.isArray(value.rules)
  ) {
    throw new Error(
      "contentPolicy requires version 'v1', defaultMode (feed, extract, or auto), and a rules array",
    );
  }
  const ids = new Set<string>();
  const rules = value.rules.map((item, index): ContentRule => {
    const location = `contentPolicy.rules[${index}]`;
    if (
      !isObject(item) ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      typeof item.host !== "string" ||
      !item.host ||
      !isMode(item.mode) ||
      (item.pathPrefix !== undefined &&
        (typeof item.pathPrefix !== "string" ||
          !item.pathPrefix.startsWith("/"))) ||
      !/^[a-z0-9.-]+$/i.test(item.host) ||
      item.host.includes("..") ||
      item.host.startsWith(".") ||
      item.host.endsWith(".")
    ) {
      throw new Error(
        `${location} requires a nonempty id, valid hostname, optional pathPrefix starting with '/', and mode (feed, extract, or auto)`,
      );
    }
    if (ids.has(item.id)) throw new Error(`${location}.id must be unique`);
    ids.add(item.id);
    return {
      id: item.id,
      host: item.host.toLowerCase(),
      pathPrefix: item.pathPrefix,
      mode: item.mode,
    };
  });
  return { version: "v1", defaultMode: value.defaultMode, rules };
}

function isPreview(html: string, text: string): boolean {
  // Preview signals must be explicit. A short article alone is not a preview.
  return (
    /(?:\.\.\.|…|阅读全文|阅读原文|查看全文|点击查看全文|read more|continue reading|full article)\s*$/i.test(
      text,
    ) ||
    /<a\b[^>]*>\s*(?:阅读全文|阅读原文|查看全文|read more|continue reading|full article)\s*<\/a>/i.test(
      html,
    )
  );
}

export async function selectContent(
  article: MinifluxArticle,
  policy: ContentPolicy | undefined,
  miniflux: MinifluxService,
): Promise<ContentSelection> {
  const feedText = extractPlainText(article.content || "");
  // An absent policy preserves the original feed-only behavior, including empty content.
  if (!policy)
    return {
      text: feedText,
      contentSource: "feed",
      matchedRuleId: null,
      reason: "legacy_feed",
    };

  let articleUrl: URL | null = null;
  try {
    articleUrl = new URL(article.url);
  } catch {
    /* no rule can match */
  }
  const rule = policy.rules.find(
    (candidate) =>
      articleUrl?.hostname.toLowerCase() === candidate.host &&
      (candidate.pathPrefix === undefined ||
        articleUrl.pathname.startsWith(candidate.pathPrefix)),
  );
  const matchedRuleId = rule?.id ?? null;
  const mode = rule?.mode ?? policy.defaultMode;
  const preview = isPreview(article.content || "", feedText);
  if (mode === "feed" || (mode === "auto" && feedText && !preview)) {
    if (!feedText)
      throw new ContentSelectionError(
        "Miniflux article content is empty",
        "feed",
        matchedRuleId,
        "feed_empty",
      );
    return {
      text: feedText,
      contentSource: "feed",
      matchedRuleId,
      reason: mode === "feed" ? "policy_feed" : "feed_complete",
    };
  }

  const reason =
    mode === "extract"
      ? "policy_extract"
      : feedText
        ? "feed_preview"
        : "feed_empty";
  try {
    const html = await miniflux.fetchOriginalContent(article.id);
    const text = extractPlainText(html);
    if (!text) throw new Error("Extracted webpage content is empty");
    return { text, contentSource: "web", matchedRuleId, reason };
  } catch {
    throw new ContentSelectionError(
      "Webpage content extraction failed or returned empty content",
      "web",
      matchedRuleId,
      "extraction_failed",
    );
  }
}
