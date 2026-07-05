import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { z } from "zod";
import path from "path";

import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import customersRoutes from "./routes/customers";
import productsRoutes from "./routes/products";
import ordersRoutes from "./routes/orders";
import invoicesRoutes from "./routes/invoices";
import paymentsRoutes from "./routes/payments";
import expensesRoutes from "./routes/expenses";
import tasksRoutes from "./routes/tasks";
import notificationsRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import reportsRoutes from "./routes/reports";
import settingsRoutes from "./routes/settings";
import importRoutes from "./routes/imports";
import activityRoutes from "./routes/activity";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/api/health", (_req, res) => res.json({ status: "OK" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/expenses", expensesRoutes);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/imports", importRoutes);
  app.use("/api/activity", activityRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.errors });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
}
