import type { FastifyPluginAsync } from "fastify";
import type { SummaryService } from "../services/summary.js";

interface SummaryRoutesOptions {
  summaryService: SummaryService;
}

export const summaryRoutes: FastifyPluginAsync<SummaryRoutesOptions> = async (
  fastify,
  opts
) => {
  const { summaryService } = opts;

  // GET /api/summary/:entryId
  fastify.get<{ Params: { entryId: string } }>("/:entryId", async (req, reply) => {
    const entryId = parseInt(req.params.entryId, 10);
    if (isNaN(entryId)) {
      return reply.status(400).send({ error: "Invalid entryId" });
    }

    try {
      const summary = await summaryService.getSummary(entryId);
      if (!summary) {
        return reply.status(404).send({ error: "Summary not found" });
      }

      return reply.send({
        entryId: summary.entry_id,
        title: summary.title,
        url: summary.url,
        contentHash: summary.content_hash,
        tldr: summary.tldr,
        summary: summary.summary,
        model: summary.model,
        generatedAt: summary.generated_at,
        updatedAt: summary.updated_at,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({
        error: "Internal Server Error",
        message,
      });
    }
  });

  // POST /api/summary/:entryId/generate
  fastify.post<{ Params: { entryId: string } }>(
    "/:entryId/generate",
    async (req, reply) => {
      const entryId = parseInt(req.params.entryId, 10);
      if (isNaN(entryId)) {
        return reply.status(400).send({ error: "Invalid entryId" });
      }

      try {
        const summary = await summaryService.generateSummary(entryId);
        return reply.send({
          entryId: summary.entry_id,
          title: summary.title,
          url: summary.url,
          contentHash: summary.content_hash,
          tldr: summary.tldr,
          summary: summary.summary,
          model: summary.model,
          generatedAt: summary.generated_at,
          updatedAt: summary.updated_at,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({
          error: "Failed to generate summary",
          message,
        });
      }
    }
  );
};
