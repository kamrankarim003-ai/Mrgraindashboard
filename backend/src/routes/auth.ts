import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { signToken, requireAuth } from "../middleware/auth";
import { getPermissionsForRole } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { sendEmail } from "../utils/mailer";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logActivity(user.id, "login", `${user.name} logged in`);
    const token = signToken({
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        roleId: user.roleId,
      },
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const permissions = await getPermissionsForRole(req.user!.roleId);
    res.json({ user: req.user, permissions });
  })
);

const forgotSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond success to avoid leaking which emails exist.
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 60);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });
      const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: "Reset your MR GRAIN password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }
    res.json({ message: "If that email exists, a reset link has been sent." });
  })
);

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) {
      return res.status(400).json({ error: "Reset link is invalid or has expired" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    res.json({ message: "Password has been reset. You can now log in." });
  })
);

export default router;
