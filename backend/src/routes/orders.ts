import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { nextOrderNumber } from "../utils/numbering";
import { exportRowsToExcel } from "../utils/exportExcel";
import { notifyRole } from "../utils/notify";

const router = Router();
router.use(requireAuth);

function bagsToKg(bagSize: string, bags: number): number {
  const size = bagSize === "kg1" ? 1 : bagSize === "kg5" ? 5 : 20;
  return size * bags;
}

router.get(
  "/",
  requirePermission("orders", "view"),
  asyncHandler(async (req, res) => {
    const { customerId, orderStatus, paymentStatus, from, to } = req.query as Record<string, string>;
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (orderStatus) where.orderStatus = orderStatus;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { businessName: true } },
        assignedUser: { select: { name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  })
);

router.get(
  "/export.xlsx",
  requirePermission("orders", "view"),
  asyncHandler(async (_req, res) => {
    const orders = await prisma.order.findMany({
      include: { customer: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const buffer = await exportRowsToExcel(
      "Orders",
      ["Order #", "Customer", "Status", "Payment Status", "Delivery Date", "Total"],
      orders.map((o) => [
        o.orderNumber,
        o.customer.businessName,
        o.orderStatus,
        o.paymentStatus,
        o.deliveryDate ? o.deliveryDate.toISOString().slice(0, 10) : "",
        Number(o.totalValue),
      ])
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=orders.xlsx");
    res.send(buffer);
  })
);

router.get(
  "/:id",
  requirePermission("orders", "view"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        assignedUser: { select: { id: true, name: true } },
        items: { include: { product: true } },
        invoice: true,
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  })
);

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantityBags: z.number().int().positive(),
});

const orderSchema = z.object({
  customerId: z.string().uuid(),
  contactPerson: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryDate: z.string().optional().nullable(),
  deliveryNotes: z.string().optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  internalNotes: z.string().optional(),
  discount: z.number().nonnegative().optional(),
  gstApplicable: z.boolean().optional(),
  items: z.array(itemSchema).min(1),
});

async function computeItems(items: z.infer<typeof itemSchema>[]) {
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    const kg = bagsToKg(product.bagSize, item.quantityBags);
    const pricePerKg = Number(product.wholesalePrice);
    const subtotal = pricePerKg * kg;
    return {
      productId: product.id,
      quantityBags: item.quantityBags,
      quantityKg: kg,
      pricePerKg,
      pricePerBag: pricePerKg * (product.bagSize === "kg1" ? 1 : product.bagSize === "kg5" ? 5 : 20),
      subtotal,
    };
  });
}

router.post(
  "/",
  requirePermission("orders", "create"),
  asyncHandler(async (req, res) => {
    const data = orderSchema.parse(req.body);
    const computedItems = await computeItems(data.items);
    const itemsTotal = computedItems.reduce((sum, i) => sum + i.subtotal, 0);
    const discount = data.discount ?? 0;
    const settings = await prisma.settings.findFirstOrThrow();
    const gstApplicable = settings.gstRegistered ? (data.gstApplicable ?? true) : false;
    const netTotal = itemsTotal - discount;
    const totalValue = gstApplicable ? netTotal * 1.1 : netTotal;

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx);
      return tx.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          contactPerson: data.contactPerson,
          deliveryAddress: data.deliveryAddress,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
          deliveryNotes: data.deliveryNotes,
          assignedUserId: data.assignedUserId,
          internalNotes: data.internalNotes,
          discount,
          gstApplicable,
          totalValue,
          createdBy: req.user!.id,
          items: { create: computedItems },
        },
        include: { items: true },
      });
    });

    await logActivity(req.user!.id, "create_order", `Created order ${order.orderNumber}`);
    res.status(201).json(order);
  })
);

