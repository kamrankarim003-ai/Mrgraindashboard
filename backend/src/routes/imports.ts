import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { upload } from "../utils/upload";
import { parseUploadedWorkbook } from "../utils/importParse";
import { exportRowsToExcel } from "../utils/exportExcel";
import { ModuleName } from "../utils/permissionMatrix";

const router = Router();
router.use(requireAuth);

const CUSTOMER_TYPES = ["restaurant", "grocery_store", "supermarket", "distributor", "food_service", "other"];
const LEAD_SOURCES = ["facebook", "instagram", "google_ads", "referral", "walk_in", "phone_call", "email", "whatsapp", "other"];
const PRODUCT_TYPES = ["basmati", "sella"];
const BAG_SIZES = ["kg1", "kg5", "kg20"];
const EXPENSE_CATEGORIES = [
  "stock_purchase", "packaging", "warehouse", "rent", "delivery_fuel", "marketing", "staff_wages", "software", "accountant", "bank_fees", "other",
];

type ImportSpec = {
  module: ModuleName;
  templateHeaders: string[];
  validate: (row: Record<string, string>) => { errors: string[]; parsed?: any };
  commit: (parsed: any, userId: string) => Promise<void>;
};

const SPECS: Record<string, ImportSpec> = {
  customers: {
    module: "customers",
    templateHeaders: ["business_name", "contact_person", "phone", "email", "address", "suburb", "state", "postcode", "customer_type", "lead_source"],
    validate: (row) => {
      const errors: string[] = [];
      if (!row.business_name) errors.push("business_name is required");
      if (!row.customer_type || !CUSTOMER_TYPES.includes(row.customer_type)) errors.push(`customer_type must be one of ${CUSTOMER_TYPES.join(", ")}`);
      if (!row.lead_source || !LEAD_SOURCES.includes(row.lead_source)) errors.push(`lead_source must be one of ${LEAD_SOURCES.join(", ")}`);
      return { errors, parsed: row };
    },
    commit: async (row, userId) => {
      await prisma.customer.create({
        data: {
          businessName: row.business_name,
          contactPerson: row.contact_person || undefined,
          phone: row.phone || undefined,
          email: row.email || undefined,
          address: row.address || undefined,
          suburb: row.suburb || undefined,
          state: row.state || undefined,
          postcode: row.postcode || undefined,
          customerType: row.customer_type,
          leadSource: row.lead_source,
          createdBy: userId,
        },
      });
    },
  },

  products: {
    module: "inventory",
    templateHeaders: ["product_name", "product_type", "bag_size", "sku", "cost_price", "wholesale_price", "low_stock_level"],
    validate: (row) => {
      const errors: string[] = [];
      if (!row.product_name) errors.push("product_name is required");
      if (!row.product_type || !PRODUCT_TYPES.includes(row.product_type)) errors.push(`product_type must be one of ${PRODUCT_TYPES.join(", ")}`);
      if (!row.bag_size || !BAG_SIZES.includes(row.bag_size)) errors.push(`bag_size must be one of ${BAG_SIZES.join(", ")}`);
      if (!row.sku) errors.push("sku is required");
      if (!row.cost_price || isNaN(Number(row.cost_price))) errors.push("cost_price must be a number");
      if (!row.wholesale_price || isNaN(Number(row.wholesale_price))) errors.push("wholesale_price must be a number");
      return { errors, parsed: row };
    },
    commit: async (row) => {
      await prisma.product.create({
        data: {
          productName: row.product_name,
          productType: row.product_type,
          bagSize: row.bag_size,
          sku: row.sku,
          costPrice: Number(row.cost_price),
          wholesalePrice: Number(row.wholesale_price),
          lowStockLevel: row.low_stock_level ? Number(row.low_stock_level) : 10,
          stockBags: 0,
          stockKg: 0,
        },
      });
    },
  },

  expenses: {
    module: "expenses",
    templateHeaders: ["date", "category", "supplier_name", "amount", "gst_included", "payment_method", "notes"],
    validate: (row) => {
      const errors: string[] = [];
      if (!row.date || isNaN(Date.parse(row.date))) errors.push("date must be a valid date (YYYY-MM-DD)");
      if (!row.category || !EXPENSE_CATEGORIES.includes(row.category)) errors.push(`category must be one of ${EXPENSE_CATEGORIES.join(", ")}`);
      if (!row.amount || isNaN(Number(row.amount))) errors.push("amount must be a number");
      return { errors, parsed: row };
    },
    commit: async (row, userId) => {
      await prisma.expense.create({
        data: {
          date: new Date(row.date),
          category: row.category,
          supplierName: row.supplier_name || undefined,
          amount: Number(row.amount),
          gstIncluded: /^(true|yes|1)$/i.test(row.gst_included || ""),
          paymentMethod: (row.payment_method as any) || undefined,
          notes: row.notes || undefined,
          enteredBy: userId,
        },
      });
    },
  },

  inventory: {
    module: "inventory",
    templateHeaders: ["sku", "quantity_bags", "notes"],
    validate: (row) => {
      const errors: string[] = [];
      if (!row.sku) errors.push("sku is required");
      if (!row.quantity_bags || isNaN(Number(row.quantity_bags))) errors.push("quantity_bags must be a number");
      return { errors, parsed: row };
    },
    commit: async (row, userId) => {
      const product = await prisma.product.findUnique({ where: { sku: row.sku } });
      if (!product) throw new Error(`No product with SKU ${row.sku}`);
      const bags = Number(row.quantity_bags);
      const size = product.bagSize === "kg1" ? 1 : product.bagSize === "kg5" ? 5 : 20;
      const kg = size * bags;
      await prisma.$transaction([
        prisma.product.update({ where: { id: product.id }, data: { stockBags: { increment: bags }, stockKg: { increment: kg } } }),
        prisma.inventoryMovement.create({
          data: { productId: product.id, movementType: "stock_in", quantityBags: bags, quantityKg: kg, notes: row.notes || "Bulk import", userId },
        }),
      ]);
    },
  },

  orders: {
    module: "orders",
    templateHeaders: ["customer_business_name", "product_sku", "quantity_bags", "delivery_date"],
    validate: (row) => {
      const errors: string[] = [];
      if (!row.customer_business_name) errors.push("customer_business_name is required");
      if (!row.product_sku) errors.push("product_sku is required");
      if (!row.quantity_bags || isNaN(Number(row.quantity_bags))) errors.push("quantity_bags must be a number");
      return { errors, parsed: row };
    },
    commit: async (row, userId) => {
      const customer = await prisma.customer.findFirst({ where: { businessName: row.customer_business_name } });
      if (!customer) throw new Error(`No customer named "${row.customer_business_name}"`);
      const product = await prisma.product.findUnique({ where: { sku: row.product_sku } });
      if (!product) throw new Error(`No product with SKU ${row.product_sku}`);
      const bags = Number(row.quantity_bags);
      const size = product.bagSize === "kg1" ? 1 : product.bagSize === "kg5" ? 5 : 20;
      const kg = size * bags;
      const pricePerKg = Number(product.wholesalePrice);
      const subtotal = pricePerKg * kg;

      await prisma.$transaction(async (tx) => {
        const settings = await tx.settings.findFirstOrThrow();
        const orderNumber = `${settings.orderPrefix}${settings.orderNextNumber}`;
        await tx.settings.update({ where: { id: settings.id }, data: { orderNextNumber: settings.orderNextNumber + 1 } });
        await tx.order.create({
          data: {
            orderNumber,
            customerId: customer.id,
            deliveryDate: row.delivery_date ? new Date(row.delivery_date) : undefined,
            totalValue: subtotal,
            createdBy: userId,
            items: {
              create: [{
                productId: product.id,
                quantityBags: bags,
                quantityKg: kg,
                pricePerKg,
                pricePerBag: pricePerKg * size,
                subtotal,
              }],
            },
          },
        });
      });
    },
  },
};

