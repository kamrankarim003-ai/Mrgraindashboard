import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { exportRowsToExcel } from "../utils/exportExcel";
import { buildTablePdf } from "../utils/pdf";

const router = Router();
router.use(requireAuth);
router.use(requirePermission("reports", "view"));

function requireFinancial(req: any, res: any, next: any) {
  if (!["Owner", "Accountant"].includes(req.user.roleName)) {
    return res.status(403).json({ error: "Only Owner and Accountant can view financial reports" });
  }
  next();
}

function dateRange(req: any) {
  const { from, to } = req.query as Record<string, string>;
  const rangeFrom = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const rangeTo = to ? new Date(to) : new Date();
  rangeTo.setHours(23, 59, 59, 999);
  return { rangeFrom, rangeTo };
}

async function respond(req: any, res: any, sheetName: string, headers: string[], rows: any[][], data: unknown) {
  const filenameBase = sheetName.toLowerCase().replace(/\s+/g, "-");
  if (req.query.format === "xlsx") {
    const buffer = await exportRowsToExcel(sheetName, headers, rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filenameBase}.xlsx`);
    return res.send(buffer);
  }
  if (req.query.format === "pdf") {
    const buffer = await buildTablePdf(sheetName, headers, rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${filenameBase}.pdf`);
    return res.send(buffer);
  }
  res.json(data);
}

router.get(
  "/sales",
  asyncHandler(async (req, res) => {
    const { rangeFrom, rangeTo } = dateRange(req);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: rangeFrom, lte: rangeTo }, orderStatus: { not: "cancelled" } },
      include: { customer: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const rows = orders.map((o) => [o.createdAt.toISOString().slice(0, 10), o.orderNumber, o.customer.businessName, Number(o.totalValue)]);
    await respond(req, res, "Sales Report", ["Date", "Order #", "Customer", "Total"], rows, orders);
  })
);

router.get(
  "/profit-loss",
  requireFinancial,
  asyncHandler(async (req, res) => {
    const { rangeFrom, rangeTo } = dateRange(req);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: rangeFrom, lte: rangeTo }, orderStatus: { not: "cancelled" } },
      include: { items: true },
    });
    const totalSales = orders.reduce((sum, o) => sum + Number(o.totalValue), 0);
    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const costMap = new Map(products.map((p) => [p.id, Number(p.costPrice) * (p.bagSize === "kg1" ? 1 : p.bagSize === "kg5" ? 5 : 20)]));
    const cogs = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + (costMap.get(i.productId) || 0) * i.quantityBags, 0), 0);
    const expenses = await prisma.expense.aggregate({ where: { date: { gte: rangeFrom, lte: rangeTo } }, _sum: { amount: true } });
    const totalExpenses = Number(expenses._sum.amount || 0);
    const profit = totalSales - cogs - totalExpenses;
    const data = { totalSales, cogs, totalExpenses, profit };
    const rows = [["Total Sales", totalSales], ["Cost of Goods Sold", cogs], ["Total Expenses", totalExpenses], ["Net Profit", profit]];
    await respond(req, res, "Profit and Loss", ["Line", "Amount"], rows, data);
  })
);

router.get(
  "/expenses",
  requireFinancial,
  asyncHandler(async (req, res) => {
    const { rangeFrom, rangeTo } = dateRange(req);
    const expenses = await prisma.expense.findMany({ where: { date: { gte: rangeFrom, lte: rangeTo } }, orderBy: { date: "desc" } });
    const rows = expenses.map((e) => [e.date.toISOString().slice(0, 10), e.category, e.supplierName || "", Number(e.amount)]);
    await respond(req, res, "Expense Report", ["Date", "Category", "Supplier", "Amount"], rows, expenses);
  })
);

router.get(
  "/customers",
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({ include: { assignedUser: { select: { name: true } } } });
    const rows = customers.map((c) => [c.businessName, c.customerType, c.status, c.assignedUser?.name || ""]);
    await respond(req, res, "Customer Report", ["Business Name", "Type", "Status", "Assigned To"], rows, customers);
  })
);

router.get(
  "/salesperson-performance",
  asyncHandler(async (req, res) => {
    const { rangeFrom, rangeTo } = dateRange(req);
    const grouped = await prisma.order.groupBy({
      by: ["assignedUserId"],
      where: { createdAt: { gte: rangeFrom, lte: rangeTo }, orderStatus: { not: "cancelled" }, assignedUserId: { not: null } },
      _sum: { totalValue: true },
      _count: true,
    });
    const users = await prisma.user.findMany({ where: { id: { in: grouped.map((g) => g.assignedUserId!) } } });
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const data = grouped.map((g) => ({
      userId: g.assignedUserId,
      name: userMap.get(g.assignedUserId!) || "Unknown",
      orderCount: g._count,
      totalValue: Number(g._sum.totalValue || 0),
    }));
    const rows = data.map((d) => [d.name, d.orderCount, d.totalValue]);
    await respond(req, res, "Salesperson Performance", ["Salesperson", "Orders", "Total Value"], rows, data);
  })
);

