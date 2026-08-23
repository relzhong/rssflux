import type { FastifyPluginAsync } from "fastify";
import type { DatabaseService } from "../db/index.js";

interface HealthRoutesOptions {
  db: DatabaseService;
}

export const healthRoutes: FastifyPluginAsync<HealthRoutesOptions> = async (
  fastify,
  opts
) => {
  fastify.get("/health", async (_req, reply) => {
    try {
      await opts.db.query("SELECT 1");
      return reply.send({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(503).send({
        status: "degraded",
        database: "disconnected",
        error: message,
        timestamp: new Date().toISOString(),
      });
    }
  });
};
