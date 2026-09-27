import type { AppConfig } from "../config.js";
import type { MinifluxArticle } from "./miniflux.js";

export const PROMPT_VERSION = "article-summary-v1";

export interface GeneratedSummaryResult {
  tldr: string;
  summary: string;
  topics: string[];
  importance: number;
  model: string;
  promptVersion: string;
}

export function extractPlainText(html: string): string {
  if (!html) return "";
  // Strip HTML tags and entities
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, " [code] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

export function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function isDisplayableSummaryText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !/^\s*(?:\{\s*"|\[\s*(?:\{|"))/.test(value)
  );
}

export function parseAndValidateAIResponse(
  rawContent: string,
  _fallbackModel: string,
): { tldr: string; summary: string; topics: string[]; importance: number } {
  const clean = stripThinkingTags(rawContent);

  const jsonMatch = clean.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonStr = jsonMatch ? jsonMatch[1] : clean;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("AI response contains invalid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response must be a JSON object");
  }
  const result = parsed as Record<string, unknown>;
  if (!isDisplayableSummaryText(result.tldr)) {
    throw new Error("AI response tldr is not displayable text");
  }
  if (!isDisplayableSummaryText(result.summary)) {
    throw new Error("AI response summary is not displayable text");
  }
  const tldr = result.tldr.trim();
  const summary = result.summary.trim();

  let topics: string[] = [];
  if (Array.isArray(result.topics)) {
    topics = result.topics
      .filter((t: unknown) => typeof t === "string")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  let importance = 3;
  if (
    typeof result.importance === "number" &&
    Number.isInteger(result.importance)
  ) {
    importance = Math.max(1, Math.min(5, result.importance));
  } else if (typeof result.importance === "string") {
    const parsedInt = parseInt(result.importance, 10);
    if (!isNaN(parsedInt)) {
      importance = Math.max(1, Math.min(5, parsedInt));
    }
  }

  return {
    tldr,
    summary,
    topics,
    importance,
  };
}

export class AIService {
  constructor(private config: AppConfig) {}

  async generateSummary(
    article: MinifluxArticle,
    normalizedPlainText: string,
  ): Promise<GeneratedSummaryResult> {
    if (!this.config.aiApiKey) {
      throw new Error("AI API Key is not configured on the server");
    }

    const title = article.title || "";
    const truncatedContent = normalizedPlainText.slice(0, 8000);
    const endpoint = `${this.config.aiBaseUrl}/chat/completions`;

    const systemPrompt = `You are an expert reading assistant and research analyst.
Analyze the provided article and return a strictly valid JSON object matching this schema:
{
  "tldr": "1-3 sentences concise overview of the core conclusion or key event (in the same language as the article)",
  "summary": "Detailed structured breakdown in Markdown bullet points highlighting main arguments, key data, and context (in the same language as the article)",
  "topics": ["topic1", "topic2"],
  "importance": 1-5 (Integer scale where 1: trivial/low value, 2: mildly useful, 3: useful, 4: important/worth reading, 5: exceptional/must read)
}
Return only the raw JSON object, without extra conversational commentary.`;

    const userPrompt = `Title: ${title}\n\n${truncatedContent}`;

    for (const maxTokens of [4000, 8000]) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.aiApiKey}`,
        },
        body: JSON.stringify({
          model: this.config.aiModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        let errorDetails = "";
        try {
          const errorJson = (await response.json()) as {
            error?: { message?: string };
          };
          errorDetails = errorJson.error?.message || response.statusText;
        } catch {
          errorDetails = response.statusText;
        }
        throw new Error(`AI API error ${response.status}: ${errorDetails}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          finish_reason?: string;
          message?: { content?: string };
        }>;
        model?: string;
      };

      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length") {
        if (maxTokens === 4000) continue;
        throw new Error("AI response truncated at token limit");
      }
      if (choice?.finish_reason && choice.finish_reason !== "stop") {
        throw new Error("AI response did not finish normally");
      }
      const rawContent = choice?.message?.content || "";
      const validated = parseAndValidateAIResponse(
        rawContent,
        this.config.aiModel,
      );

      return {
        tldr: validated.tldr,
        summary: validated.summary,
        topics: validated.topics,
        importance: validated.importance,
        model: data.model || this.config.aiModel,
        promptVersion: PROMPT_VERSION,
      };
    }

    throw new Error("AI response truncated at token limit");
  }
}
