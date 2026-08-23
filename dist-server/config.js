import dotenv from "dotenv";
dotenv.config();
export function loadConfig(env = process.env) {
    const nodeEnv = env.NODE_ENV || "development";
    const isTest = nodeEnv === "test";
    const requiredKeys = [
        "DATABASE_URL",
        "AUTH_USERNAME",
        "AUTH_PASSWORD",
        "SESSION_SECRET",
        "MINIFLUX_URL",
        "MINIFLUX_API_TOKEN",
    ];
    const missing = [];
    for (const key of requiredKeys) {
        if (!env[key] && !isTest) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        throw new Error(`[FATAL] Missing required environment variables: ${missing.join(", ")}. Server cannot start.`);
    }
    const defaultAiPrompt = "You are a helpful reading assistant. Summarize the provided article concisely into: 1) A 1-2 sentence TL;DR. 2) Key bullet points of main arguments or facts. Keep the language matching the article's language.";
    return {
        port: parseInt(env.PORT || "3000", 10),
        databaseUrl: env.DATABASE_URL || "postgresql://localhost:5432/rssflux_test",
        authUsername: env.AUTH_USERNAME || "admin",
        authPassword: env.AUTH_PASSWORD || "admin",
        sessionSecret: env.SESSION_SECRET || "default-insecure-secret-for-testing",
        minifluxUrl: (env.MINIFLUX_URL || "http://localhost:8080").replace(/\/+$/, ""),
        minifluxApiToken: env.MINIFLUX_API_TOKEN || "test-token",
        aiBaseUrl: (env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
        aiApiKey: env.AI_API_KEY || "",
        aiModel: env.AI_MODEL || "gpt-4o-mini",
        aiPrompt: env.AI_PROMPT || defaultAiPrompt,
        sessionTtlDays: parseInt(env.SESSION_TTL_DAYS || "30", 10),
        nodeEnv,
        isProduction: nodeEnv === "production",
        trustProxy: env.TRUST_PROXY !== "false",
    };
}
export const config = loadConfig();
