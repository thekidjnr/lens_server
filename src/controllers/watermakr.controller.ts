import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
import { createError } from "../utils/common/error";
import { Workspace } from "../models/workspace.model";
import { deleteFileFromS3 } from "./s3.controller";
import { allowedMimeTypes, uploadToS3 } from "../utils/common/s3";
import path from "path";
import { WatermarkConfigSchema } from "../utils/watermark/watermark.dto";
import { redis } from "../utils/common/queue";
import logger from "../utils/common/logger";
import { processImageWithWatermark } from "../utils/watermark/watermark.proccessor";
import {
  MAX_FILE_SIZE,
  getQueuePosition,
  removeFromQueue,
} from "../utils/watermark/watermark.handler";
import { WatermarkConfig, WatermarkProgressResponse } from "../types";

export const cancelWatermarkJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return next(createError(404, "Collection not found"));
    }

    const progress = collection.watermarkProgress;

    if (!progress || progress.status !== "queued") {
      return next(
        createError(400, "Collection is not queued for watermark processing")
      );
    }

    // Remove from queue
    await removeFromQueue(collectionId);

    // Update status to idle
    collection.setWatermarkProgress({
      ...progress,
      status: "failed",
      queuedAt: undefined,
      locked: false,
    });
    await collection.save();

    res.status(200).json({
      message: "Watermark job cancelled successfully",
      collectionId,
    });
  } catch (error) {
    next(error);
  }
};

export const checkAndRemoveQueuedWatermark = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return next(createError(404, "Collection not found"));
    }

    const progress = collection.watermarkProgress;

    if (!progress || progress.status !== "queued") {
      return res.status(200).json({
        inQueue: false,
        message: "Collection is not in watermark queue",
        currentStatus: progress?.status || "idle",
      });
    }

    await removeFromQueue(collectionId);

    collection.setWatermarkProgress({
      ...progress,
      status: "idle",
      queuedAt: undefined,
      locked: false,
    });
    await collection.save();

    res.status(200).json({
      inQueue: true,
      removed: true,
      message: "Watermark job removed from queue successfully",
      collectionId,
    });
  } catch (error) {
    next(error);
  }
};

export const removeAllQueuedWatermarks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(createError(404, "Workspace not found"));
    }

    const queuedCollections = await Collection.find({
      workspaceId,
      "watermarkProgress.status": "queued",
    });

    const removedCollections = [];

    for (const collection of queuedCollections) {
      const collectionId = (collection._id as string).toString();

      await removeFromQueue(collectionId);

      //   const progress = collection.watermarkProgress;
      collection.setWatermarkProgress({
        total: 0,
        watermarked: 0,
        status: "idle",
        queuedAt: undefined,
        locked: false,
      });

      await collection.save();

      removedCollections.push({
        collectionId,
        collectionName: collection.name,
      });
    }

    res.status(200).json({
      message: `Removed ${removedCollections.length} watermark jobs from queue`,
      workspaceId,
      removedCount: removedCollections.length,
      removedCollections,
    });
  } catch (error) {
    next(error);
  }
};

