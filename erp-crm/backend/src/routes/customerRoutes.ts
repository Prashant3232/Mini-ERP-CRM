import { Router } from "express";
import { body, param } from "express-validator";
import { Role, CustomerType, CustomerStatus } from "@prisma/client";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  addFollowUpNote,
} from "../controllers/customerController";
import { handleValidation } from "../middleware/errorHandler";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// All customer routes require login. Admin + Sales can manage customers;
// Warehouse/Accounts can view (read-only) since CRM is a sales-driven module.
router.use(authenticate);

router.get("/", listCustomers);
router.get("/:id", param("id").isUUID(), handleValidation, getCustomer);

router.post(
  "/",
  authorize(Role.ADMIN, Role.SALES),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("mobile").notEmpty().withMessage("Mobile number is required"),
    body("email").optional().isEmail().withMessage("Must be a valid email"),
    body("customerType").optional().isIn(Object.values(CustomerType)),
    body("status").optional().isIn(Object.values(CustomerStatus)),
  ],
  handleValidation,
  createCustomer
);

router.put(
  "/:id",
  authorize(Role.ADMIN, Role.SALES),
  [
    param("id").isUUID(),
    body("email").optional().isEmail(),
    body("customerType").optional().isIn(Object.values(CustomerType)),
    body("status").optional().isIn(Object.values(CustomerStatus)),
  ],
  handleValidation,
  updateCustomer
);

router.post(
  "/:id/notes",
  authorize(Role.ADMIN, Role.SALES),
  [param("id").isUUID(), body("note").notEmpty().withMessage("Note text is required")],
  handleValidation,
  addFollowUpNote
);

export default router;
