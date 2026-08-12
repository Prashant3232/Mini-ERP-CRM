import { Router } from "express";
import { body, param } from "express-validator";
import { Role, MovementType } from "@prisma/client";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  recordStockMovement,
} from "../controllers/productController";
import { handleValidation } from "../middleware/errorHandler";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", listProducts);
router.get("/:id", param("id").isUUID(), handleValidation, getProduct);

router.post(
  "/",
  authorize(Role.ADMIN, Role.WAREHOUSE),
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("unitPrice").isFloat({ min: 0 }).withMessage("Unit price must be a positive number"),
    body("currentStock").optional().isInt({ min: 0 }),
    body("minStockAlert").optional().isInt({ min: 0 }),
  ],
  handleValidation,
  createProduct
);

router.put(
  "/:id",
  authorize(Role.ADMIN, Role.WAREHOUSE),
  [param("id").isUUID(), body("unitPrice").optional().isFloat({ min: 0 })],
  handleValidation,
  updateProduct
);

router.post(
  "/:id/stock-movement",
  authorize(Role.ADMIN, Role.WAREHOUSE),
  [
    param("id").isUUID(),
    body("quantity").isInt({ min: 1 }).withMessage("Quantity must be a positive integer"),
    body("movementType").isIn(Object.values(MovementType)).withMessage("movementType must be IN or OUT"),
    body("reason").optional().isString(),
  ],
  handleValidation,
  recordStockMovement
);

export default router;
