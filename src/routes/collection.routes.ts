import { Router } from "express";
import {
  updateCollection,
  deleteCollection,
  createCollection,
  getCollectionBySlug,
  collectionStatus,
  getCollectionsByWorkspace,
  generateWatermark,
  getWatermarkingProgress,
  getCollectionById,
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);
router.get("/workspace/:workspaceSlug/slug/:slug", getCollectionBySlug);

router.patch("/:slug/isPublished", collectionStatus);
router.put("/:collectionId", updateCollection);

router.delete("/:collectionId", deleteCollection);

// Watermark generation route
router.post("/:collectionId/watermark", verifyToken, generateWatermark);

// Add this route with your other routes
router.get(
  "/:collectionId/watermarking-progress",
  verifyToken,
  getWatermarkingProgress
);
router.get("/:collectionId", verifyToken, getCollectionById);
export default router;
