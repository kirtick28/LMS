import express from "express";
import multer from "multer";
import {
  addFaculty,
  updateFaculty,
  deleteFaculty,
  uploadMultipleFaculty,
  getAllFaculty,
  getDepartmentWise,
  getDepartmentWiseFaculty,
  getDepartmentWiseFacultyList,
  getDashboardStats,
  getMyInfo,
} from "../controllers/faculty.controller.js";
import { protect, authorize } from "../middlewares/auth.middleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.post("/", authorize("ADMIN"), addFaculty);
router.get("/me", authorize("FACULTY", "ADMIN", "HOD"), getMyInfo);
router.post(
  "/upload",
  authorize("ADMIN"),
  upload.single("file"),
  uploadMultipleFaculty,
);
router.put(
  "/:id",
  authorize("ADMIN"),
  upload.fields([
    { name: "marksheet", maxCount: 1 },
    { name: "experienceCertificate", maxCount: 1 },
    { name: "degreeCertificate", maxCount: 1 },
  ]),
  updateFaculty,
);
router.delete("/:id", authorize("ADMIN"), deleteFaculty);
router.get("/", authorize("FACULTY", "ADMIN", "HOD"), getAllFaculty);
router.get(
  "/department-wise",
  authorize("FACULTY", "ADMIN"),
  getDepartmentWise,
);
router.get(
  "/department-wise/:department",
  authorize("FACULTY", "ADMIN"),
  getDepartmentWiseFaculty,
);
router.get(
  "/department-wise/:department/list",
  authorize("FACULTY", "ADMIN"),
  getDepartmentWiseFacultyList,
);
router.get(
  "/dashboard/stats",
  authorize("FACULTY", "ADMIN"),
  getDashboardStats,
);

export default router;
