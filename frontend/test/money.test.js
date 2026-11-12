import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../src/money.js";

test("dashboard money formatting keeps paise exact for large balances", () => {
  assert.equal(formatMoney("123456789012345"), "₹12,34,56,78,90,123.45");
  assert.equal(formatMoney("0"), "₹0.00");
});
