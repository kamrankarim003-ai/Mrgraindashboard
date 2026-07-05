import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logActivity } from "../utils/activityLog";
import { notifyUser, notifyRole } from "../utils/notify";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  requirePermission("tasks", "view"),
  asyncHandler(async (req, res) => {
    const { assignedTo, priority, status, dueBefore, scope } = req.query as Record<string, string>;
    const where: any = {};
    if (scope !== "all") {
      where.assignedTo = req.user!.id;
    } else if (req.user!.roleName !== "Owner") {
      where.assignedTo = req.user!.id;
    }
    if (assignedTo) where.assignedTo = assignedTo;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (dueBefore) where.dueDate = { lte: new Date(dueBefore) };

    const tasks = await prisma.task.findMany({
      where,
      include: { assignee: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }],
    });
    res.json(tasks);
  })
);

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().optional().nullable(),
  relatedType: z.enum(["customer", "order", "invoice", "campaign"]).optional().nullable(),
  relatedId: z.string().optional().nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  reminderAt: z.string().optional().nullable(),
  notes: z.string().optional(),
  status: z.enum(["not_started", "in_progress", "waiting", "completed", "cancelled"]).optional(),
});

router.post(
  "/",
  requirePermission("tasks", "create"),
  asyncHandler(async (req, res) => {
    const data = taskSchema.parse(req.body);
    const task = await prisma.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : undefined,
        createdBy: req.user!.id,
      },
    });
    if (task.assignedTo && task.assignedTo !== req.user!.id) {
      await notifyUser(task.assignedTo, "task_assigned", `You were assigned a task: ${task.title}`, "task", task.id);
    }
    res.status(201).json(task);
  })
);

function nextDueDate(current: Date, recurrence: string): Date {
  const next = new Date(current);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  if (recurrence === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

router.patch(
  "/:id",
  requirePermission("tasks", "edit"),
  asyncHandler(async (req, res) => {
    const data = taskSchema.partial().parse(req.body);
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : undefined,
      },
    });

    if (data.status === "completed" && existing.status !== "completed" && existing.recurrence !== "none" && existing.dueDate) {
      const newDueDate = nextDueDate(existing.dueDate, existing.recurrence);
      await prisma.task.create({
        data: {
          title: existing.title,
          description: existing.description,
          assignedTo: existing.assignedTo,
          priority: existing.priority,
          dueDate: newDueDate,
          relatedType: existing.relatedType,
          relatedId: existing.relatedId,
          recurrence: existing.recurrence,
          notes: existing.notes,
          createdBy: existing.createdBy,
        },
      });
      await notifyRole("Owner", "task_completed", `A recurring task "${existing.title}" was completed and rescheduled`, "task", task.id);
    }

    await logActivity(req.user!.id, "update_task", `Updated task "${task.title}"`);
    res.json(task);
  })
);

router.delete(
  "/:id",
  requirePermission("tasks", "delete"),
  asyncHandler(async (req, res) => {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
