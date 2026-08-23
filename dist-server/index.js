import { config } from "./config.js";
import { initDatabase } from "./db/index.js";
import { buildApp } from "./app.js";
async function start() {
    const db = initDatabase(config.databaseUrl);
    try {
        console.log("[BFF] Running database migrations...");
        await db.runMigrations();
        console.log("[BFF] Database migrations applied successfully.");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[FATAL] Failed to run database migrations:", message);
        process.exit(1);
    }
    try {
        const app = await buildApp({ config, db });
        await app.listen({
            port: config.port,
            host: "0.0.0.0",
        });
        console.log(`[BFF] Nextflux Fastify BFF running on http://0.0.0.0:${config.port}`);
        const shutdown = async (signal) => {
            console.log(`[BFF] Received ${signal}. Shutting down gracefully...`);
            await app.close();
            await db.close();
            process.exit(0);
        };
        process.on("SIGINT", () => shutdown("SIGINT"));
        process.on("SIGTERM", () => shutdown("SIGTERM"));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[FATAL] Server error during startup:", message);
        process.exit(1);
    }
}
start();
