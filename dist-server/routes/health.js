export const healthRoutes = async (fastify, opts) => {
    fastify.get("/health", async (_req, reply) => {
        try {
            await opts.db.query("SELECT 1");
            return reply.send({
                status: "ok",
                database: "connected",
                timestamp: new Date().toISOString(),
            });
        }
        catch (err) {
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
