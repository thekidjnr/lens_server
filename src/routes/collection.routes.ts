import { Router } from "express";
import {
  getCollectionsByCreator,
  getCollectionById,
  updateCollection,
  deleteCollection,
  createCollection,
} from "../controllers/collection.controller";
import multer from "multer"; // For file upload
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Multer configuration for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/creator", verifyToken, getCollectionsByCreator);

router.get("/:id", getCollectionById);
router.put("/:collectionId", updateCollection);
router.delete("/:collectionId", deleteCollection);

export default router;
