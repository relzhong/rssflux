import type { FastifyPluginAsync } from "fastify";
import type { SummaryService } from "../services/summary.js";

interface InternalRoutesOptions {
  summaryService: SummaryService;
}

interface BatchGenerateBody {
  entryIds?: unknown;
  force?: boolean;
}

export const internalRoutes: FastifyPluginAsync<InternalRoutesOptions> = async (
  fastify,
  opts
) => {
  const { summaryService } = opts;

  // GET /internal/health (requires Bearer auth)
  fastify.get("/health", async (_req, reply) => {
    return reply.send({ ok: true });
  });

  // POST /internal/summaries/generate (requires Bearer auth)
  fastify.post<{ Body: BatchGenerateBody }>(
    "/summaries/generate",
    async (req, reply) => {
      const { entryIds, force } = req.body || {};

      // 1. Validation
      if (!Array.isArray(entryIds)) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "entryIds must be an array of numbers",
        });
      }

      if (entryIds.length === 0) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "entryIds array cannot be empty",
        });
      }

      if (entryIds.length > 50) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "entryIds count cannot exceed 50",
        });
      }

      const validNumbers = entryIds.every(
        (id) => typeof id === "number" && !isNaN(id) && Number.isInteger(id) && id > 0
      );

      if (!validNumbers) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "entryIds must contain valid positive integers",
        });
      }

      try {
        const result = await summaryService.generateBatch(entryIds, {
          force: Boolean(force),
        });
        return reply.send(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({
          error: "Internal Server Error",
          message,
        });
      }
    }
  );
};
