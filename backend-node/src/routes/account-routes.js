import { Router } from "express";
import { asyncRoute } from "../errors.js";
import { requireRoles } from "../middleware/auth.js";
import { createAccountService } from "../services/account-service.js";
import { accountSchema, parseBody } from "../validation.js";

export function accountRoutes({ prisma, authenticate }) {
  const router = Router();
  const service = createAccountService(prisma);

  router.use(authenticate, requireRoles("CUSTOMER"));
  router.post("/", asyncRoute(async (req, res) => {
    const input = parseBody(accountSchema, req.body);
    res.status(201).json({ account: await service.create(req.user, input.accountType) });
  }));
  router.get("/", asyncRoute(async (req, res) => {
    res.json({ accounts: await service.listMine(req.user.id) });
  }));
  router.get("/:accountNumber", asyncRoute(async (req, res) => {
    res.json({ account: await service.getMine(req.user.id, req.params.accountNumber) });
  }));

  return router;
}
