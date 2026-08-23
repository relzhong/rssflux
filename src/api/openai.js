// Fastify BFF AI Summary Client

export const summarizeArticleStream = async (
  article,
  { onChunk, onDone, onError }
) => {
  if (!article?.id) {
    onError?.(new Error("Invalid article"));
    return;
  }

  try {
    const res = await fetch(`/api/summary/${article.id}/generate`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || `Summary generation failed (${res.status})`);
    }

    const data = await res.json();
    const fullText = data.summary || "";

    // Animate chunks smoothly to preserve UI animation
    const chunkSize = 20;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      onChunk?.(fullText.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, 16));
    }

    onDone?.(data);
  } catch (err) {
    onError?.(err);
  }
};
