import { PrismaClient, Role, CustomerType, CustomerStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("Password@123", 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@erp.com" },
      update: {},
      create: { name: "Admin User", email: "admin@erp.com", password, role: Role.ADMIN },
    }),
    prisma.user.upsert({
      where: { email: "sales@erp.com" },
      update: {},
      create: { name: "Sales User", email: "sales@erp.com", password, role: Role.SALES },
    }),
    prisma.user.upsert({
      where: { email: "warehouse@erp.com" },
      update: {},
      create: { name: "Warehouse User", email: "warehouse@erp.com", password, role: Role.WAREHOUSE },
    }),
    prisma.user.upsert({
      where: { email: "accounts@erp.com" },
      update: {},
      create: { name: "Accounts User", email: "accounts@erp.com", password, role: Role.ACCOUNTS },
    }),
  ]);

  console.log(
    "Seeded users (all passwords: Password@123):\n" + users.map((u) => `  ${u.role.padEnd(10)} -> ${u.email}`).join("\n")
  );

  const customer = await prisma.customer.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Ramesh Traders",
      mobile: "9876543210",
      email: "ramesh@traders.com",
      businessName: "Ramesh Wholesale Pvt Ltd",
      customerType: CustomerType.WHOLESALE,
      address: "MG Road, Bengaluru",
      status: CustomerStatus.ACTIVE,
    },
  });

  const product = await prisma.product.upsert({
    where: { sku: "SKU-001" },
    update: {},
    create: {
      name: "Steel Bracket 4-inch",
      sku: "SKU-001",
      category: "Hardware",
      unitPrice: 45.5,
      currentStock: 500,
      minStockAlert: 50,
      location: "Warehouse A - Rack 3",
    },
  });

  console.log(`Seeded sample customer (${customer.name}) and product (${product.name}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
