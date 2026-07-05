import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { logActivity } from "../utils/activityLog";
import { DEFAULT_TEMPLATES } from "../utils/emailTemplates";
import { upload, fileUrl } from "../utils/upload";

const router = Router();
router.use(requireAuth);

function requireOwner(req: any, res: any, next: any) {
  if (req.user?.roleName !== "Owner") {
    return res.status(403).json({ error: "Only the Owner can change settings" });
  }
  next();
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const settings = await prisma.settings.findFirstOrThrow();
    res.json({
      ...settings,
      emailTemplates: { ...DEFAULT_TEMPLATES, ...((settings.emailTemplates as object) || {}) },
    });
  })
);

const settingsSchema = z.object({
  businessName: z.string().min(1).optional(),
  abn: z.string().optional(),
  businessAddress: z.string().optional(),
  businessEmail: z.string().optional(),
  businessPhone: z.string().optional(),
  bankDetails: z.string().optional(),
  gstRegistered: z.boolean().optional(),
  defaultPaymentTerms: z.string().optional(),
  invoicePrefix: z.string().optional(),
  quotePrefix: z.string().optional(),
  orderPrefix: z.string().optional(),
  expenseCategories: z.array(z.string()).optional(),
  productTypes: z.array(z.string()).optional(),
  emailTemplates: z.record(z.object({ subject: z.string(), body: z.string() })).optional(),
});

router.patch(
  "/",
  requireOwner,
  asyncHandler(async (req, res) => {
    const data = settingsSchema.parse(req.body);
    const existing = await prisma.settings.findFirstOrThrow();
    const updated = await prisma.settings.update({ where: { id: existing.id }, data });
    await logActivity(req.user!.id, "update_settings", "Updated business settings");
    res.json(updated);
  })
);

router.post(
  "/logo",
  requireOwner,
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const existing = await prisma.settings.findFirstOrThrow();
    const updated = await prisma.settings.update({
      where: { id: existing.id },
      data: { logoUrl: fileUrl(req.file.filename) },
    });
    res.json(updated);
  })
);

export default router;