router.get(
  "/:module/template",
  asyncHandler(async (req, res) => {
    const spec = SPECS[req.params.module];
    if (!spec) return res.status(404).json({ error: "Unknown import module" });
    const buffer = await exportRowsToExcel(`${req.params.module} template`, spec.templateHeaders, []);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${req.params.module}-template.xlsx`);
    res.send(buffer);
  })
);

router.post(
  "/:module/preview",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const spec = SPECS[req.params.module];
    if (!spec) return res.status(404).json({ error: "Unknown import module" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Enforce view permission on the underlying module at minimum; create is checked at commit time per-row.
    const permission = await prisma.permission.findUnique({
      where: { roleId_moduleName: { roleId: req.user!.roleId, moduleName: spec.module } },
    });
    if (!permission?.canCreate) {
      return res.status(403).json({ error: `Your role cannot import into ${spec.module}` });
    }

    const fs = await import("fs");
    const buffer = fs.readFileSync(req.file.path);
    const { rows } = await parseUploadedWorkbook(buffer);

    const preview = rows.map((row) => {
      const { errors, parsed } = spec.validate(row);
      return { data: parsed ?? row, errors };
    });

    res.json({ headers: spec.templateHeaders, rows: preview });
  })
);

const commitPermission = (moduleName: ModuleName) => requirePermission(moduleName, "create");

router.post(
  "/:module/commit",
  asyncHandler(async (req, res, next) => {
    const spec = SPECS[req.params.module];
    if (!spec) return res.status(404).json({ error: "Unknown import module" });
    return commitPermission(spec.module)(req, res, next);
  }),
  asyncHandler(async (req, res) => {
    const spec = SPECS[req.params.module];
    const rows: Record<string, string>[] = req.body.rows || [];
    let created = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { errors: rowErrors } = spec.validate(rows[i]);
      if (rowErrors.length > 0) {
        errors.push({ row: i + 1, error: rowErrors.join("; ") });
        continue;
      }
      try {
        await spec.commit(rows[i], req.user!.id);
        created++;
      } catch (err) {
        errors.push({ row: i + 1, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    res.json({ created, errors });
  })
);

export default router;
