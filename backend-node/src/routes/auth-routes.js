import { Router } from "express";
import { asyncRoute } from "../errors.js";
import { loginSchema, parseBody, registrationSchema } from "../validation.js";
import { createAuthService } from "../services/auth-service.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export function authRoutes({ prisma, redis, config, authenticate }) {
  const router = Router();
  const service = createAuthService({
    prisma,
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  router.post("/register", createRateLimiter(redis, {
    name: "register",
    limit: config.rateLimitRegisterMax,
    windowMs: config.rateLimitWindowMs,
  }), asyncRoute(async (req, res) => {
    const input = parseBody(registrationSchema, req.body);
    const user = await service.register(input);
    res.status(201).json({ user });
  }));

  router.post("/login", createRateLimiter(redis, {
    name: "login",
    limit: config.rateLimitLoginMax,
    windowMs: config.rateLimitWindowMs,
  }), asyncRoute(async (req, res) => {
    const input = parseBody(loginSchema, req.body);
    res.json(await service.login(input.login, input.password));
  }));

  router.post("/logout", authenticate, asyncRoute(async (req, res) => {
    res.json(await service.logout(req.sessionId, req.user.id));
  }));

  router.get("/me", authenticate, asyncRoute(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });
    res.json({ user });
  }));

  return router;
}
