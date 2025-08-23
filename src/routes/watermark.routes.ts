import { Router } from "express";
import {
  updateWatermarkConfig,
  getWorkspaceWatermarkProgress,
  getCollectionWatermarkProgress,
  cancelWatermarkJob,
  processWatermarkImage,
  checkAndRemoveQueuedWatermark,
  removeAllQueuedWatermarks,
} from "../controllers/watermakr.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import multer from "multer";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/:collectionId/watermark",
  upload.single("image"),
  updateWatermarkConfig
);

router.get(
  "/workspace/:workspaceId/watermark-progress",
  verifyToken,
  getWorkspaceWatermarkProgress
);

router.get("/:collectionId/watermark-progress", getCollectionWatermarkProgress);

router.get("/cancel-watermark/:collectionId", verifyToken, cancelWatermarkJob);

router.get(
  "/:collectionId/check-and-remove-queue",
  //   verifyToken,
  checkAndRemoveQueuedWatermark
);

router.get(
  "/workspace/:workspaceId/remove-all-queued",
  //   verifyToken,
  removeAllQueuedWatermarks
);

router.post(
  "/watermark",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "watermarkImage", maxCount: 1 },
  ]),
  processWatermarkImage
);

export default router;
