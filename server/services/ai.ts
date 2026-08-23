import type { AppConfig } from "../config.js";
import type { MinifluxArticle } from "./miniflux.js";

export interface GeneratedSummaryResult {
  tldr: string;
  summary: string;
  model: string;
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

export class AIService {
  constructor(private config: AppConfig) {}

  async generateSummary(article: MinifluxArticle): Promise<GeneratedSummaryResult> {
    if (!this.config.aiApiKey) {
      throw new Error("AI API Key is not configured on the server");
    }

    const plainText = extractPlainText(article.content);
    const title = article.title || "";
    const truncatedContent = plainText.slice(0, 8000);

    const endpoint = `${this.config.aiBaseUrl}/chat/completions`;

    const systemPrompt =
      this.config.aiPrompt ||
      "You are a helpful reading assistant. Summarize the provided article concisely into: 1) A 1-2 sentence TL;DR. 2) Key bullet points of main arguments or facts. Keep the language matching the article's language.";

    const userPrompt = `Please summarize this article:\n\nTitle: ${title}\n\n${truncatedContent}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.aiApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.aiModel,
        stream: false,
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
    const cleanContent = stripThinkingTags(rawContent);

    // Derive a concise TL;DR from the first paragraph or line
    const lines = cleanContent
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const tldr = lines.length > 0 ? lines[0] : "";

    return {
      tldr,
      summary: cleanContent,
      model: data.model || this.config.aiModel,
    };
  }
}
