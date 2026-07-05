import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export function signToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id },
      include: { role: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ error: "Account is inactive or no longer exists" });
    }
    req.user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      roleId: dbUser.roleId,
      roleName: dbUser.role.name,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
