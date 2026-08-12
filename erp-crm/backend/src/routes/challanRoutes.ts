import { Router } from "express";
import { body, param } from "express-validator";
import { Role, ChallanStatus } from "@prisma/client";
import { listChallans, getChallan, createChallan, confirmChallan, cancelChallan } from "../controllers/challanController";
import { handleValidation } from "../middleware/errorHandler";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", listChallans);
router.get("/:id", param("id").isUUID(), handleValidation, getChallan);

router.post(
  "/",
  authorize(Role.ADMIN, Role.SALES),
  [
    body("customerId").isUUID().withMessage("Valid customerId is required"),
    body("status").optional().isIn(Object.values(ChallanStatus)),
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.productId").isUUID().withMessage("Each item needs a valid productId"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Each item needs a quantity of at least 1"),
  ],
  handleValidation,
  createChallan
);

router.patch("/:id/confirm", authorize(Role.ADMIN, Role.SALES), param("id").isUUID(), handleValidation, confirmChallan);
router.patch("/:id/cancel", authorize(Role.ADMIN, Role.SALES), param("id").isUUID(), handleValidation, cancelChallan);

export default router;
