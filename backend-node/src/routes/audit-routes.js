import { Router } from "express";
import { asyncRoute } from "../errors.js";
import { requireRoles } from "../middleware/auth.js";
import { pageSchema } from "../validation.js";

export function auditRoutes({ prisma, authenticate }) {
  const router = Router();
  router.use(authenticate, requireRoles("ADMIN", "AUDITOR"));
  router.get("/", asyncRoute(async (req, res) => {
    const { page, pageSize } = pageSchema.parse(req.query);
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        select: {
          id: true,
          action: true,
          subjectId: true,
          metadata: true,
          createdAt: true,
          ...(req.user.role === "ADMIN" ? { actorId: true } : {}),
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditEvent.count(),
    ]);
    res.json({ items: events, page, pageSize, total });
  }));
  return router;
}