export const updateWatermarkConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;
    const file = req.file as Express.Multer.File;

    const watermarkConfigRaw = req.body.watermarkConfig;
    if (!watermarkConfigRaw) {
      res.status(400).json({ error: "Watermark config is required" });
      return;
    }

    // Parse the config first
    let parsedConfig = file
      ? JSON.parse(watermarkConfigRaw)
      : watermarkConfigRaw;

    // Check if text is empty and set default value
    if (!parsedConfig.text || parsedConfig.text.trim() === "") {
      parsedConfig.text = "lenslyst";
    }

    // Validate request body against schema
    const validationResult = WatermarkConfigSchema.safeParse(parsedConfig);

    if (!validationResult.success) {
      return next(
        createError(
          400,
          `Invalid watermark configuration: ${validationResult.error.message}`
        )
      );
    }
    const watermarkConfig = validationResult.data;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    // Check if collection can be queued (not already in progress)
    if (!collection.canBeQueued() || collection.isWatermarkProgressLocked()) {
      return res.status(200).json({
        success: true,
        message: `Watermark processing is already ${collection.watermarkProgress?.status}. Please wait for completion or cancellation.`,
        status: collection.watermarkProgress?.status,
        canQueue: false,
      });
    }

    let newFileKey: string | undefined;

    if (watermarkConfig.type !== "text") {
      const file = req.file as Express.Multer.File;
      if (!file) {
        return next(createError(400, "Watermark image is required"));
      }

      if (file.size > MAX_FILE_SIZE) {
        return next(
          createError(
            400,
            `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
          )
        );
      }

      if (!allowedMimeTypes.includes(file.mimetype)) {
        return next(
          createError(400, "Invalid file type. Only images are allowed.")
        );
      }

      try {
        // collection.lockWatermarkProgress();
        // await collection.save();

        const folder = "watermark-logos";
        newFileKey = `${folder}/${collectionId}-${Date.now()}${path.extname(
          file.originalname
        )}`;

        await uploadToS3(
          process.env.AWS_BUCKET_NAME!,
          newFileKey,
          file.buffer,
          file.mimetype
        );

        if (collection.watermarkConfig?.imageKey) {
          await deleteFileFromS3(
            { body: { key: collection.watermarkConfig.imageKey } } as Request,
            res,
            next
          );
        }

        watermarkConfig.imageKey = newFileKey;
      } catch (error) {
        // If new file was uploaded but something else failed, clean it up
        if (newFileKey) {
          try {
            await deleteFileFromS3(
              { body: { key: newFileKey } } as Request,
              res,
              next
            );
          } catch (cleanupError) {
            logger.error(
              "Failed to cleanup new file after error:",
              cleanupError
            );
          }
        }
        throw error;
      }
    } else {
      // For text type, remove any existing image key and file
      if (collection.watermarkConfig?.imageKey) {
        try {
          await deleteFileFromS3(
            { body: { key: collection.watermarkConfig.imageKey } } as Request,
            res,
            next
          );
        } catch (error) {
          logger.error("Failed to delete old watermark image:", error);
        }
      }
      watermarkConfig.imageKey = undefined;
    }

    const existingConfig = collection.watermarkConfig;
    const completeConfig = {
      ...watermarkConfig,
      CreatedAt: existingConfig?.CreatedAt || new Date(),
      UpdatedAt: new Date(),
    };

    collection.setWatermarkConfig(completeConfig);

    // Push task to Redis queue
    const queueData = {
      collectionId: collection._id,
      slug: collection.slug,
      watermarkConfig: completeConfig,
    };

    await redis.lpush("watermark-processing", JSON.stringify(queueData));

    // Get queue position
    const queuePosition = await getQueuePosition(collectionId);

    // Set initial queued progress
    collection.setWatermarkProgress({
      total: 0,
      watermarked: 0,
      status: "queued",
      queuedAt: undefined,
      locked: false,
    });

    if (queuePosition) {
      collection.lockWatermarkProgress();
      await collection.save();
    }

    logger.info(
      `Collection ${collectionId} added to watermark queue at position ${queuePosition}`
    );

    res.status(200).json({
      message: "Watermark configuration updated and added to processing queue",
      watermarkConfig: collection.watermarkConfig,
      watermarkProgress: collection.watermarkProgress,
      queuePosition,
    });
  } catch (err) {
    next(err);
  }
};

export const processWatermarkImage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const imageFile = (req.files as any)?.["image"]?.[0];
    if (!imageFile) {
      res.status(400).json({ error: "Image file is required" });
      return;
    }

    const inputBuffer = imageFile.buffer;

    // Make watermarkImage optional - only required for image-type watermarks
    const watermarkImageBuffer = (req.files as any)?.["watermarkImage"]?.[0]
      ?.buffer;

    const watermarkConfigRaw = req.body.config;
    if (!watermarkConfigRaw) {
      res.status(400).json({ error: "Watermark config is required" });
      return;
    }

    const watermarkConfig: WatermarkConfig = JSON.parse(watermarkConfigRaw);

    // Validate that watermarkImage is provided when type is 'image'
    if (watermarkConfig.type === "image" && !watermarkImageBuffer) {
      res.status(400).json({
        error:
          "Watermark image file is required when watermark type is 'image'",
      });
      return;
    }

    const outputBuffer = await processImageWithWatermark({
      inputBuffer,
      watermarkConfig,
      watermarkImageBuffer, // This can now be undefined for text watermarks
    });

    res.set("Content-Type", "image/png");
    res.send(outputBuffer);
  } catch (error) {
    logger.error("Error processing image:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
};

export const getCollectionWatermarkProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;

    // Find the specific collection
    const collection = await Collection.findById(collectionId).select(
      "name workspaceId watermarkProgress watermarkConfig"
    );

    if (!collection) {
      return next(createError(404, "Collection not found"));
    }

    const progress = collection.watermarkProgress;

    // If no watermark progress, status is idle, or status is completed, return basic info
    if (
      !progress ||
      progress.status === "idle" ||
      progress.status === "completed"
    ) {
      return res.status(200).json({
        collectionId: collection._id,
        collectionName: collection.name,
        status: progress?.status || "idle",
        totalImages: 0,
        processedImages: 0,
        progressPercentage: 0,
        hasWatermarkConfig: !!collection.watermarkConfig,
      });
    }

    let queuePosition: number | undefined;
    let elapsedTime: number | undefined;

    // Get queue position if queued
    if (progress.status === "queued") {
      queuePosition = await getQueuePosition(collectionId);
    }

    // Calculate elapsed time if processing
    if (progress.status === "processing" && progress.startedAt) {
      elapsedTime = Math.floor(
        (Date.now() - progress.startedAt.getTime()) / 1000
      );
    }

    const progressPercentage =
      progress.total > 0
        ? Math.round((progress.watermarked / progress.total) * 100)
        : 0;

    const progressData: WatermarkProgressResponse = {
      collectionId: collection._id as string,
      collectionName: collection.name,
      status: progress.status,
      totalImages: progress.total,
      processedImages: progress.watermarked,
      queuePosition,
      queuedAt: progress.queuedAt,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      currentImageName: progress.currentImageName,
      progressPercentage,
      elapsedTime,
    };

    res.status(200).json(progressData);
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceWatermarkProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(createError(404, "Workspace not found"));
    }

    // Get all collections in workspace with watermark progress (excluding completed)
    const collections = await Collection.find({
      workspaceId,
      $or: [
        {
          "watermarkProgress.status": {
            $exists: true,
            $nin: ["idle", "completed"],
          },
        },
        { watermarkConfig: { $exists: true } },
      ],
    }).select("name watermarkProgress watermarkConfig");

    const progressData: WatermarkProgressResponse[] = [];

    for (const collection of collections) {
      const collectionId = collection._id as string;
      const progress = collection.watermarkProgress;

      // Skip if no progress, idle, or completed
      if (
        !progress ||
        progress.status === "idle" ||
        progress.status === "completed"
      )
        continue;

      let queuePosition: number | undefined;
      let elapsedTime: number | undefined;

      // Get queue position if queued
      if (progress.status === "queued") {
        queuePosition = await getQueuePosition(collectionId);
      }

      // Calculate elapsed time if processing
      if (progress.status === "processing" && progress.startedAt) {
        elapsedTime = Math.floor(
          (Date.now() - progress.startedAt.getTime()) / 1000
        );
      }

      const progressPercentage =
        progress.total > 0
          ? Math.round((progress.watermarked / progress.total) * 100)
          : 0;

      progressData.push({
        collectionId,
        collectionName: collection.name,
        status: progress.status,
        totalImages: progress.total,
        processedImages: progress.watermarked,
        queuePosition,
        queuedAt: progress.queuedAt,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        currentImageName: progress.currentImageName,
        progressPercentage,
        elapsedTime,
      });
    }

    // Sort by status priority (processing first, then queued, then failed)
    progressData.sort((a, b) => {
      const statusPriority = {
        processing: 0,
        queued: 1,
        failed: 2,
        idle: 3,
      };
      return (
        (statusPriority[a.status as keyof typeof statusPriority] || 4) -
        (statusPriority[b.status as keyof typeof statusPriority] || 4)
      );
    });

    res.status(200).json({
      workspaceId,
      workspaceName: workspace.name,
      totalActiveJobs: progressData.length,
      progressData,
    });
  } catch (error) {
    next(error);
  }
};
