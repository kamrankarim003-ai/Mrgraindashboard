import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user!.roleName !== "Owner") {
      return res.status(403).json({ error: "Only the Owner can view the activity log" });
    }
    const logs = await prisma.activityLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  })
);

export default router;
