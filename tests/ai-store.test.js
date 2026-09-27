import { afterEach, describe, expect, it, vi } from "vitest";
import { aiSummaries, fetchSummaryIfAvailable } from "../src/stores/aiStore.js";

describe("persisted AI summary revalidation", () => {
  afterEach(() => {
    aiSummaries.set({});
    vi.unstubAllGlobals();
  });

  it("replaces a previously cached raw JSON fragment when the same browser reopens an article", async () => {
    aiSummaries.set({
      10920: { loading: false, summary: '{"tldr":"partial","summary":', tldr: '{"tldr":"partial","summary":', model: "old", error: null },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: "- Repaired readable summary.", tldr: "Repaired conclusion.", model: "new" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchSummaryIfAvailable(10920);
    expect(fetchMock).toHaveBeenCalledWith("/api/summary/10920", expect.anything());
    expect(aiSummaries.get()[10920]).toMatchObject({ summary: "- Repaired readable summary.", tldr: "Repaired conclusion." });

    await fetchSummaryIfAvailable(10920);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(aiSummaries.get()[10920].summary).toBe("- Repaired readable summary.");
  });

  it("clears stale local data when the server rejects an old bad record", async () => {
    aiSummaries.set({
      10920: { loading: false, summary: '{"tldr":"partial"', tldr: '{"tldr":"partial"', model: "old", error: null },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    expect(await fetchSummaryIfAvailable(10920)).toBeNull();
    expect(aiSummaries.get()[10920]).toBeUndefined();
  });
});
