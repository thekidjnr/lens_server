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
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { WatermarkConfig } from "../models/collection.model";
import { processImageWithWatermark } from "../utils/watermark.proccessor";
import logger from "../utils/logger";

const router = Router();

const upload = multer({ storage: multer.memoryStorage() });

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);
router.get("/workspace/:workspaceSlug/slug/:slug", getCollectionBySlug);

router.patch("/:slug/isPublished", collectionStatus);
router.put("/:collectionId", updateCollection);

router.patch("/:collectionId/watermark", verifyToken, updateWatermarkConfig);

router.delete("/:collectionId", deleteCollection);

router.get("/get/:id", getCollectionById);

// router.post("/:collectionId/watermark", verifyToken, updateWatermarkConfig);

router.post(
  "/watermark",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "watermarkImage", maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const imageFile = (req.files as any)?.["image"]?.[0];
      if (!imageFile) {
        res.status(400).json({ error: "Image file is required" });
        return;
      }

      const inputBuffer = imageFile.buffer;

      const watermarkImageBuffer = (req.files as any)?.["watermarkImage"]?.[0]
        ?.buffer;

      const watermarkConfigRaw = req.body.config;
      if (!watermarkConfigRaw) {
        res.status(400).json({ error: "Watermark config is required" });
        return;
      }

      const watermarkConfig: WatermarkConfig = JSON.parse(watermarkConfigRaw);

      const outputBuffer = await processImageWithWatermark({
        inputBuffer,
        watermarkConfig,
        watermarkImageBuffer,
      });

      res.set("Content-Type", "image/png");
      res.send(outputBuffer); // ✅ just call, don't return
    } catch (error) {
      logger.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  }
);

export default router;
