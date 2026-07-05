import { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function nextOrderNumber(tx: Tx): Promise<string> {
  const settings = await tx.settings.findFirstOrThrow();
  const number = settings.orderNextNumber;
  await tx.settings.update({ where: { id: settings.id }, data: { orderNextNumber: number + 1 } });
  return `${settings.orderPrefix}${number}`;
}

export async function nextInvoiceNumber(tx: Tx): Promise<string> {
  const settings = await tx.settings.findFirstOrThrow();
  const number = settings.invoiceNextNumber;
  await tx.settings.update({ where: { id: settings.id }, data: { invoiceNextNumber: number + 1 } });
  return `${settings.invoicePrefix}${number}`;
}
