import express from "express";
import { getProjectFiles, uploadFile } from "../controllers/file.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import { upload } from "../utils/multer"; // Import multer middleware

const router = express.Router();

router.get("/:projectId", getProjectFiles);

router.post(
  "/upload/:projectId",
  verifyToken,
  upload.array("files", 10),
  uploadFile
);

export default router;
