import { Response } from "express";
import { prisma } from "../prisma/client";
import { asyncHandler, ApiError, ok, created } from "../utils/apiResponse";
import { comparePassword, hashPassword, signToken } from "../utils/auth";
import { AuthedRequest } from "../middleware/auth";

// POST /auth/login
export const login = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return ok(res, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /auth/register  (Admin only - creates users for any role)
export const register = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
  });

  return created(res, { id: user.id, name: user.name, email: user.email, role: user.role });
});

// GET /auth/me
export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, "User not found");
  return ok(res, user);
});
