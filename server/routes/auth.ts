import type { FastifyPluginAsync } from "fastify";
import type { CaptchaService } from "../services/captcha.js";
import type { AuthService } from "../services/auth.js";
import type { AppConfig } from "../config.js";

interface AuthRoutesOptions {
  captchaService: CaptchaService;
  authService: AuthService;
  config: AppConfig;
}

interface LoginBody {
  username?: string;
  password?: string;
  captchaId?: string;
  captcha?: string;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify,
  opts
) => {
  const { captchaService, authService, config } = opts;

  // GET /api/auth/captcha
  fastify.get("/captcha", async (_req, reply) => {
    const challenge = await captchaService.createChallenge();
    return reply.send(challenge);
  });

  // POST /api/auth/login
  fastify.post<{ Body: LoginBody }>(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            message: "Too many login attempts. Please try again later.",
          }),
        },
      },
    },
    async (req, reply) => {
      const { username, password, captchaId, captcha } = req.body || {};

      // 1. Verify captcha challenge
      if (!captchaId || !captcha) {
        return reply.status(401).send({
          error: "Invalid credentials or captcha",
        });
      }

      const captchaValid = await captchaService.verifyAndConsumeChallenge(
        captchaId,
        captcha
      );

      if (!captchaValid) {
        return reply.status(401).send({
          error: "Invalid credentials or captcha",
        });
      }

      // 2. Verify username and password
      const credentialsValid = authService.verifyCredentials(username, password);
      if (!credentialsValid) {
        return reply.status(401).send({
          error: "Invalid credentials or captcha",
        });
      }

      // 3. Issue session
      const sessionId = await authService.createSession();

      const isSecure = config.isProduction;

      reply.setCookie("session", sessionId, {
        path: "/",
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: config.sessionTtlDays * 24 * 60 * 60,
      });

      return reply.send({
        success: true,
        username: config.authUsername,
      });
    }
  );

  // POST /api/auth/logout
  fastify.post("/logout", async (req, reply) => {
    const sessionId = req.cookies?.session;
    if (sessionId) {
      await authService.revokeSession(sessionId);
    }

    reply.clearCookie("session", {
      path: "/",
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
    });

    return reply.send({ success: true });
  });

  // GET /api/auth/session
  fastify.get("/session", async (req, reply) => {
    if (req.session) {
      return reply.send({
        authenticated: true,
        username: config.authUsername,
      });
    }

    return reply.status(401).send({
      authenticated: false,
    });
  });
};
