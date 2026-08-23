import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { AuthService, SessionRecord } from "../services/auth.js";

declare module "fastify" {
  interface FastifyRequest {
    session: SessionRecord | null;
  }
  interface FastifyInstance {
    authService: AuthService;
  }
}

interface AuthPluginOptions {
  authService: AuthService;
}

const authPluginCallback: FastifyPluginAsync<AuthPluginOptions> = async (
  fastify,
  opts
) => {
  fastify.decorate("authService", opts.authService);
  fastify.decorateRequest("session", null);

  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    // 1. Read session cookie
    const sessionId = req.cookies?.session;
    if (sessionId) {
      const session = await opts.authService.validateSession(sessionId);
      req.session = session;
    }

    // 2. Route classification
    const url = req.url.split("?")[0];

    // Non-API routes (SPA static assets / html fallback) are public
    if (!url.startsWith("/api/")) {
      return;
    }

    // Whitelisted public API routes
    const isPublicRoute =
      url === "/api/health" ||
      url === "/api/auth/captcha" ||
      url === "/api/auth/login" ||
      url === "/api/auth/session";

    if (isPublicRoute) {
      return;
    }

    // All other /api/* routes require an authenticated session
    if (!req.session) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Authentication required to access this resource",
      });
    }
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: "authPlugin",
});
