import { Router } from "express";

import { verifyToken } from "../middlewares/auth.middleware";
import {
  addFileToCollection,
  deleteFileFromCollection,
  getFilesByCollection,
} from "../controllers/file.controller";

const router = Router();

router.post("/", verifyToken, addFileToCollection);
router.get("/:slug", verifyToken, getFilesByCollection);
router.delete("/:slug", verifyToken, deleteFileFromCollection);

export default router;
