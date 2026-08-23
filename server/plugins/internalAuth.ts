import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import crypto from "node:crypto";
import type { AppConfig } from "../config.js";

interface InternalAuthPluginOptions {
  config: AppConfig;
}

const internalAuthPluginCallback: FastifyPluginAsync<InternalAuthPluginOptions> = async (
  fastify,
  opts
) => {
  const { config } = opts;

  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url.split("?")[0];

    // Only apply to /internal/* routes
    if (!url.startsWith("/internal")) {
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Missing or invalid Bearer authorization header",
      });
    }

    const providedToken = authHeader.slice(7).trim();
    const expectedToken = config.internalApiKey;

    if (!providedToken || !expectedToken) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }

    // Constant-time comparison using SHA-256 digests
    const expectedDigest = crypto.createHash("sha256").update(expectedToken).digest();
    const providedDigest = crypto.createHash("sha256").update(providedToken).digest();

    const matches = crypto.timingSafeEqual(expectedDigest, providedDigest);
    if (!matches) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid API key",
      });
    }
  });
};

export const internalAuthPlugin = fp(internalAuthPluginCallback, {
  name: "internalAuthPlugin",
});
