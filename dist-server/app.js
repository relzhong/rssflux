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
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { minifluxRoutes } from "./routes/miniflux.js";
import { summaryRoutes } from "./routes/summary.js";
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
    const summaryService = new SummaryService(db, minifluxService, aiService);
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
    // 3. Auth Plugin & Hooks
    await app.register(authPlugin, {
        authService,
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
    // 5. Static Files & SPA Fallback
    const distPath = path.resolve(process.cwd(), "dist");
    const hasDist = fs.existsSync(distPath);
    if (hasDist) {
        await app.register(fastifyStatic, {
            root: distPath,
            prefix: "/",
            wildcard: false,
        });
    }
    // SPA Fallback and API 404 Handler
    app.setNotFoundHandler((req, reply) => {
        const url = req.url.split("?")[0];
        // API routes NEVER fallback to index.html
        if (url.startsWith("/api/")) {
            return reply.status(404).send({
                error: "Not Found",
                message: `API endpoint ${url} does not exist`,
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
