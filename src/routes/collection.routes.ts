import { Router } from "express";
import {
  // Core collection operations
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionById,
  getCollectionBySlug,
  getCollectionsByWorkspace,
  collectionStatus,
  // Watermark operations
  updateWatermarkConfig,
  getWorkspaceWatermarkProgress,
  getCollectionWatermarkProgress,
  cancelWatermarkJob,
  processWatermarkImage,
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import multer from "multer";

const router = Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// ============================================================================
// CORE COLLECTION ROUTES
// ============================================================================

// Create new collection
router.post("/", verifyToken, createCollection);

// Get collections by workspace
router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);

// Get collection by slug (public route)
router.get("/workspace/:workspaceSlug/slug/:slug", getCollectionBySlug);

// Get collection by ID
router.get("/:id", getCollectionById);

// Update collection
router.put("/:collectionId", updateCollection);

// Update collection publish status
router.patch("/:slug/isPublished", collectionStatus);

// Delete collection
router.delete("/:collectionId", deleteCollection);

// ============================================================================
// WATERMARK ROUTES
// ============================================================================

// Update watermark configuration with image upload
router.post(
  "/:collectionId/watermark",
  upload.single("image"),
  updateWatermarkConfig
);

// Get watermark progress for entire workspace
router.get(
  "/workspace/:workspaceId/watermark-progress",
  verifyToken,
  getWorkspaceWatermarkProgress
);

// Get watermark progress for specific collection
router.get("/:collectionId/watermark-progress", getCollectionWatermarkProgress);

// Cancel watermark job
router.get("/:collectionId/cancel-watermark", verifyToken, cancelWatermarkJob);

// Process watermark image (utility endpoint)
router.post(
  "/watermark",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "watermarkImage", maxCount: 1 },
  ]),
  processWatermarkImage
);

export default router;
