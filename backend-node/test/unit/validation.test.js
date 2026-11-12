import test from "node:test";
import assert from "node:assert/strict";
import { formatPaise, parseAmountToPaise, parseBody, registrationSchema } from "../../src/validation.js";

test("money parsing uses exact integer paise", () => {
  assert.equal(parseAmountToPaise("0.01"), 1n);
  assert.equal(parseAmountToPaise("1000"), 100000n);
  assert.equal(parseAmountToPaise("20.5"), 2050n);
  assert.equal(formatPaise(2050n), "20.50");
});

test("money parsing rejects zero, negatives, excess precision, and unsafe magnitudes", () => {
  for (const amount of ["0", "-1", "1.001", "01.00", "1e6", "999999999999999999.99"]) {
    assert.throws(() => parseAmountToPaise(amount));
  }
});

test("public registration rejects caller-selected roles and weak passwords", () => {
  assert.throws(() => parseBody(registrationSchema, {
    username: "customer",
    email: "customer@example.com",
    password: "very-secure-password",
    role: "ADMIN",
  }));
  assert.throws(() => parseBody(registrationSchema, {
    username: "customer",
    email: "customer@example.com",
    password: "short",
  }));
});
