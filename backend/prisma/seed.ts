import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PERMISSIONS, MODULES } from "../src/utils/permissionMatrix";

const prisma = new PrismaClient();

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Owner: "Full access to every module",
  Sales: "Manages customers, quotes and orders",
  Operations: "Manages orders, dispatch and inventory",
  Accountant: "Manages invoices, payments, expenses and reports",
  Marketing: "Manages marketing and content calendar",
};

async function main() {
  for (const [name, description] of Object.entries(ROLE_DESCRIPTIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });

    const perms = DEFAULT_PERMISSIONS[name];
    for (const moduleName of MODULES) {
      const p = perms[moduleName];
      await prisma.permission.upsert({
        where: { roleId_moduleName: { roleId: role.id, moduleName } },
        update: { canView: p.view, canCreate: p.create, canEdit: p.edit, canDelete: p.delete },
        create: {
          roleId: role.id,
          moduleName,
          canView: p.view,
          canCreate: p.create,
          canEdit: p.edit,
          canDelete: p.delete,
        },
      });
    }
  }

  const settingsCount = await prisma.settings.count();
  if (settingsCount === 0) {
    await prisma.settings.create({
      data: {
        businessName: "MR GRAIN",
        abn: "00 000 000 000",
        businessAddress: "1 Warehouse Rd, Sydney NSW 2000",
        businessEmail: "accounts@mrgrain.com.au",
        businessPhone: "+61 2 0000 0000",
        bankDetails: "BSB: 000-000  Acc: 00000000  MR GRAIN PTY LTD",
        gstRegistered: true,
        defaultPaymentTerms: "14 days",
        invoicePrefix: "INV-",
        quotePrefix: "QUO-",
        orderPrefix: "ORD-",
        invoiceNextNumber: 1000,
        orderNextNumber: 1000,
        quoteNextNumber: 1000,
        expenseCategories: [
          "stock_purchase",
          "packaging",
          "warehouse",
          "rent",
          "delivery_fuel",
          "marketing",
          "staff_wages",
          "software",
          "accountant",
          "bank_fees",
          "other",
        ],
        productTypes: ["basmati", "sella"],
      },
    });
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: "Owner" } });
  const ownerEmail = "owner@mrgrain.com.au";
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existingOwner) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    await prisma.user.create({
      data: {
        name: "MR GRAIN Owner",
        email: ownerEmail,
        passwordHash,
        roleId: ownerRole.id,
        isActive: true,
      },
    });
    console.log(`Seeded default Owner user: ${ownerEmail} / ChangeMe123!`);
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        {
          productName: "Premium Basmati Rice",
          productType: "basmati",
          bagSize: "kg20",
          sku: "BAS-20KG",
          stockBags: 100,
          stockKg: 2000,
          costPrice: 22.0,
          wholesalePrice: 32.0,
          lowStockLevel: 20,
        },
        {
          productName: "Sella Rice",
          productType: "sella",
          bagSize: "kg20",
          sku: "SEL-20KG",
          stockBags: 80,
          stockKg: 1600,
          costPrice: 19.0,
          wholesalePrice: 28.0,
          lowStockLevel: 20,
        },
        {
          productName: "Premium Basmati Rice",
          productType: "basmati",
          bagSize: "kg5",
          sku: "BAS-5KG",
          stockBags: 200,
          stockKg: 1000,
          costPrice: 6.0,
          wholesalePrice: 9.5,
          lowStockLevel: 40,
        },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
