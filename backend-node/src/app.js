import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createAuthMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./errors.js";
import { authRoutes } from "./routes/auth-routes.js";
import { accountRoutes } from "./routes/account-routes.js";
import { transactionRoutes } from "./routes/transaction-routes.js";
import { adminRoutes } from "./routes/admin-routes.js";
import { auditRoutes } from "./routes/audit-routes.js";

export function createApp({ prisma, redis, config }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);
  app.use(helmet());
  app.use(cors({
    origin: config.frontendOrigin,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  }));
  app.use(express.json({ limit: "16kb", strict: true }));

  const authenticate = createAuthMiddleware({
    prisma,
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
  app.get("/ready", async (_req, res) => {
    const dependencies = { postgres: "ok", redis: "ok" };
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dependencies.postgres = "unavailable";
    }
    try {
      await redis.ping();
    } catch {
      dependencies.redis = "unavailable";
    }
    const ready = Object.values(dependencies).every((state) => state === "ok");
    return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", dependencies });
  });

  app.use("/api/auth", authRoutes({ prisma, redis, config, authenticate }));
  app.use("/api/accounts", accountRoutes({ prisma, authenticate }));
  app.use("/api/transactions", transactionRoutes({ prisma, redis, config, authenticate }));
  app.use("/api/admin", adminRoutes({ prisma, authenticate }));
  app.use("/api/audit", auditRoutes({ prisma, authenticate }));
  app.use((_req, res) => res.status(404).json({ error: "NOT_FOUND", message: "Route was not found" }));
  app.use(errorHandler);
  return app;
}