router.patch(
  "/:id",
  requirePermission("orders", "edit"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (!["draft", "confirmed"].includes(existing.orderStatus)) {
      return res.status(400).json({ error: "Only draft or confirmed orders can be edited" });
    }
    const data = orderSchema.partial().parse(req.body);

    let updateData: any = {
      contactPerson: data.contactPerson,
      deliveryAddress: data.deliveryAddress,
      deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
      deliveryNotes: data.deliveryNotes,
      assignedUserId: data.assignedUserId,
      internalNotes: data.internalNotes,
      discount: data.discount,
    };

    if (data.items) {
      const computedItems = await computeItems(data.items);
      const itemsTotal = computedItems.reduce((sum, i) => sum + i.subtotal, 0);
      const discount = data.discount ?? Number(existing.discount);
      const settings = await prisma.settings.findFirstOrThrow();
      const gstApplicable = settings.gstRegistered ? (data.gstApplicable ?? existing.gstApplicable) : false;
      const netTotal = itemsTotal - discount;
      updateData.totalValue = gstApplicable ? netTotal * 1.1 : netTotal;
      updateData.gstApplicable = gstApplicable;

      await prisma.orderItem.deleteMany({ where: { orderId: existing.id } });
      updateData.items = { create: computedItems };
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: true },
    });
    res.json(order);
  })
);

const statusSchema = z.object({
  orderStatus: z.enum(["draft", "confirmed", "packed", "dispatched", "delivered", "completed", "cancelled"]),
});

router.patch(
  "/:id/status",
  requirePermission("orders", "edit"),
  asyncHandler(async (req, res) => {
    const { orderStatus } = statusSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const wasStockReduced = ["confirmed", "packed", "dispatched", "delivered", "completed"].includes(order.orderStatus);
    const willReduceStock = ["confirmed", "packed", "dispatched", "delivered", "completed"].includes(orderStatus);

    if (!wasStockReduced && willReduceStock) {
      // Moving into confirmed (or beyond) for the first time - reduce stock, checking availability.
      const products = await prisma.product.findMany({ where: { id: { in: order.items.map((i) => i.productId) } } });
      const productMap = new Map(products.map((p) => [p.id, p]));
      for (const item of order.items) {
        const product = productMap.get(item.productId)!;
        if (product.stockBags < item.quantityBags) {
          return res.status(400).json({
            error: `Not enough stock of ${product.productName}: have ${product.stockBags} bags, need ${item.quantityBags}`,
          });
        }
      }

      await prisma.$transaction([
        ...order.items.map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: { stockBags: { decrement: item.quantityBags }, stockKg: { decrement: item.quantityKg } },
          })
        ),
        ...order.items.map((item) =>
          prisma.inventoryMovement.create({
            data: {
              productId: item.productId,
              movementType: "stock_out",
              quantityBags: item.quantityBags,
              quantityKg: item.quantityKg,
              relatedOrderId: order.id,
              notes: `Order ${order.orderNumber} confirmed`,
              userId: req.user!.id,
            },
          })
        ),
        prisma.order.update({ where: { id: order.id }, data: { orderStatus } }),
      ]);
    } else if (wasStockReduced && orderStatus === "cancelled") {
      // Restore stock that was previously deducted.
      await prisma.$transaction([
        ...order.items.map((item) =>
          prisma.product.update({
            where: { id: item.productId },
            data: { stockBags: { increment: item.quantityBags }, stockKg: { increment: item.quantityKg } },
          })
        ),
        ...order.items.map((item) =>
          prisma.inventoryMovement.create({
            data: {
              productId: item.productId,
              movementType: "stock_in",
              quantityBags: item.quantityBags,
              quantityKg: item.quantityKg,
              relatedOrderId: order.id,
              notes: `Order ${order.orderNumber} cancelled - stock restored`,
              userId: req.user!.id,
            },
          })
        ),
        prisma.order.update({ where: { id: order.id }, data: { orderStatus } }),
      ]);
    } else {
      await prisma.order.update({ where: { id: order.id }, data: { orderStatus } });
    }

    if (orderStatus === "dispatched") {
      await notifyRole("Sales", "order_dispatched", `Order ${order.orderNumber} has been dispatched`, "order", order.id);
    }

    await logActivity(req.user!.id, "update_order_status", `Order ${order.orderNumber} -> ${orderStatus}`);
    res.json(await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } }));
  })
);

export default router;
