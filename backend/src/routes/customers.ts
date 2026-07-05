import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { exportRowsToExcel } from "../utils/exportExcel";
import { renderTemplate } from "../utils/emailTemplates";
import { sendEmail } from "../utils/mailer";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("customers", "view"),
  asyncHandler(async (req, res) => {
    const { status, customerType, state, assignedUserId, leadSource, search } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (customerType) where.customerType = customerType;
    if (state) where.state = state;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (leadSource) where.leadSource = leadSource;
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
    const customers = await prisma.customer.findMany({
      where,
      include: { assignedUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(customers);
  })
);

router.get(
  "/export.xlsx",
  requirePermission("customers", "view"),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.customer.findMany({
      include: { assignedUser: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const buffer = await exportRowsToExcel(
      "Customers",
      ["Business Name", "Contact", "Phone", "Email", "Type", "Status", "Assigned To", "Next Follow-up"],
      customers.map((c) => [
        c.businessName,
        c.contactPerson || "",
        c.phone || "",
        c.email || "",
        c.customerType,
        c.status,
        c.assignedUser?.name || "",
        c.nextFollowupAt ? c.nextFollowupAt.toISOString().slice(0, 10) : "",
      ])
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=customers.xlsx");
    res.send(buffer);
  })
);

router.get(
  "/:id",
  requirePermission("customers", "view"),
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        assignedUser: { select: { id: true, name: true } },
        customerNotes: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
        orders: { orderBy: { createdAt: "desc" } },
        invoices: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const emailLogs = await prisma.emailLog.findMany({
      where: {
        OR: [
          { relatedType: "customer", relatedId: customer.id },
          { relatedType: "invoice", relatedId: { in: customer.invoices.map((i) => i.id) } },
          { relatedType: "order", relatedId: { in: customer.orders.map((o) => o.id) } },
        ],
      },
      include: { sender: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ...customer, emailLogs });
  })
);

const customerSchema = z.object({
  businessName: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  customerType: z.enum(["restaurant", "grocery_store", "supermarket", "distributor", "food_service", "other"]),
  leadSource: z.enum(["facebook", "instagram", "google_ads", "referral", "walk_in", "phone_call", "email", "whatsapp", "other"]),
  interestLevel: z.enum(["cold", "warm", "hot"]).optional(),
  status: z
    .enum(["new_lead", "contacted", "quote_sent", "negotiating", "active_customer", "inactive", "lost"])
    .optional(),
  assignedUserId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  nextFollowupAt: z.string().optional().nullable(),
  lostReason: z.string().optional(),
});

router.post(
  "/",
  requirePermission("customers", "create"),
  asyncHandler(async (req, res) => {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({
      data: {
        ...data,
        email: data.email || undefined,
        nextFollowupAt: data.nextFollowupAt ? new Date(data.nextFollowupAt) : undefined,
        createdBy: req.user!.id,
      },
    });
    await logActivity(req.user!.id, "create_customer", `Created customer ${customer.businessName}`);
    res.status(201).json(customer);
  })
);

router.patch(
  "/:id",
  requirePermission("customers", "edit"),
  asyncHandler(async (req, res) => {
    const data = customerSchema.partial().parse(req.body);

    if (data.status === "lost" && !data.lostReason) {
      const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
      if (!existing?.lostReason) {
        return res.status(400).json({ error: "A lost reason is required when marking a customer as Lost" });
      }
    }

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        ...data,
        email: data.email || undefined,
        nextFollowupAt: data.nextFollowupAt ? new Date(data.nextFollowupAt) : undefined,
      },
    });
    await logActivity(req.user!.id, "update_customer", `Updated customer ${customer.businessName}`);
    res.json(customer);
  })
);

router.delete(
  "/:id",
  requirePermission("customers", "delete"),
  asyncHandler(async (req, res) => {
    await prisma.customer.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

const noteSchema = z.object({
  noteText: z.string().min(1),
  noteType: z.enum(["call", "email", "meeting", "general"]).optional(),
});

router.post(
  "/:id/notes",
  requirePermission("customers", "edit"),
  asyncHandler(async (req, res) => {
    const data = noteSchema.parse(req.body);
    const note = await prisma.customerNote.create({
      data: {
        customerId: req.params.id,
        userId: req.user!.id,
        noteText: data.noteText,
        noteType: data.noteType ?? "general",
      },
      include: { user: { select: { name: true } } },
    });
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { lastContactedAt: new Date() },
    });
    res.status(201).json(note);
  })
);

const followupEmailSchema = z.object({ template: z.enum(["quote_followup", "new_customer_intro", "reorder_reminder"]).optional() });

router.post(
  "/:id/email",
  requirePermission("customers", "edit"),
  asyncHandler(async (req, res) => {
    const { template } = followupEmailSchema.parse(req.body ?? {});
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (!customer.email) {
      return res.status(400).json({ error: "This customer has no email address on file" });
    }

    const rendered = await renderTemplate(template ?? "quote_followup", { customer_name: customer.businessName });

    let status: "sent" | "failed" = "sent";
    try {
      await sendEmail({ to: customer.email, subject: rendered.subject, html: rendered.body });
    } catch {
      status = "failed";
    }

    await prisma.emailLog.create({
      data: {
        relatedType: "customer",
        relatedId: customer.id,
        recipientEmail: customer.email,
        subject: rendered.subject,
        bodySnapshot: rendered.body,
        sentAt: new Date(),
        status,
        sentBy: req.user!.id,
      },
    });
    await prisma.customer.update({ where: { id: customer.id }, data: { lastContactedAt: new Date() } });

    res.json({ status });
  })
);

export default router;
