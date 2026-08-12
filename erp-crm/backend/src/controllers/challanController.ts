import { Response } from "express";
import { prisma } from "../prisma/client";
import { asyncHandler, ApiError, ok, created, paginationParams } from "../utils/apiResponse";
import { AuthedRequest } from "../middleware/auth";
import { ChallanStatus, MovementType, Prisma } from "@prisma/client";

// Generates a sequential challan number like CH-2026-0001
async function generateChallanNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.challan.count({
    where: { challanNumber: { startsWith: `CH-${year}-` } },
  });
  const next = String(count + 1).padStart(4, "0");
  return `CH-${year}-${next}`;
}

// GET /challans?status=&customerId=&page=&limit=
export const listChallans = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { status, customerId } = req.query;
  const { page, limit, skip } = paginationParams(req);

  const where: Prisma.ChallanWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(customerId ? { customerId: String(customerId) } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.challan.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true, businessName: true } }, items: true },
    }),
    prisma.challan.count({ where }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /challans/:id
export const getChallan = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const challan = await prisma.challan.findUnique({
    where: { id: req.params.id },
    include: { customer: true, items: true, createdBy: { select: { name: true } } },
  });
  if (!challan) throw new ApiError(404, "Challan not found");
  return ok(res, challan);
});

// POST /challans
// body: { customerId, status?: "DRAFT"|"CONFIRMED", items: [{ productId, quantity }] }
// If status is CONFIRMED, stock is deducted atomically; insufficient stock aborts the whole request.
export const createChallan = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { customerId, status, items } = req.body as {
    customerId: string;
    status?: ChallanStatus;
    items: { productId: string; quantity: number }[];
  };

  const desiredStatus = status === ChallanStatus.CONFIRMED ? ChallanStatus.CONFIRMED : ChallanStatus.DRAFT;

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new ApiError(404, "Customer not found");

    // Snapshot every product's current data at the moment of the challan.
    const products = await tx.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
    if (products.length !== new Set(items.map((i) => i.productId)).size) {
      throw new ApiError(404, "One or more products were not found");
    }
    const productMap = new Map(products.map((p) => [p.id, p]));

    // If confirming immediately, validate stock BEFORE writing anything.
    if (desiredStatus === ChallanStatus.CONFIRMED) {
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        if (product.currentStock < item.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.currentStock}, requested: ${item.quantity}.`
          );
        }
      }
    }

    const challanNumber = await generateChallanNumber(tx);
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    const challan = await tx.challan.create({
      data: {
        challanNumber,
        customerId,
        status: desiredStatus,
        totalQuantity,
        createdById: req.user!.userId,
        items: {
          create: items.map((i) => {
            const product = productMap.get(i.productId)!;
            return {
              productId: i.productId,
              productNameSnapshot: product.name,
              productSkuSnapshot: product.sku,
              unitPriceSnapshot: product.unitPrice,
              quantity: i.quantity,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Deduct stock + log movements only when confirmed on creation.
    if (desiredStatus === ChallanStatus.CONFIRMED) {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: MovementType.OUT,
            reason: `Sales challan ${challanNumber}`,
            createdById: req.user!.userId,
          },
        });
      }
    }

    return challan;
  });

  return created(res, result);
});

// PATCH /challans/:id/confirm  - moves a DRAFT challan to CONFIRMED and deducts stock
export const confirmChallan = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const result = await prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!challan) throw new ApiError(404, "Challan not found");
    if (challan.status !== ChallanStatus.DRAFT) {
      throw new ApiError(400, `Only DRAFT challans can be confirmed (current status: ${challan.status})`);
    }

    const productIds = challan.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate ALL items have sufficient stock before deducting any of them.
    for (const item of challan.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new ApiError(404, `Product referenced by this challan no longer exists`);
      if (product.currentStock < item.quantity) {
        throw new ApiError(
          400,
          `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.currentStock}, requested: ${item.quantity}.`
        );
      }
    }

    for (const item of challan.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { currentStock: { decrement: item.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          movementType: MovementType.OUT,
          reason: `Sales challan ${challan.challanNumber}`,
          createdById: req.user!.userId,
        },
      });
    }

    return tx.challan.update({
      where: { id: req.params.id },
      data: { status: ChallanStatus.CONFIRMED },
      include: { items: true, customer: true },
    });
  });

  return ok(res, result);
});

// PATCH /challans/:id/cancel
// If the challan was already CONFIRMED, stock is restored (reverse movement logged).
export const cancelChallan = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const result = await prisma.$transaction(async (tx) => {
    const challan = await tx.challan.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!challan) throw new ApiError(404, "Challan not found");
    if (challan.status === ChallanStatus.CANCELLED) {
      throw new ApiError(400, "Challan is already cancelled");
    }

    if (challan.status === ChallanStatus.CONFIRMED) {
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: MovementType.IN,
            reason: `Cancellation of challan ${challan.challanNumber} - stock restored`,
            createdById: req.user!.userId,
          },
        });
      }
    }

    return tx.challan.update({ where: { id: req.params.id }, data: { status: ChallanStatus.CANCELLED } });
  });

  return ok(res, result);
});
