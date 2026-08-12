import { Router } from "express";
import { body } from "express-validator";
import { Role } from "@prisma/client";
import { login, register, me } from "../controllers/authController";
import { handleValidation } from "../middleware/errorHandler";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post(
  "/login",
  [body("email").isEmail().withMessage("Valid email is required"), body("password").notEmpty().withMessage("Password is required")],
  handleValidation,
  login
);

router.post(
  "/register",
  authenticate,
  authorize(Role.ADMIN),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").isIn(Object.values(Role)).withMessage("Role must be one of ADMIN, SALES, WAREHOUSE, ACCOUNTS"),
  ],
  handleValidation,
  register
);

router.get("/me", authenticate, me);

export default router;
