import { Response } from "express";
import { prisma } from "../prisma/client";
import { asyncHandler, ApiError, ok, created, paginationParams } from "../utils/apiResponse";
import { AuthedRequest } from "../middleware/auth";
import { Prisma } from "@prisma/client";

// GET /customers?search=&status=&type=&page=&limit=
export const listCustomers = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { search, status, customerType } = req.query;
  const { page, limit, skip } = paginationParams(req);

  const where: Prisma.CustomerWhereInput = {
    ...(status ? { status: status as any } : {}),
    ...(customerType ? { customerType: customerType as any } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: String(search), mode: "insensitive" } },
            { mobile: { contains: String(search) } },
            { email: { contains: String(search), mode: "insensitive" } },
            { businessName: { contains: String(search), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.customer.count({ where }),
  ]);

  return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /customers/:id  (with follow-up notes + recent challans)
export const getCustomer = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      followUpNotes: { orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true } } } },
      challans: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  return ok(res, customer);
});

// POST /customers
export const createCustomer = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate, notes } = req.body;

  const customer = await prisma.customer.create({
    data: {
      name,
      mobile,
      email,
      businessName,
      gstNumber,
      customerType,
      address,
      status,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      ...(notes
        ? { followUpNotes: { create: { note: notes, createdById: req.user!.userId } } }
        : {}),
    },
  });

  return created(res, customer);
});

// PUT /customers/:id
export const updateCustomer = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, mobile, email, businessName, gstNumber, customerType, address, status, followUpDate } = req.body;

  const existing = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, "Customer not found");

  const customer = await prisma.customer.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(mobile !== undefined ? { mobile } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(businessName !== undefined ? { businessName } : {}),
      ...(gstNumber !== undefined ? { gstNumber } : {}),
      ...(customerType !== undefined ? { customerType } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(followUpDate !== undefined ? { followUpDate: followUpDate ? new Date(followUpDate) : null } : {}),
    },
  });

  return ok(res, customer);
});

// POST /customers/:id/notes
export const addFollowUpNote = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { note } = req.body;

  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw new ApiError(404, "Customer not found");

  const created_ = await prisma.followUpNote.create({
    data: { customerId: req.params.id, note, createdById: req.user!.userId },
  });

  return created(res, created_);
});
