import express from "express";
import { upload } from "../utils/multer";
import {
  deleteFileFromS3,
  // refreshPresignedUrl,
  uploadFiles,
} from "../controllers/s3.controller";

const router = express.Router();

router.post("/upload", upload.array("files", 10), uploadFiles);
// router.put("/refresh", refreshPresignedUrl);
router.delete("/delete", deleteFileFromS3);

export default router;
