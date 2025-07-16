import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
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

    // Find all watermarked images of collection
    const watermarked = await WatermarkedFile.find({
      collectionId: collection._id,
    });

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
      ...(watermarked &&
        watermarked.length > 0 && { watermarkedFiles: watermarked }),
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

    await Collection.findByIdAndDelete(collectionId);

    res.status(200).json({
      message: "Collection and associated files deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
// const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];

export const updateWatermarkConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { collectionId } = req.params;

    // Validate request body against schema
    const validationResult = WatermarkConfigSchema.safeParse(req.body);
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

    if (collection.watermarkProgress?.locked) {
      return next(createError(400, "Watermark already in progress"));
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
    await collection.save();

    // Push task to Redis list
    await redis.lpush(
      "watermark-processing",
      JSON.stringify({
        collectionId,
        slug: collection.slug,
        watermarkConfig: completeConfig,
      })
    );

    res.status(200).json({
      message: "Watermark configuration updated successfully",
      watermarkConfig: collection.watermarkConfig,
    });
  } catch (err) {
    next(err);
  }
};
