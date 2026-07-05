import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { notifyOwnerAndAccountant } from "./notify";
import { runDatabaseBackup } from "./backup";

export async function checkOverdueInvoices() {
  const overdue = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: new Date() },
      balanceDue: { gt: 0 },
      status: { notIn: ["paid", "cancelled", "overdue"] },
    },
  });

  for (const invoice of overdue) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "overdue" } });
    await notifyOwnerAndAccountant(
      "invoice_overdue",
      `Invoice ${invoice.invoiceNumber} is now overdue ($${Number(invoice.balanceDue).toFixed(2)} outstanding)`,
      "invoice",
      invoice.id
    );
  }

  return overdue.length;
}

export function startCronJobs() {
  // Runs once a day at 06:00 server time to flag overdue invoices.
  cron.schedule("0 6 * * *", () => {
    checkOverdueInvoices().catch((err) => console.error("Overdue invoice check failed", err));
  });

  // Runs once a day at 02:00 server time to back up the database.
  cron.schedule("0 2 * * *", () => {
    runDatabaseBackup()
      .then((file) => console.log(`Database backup written to ${file}`))
      .catch((err) => console.error("Database backup failed", err));
  });

  // Also run the overdue check once at startup so the effect is visible without waiting for the schedule.
  checkOverdueInvoices().catch((err) => console.error("Overdue invoice check failed", err));
}
