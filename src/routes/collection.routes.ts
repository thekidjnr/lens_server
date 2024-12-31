import { Router } from "express";
import {
  getCollectionsByCreator,
  getCollectionById,
  updateCollection,
  deleteCollection,
  createCollection,
  getCollectionBySlug,
  collectionStatus,
} from "../controllers/collection.controller";
import multer from "multer"; // For file upload
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Multer configuration for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/creator", verifyToken, getCollectionsByCreator);
router.get("/id/:id", getCollectionById);
router.get("/workspace/:workspaceId/slug/:slug", getCollectionBySlug);

router.patch("/:slug/isPublished", collectionStatus);
router.put("/:collectionId", updateCollection);

router.delete("/:collectionId", deleteCollection);

export default router;
