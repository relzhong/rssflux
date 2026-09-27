import { afterEach, describe, expect, it, vi } from "vitest";
import { AIService, parseAndValidateAIResponse } from "../server/services/ai.js";
import { createTestConfig } from "./test-helper.js";
import type { MinifluxArticle } from "../server/services/miniflux.js";

const article = { id: 10920, title: "Test article" } as MinifluxArticle;
const valid = JSON.stringify({
  tldr: "A readable short conclusion.",
  summary: "- A readable summary point.",
  topics: ["news"],
  importance: 3,
});

describe("AI summary response validation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects truncated JSON instead of storing the raw reply", () => {
    expect(() => parseAndValidateAIResponse('{"tldr":"partial","summary":', "model"))
      .toThrow(/invalid JSON/i);
  });

  it("rejects invalid JSON instead of treating it as display text", () => {
    expect(() => parseAndValidateAIResponse("not a JSON object", "model"))
      .toThrow(/invalid JSON/i);
  });

  it("rejects empty or non-displayable tldr and summary fields", () => {
    expect(() => parseAndValidateAIResponse('{"tldr":"","summary":"- point"}', "model"))
      .toThrow(/tldr/i);
    expect(() => parseAndValidateAIResponse('{"tldr":"short","summary":""}', "model"))
      .toThrow(/summary/i);
    expect(() => parseAndValidateAIResponse('{"tldr":"{\\"raw\\":true}","summary":"- point"}', "model"))
      .toThrow(/tldr/i);
  });

  it("accepts valid JSON with displayable text", () => {
    expect(parseAndValidateAIResponse(valid, "model")).toMatchObject({
      tldr: "A readable short conclusion.",
      summary: "- A readable summary point.",
    });
  });

  it("rejects a completion that ended at max_tokens even when its JSON parses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ finish_reason: "length", message: { content: valid } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(new AIService(createTestConfig()).generateSummary(article, "Article text"))
      .rejects.toThrow(/truncated|length/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once with a larger output budget after length and accepts the complete response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ finish_reason: "length", message: { content: '{"tldr":' } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: valid } }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(new AIService(createTestConfig()).generateSummary(article, "Article text"))
      .resolves.toMatchObject({ summary: "- A readable summary point." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4000);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(8000);
  });
});
