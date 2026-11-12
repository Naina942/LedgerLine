import jwt from "jsonwebtoken";
import { HttpError } from "../errors.js";

export function createAuthMiddleware({ prisma, secret, issuer, audience }) {
  return async function authenticate(req, _res, next) {
    const header = req.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      return next(new HttpError(401, "Authentication is required", "UNAUTHENTICATED"));
    }

    let payload;
    try {
      payload = jwt.verify(header.slice(7), secret, {
        algorithms: ["HS256"],
        issuer,
        audience,
      });
    } catch (error) {
      return next(new HttpError(401, "Token is invalid or expired", "UNAUTHENTICATED"));
    }
    if (typeof payload !== "object" || typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      return next(new HttpError(401, "Token is invalid or expired", "UNAUTHENTICATED"));
    }

    try {
      const session = await prisma.session.findUnique({
        where: { tokenId: payload.jti },
        include: { user: true },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date() ||
          !session.user.isActive || session.user.id !== payload.sub) {
        return next(new HttpError(401, "Session is invalid or expired", "UNAUTHENTICATED"));
      }
      req.user = {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      };
      req.sessionId = session.id;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, "You do not have permission to perform this action", "FORBIDDEN"));
    }
    return next();
  };
}
