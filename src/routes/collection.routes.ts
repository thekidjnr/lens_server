import { Router } from "express";
import {
  updateCollection,
  deleteCollection,
  createCollection,
  getCollectionBySlug,
  collectionStatus,
  getCollectionsByWorkspace,
  updateWatermarkConfig,
  getCollectionById,
  getWorkspaceWatermarkProgress,
  cancelWatermarkJob,
  processWatermarkImage, // Add this new import
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import multer from "multer";


const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);

router.get("/workspace/:workspaceSlug/slug/:slug", getCollectionBySlug);

router.patch("/:slug/isPublished", collectionStatus);

router.put("/:collectionId", updateCollection);

router.post( "/:collectionId/watermark", upload.single("image"), updateWatermarkConfig );

router.delete("/:collectionId", deleteCollection);

router.get("/get/:id", getCollectionById);

router.get( "/workspace/:workspaceId/watermark-progress", verifyToken, getWorkspaceWatermarkProgress );

router.get("/:collectionId/cancel-watermark", verifyToken, cancelWatermarkJob);

router.post( "/watermark", upload.fields([ { name: "image", maxCount: 1 }, { name: "watermarkImage", maxCount: 1 },]), processWatermarkImage );

export default router;
