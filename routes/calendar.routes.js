import express from "express";
import { getCalendar } from "../controllers/calendar.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getCalendar);

export default router;
