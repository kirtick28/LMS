import express from "express";
import { getFacultyDashboard } from "../controllers/facultyDashboard.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/dashboard",
  protect,
  authorize("FACULTY"),
  getFacultyDashboard
);

export default router;