import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
import { createError } from "../utils/error";
import { Workspace } from "../models/workspace.model";
import slugify from "slugify";
import { deleteFileFromS3 } from "./s3.controller";
import { File } from "../models/file.model";
import { IWatermarkConfig, WatermarkConfig } from "../models/watermark.model";
import { allowedMimeTypes, uploadToS3 } from "../utils/s3";
import { addWatermarkJob } from "../utils/watermarkProcessor";
import path from "path";

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

    // Create default watermark config
    const defaultWatermarkConfig = new WatermarkConfig({
      type: "text",
      text: "Lenslyst",
      alignment: "center",
      opacity: 0.6,
      size: 0.3,
      rotation: 0,
      tileType: "single",
      textColor: "#000000",
    });

    const savedWatermarkConfig = await defaultWatermarkConfig.save();

    const newCollection = new Collection({
      name,
      slug,
      description,
      workspaceId,
      creatorId: decodedUser.id,
      watermarkConfigId: savedWatermarkConfig._id, // Link the watermark config
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

    const collectionData = collection.toObject();

    const url = `${process.env.PREVIEW_URL}/${workspace.slug}/${slug}`;

    const response = {
      ...collectionData,
      url,
      workspaceLogo: workspace.logo,
      workspaceName: workspace.name,
    };

    console.log(response);
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
        console.error(`Error deleting file ${file._id}:`, err);
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

export const getCollectionById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId).populate({
      path: "workspaceId",
      select: "_id slug name logo",
    });

    if (!collection) {
      next(createError(404, "Collection not found"));
      return;
    }

    const collectionData = collection.toObject();
    const workspace = collection.workspaceId as any;

    const url = `${process.env.PREVIEW_URL}/${workspace.slug}/${collection.slug}`;

    const response = {
      ...collectionData,
      url,
      workspaceLogo: workspace.logo,
      workspaceName: workspace.name,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const generateWatermark = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const { previewMode } = req.body;
    const collection = await Collection.findById(collectionId);
    if (!collection) {
      next(createError(404, "Collection not found"));
      return;
    }

    const file = await File.findOne({ collectionSlug: collection.slug });
    if (!file) {
      next(createError(400, "No files found in collection"));
      return;
    }
    if (!allowedMimeTypes.includes(file.type)) {
      next(createError(400, "File is not an image"));
      return;
    }

    if (collection.isWatermarkingLocked) {
      next(createError(400, "Watermark Generation already in progress"));
      return;
    }

    let watermarkConfig = (await WatermarkConfig.findById(
      collection.watermarkConfigId
    )) as IWatermarkConfig | null;
    if (!watermarkConfig) {
      next(createError(404, "Watermark config not found"));
      return;
    }

    // Update watermark config with form data
    watermarkConfig.type = req.body.type || watermarkConfig.type;
    watermarkConfig.text = req.body.text || watermarkConfig.text;
    watermarkConfig.opacity =
      req.body.opacity !== undefined
        ? parseFloat(req.body.opacity)
        : watermarkConfig.opacity;
    watermarkConfig.size =
      req.body.size !== undefined
        ? parseFloat(req.body.size)
        : watermarkConfig.opacity;
    watermarkConfig.rotation =
      req.body.rotation !== undefined
        ? parseInt(req.body.rotation)
        : watermarkConfig.rotation;
    watermarkConfig.tileType = req.body.tileType || watermarkConfig.tileType;
    watermarkConfig.alignment = req.body.alignment || watermarkConfig.alignment;
    watermarkConfig.textColor = req.body.textColor || watermarkConfig.textColor;

    // Handle image upload if type is "image"
    if (req.body.type === "image" && req.files) {
      const file = (req.files as any).watermarkImage as Express.Multer.File;
      if (file && allowedMimeTypes.includes(file.mimetype)) {
        const imageKey = `watermark_images/${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${path.extname(file.originalname)}`;
        await uploadToS3(
          process.env.AWS_BUCKET_NAME!,
          imageKey,
          file.buffer,
          file.mimetype
        );
        watermarkConfig.imageKey = imageKey;
      }
    }

    // Update preview mode
    if (previewMode) {
      watermarkConfig.previewMode = previewMode;
    }

    await watermarkConfig.save();

    // Handle preview mode logic
    if (previewMode === "none") {
      collection.watermarked = false;
      collection.isWatermarkingLocked = false;
      await collection.save();
      res
        .status(200)
        .json({ message: "Watermarking disabled for this collection" });
      return;
    }

    collection.isWatermarkingLocked = true;
    collection.watermarked = true;
    await collection.save();

    await addWatermarkJob(
      collectionId,
      collection.watermarkConfigId.toString()
    );

    res
      .status(202)
      .json({ message: "Watermark generation queued successfully" });
  } catch (error) {
    next(error);
  }
};

export const getWatermarkingProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { collectionId } = req.params;

    const collection = await Collection.findById(collectionId);
    if (!collection) {
      next(createError(404, "Collection not found"));
      return;
    }

    res.status(200).json({
      watermarkingProgress: {
        totalFiles: collection.watermarkingProgress.totalFiles,
        watermarkedFiles: collection.watermarkingProgress.watermarkedFiles,
        status: collection.watermarkingProgress.status,
        lastUpdated: collection.watermarkingProgress.lastUpdated,
      },
    });
  } catch (error) {
    next(error);
  }
};
