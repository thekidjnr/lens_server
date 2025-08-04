import { Request, Response, NextFunction } from "express";
import {
  Collection,
  WatermarkConfig,
  WatermarkProgressResponse,
} from "../models/collection.model";
import { createError } from "../utils/error";
import { Workspace } from "../models/workspace.model";
import slugify from "slugify";
import { deleteFileFromS3 } from "./s3.controller";
import { File } from "../models/file.model";
import { S3Client } from "@aws-sdk/client-s3";
import { allowedMimeTypes, uploadToS3 } from "../utils/s3";
import path from "path";
import { WatermarkConfigSchema } from "../utils/watermark.dto";
import { redis } from "../utils/queue";
import logger from "../utils/logger";
import { WatermarkedFile } from "../models/watermarkedfile.model";
import { processImageWithWatermark } from "../utils/watermark.proccessor";

export const createCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    const { name, description, workspaceId } = req.body;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return next(createError(404, "Workspace not found"));
    }

    const slug = slugify(name, { lower: true, strict: true });

    const existingCollection = await Collection.findOne({
      slug,
      workspaceId,
    });

    if (existingCollection) {
      return next(
        createError(
          400,
          "A collection with this name already exists in the workspace."
        )
      );
    }

    const newCollection = new Collection({
      name,
      slug,
      description,
      workspaceId,
      creatorId: decodedUser.id,
    });

    await newCollection.save();

    res.status(201).json(newCollection);
  } catch (err) {
    next(err);
  }
};

export const updateCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;
    const updates = req.body;

    const allowedUpdates = ["name", "description", "coverPhotoKey"];
    const updateKeys = Object.keys(updates);
    const isValidUpdate = updateKeys.every((key) =>
      allowedUpdates.includes(key)
    );

    if (!isValidUpdate) {
      return next(createError(400, "Invalid fields for update."));
    }

    const collection = await Collection.findById(collectionId);

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    updateKeys.forEach((key) => {
      (collection as any)[key] = updates[key];
    });

    await collection.save();

    res.status(200).json({
      message: "Collection updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const getCollectionsByWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { workspaceId } = req.params;

  try {
    const workspace = await Workspace.findById(workspaceId).select(
      "workspaceId"
    );
    if (!workspace) return next(createError(404, "Workspace not found"));

    const collections = await Collection.find({ workspaceId: workspace._id });

    res.status(200).json(collections);
  } catch (err) {
    next(err);
  }
};

export const getCollectionBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { workspaceSlug, slug } = req.params;

  try {
    // Find workspace by slug
    const workspace = await Workspace.findOne({ slug: workspaceSlug }).select(
      "_id slug name logo"
    );
    if (!workspace) {
      return next(createError(404, "Workspace not found."));
    }

    // Find collection by slug and workspaceId
    const collection = await Collection.findOne({
      slug,
      workspaceId: workspace._id,
    });

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    const collectionData = collection.toObject();

    const url = `${process.env.PREVIEW_URL}/${workspace.slug}/${slug}`;

    const response = {
      ...collectionData,
      url,
      workspaceLogo: workspace.logo,
      workspaceName: workspace.name,
    };

    logger.info(response);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const getCollectionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    // Find collection by ID
    const collection = await Collection.findById(id);
    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    // Find all watermarked images of the collection
    const watermarked = await WatermarkedFile.find({
      collectionId: collection._id,
    });

    const collectionData = collection.toObject();

    const response = {
      ...collectionData,
    };

    logger.info(response);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const collectionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { slug } = req.params;

  try {
    const collection = await Collection.findOne({ slug });
    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    collection.isPublished = !collection.isPublished;

    await collection.save();

    res.status(200).json({
      message: `Collection ${
        collection.isPublished ? "published" : "unpublished"
      } successfully`,
      isPublished: collection.isPublished,
    });
  } catch (error) {
    next(
      createError(500, "An error occurred while updating collection status.")
    );
  }
};

export const deleteCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    // Check if collection is currently in progress
    if (collection.isInProgress()) {
      return next(
        createError(
          400,
          "Cannot delete collection while watermark processing is in progress"
        )
      );
    }

    const files = await File.find({ collectionSlug: collection.slug });

    for (const file of files) {
      try {
        await deleteFileFromS3(
          { body: { key: file.key } } as Request,
          res,
          next
        );

        const workspace = await Workspace.findById(collection.workspaceId);
        if (workspace) {
          const currentStorageUsed = BigInt(workspace.storageUsed);
          const newStorageUsed = Math.max(
            0,
            Number(currentStorageUsed) - file.size
          );

          workspace.storageUsed = newStorageUsed.toString();
          await workspace.save();
        }

        await File.findByIdAndDelete(file._id);
      } catch (err) {
        logger.error(`Error deleting file ${file._id}:`, err);
      }
    }

    // Remove from queue if it's there
    await removeFromQueue(collectionId);

    await Collection.findByIdAndDelete(collectionId);

    res.status(200).json({
      message: "Collection and associated files deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

////////////// Utils
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const getQueuePosition = async (
  collectionId: string
): Promise<number | undefined> => {
  try {
    const queueItems = await redis.lrange("watermark-processing", 0, -1);
    const position = queueItems.findIndex((item) => {
      const parsedItem = JSON.parse(item);
      return parsedItem.collectionId === collectionId;
    });
    return position >= 0 ? position + 1 : undefined;
  } catch (error) {
    logger.error("Error getting queue position:", error);
    return undefined;
  }
};

const removeFromQueue = async (collectionId: string): Promise<void> => {
  try {
    const queueItems = await redis.lrange("watermark-processing", 0, -1);
    for (let i = 0; i < queueItems.length; i++) {
      const parsedItem = JSON.parse(queueItems[i]);
      if (parsedItem.collectionId === collectionId) {
        await redis.lrem("watermark-processing", 1, queueItems[i]);
        logger.info(`Removed collection ${collectionId} from queue`);
        break;
      }
    }
  } catch (error) {
    logger.error("Error removing from queue:", error);
  }
};

////////// Procceses
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
      status: "idle",
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

    // Validate request body against schema
    const validationResult = file
      ? WatermarkConfigSchema.safeParse(JSON.parse(watermarkConfigRaw))
      : WatermarkConfigSchema.safeParse(watermarkConfigRaw);

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

        const folder = "watermarks";
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

    // Set initial queued progress
    collection.setWatermarkProgress({
      total: 0,
      watermarked: 0,
      locked: false,
      status: "queued",
      queuedAt: new Date(),
    });

    await collection.save();

    // Push task to Redis queue
    const queueData = {
      collectionId,
      slug: collection.slug,
      watermarkConfig: completeConfig,
    };

    await redis.lpush("watermark-processing", JSON.stringify(queueData));

    // Get queue position
    const queuePosition = await getQueuePosition(collectionId);

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

//////// Progress
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

// New endpoint to get workspace watermark progress
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
