import "dotenv/config";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const positiveInt = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};
const nonnegativeInt = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
};

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: positiveInt("PORT", 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
  jwtSecret,
  jwtIssuer: process.env.JWT_ISSUER ?? "balancevault",
  jwtAudience: process.env.JWT_AUDIENCE ?? "balancevault-api",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  rateLimitWindowMs: positiveInt("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitLoginMax: positiveInt("RATE_LIMIT_LOGIN_MAX", 5),
  rateLimitRegisterMax: positiveInt("RATE_LIMIT_REGISTER_MAX", 5),
  rateLimitTransactionMax: positiveInt("RATE_LIMIT_TRANSACTION_MAX", 20),
  trustProxyHops: nonnegativeInt("TRUST_PROXY_HOPS", 0),
});
