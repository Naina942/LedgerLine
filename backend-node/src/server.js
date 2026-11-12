import Redis from "ioredis";
import { config } from "./config.js";
import { createApp } from "./app.js";
import { prisma } from "./prisma.js";

const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  connectTimeout: 1_000,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => Math.min(attempt * 250, 2_000),
});
redis.on("error", (error) => console.error("Redis connection error", error.message));

const app = createApp({ prisma, redis, config });
const server = app.listen(config.port, () => {
  console.log(`BalanceVault API listening on port ${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing services`);
  server.close(async () => {
    await Promise.allSettled([redis.quit(), prisma.$disconnect()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
