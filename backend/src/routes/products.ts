import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { notifyRole } from "../utils/notify";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("inventory", "view"),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ orderBy: { productName: "asc" } });
    res.json(products);
  })
);

router.get(
  "/:id",
  requirePermission("inventory", "view"),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        inventoryMovements: {
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  })
);

const productSchema = z.object({
  productName: z.string().min(1),
  productType: z.enum(["basmati", "sella"]),
  bagSize: z.enum(["kg1", "kg5", "kg20"]),
  sku: z.string().min(1),
  costPrice: z.number().nonnegative(),
  wholesalePrice: z.number().nonnegative(),
  lowStockLevel: z.number().int().nonnegative().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.post(
  "/",
  requirePermission("inventory", "create"),
  asyncHandler(async (req, res) => {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data: { ...data, stockBags: 0, stockKg: 0 } });
    await logActivity(req.user!.id, "create_product", `Created product ${product.productName}`);
    res.status(201).json(product);
  })
);

router.patch(
  "/:id",
  requirePermission("inventory", "edit"),
  asyncHandler(async (req, res) => {
    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });
    res.json(product);
  })
);

function bagsToKg(bagSize: string, bags: number): number {
  const size = bagSize === "kg1" ? 1 : bagSize === "kg5" ? 5 : 20;
  return size * bags;
}

const stockInSchema = z.object({
  quantityBags: z.number().int().positive(),
  notes: z.string().optional(),
});

router.post(
  "/:id/stock-in",
  requirePermission("inventory", "create"),
  asyncHandler(async (req, res) => {
    const { quantityBags, notes } = stockInSchema.parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    const kg = bagsToKg(product.bagSize, quantityBags);

    const [updated] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { stockBags: { increment: quantityBags }, stockKg: { increment: kg } },
      }),
      prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          movementType: "stock_in",
          quantityBags,
          quantityKg: kg,
          notes,
          userId: req.user!.id,
        },
      }),
    ]);
    res.json(updated);
  })
);

const adjustSchema = z.object({
  quantityBags: z.number().int(),
  reason: z.string().min(1),
});

router.post(
  "/:id/adjust",
  requirePermission("inventory", "edit"),
  asyncHandler(async (req, res) => {
    const { quantityBags, reason } = adjustSchema.parse(req.body);
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    const kg = bagsToKg(product.bagSize, quantityBags);

    if (product.stockBags + quantityBags < 0) {
      return res.status(400).json({ error: "Adjustment would result in negative stock" });
    }

    const [updated] = await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: { stockBags: { increment: quantityBags }, stockKg: { increment: kg } },
      }),
      prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          movementType: "adjustment",
          quantityBags,
          quantityKg: kg,
          notes: reason,
          userId: req.user!.id,
        },
      }),
    ]);

    if (updated.stockBags <= updated.lowStockLevel) {
      await notifyRole("Owner", "low_stock", `${updated.productName} is low on stock (${updated.stockBags} bags left)`, "product", updated.id);
    }

    res.json(updated);
  })
);

router.get(
  "/alerts/low-stock",
  requirePermission("inventory", "view"),
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const low = products.filter((p) => p.stockBags <= p.lowStockLevel);
    res.json(low);
  })
);

export default router;
