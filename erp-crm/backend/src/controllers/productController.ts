import { Response } from "express";
import { prisma } from "../prisma/client";
import { asyncHandler, ApiError, ok, created, paginationParams } from "../utils/apiResponse";
import { AuthedRequest } from "../middleware/auth";
import { Prisma, MovementType } from "@prisma/client";

// GET /products?search=&category=&lowStock=true&page=&limit=
export const listProducts = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { search, category, lowStock } = req.query;
  const { page, limit, skip } = paginationParams(req);

  const where: Prisma.ProductWhereInput = {
    ...(category ? { category: String(category) } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { sku: { contains: String(search), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  let items = await prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } });
  const total = await prisma.product.count({ where });

  if (lowStock === "true") {
    items = items.filter((p) => p.currentStock <= p.minStockAlert);
  }

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /products/:id  (with recent stock movement log)
export const getProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!product) throw new ApiError(404, "Product not found");
  return ok(res, product);
});

// POST /products
export const createProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, sku, category, unitPrice, currentStock, minStockAlert, location } = req.body;

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        name,
        sku,
        category,
        unitPrice,
        currentStock: currentStock ?? 0,
        minStockAlert: minStockAlert ?? 0,
        location,
      },
    });

    // Log the opening stock as an IN movement so the movement log
    // always reflects the full history of a product's stock.
    if (p.currentStock > 0) {
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          quantity: p.currentStock,
          movementType: MovementType.IN,
          reason: "Opening stock",
          createdById: req.user!.userId,
        },
      });
    }

    return p;
  });

  return created(res, product);
});

// PUT /products/:id  (details only - use /stock-movement to change quantity)
export const updateProduct = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, category, unitPrice, minStockAlert, location } = req.body;

  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Product not found");

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      ...(minStockAlert !== undefined ? { minStockAlert } : {}),
      ...(location !== undefined ? { location } : {}),
    },
  });

  return ok(res, product);
});

// POST /products/:id/stock-movement  - the only way stock quantity changes
export const recordStockMovement = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { quantity, movementType, reason } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: req.params.id } });
    if (!product) throw new ApiError(404, "Product not found");

    const delta = movementType === MovementType.IN ? quantity : -quantity;
    const newStock = product.currentStock + delta;

    if (newStock < 0) {
      throw new ApiError(400, `Insufficient stock. Current stock is ${product.currentStock}, cannot remove ${quantity}.`);
    }

    const updated = await tx.product.update({
      where: { id: req.params.id },
      data: { currentStock: newStock },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: req.params.id,
        quantity,
        movementType,
        reason,
        createdById: req.user!.userId,
      },
    });

    return { product: updated, movement };
  });

  return created(res, result);
});
