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

export function parseAndValidateAIResponse(
  rawContent: string,
  fallbackModel: string
): { tldr: string; summary: string; topics: string[]; importance: number } {
  const clean = stripThinkingTags(rawContent);

  // Try extracting JSON block if wrapped in markdown code fence
  let jsonStr = clean;
  const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    // If there is leading/trailing text, extract substring between first { and last }
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = clean.slice(firstBrace, lastBrace + 1);
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // If JSON parsing fails, fallback to simple heuristic structuring
    const lines = clean
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const tldr = lines.length > 0 ? lines[0].slice(0, 300) : "Summary unavailable";
    const summary = clean;
    return {
      tldr,
      summary,
      topics: [],
      importance: 3,
    };
  }

  // Validate fields
  let tldr = typeof parsed.tldr === "string" ? parsed.tldr.trim() : "";
  if (!tldr && typeof parsed.summary === "string") {
    tldr = parsed.summary.split("\n")[0]?.trim() || "";
  }
  if (!tldr) {
    tldr = "Summary unavailable";
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";

  let topics: string[] = [];
  if (Array.isArray(parsed.topics)) {
    topics = parsed.topics
      .filter((t: unknown) => typeof t === "string")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  let importance = 3;
  if (typeof parsed.importance === "number" && Number.isInteger(parsed.importance)) {
    importance = Math.max(1, Math.min(5, parsed.importance));
  } else if (typeof parsed.importance === "string") {
    const parsedInt = parseInt(parsed.importance, 10);
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
    normalizedPlainText: string
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
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      let errorDetails = "";
      try {
        const errorJson = (await response.json()) as { error?: { message?: string } };
        errorDetails = errorJson.error?.message || response.statusText;
      } catch {
        errorDetails = response.statusText;
      }
      throw new Error(`AI API error ${response.status}: ${errorDetails}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const rawContent = data.choices?.[0]?.message?.content || "";
    const validated = parseAndValidateAIResponse(rawContent, this.config.aiModel);

    return {
      tldr: validated.tldr,
      summary: validated.summary,
      topics: validated.topics,
      importance: validated.importance,
      model: data.model || this.config.aiModel,
      promptVersion: PROMPT_VERSION,
    };
  }
}
