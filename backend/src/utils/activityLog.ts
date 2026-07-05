import { prisma } from "../lib/prisma";

export async function logActivity(userId: string | null, action: string, details?: string) {
  await prisma.activityLog.create({
    data: { userId: userId ?? undefined, action, details },
  });
}
