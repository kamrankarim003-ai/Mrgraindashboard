import { prisma } from "../lib/prisma";

export async function notifyUser(userId: string, type: string, message: string, relatedType?: string, relatedId?: string) {
  await prisma.notification.create({
    data: { userId, type, message, relatedType, relatedId },
  });
}

export async function notifyRole(roleName: string, type: string, message: string, relatedType?: string, relatedId?: string) {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { name: roleName } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type, message, relatedType, relatedId })),
  });
}

export async function notifyOwnerAndAccountant(type: string, message: string, relatedType?: string, relatedId?: string) {
  await notifyRole("Owner", type, message, relatedType, relatedId);
  await notifyRole("Accountant", type, message, relatedType, relatedId);
}
