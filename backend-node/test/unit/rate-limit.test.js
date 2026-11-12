import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../../src/middleware/rate-limit.js";

function response() {
  return {
    headers: {},
    statusCode: 200,
    set(name, value) { this.headers[name] = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("rate limiter rejects requests beyond its configured limit", async () => {
  let count = 0;
  const redis = {
    async incr() { count += 1; return count; },
    async pexpire() {},
    async pttl() { return 1000; },
  };
  const limit = createRateLimiter(redis, { name: "test", limit: 1, windowMs: 1000 });
  const first = response();
  let continued = false;
  await limit({ ip: "127.0.0.1" }, first, () => { continued = true; });
  assert.equal(continued, true);
  const second = response();
  await limit({ ip: "127.0.0.1" }, second, () => { continued = true; });
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.error, "RATE_LIMITED");
});

test("rate limiter fails closed when Redis is unavailable", async () => {
  const originalError = console.error;
  console.error = () => {};
  const limit = createRateLimiter({ incr: async () => { throw new Error("offline"); } }, {
    name: "test",
    limit: 5,
    windowMs: 1000,
  });
  const res = response();
  let continued = false;
  let nextError;
  await limit({ ip: "127.0.0.1" }, res, (error) => { nextError = error; });
  console.error = originalError;
  assert.equal(nextError.status, 503);
  assert.equal(nextError.code, "RATE_LIMIT_UNAVAILABLE");
});
