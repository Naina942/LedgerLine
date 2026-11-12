import { Router } from "express";
import { z } from "zod";
import { HttpError, asyncRoute } from "../errors.js";
import { requireRoles } from "../middleware/auth.js";
import { createAccountService } from "../services/account-service.js";
import { createAdminService } from "../services/admin-service.js";
import { pageSchema, parseBody } from "../validation.js";

const userUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["CUSTOMER", "AUDITOR"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const accountStatusSchema = z.object({
  status: z.enum(["ACTIVE", "FROZEN", "CLOSED"]),
}).strict();

export function adminRoutes({ prisma, authenticate }) {
  const router = Router();
  const admin = createAdminService(prisma);
  const accounts = createAccountService(prisma);
  router.use(authenticate, requireRoles("ADMIN"));

  router.get("/users", asyncRoute(async (req, res) => {
    res.json(await admin.listUsers(pageSchema.parse(req.query)));
  }));
  router.patch("/users/:userId", asyncRoute(async (req, res) => {
    const changes = parseBody(userUpdateSchema, req.body);
    if (changes.role === "ADMIN") throw new HttpError(403, "Administrator roles can only be provisioned by the one-time bootstrap script", "FORBIDDEN");
    res.json({ user: await admin.updateUser(req.user.id, req.params.userId, changes) });
  }));
  router.get("/accounts", asyncRoute(async (req, res) => {
    res.json(await admin.listAccounts(pageSchema.parse(req.query)));
  }));
  router.patch("/accounts/:accountId/status", asyncRoute(async (req, res) => {
    const input = parseBody(accountStatusSchema, req.body);
    res.json({ account: await accounts.updateStatus(req.user.id, req.params.accountId, input.status) });
  }));

  return router;
}
