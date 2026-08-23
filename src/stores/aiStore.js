import { atom } from "nanostores";

// summary state per article id: { [articleId]: { loading, summary, tldr, model, error } }
export const aiSummaries = atom({});

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
  if (existing?.summary) return existing;

  try {
    const res = await fetch(`/api/summary/${articleId}`);
    if (res.ok) {
      const data = await res.json();
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
  } catch (err) {
    console.error("Failed to fetch article summary:", err);
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
