import { Router } from "express";

import { verifyToken } from "../middlewares/auth.middleware";
import {
  addFileToCollection,
  getFilesByCollection,
} from "../controllers/file.controller";

const router = Router();

router.post("/", verifyToken, addFileToCollection);
router.get("/:collectionId", verifyToken, getFilesByCollection);

export default router;
