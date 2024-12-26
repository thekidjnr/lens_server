import express from "express";
import { upload } from "../utils/multer";
import { uploadFiles } from "../controllers/upload.controller";

const router = express.Router();

router.post("/", upload.array("files", 10), uploadFiles);

export default router;
