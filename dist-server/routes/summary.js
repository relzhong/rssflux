export const summaryRoutes = async (fastify, opts) => {
    const { summaryService } = opts;
    // GET /api/summary/:entryId
    fastify.get("/:entryId", async (req, reply) => {
        const entryId = parseInt(req.params.entryId, 10);
        if (isNaN(entryId)) {
            return reply.status(400).send({ error: "Invalid entryId" });
        }
        try {
            const summary = await summaryService.get(entryId);
            if (!summary || summary.status !== "ready") {
                return reply.status(404).send({ error: "Summary not found" });
            }
            return reply.send({
                entryId: summary.entry_id,
                title: summary.title,
                url: summary.url,
                feedId: summary.feed_id,
                feedTitle: summary.feed_title,
                publishedAt: summary.published_at,
                textLength: summary.text_length,
                tldr: summary.tldr,
                summary: summary.summary,
                topics: summary.topics || [],
                importance: summary.importance,
                summaryKind: summary.summary_kind,
                model: summary.model,
                promptVersion: summary.prompt_version,
                status: summary.status,
                generatedAt: summary.generated_at,
                updatedAt: summary.updated_at,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return reply.status(500).send({
                error: "Internal Server Error",
                message,
            });
        }
    });
    // POST /api/summary/:entryId/generate
    fastify.post("/:entryId/generate", async (req, reply) => {
        const entryId = parseInt(req.params.entryId, 10);
        if (isNaN(entryId)) {
            return reply.status(400).send({ error: "Invalid entryId" });
        }
        const force = Boolean(req.body?.force);
        try {
            const result = await summaryService.generate(entryId, { force });
            const summary = result.record;
            return reply.send({
                entryId: summary.entry_id,
                title: summary.title,
                url: summary.url,
                feedId: summary.feed_id,
                feedTitle: summary.feed_title,
                publishedAt: summary.published_at,
                textLength: summary.text_length,
                tldr: summary.tldr,
                summary: summary.summary,
                topics: summary.topics || [],
                importance: summary.importance,
                summaryKind: summary.summary_kind,
                model: summary.model,
                promptVersion: summary.prompt_version,
                status: summary.status,
                cached: result.cached,
                generatedAt: summary.generated_at,
                updatedAt: summary.updated_at,
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return reply.status(500).send({
                error: "Failed to generate summary",
                message,
            });
        }
    });
};
