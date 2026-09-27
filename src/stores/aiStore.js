import { persistentAtom } from "@nanostores/persistent";

const MAX_CACHED_SUMMARIES = 200;

const isDisplayableText = (value) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  !/^\s*(?:\{\s*"|\[\s*(?:\{|"))/.test(value);

const hasDisplayableSummary = (item) =>
  item && isDisplayableText(item.summary) && isDisplayableText(item.tldr);

// summary state per article id: { [articleId]: { loading, summary, tldr, model, error } }
export const aiSummaries = persistentAtom(
  "aiSummaries",
  {},
  {
    encode: (val) => {
      const clean = {};
      const keys = Object.keys(val);
      const sliceKeys = keys.slice(-MAX_CACHED_SUMMARIES);
      for (const k of sliceKeys) {
        const item = val[k];
        if (hasDisplayableSummary(item)) {
          clean[k] = {
            loading: false,
            summary: item.summary,
            tldr: item.tldr,
            model: item.model,
            error: null,
          };
        }
      }
      return JSON.stringify(clean);
    },
    decode: (str) => {
      try {
        const decoded = JSON.parse(str);
        if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
        return Object.fromEntries(
          Object.entries(decoded).filter(([, item]) => hasDisplayableSummary(item))
        );
      } catch {
        return {};
      }
    },
  }
);
export const setSummaryLoading = (articleId) => {
  aiSummaries.set({
    ...aiSummaries.get(),
    [articleId]: { loading: true, summary: "", tldr: null, model: null, error: null },
  });
};

export const appendSummaryChunk = (articleId, chunk) => {
  const current = aiSummaries.get();
  const prev = current[articleId];
  if (!prev) return;
  aiSummaries.set({
    ...current,
    [articleId]: { ...prev, summary: (prev.summary || "") + chunk },
  });
};

export const setSummaryDone = (articleId, payload = {}) => {
  const current = aiSummaries.get();
  const prev = current[articleId];
  if (!prev) return;
  aiSummaries.set({
    ...current,
    [articleId]: {
      ...prev,
      loading: false,
      summary: payload.summary || prev.summary,
      tldr: payload.tldr || prev.tldr,
      model: payload.model || prev.model,
    },
  });
};

export const setSummaryError = (articleId, error) => {
  aiSummaries.set({
    ...aiSummaries.get(),
    [articleId]: { loading: false, summary: null, tldr: null, model: null, error },
  });
};

export const clearSummary = (articleId) => {
  const current = { ...aiSummaries.get() };
  delete current[articleId];
  aiSummaries.set(current);
};

// 从 BFF 查询已有总结（例如后台 Windmill 或此前已生成的）
export const fetchSummaryIfAvailable = async (articleId) => {
  if (!articleId) return null;
  const existing = aiSummaries.get()[articleId];
  if (existing && !hasDisplayableSummary(existing)) clearSummary(articleId);

  try {
    const res = await fetch(`/api/summary/${articleId}`, { cache: "no-store" });
    // A manual generation may have started while this lookup was in flight.
    if (aiSummaries.get()[articleId]?.loading) return null;
    if (res.ok) {
      const data = await res.json();
      if (!hasDisplayableSummary(data)) {
        clearSummary(articleId);
        return null;
      }
      aiSummaries.set({
        ...aiSummaries.get(),
        [articleId]: {
          loading: false,
          summary: data.summary,
          tldr: data.tldr,
          model: data.model,
          error: null,
        },
      });
      return data;
    }
    if (res.status === 404) clearSummary(articleId);
  } catch (err) {
    console.error("Failed to fetch article summary:", err);
    return hasDisplayableSummary(existing) ? existing : null;
  }
  return null;
};

// 调用 BFF 按需生成总结
export const requestSummaryGeneration = async (articleId) => {
  if (!articleId) return;
  setSummaryLoading(articleId);

  try {
    const res = await fetch(`/api/summary/${articleId}/generate`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Error ${res.status}`);
    }

    const data = await res.json();
    setSummaryDone(articleId, data);
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setSummaryError(articleId, message);
    throw err;
  }
};
