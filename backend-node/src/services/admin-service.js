import { HttpError } from "../errors.js";
import { audit } from "./audit-service.js";

export function createAdminService(prisma) {
  return {
    async listUsers({ page, pageSize }) {
      const where = {};
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { accounts: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ]);
      return { items, page, pageSize, total };
    },

    async updateUser(actorId, targetId, changes) {
      if (actorId === targetId && (changes.isActive === false || changes.role)) {
        throw new HttpError(409, "You cannot deactivate or demote your own administrator account", "ADMIN_SELF_LOCKOUT");
      }
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "id" FOR UPDATE`;
        const target = await tx.user.findUnique({ where: { id: targetId } });
        if (!target) throw new HttpError(404, "User was not found", "NOT_FOUND");
        const removesActiveAdmin = target.role === "ADMIN" && target.isActive &&
          (changes.isActive === false || (changes.role && changes.role !== "ADMIN"));
        if (removesActiveAdmin) {
          const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
          if (activeAdmins <= 1) {
            throw new HttpError(409, "At least one active administrator must remain", "LAST_ADMIN");
          }
        }
        const updated = await tx.user.update({
          where: { id: targetId },
          data: changes,
          select: { id: true, username: true, email: true, role: true, isActive: true, createdAt: true },
        });
        if (changes.isActive === false) {
          await tx.session.updateMany({
            where: { userId: targetId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        await audit(tx, actorId, "USER_UPDATED", targetId, changes);
        return updated;
      }, { isolationLevel: "Serializable" });
    },

    async listAccounts({ page, pageSize }) {
      const [items, total] = await Promise.all([
        prisma.account.findMany({
          where: { isSystem: false },
          select: {
            id: true,
            accountNumber: true,
            accountType: true,
            status: true,
            currency: true,
            balancePaise: true,
            createdAt: true,
            owner: { select: { id: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.account.count({ where: { isSystem: false } }),
      ]);
      return {
        items: items.map((item) => ({
          ...item,
          balancePaise: item.balancePaise.toString(),
          owner: item.owner,
        })),
        page,
        pageSize,
        total,
      };
    },
  };
}
