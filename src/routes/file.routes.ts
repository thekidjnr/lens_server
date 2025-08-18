import { Router } from "express";

import { verifyToken } from "../middlewares/auth.middleware";
import {
  addFileToCollection,
  deleteFileFromCollection,
  getFilesByCollection,
  getOriginalFilesByCollection,
} from "../controllers/file.controller";

const router = Router();

router.post("/", verifyToken, addFileToCollection);
router.get("/:slug", getFilesByCollection);
router.get("/original/:slug", getOriginalFilesByCollection);
router.delete("/:fileId", verifyToken, deleteFileFromCollection);

export default router;
