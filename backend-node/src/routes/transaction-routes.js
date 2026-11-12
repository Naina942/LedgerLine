import { Router } from "express";
import { asyncRoute } from "../errors.js";
import { requireRoles } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";
import { createTransactionService } from "../services/transaction-service.js";
import { parseBody, transactionFilterSchema, transactionSchema } from "../validation.js";

export function transactionRoutes({ prisma, redis, config, authenticate }) {
  const router = Router();
  const service = createTransactionService(prisma);
  const limiter = createRateLimiter(redis, {
    name: "transactions",
    limit: config.rateLimitTransactionMax,
    windowMs: config.rateLimitWindowMs,
  });

  router.get("/my", authenticate, requireRoles("CUSTOMER"), asyncRoute(async (req, res) => {
    const pagination = transactionFilterSchema.parse(req.query);
    res.json(await service.listForCustomer(req.user.id, pagination));
  }));

  router.get("/", authenticate, requireRoles("ADMIN", "AUDITOR"), asyncRoute(async (req, res) => {
    const pagination = transactionFilterSchema.parse(req.query);
    const result = await service.listAll(pagination);
    if (req.user.role === "AUDITOR") {
      result.items = result.items.map(({ id, type, status, amount, amountPaise, currency, createdAt }) =>
        ({ id, type, status, amount, amountPaise, currency, createdAt }));
    }
    res.json(result);
  }));

  router.post("/deposit", authenticate, requireRoles("CUSTOMER"), limiter, asyncRoute(async (req, res) => {
    const input = parseBody(transactionSchema, req.body);
    if (!input.accountNumber || input.fromAccountNumber || input.toAccountNumber) {
      return res.status(400).json({ error: "VALIDATION_FAILED", message: "Provide accountNumber and amount" });
    }
    const transaction = await service.deposit({
      user: req.user,
      accountNumber: input.accountNumber,
      amount: input.amount,
      idempotencyKey: req.get("Idempotency-Key"),
    });
    res.status(201).json({ transaction });
  }));

  router.post("/withdraw", authenticate, requireRoles("CUSTOMER"), limiter, asyncRoute(async (req, res) => {
    const input = parseBody(transactionSchema, req.body);
    if (!input.accountNumber || input.fromAccountNumber || input.toAccountNumber) {
      return res.status(400).json({ error: "VALIDATION_FAILED", message: "Provide accountNumber and amount" });
    }
    const transaction = await service.withdraw({
      user: req.user,
      accountNumber: input.accountNumber,
      amount: input.amount,
      idempotencyKey: req.get("Idempotency-Key"),
    });
    res.status(201).json({ transaction });
  }));

  router.post("/transfer", authenticate, requireRoles("CUSTOMER"), limiter, asyncRoute(async (req, res) => {
    const input = parseBody(transactionSchema, req.body);
    if (!input.fromAccountNumber || !input.toAccountNumber || input.accountNumber) {
      return res.status(400).json({ error: "VALIDATION_FAILED", message: "Provide fromAccountNumber, toAccountNumber and amount" });
    }
    const transaction = await service.transfer({
      user: req.user,
      fromAccountNumber: input.fromAccountNumber,
      toAccountNumber: input.toAccountNumber,
      amount: input.amount,
      idempotencyKey: req.get("Idempotency-Key"),
    });
    res.status(201).json({ transaction });
  }));

  router.get("/:transactionId", authenticate, asyncRoute(async (req, res) => {
    if (req.user.role === "CUSTOMER") {
      return res.json({ transaction: await service.getForCustomer(req.user.id, req.params.transactionId) });
    }
    if (!["ADMIN", "AUDITOR"].includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "You do not have permission to view this transaction" });
    }
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.transactionId },
      include: { sourceAccount: true, destinationAccount: true, ledgerEntries: true },
    });
    if (!transaction) return res.status(404).json({ error: "NOT_FOUND", message: "Transaction was not found" });
    const dto = {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: `${transaction.amountPaise / 100n}.${String(transaction.amountPaise % 100n).padStart(2, "0")}`,
      amountPaise: transaction.amountPaise.toString(),
      currency: "INR",
      createdAt: transaction.createdAt,
      ...(req.user.role === "ADMIN" ? {
        sourceAccountNumber: transaction.sourceAccount?.accountNumber ?? null,
        destinationAccountNumber: transaction.destinationAccount?.accountNumber ?? null,
        ledgerEntries: transaction.ledgerEntries.map(({ side, amountPaise, createdAt }) =>
          ({ side, amountPaise: amountPaise.toString(), createdAt })),
      } : {
        ledgerEntries: transaction.ledgerEntries.map(({ side, amountPaise, createdAt }) =>
          ({ side, amountPaise: amountPaise.toString(), createdAt })),
      }),
    };
    return res.json({ transaction: dto });
  }));

  return router;
}
