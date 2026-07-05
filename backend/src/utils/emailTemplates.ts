import { prisma } from "../lib/prisma";

export const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  new_customer_intro: {
    subject: "Welcome to MR GRAIN, {{customer_name}}!",
    body: "<p>Hi {{customer_name}},</p><p>Thanks for your interest in MR GRAIN. We look forward to working with you.</p>",
  },
  quote_followup: {
    subject: "Following up on your MR GRAIN quote",
    body: "<p>Hi {{customer_name}},</p><p>Just checking in on the quote we sent. Let us know if you have any questions.</p>",
  },
  order_confirmation: {
    subject: "Order {{order_number}} confirmed",
    body: "<p>Hi {{customer_name}},</p><p>Your order {{order_number}} has been confirmed and is being prepared.</p>",
  },
  invoice_sent: {
    subject: "Invoice {{invoice_number}} from MR GRAIN",
    body: "<p>Hi {{customer_name}},</p><p>Please find attached invoice {{invoice_number}} for ${{amount_due}}, due {{due_date}}.</p>",
  },
  payment_reminder: {
    subject: "Reminder: Invoice {{invoice_number}} payment due",
    body: "<p>Hi {{customer_name}},</p><p>This is a friendly reminder that invoice {{invoice_number}} for ${{amount_due}} was due {{due_date}}.</p>",
  },
  thank_you_payment: {
    subject: "Thank you for your payment",
    body: "<p>Hi {{customer_name}},</p><p>We've received your payment. Thank you!</p>",
  },
  delivery_confirmation: {
    subject: "Order {{order_number}} has been delivered",
    body: "<p>Hi {{customer_name}},</p><p>Your order {{order_number}} has been delivered. Thanks for choosing MR GRAIN.</p>",
  },
  reorder_reminder: {
    subject: "Time to reorder from MR GRAIN?",
    body: "<p>Hi {{customer_name}},</p><p>It's been a while since your last order - let us know if you'd like to reorder.</p>",
  },
};

export async function renderTemplate(
  key: string,
  placeholders: Record<string, string>
): Promise<{ subject: string; body: string }> {
  const settings = await prisma.settings.findFirst();
  const customTemplates = (settings?.emailTemplates as Record<string, { subject: string; body: string }>) || {};
  const template = customTemplates[key] || DEFAULT_TEMPLATES[key] || DEFAULT_TEMPLATES.invoice_sent;

  const replace = (text: string) =>
    text.replace(/{{\s*(\w+)\s*}}/g, (_match, name) => placeholders[name] ?? "");

  return { subject: replace(template.subject), body: replace(template.body) };
}
