import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { buildReceiptPdf } from "../utils/pdf";
import { renderTemplate } from "../utils/emailTemplates";
import { sendEmail } from "../utils/mailer";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("payments", "view"),
  asyncHandler(async (req, res) => {
    const { customerId, from, to } = req.query as Record<string, string>;
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.paymentDate = {};
      if (from) where.paymentDate.gte = new Date(from);
      if (to) where.paymentDate.lte = new Date(to);
    }
    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: { select: { businessName: true } },
        invoice: { select: { invoiceNumber: true } },
        recorder: { select: { name: true } },
      },
      orderBy: { paymentDate: "desc" },
    });
    res.json(payments);
  })
);

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string(),
  paymentMethod: z.enum(["bank_transfer", "cash", "card", "other"]),
  referenceNote: z.string().optional(),
});

router.post(
  "/",
  requirePermission("payments", "create"),
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId }, include: { customer: true } });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const newAmountPaid = Number(invoice.amountPaid) + data.amount;
    const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid;
    const newStatus = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partially_paid" : invoice.status;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId: data.invoiceId,
          customerId: invoice.customerId,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          referenceNote: data.referenceNote,
          recordedBy: req.user!.id,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: newAmountPaid, balanceDue: Math.max(newBalanceDue, 0), status: newStatus },
      });
      return p;
    });

    await logActivity(req.user!.id, "record_payment", `Recorded $${data.amount} payment for invoice ${invoice.invoiceNumber}`);

    if (newStatus === "paid" && invoice.customer.email) {
      const rendered = await renderTemplate("thank_you_payment", {
        customer_name: invoice.customer.businessName,
        invoice_number: invoice.invoiceNumber,
      });
      try {
        await sendEmail({ to: invoice.customer.email, subject: rendered.subject, html: rendered.body });
        await prisma.emailLog.create({
          data: {
            relatedType: "invoice",
            relatedId: invoice.id,
            recipientEmail: invoice.customer.email,
            subject: rendered.subject,
            bodySnapshot: rendered.body,
            sentAt: new Date(),
            status: "sent",
            sentBy: req.user!.id,
          },
        });
      } catch {
        // Non-fatal: payment is already recorded even if the thank-you email fails.
      }
    }

    res.status(201).json(payment);
  })
);

router.get(
  "/:id/receipt.pdf",
  requirePermission("payments", "view"),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { customer: true, invoice: true },
    });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    const settings = await prisma.settings.findFirstOrThrow();

    const pdf = await buildReceiptPdf({
      business: { name: settings.businessName },
      invoiceNumber: payment.invoice.invoiceNumber,
      customerName: payment.customer.businessName,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      referenceNote: payment.referenceNote,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=receipt-${payment.invoice.invoiceNumber}.pdf`);
    res.send(pdf);
  })
);

export default router;
