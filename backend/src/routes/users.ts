import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../utils/activityLog";

const router = Router();

function requireOwner(req: any, res: any, next: any) {
  if (req.user?.roleName !== "Owner") {
    return res.status(403).json({ error: "Only the Owner can manage users" });
  }
  next();
}

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role.name,
        roleId: u.roleId,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      }))
    );
  })
);

router.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
    res.json(roles);
  })
);

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  roleId: z.number().int(),
});

router.post(
  "/",
  requireOwner,
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: "A user with that email already exists" });
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        passwordHash,
        roleId: data.roleId,
      },
      include: { role: true },
    });
    await logActivity(req.user!.id, "create_user", `Created user ${user.email} (${user.role.name})`);
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role.name });
  })
);

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  roleId: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/:id",
  requireOwner,
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    await logActivity(req.user!.id, "update_user", `Updated user ${user.email}`);
    res.json(user);
  })
);

export default router;