router.get(
  "/outstanding-payments",
  requireFinancial,
  asyncHandler(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { balanceDue: { gt: 0 }, status: { not: "cancelled" } },
      include: { customer: { select: { businessName: true } } },
      orderBy: { dueDate: "asc" },
    });
    const rows = invoices.map((i) => [i.invoiceNumber, i.customer.businessName, Number(i.balanceDue), i.dueDate ? i.dueDate.toISOString().slice(0, 10) : ""]);
    await respond(req, res, "Outstanding Payments", ["Invoice #", "Customer", "Balance Due", "Due Date"], rows, invoices);
  })
);

router.get(
  "/order-status",
  asyncHandler(async (req, res) => {
    const grouped = await prisma.order.groupBy({ by: ["orderStatus"], _count: true });
    const rows = grouped.map((g) => [g.orderStatus, g._count]);
    await respond(req, res, "Order Status Report", ["Status", "Count"], rows, grouped);
  })
);

router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const products = await prisma.product.findMany();
    const rows = products.map((p) => [p.productName, p.sku, p.stockBags, Number(p.stockKg), p.stockBags <= p.lowStockLevel ? "LOW" : "OK"]);
    await respond(req, res, "Inventory Report", ["Product", "SKU", "Stock (Bags)", "Stock (Kg)", "Status"], rows, products);
  })
);

router.get(
  "/followups",
  asyncHandler(async (req, res) => {
    const { rangeFrom, rangeTo } = dateRange(req);
    const customers = await prisma.customer.findMany({
      where: { nextFollowupAt: { gte: rangeFrom, lte: rangeTo } },
      include: { assignedUser: { select: { name: true } } },
      orderBy: { nextFollowupAt: "asc" },
    });
    const rows = customers.map((c) => [c.businessName, c.nextFollowupAt?.toISOString().slice(0, 10) || "", c.assignedUser?.name || ""]);
    await respond(req, res, "Follow-up Report", ["Business Name", "Follow-up Date", "Assigned To"], rows, customers);
  })
);

router.get(
  "/lost-leads",
  asyncHandler(async (req, res) => {
    const customers = await prisma.customer.findMany({ where: { status: "lost" }, orderBy: { updatedAt: "desc" } });
    const rows = customers.map((c) => [c.businessName, c.lostReason || "", c.updatedAt.toISOString().slice(0, 10)]);
    await respond(req, res, "Lost Leads Report", ["Business Name", "Lost Reason", "Date"], rows, customers);
  })
);

router.get(
  "/best-customers",
  asyncHandler(async (req, res) => {
    const grouped = await prisma.order.groupBy({
      by: ["customerId"],
      where: { orderStatus: { not: "cancelled" } },
      _sum: { totalValue: true },
      orderBy: { _sum: { totalValue: "desc" } },
      take: 20,
    });
    const customers = await prisma.customer.findMany({ where: { id: { in: grouped.map((g) => g.customerId) } } });
    const customerMap = new Map(customers.map((c) => [c.id, c.businessName]));
    const data = grouped.map((g) => ({ businessName: customerMap.get(g.customerId) || "Unknown", totalValue: Number(g._sum.totalValue || 0) }));
    const rows = data.map((d) => [d.businessName, d.totalValue]);
    await respond(req, res, "Best Customer Report", ["Business Name", "Total Value"], rows, data);
  })
);

router.get(
  "/best-products",
  asyncHandler(async (req, res) => {
    const grouped = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantityBags: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 20,
    });
    const products = await prisma.product.findMany({ where: { id: { in: grouped.map((g) => g.productId) } } });
    const productMap = new Map(products.map((p) => [p.id, p.productName]));
    const data = grouped.map((g) => ({
      productName: productMap.get(g.productId) || "Unknown",
      bagsSold: g._sum.quantityBags || 0,
      totalValue: Number(g._sum.subtotal || 0),
    }));
    const rows = data.map((d) => [d.productName, d.bagsSold, d.totalValue]);
    await respond(req, res, "Best Product Report", ["Product", "Bags Sold", "Total Value"], rows, data);
  })
);

export default router;
