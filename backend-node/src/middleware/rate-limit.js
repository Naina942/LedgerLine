import { HttpError } from "../errors.js";

export function createRateLimiter(redis, { name, limit, windowMs }) {
  return async (req, res, next) => {
    try {
      const key = `balancevault:rate:${name}:${req.ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      const ttl = await redis.pttl(key);
      res.set("RateLimit-Limit", String(limit));
      res.set("RateLimit-Remaining", String(Math.max(0, limit - count)));
      if (count > limit) {
        if (ttl > 0) res.set("Retry-After", String(Math.ceil(ttl / 1000)));
        return res.status(429).json({
          error: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
        });
      }
      return next();
    } catch (error) {
      console.error(`Rate limiter ${name} unavailable`, error);
      return next(new HttpError(503, "Request protection is temporarily unavailable", "RATE_LIMIT_UNAVAILABLE"));
    }
  };
}
