import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { CaptchaService } from "./services/captcha.js";
import { AuthService } from "./services/auth.js";
import { MinifluxService } from "./services/miniflux.js";
import { AIService } from "./services/ai.js";
import { SummaryService } from "./services/summary.js";
import { authPlugin } from "./plugins/auth.js";
import { internalAuthPlugin } from "./plugins/internalAuth.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { minifluxRoutes } from "./routes/miniflux.js";
import { summaryRoutes } from "./routes/summary.js";
import { internalRoutes } from "./routes/internal.js";
export async function buildApp(options) {
    const { config, db } = options;
    const app = fastify({
        logger: config.nodeEnv !== "test",
        trustProxy: config.trustProxy,
    });
    // Services
    const captchaService = new CaptchaService(db);
    const authService = new AuthService(db, config);
    const minifluxService = options.customMinifluxService || new MinifluxService(config);
    const aiService = options.customAiService || new AIService(config);
    const summaryService = new SummaryService(db, minifluxService, aiService, config);
    // 1. Cookies
    await app.register(fastifyCookie, {
        secret: config.sessionSecret,
    });
    // 2. Global Rate Limiter
    await app.register(fastifyRateLimit, {
        global: true,
        max: 200,
        timeWindow: "1 minute",
    });
    // 3. Auth Plugins & Hooks
    await app.register(authPlugin, {
        authService,
    });
    await app.register(internalAuthPlugin, {
        config,
    });
    // 4. API Routes
    await app.register(authRoutes, {
        prefix: "/api/auth",
        captchaService,
        authService,
        config,
    });
    await app.register(healthRoutes, {
        prefix: "/api",
        db,
    });
    await app.register(minifluxRoutes, {
        prefix: "/api/miniflux",
        minifluxService,
    });
    await app.register(summaryRoutes, {
        prefix: "/api/summary",
        summaryService,
    });
    // 5. Internal API Routes
    await app.register(internalRoutes, {
        prefix: "/internal",
        summaryService,
    });
    // 6. Static Files & SPA Fallback
    const distPath = path.resolve(process.cwd(), "dist");
    const hasDist = fs.existsSync(distPath);
    if (hasDist) {
        await app.register(fastifyStatic, {
            root: distPath,
            prefix: "/",
            wildcard: false,
        });
    }
    // SPA Fallback and API/Internal 404 Handler
    app.setNotFoundHandler((req, reply) => {
        const url = req.url.split("?")[0];
        // API and Internal routes NEVER fallback to index.html
        if (url.startsWith("/api/") || url.startsWith("/internal")) {
            return reply.status(404).send({
                error: "Not Found",
                message: `Endpoint ${url} does not exist`,
            });
        }
        // Static SPA fallback
        if (hasDist) {
            const indexPath = path.join(distPath, "index.html");
            if (fs.existsSync(indexPath)) {
                return reply.type("text/html").sendFile("index.html");
            }
        }
        return reply.status(404).send("Not Found");
    });
    return app;
}
