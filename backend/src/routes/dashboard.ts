import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const rangeFrom = from ? startOfDay(new Date(from)) : startOfDay(new Date(new Date().setDate(new Date().getDate() - 30)));
    const rangeTo = to ? endOfDay(new Date(to)) : endOfDay(new Date());
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const [
      todaysTasks,
      overdueTasks,
      followupsToday,
      pendingOrders,
      readyForDelivery,
      unpaidInvoices,
      paymentsThisPeriod,
      ordersThisPeriod,
      expensesThisPeriod,
      lowStockProducts,
      newLeads,
      bestCustomersRaw,
    ] = await Promise.all([
      prisma.task.findMany({
        where: { dueDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["completed", "cancelled"] } },
        include: { assignee: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: { dueDate: { lt: todayStart }, status: { notIn: ["completed", "cancelled"] } },
        include: { assignee: { select: { name: true } } },
      }),
      prisma.customer.findMany({
        where: { nextFollowupAt: { gte: todayStart, lte: todayEnd } },
        select: { id: true, businessName: true, nextFollowupAt: true },
      }),
      prisma.order.count({ where: { orderStatus: { in: ["draft", "confirmed", "packed"] } } }),
      prisma.order.count({ where: { orderStatus: "packed" } }),
      prisma.invoice.findMany({
        where: { status: { in: ["sent", "viewed", "partially_paid", "overdue"] } },
        select: { balanceDue: true },
      }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: rangeFrom, lte: rangeTo }, orderStatus: { not: "cancelled" } },
        select: { totalValue: true, items: { select: { subtotal: true, quantityBags: true, productId: true } } },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amount: true },
      }),
      prisma.product.findMany({ where: { isActive: true } }),
      prisma.customer.count({ where: { createdAt: { gte: rangeFrom, lte: rangeTo } } }),
      prisma.order.groupBy({
        by: ["customerId"],
        where: { orderStatus: { not: "cancelled" } },
        _sum: { totalValue: true },
        orderBy: { _sum: { totalValue: "desc" } },
        take: 5,
      }),
    ]);

    const totalSales = ordersThisPeriod.reduce((sum, o) => sum + Number(o.totalValue), 0);
    const totalExpenses = Number(expensesThisPeriod._sum.amount || 0);

    // Estimated COGS from order line items using each product's cost price.
    const productIds = [...new Set(ordersThisPeriod.flatMap((o) => o.items.map((i) => i.productId)))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const costMap = new Map(products.map((p) => [p.id, Number(p.costPrice) * (p.bagSize === "kg1" ? 1 : p.bagSize === "kg5" ? 5 : 20)]));
    const cogs = ordersThisPeriod.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + (costMap.get(i.productId) || 0) * i.quantityBags, 0),
      0
    );
    const estimatedProfit = totalSales - cogs - totalExpenses;

    const lowStock = lowStockProducts.filter((p) => p.stockBags <= p.lowStockLevel);

    const customerIds = bestCustomersRaw.map((c) => c.customerId);
    const customerRecords = await prisma.customer.findMany({ where: { id: { in: customerIds } } });
    const customerNameMap = new Map(customerRecords.map((c) => [c.id, c.businessName]));
    const bestCustomers = bestCustomersRaw.map((c) => ({
      customerId: c.customerId,
      businessName: customerNameMap.get(c.customerId) || "Unknown",
      totalValue: Number(c._sum.totalValue || 0),
    }));

    res.json({
      todaysTasks: { count: todaysTasks.length, items: todaysTasks },
      overdueTasks: { count: overdueTasks.length, items: overdueTasks },
      followupsToday: { count: followupsToday.length, items: followupsToday },
      pendingOrders: { count: pendingOrders },
      readyForDelivery: { count: readyForDelivery },
      unpaidInvoices: {
        count: unpaidInvoices.length,
        total: unpaidInvoices.reduce((sum, i) => sum + Number(i.balanceDue), 0),
      },
      paymentsReceived: { total: Number(paymentsThisPeriod._sum.amount || 0) },
      totalSales: { total: totalSales },
      totalExpenses: { total: totalExpenses },
      estimatedProfit: { total: estimatedProfit },
      lowStockAlerts: { count: lowStock.length, items: lowStock },
      newLeads: { count: newLeads },
      bestCustomers,
      salesPipelineValue: { total: 0 },
    });
  })
);

export default router;
