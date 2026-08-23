export const minifluxRoutes = async (fastify, opts) => {
    const { minifluxService } = opts;
    // Handle all methods under /api/miniflux/*
    fastify.all("/*", async (req, reply) => {
        // Extract the relative path after /api/miniflux
        const fullUrl = req.url;
        const urlWithoutQuery = fullUrl.split("?")[0];
        const subPath = urlWithoutQuery.replace(/^\/api\/miniflux/, "");
        const queryString = fullUrl.includes("?") ? fullUrl.split("?")[1] : "";
        const method = req.method;
        const headers = req.headers;
        const body = req.body;
        try {
            const response = await minifluxService.proxyRequest(subPath, method, headers, body, queryString);
            for (const [key, value] of Object.entries(response.headers)) {
                reply.header(key, value);
            }
            return reply.status(response.status).send(response.body);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            req.log.error({ err, path: subPath }, "Miniflux proxy error");
            return reply.status(502).send({
                error: "Bad Gateway",
                message: `Failed to proxy request to Miniflux: ${message}`,
            });
        }
    });
};
