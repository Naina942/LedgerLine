import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { HttpError } from "../errors.js";
import { audit } from "./audit-service.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function createAuthService({ prisma, secret, issuer, audience }) {
  return {
    async register(input) {
      const passwordHash = await bcrypt.hash(input.password, 12);
      try {
        return await prisma.$transaction(async (tx) => {
          const existing = await tx.user.findFirst({
            where: { OR: [{ email: input.email }, { username: input.username }] },
            select: { id: true },
          });
          if (existing) throw new HttpError(409, "Username or email is already in use", "ACCOUNT_EXISTS");
          const user = await tx.user.create({
            data: { username: input.username, email: input.email, passwordHash, role: "CUSTOMER" },
            select: { id: true, username: true, email: true, role: true, createdAt: true },
          });
          await audit(tx, user.id, "USER_REGISTERED", user.id);
          return user;
        });
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (error?.code === "P2002") {
          throw new HttpError(409, "Username or email is already in use", "ACCOUNT_EXISTS");
        }
        throw error;
      }
    },

    async login(login, plainPassword) {
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: login.toLowerCase() }, { username: login }] },
      });
      const matches = user ? await bcrypt.compare(plainPassword, user.passwordHash) : false;
      if (!user || !matches || !user.isActive) {
        throw new HttpError(401, "Invalid username/email or password", "INVALID_CREDENTIALS");
      }

      const tokenId = randomUUID();
      const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
      const token = jwt.sign(
        { sub: user.id, jti: tokenId },
        secret,
        { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS, issuer, audience },
      );
      await prisma.$transaction(async (tx) => {
        await tx.session.create({ data: { tokenId, userId: user.id, expiresAt } });
        await audit(tx, user.id, "USER_LOGIN", user.id);
      });
      return {
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      };
    },

    async logout(sessionId, userId) {
      await prisma.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(prisma, userId, "USER_LOGOUT", userId);
      return { loggedOut: true };
    },
  };
}
