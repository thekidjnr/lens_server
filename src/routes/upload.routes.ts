import express from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { upload } from "../utils/multer";
import { uploadFiles } from "../controllers/upload.controller";

const router = express.Router();

router.post("/", upload.array("files", 10), uploadFiles);

export default router;
