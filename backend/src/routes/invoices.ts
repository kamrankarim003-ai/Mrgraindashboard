import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { nextInvoiceNumber } from "../utils/numbering";
import { exportRowsToExcel } from "../utils/exportExcel";
import { buildInvoicePdf } from "../utils/pdf";
import { sendEmail } from "../utils/mailer";
import { renderTemplate } from "../utils/emailTemplates";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("invoices", "view"),
  asyncHandler(async (req, res) => {
    const { status, customerId, from, to } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices);
  })
);

router.get(
  "/export.xlsx",
  requirePermission("invoices", "view"),
  asyncHandler(async (_req, res) => {
    const invoices = await prisma.invoice.findMany({
      include: { customer: { select: { businessName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const buffer = await exportRowsToExcel(
      "Invoices",
      ["Invoice #", "Customer", "Status", "Total", "Paid", "Balance Due", "Due Date"],
      invoices.map((i) => [
        i.invoiceNumber,
        i.customer.businessName,
        i.status,
        Number(i.totalAmount),
        Number(i.amountPaid),
        Number(i.balanceDue),
        i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "",
      ])
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=invoices.xlsx");
    res.send(buffer);
  })
);

router.get(
  "/:id",
  requirePermission("invoices", "view"),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
        order: true,
      },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  })
);

router.post(
  "/from-order/:orderId",
  requirePermission("invoices", "create"),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: { items: { include: { product: true } }, customer: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.orderStatus === "draft") {
      return res.status(400).json({ error: "Order must be confirmed before generating an invoice" });
    }
    if (order.invoiceId) {
      return res.status(400).json({ error: "This order already has an invoice" });
    }

    const settings = await prisma.settings.findFirstOrThrow();
    const subtotal = order.items.reduce((sum, i) => sum + Number(i.subtotal), 0) - Number(order.discount);
    const gstAmount = order.gstApplicable ? subtotal * 0.1 : 0;
    const totalAmount = subtotal + gstAmount;
    const dueDate = new Date();
    const termDays = parseInt(settings.defaultPaymentTerms || "14", 10) || 14;
    dueDate.setDate(dueDate.getDate() + termDays);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx);
      const created = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: order.id,
          customerId: order.customerId,
          subtotal,
          gstAmount,
          totalAmount,
          balanceDue: totalAmount,
          dueDate,
          paymentTerms: settings.defaultPaymentTerms,
          status: "sent",
          createdBy: req.user!.id,
          items: {
            create: order.items.map((i) => ({
              productId: i.productId,
              description: `${i.product.productName} (${i.product.bagSize.replace("kg", "")}kg bags) x${i.quantityBags}`,
              quantity: i.quantityBags,
              unitPrice: Number(i.pricePerBag),
              subtotal: Number(i.subtotal),
            })),
          },
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { invoiceId: created.id } });
      return created;
    });

    await logActivity(req.user!.id, "create_invoice", `Generated invoice ${invoice.invoiceNumber} from order ${order.orderNumber}`);
    res.status(201).json(invoice);
  })
);

router.get(
  "/:id/pdf",
  requirePermission("invoices", "view"),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { customer: true, items: true },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const settings = await prisma.settings.findFirstOrThrow();

    const pdf = await buildInvoicePdf({
      business: {
        name: settings.businessName,
        abn: settings.abn,
        address: settings.businessAddress,
        email: settings.businessEmail,
        phone: settings.businessPhone,
        bankDetails: settings.bankDetails,
      },
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customer.businessName,
      customerAddress: invoice.customer.address,
      dueDate: invoice.dueDate,
      paymentTerms: invoice.paymentTerms,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
      subtotal: Number(invoice.subtotal),
      gstAmount: Number(invoice.gstAmount),
      totalAmount: Number(invoice.totalAmount),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${invoice.invoiceNumber}.pdf`);
    res.send(pdf);
  })
);

const emailSchema = z.object({ template: z.enum(["invoice_sent", "payment_reminder"]).optional() });

router.post(
  "/:id/email",
  requirePermission("invoices", "edit"),
  asyncHandler(async (req, res) => {
    const { template } = emailSchema.parse(req.body ?? {});
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { customer: true } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (!invoice.customer.email) {
      return res.status(400).json({ error: "This customer has no email address on file" });
    }

    const rendered = await renderTemplate(template ?? "invoice_sent", {
      customer_name: invoice.customer.businessName,
      invoice_number: invoice.invoiceNumber,
      amount_due: Number(invoice.balanceDue).toFixed(2),
      due_date: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : "",
    });

    let status: "sent" | "failed" = "sent";
    try {
      await sendEmail({ to: invoice.customer.email, subject: rendered.subject, html: rendered.body });
    } catch (err) {
      status = "failed";
    }

    await prisma.emailLog.create({
      data: {
        relatedType: "invoice",
        relatedId: invoice.id,
        recipientEmail: invoice.customer.email,
        subject: rendered.subject,
        bodySnapshot: rendered.body,
        sentAt: new Date(),
        status,
        sentBy: req.user!.id,
      },
    });

    if (invoice.status === "draft") {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "sent" } });
    }

    res.json({ status });
  })
);

export default router;
