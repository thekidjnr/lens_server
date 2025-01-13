import express from "express";
import { upload } from "../utils/multer";
import { uploadFiles } from "../controllers/s3.controller";

const router = express.Router();

router.post("/upload", upload.array("files", 10), uploadFiles);

export default router;
