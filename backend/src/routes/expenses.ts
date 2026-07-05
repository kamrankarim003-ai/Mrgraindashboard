import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { exportRowsToExcel } from "../utils/exportExcel";
import { upload, fileUrl } from "../utils/upload";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("expenses", "view"),
  asyncHandler(async (req, res) => {
    const { category, supplierName, from, to } = req.query as Record<string, string>;
    const where: any = {};
    if (category) where.category = category;
    if (supplierName) where.supplierName = { contains: supplierName, mode: "insensitive" };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const expenses = await prisma.expense.findMany({
      where,
      include: { enteredByUser: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const totalsByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {});

    res.json({ expenses, totalsByCategory });
  })
);

router.get(
  "/export.xlsx",
  requirePermission("expenses", "view"),
  asyncHandler(async (_req, res) => {
    const expenses = await prisma.expense.findMany({ orderBy: { date: "desc" } });
    const buffer = await exportRowsToExcel(
      "Expenses",
      ["Date", "Category", "Supplier", "Amount", "GST Included", "Payment Method", "Notes"],
      expenses.map((e) => [
        e.date.toISOString().slice(0, 10),
        e.category,
        e.supplierName || "",
        Number(e.amount),
        e.gstIncluded ? "Yes" : "No",
        e.paymentMethod || "",
        e.notes || "",
      ])
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=expenses.xlsx");
    res.send(buffer);
  })
);

const expenseSchema = z.object({
  date: z.string(),
  category: z.enum([
    "stock_purchase",
    "packaging",
    "warehouse",
    "rent",
    "delivery_fuel",
    "marketing",
    "staff_wages",
    "software",
    "accountant",
    "bank_fees",
    "other",
  ]),
  supplierName: z.string().optional(),
  amount: z.coerce.number().positive(),
  gstIncluded: z.coerce.boolean().optional(),
  paymentMethod: z.enum(["bank_transfer", "cash", "card", "other"]).optional(),
  notes: z.string().optional(),
});

router.post(
  "/",
  requirePermission("expenses", "create"),
  upload.single("receipt"),
  asyncHandler(async (req, res) => {
    const data = expenseSchema.parse(req.body);
    const expense = await prisma.expense.create({
      data: {
        date: new Date(data.date),
        category: data.category,
        supplierName: data.supplierName,
        amount: data.amount,
        gstIncluded: data.gstIncluded ?? false,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        receiptFileUrl: req.file ? fileUrl(req.file.filename) : undefined,
        enteredBy: req.user!.id,
      },
    });

    if (req.file) {
      await prisma.attachment.create({
        data: {
          relatedType: "expense",
          relatedId: expense.id,
          fileName: req.file.originalname,
          fileUrl: fileUrl(req.file.filename),
          uploadedBy: req.user!.id,
        },
      });
    }

    await logActivity(req.user!.id, "create_expense", `Logged expense of $${data.amount} (${data.category})`);
    res.status(201).json(expense);
  })
);

router.delete(
  "/:id",
  requirePermission("expenses", "delete"),
  asyncHandler(async (req, res) => {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
