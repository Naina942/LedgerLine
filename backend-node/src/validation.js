import { z } from "zod";
import { HttpError } from "./errors.js";

const username = z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/);
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(12).max(72);

export const registrationSchema = z.object({
  username,
  email,
  password,
}).strict();

export const loginSchema = z.object({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(72),
}).strict();

export const accountSchema = z.object({
  accountType: z.enum(["SAVINGS", "CURRENT"]),
}).strict();

export const transactionSchema = z.object({
  accountNumber: z.string().trim().min(1).max(24).optional(),
  fromAccountNumber: z.string().trim().min(1).max(24).optional(),
  toAccountNumber: z.string().trim().min(1).max(24).optional(),
  amount: z.string().trim().max(20),
}).strict();

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const transactionFilterSchema = pageSchema.extend({
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER"]).optional(),
});

export function parseBody(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Invalid request data", "VALIDATION_FAILED");
  return result.data;
}

const MAX_PAISE = 9_223_372_036_854_775_807n;
const MONEY_PATTERN = /^(0|[1-9]\d{0,15})(?:\.(\d{1,2}))?$/;

export function parseAmountToPaise(value) {
  if (typeof value !== "string") throw new HttpError(400, "Amount must be a decimal string", "INVALID_AMOUNT");
  const match = MONEY_PATTERN.exec(value);
  if (!match) throw new HttpError(400, "Amount must be positive with at most two decimal places", "INVALID_AMOUNT");
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const paise = whole * 100n + fraction;
  if (paise <= 0n || paise > MAX_PAISE) {
    throw new HttpError(400, "Amount is outside the supported range", "INVALID_AMOUNT");
  }
  return paise;
}

export function formatPaise(paise) {
  const value = BigInt(paise);
  const rupees = value / 100n;
  const remainder = String(value % 100n).padStart(2, "0");
  return `${rupees}.${remainder}`;
}
