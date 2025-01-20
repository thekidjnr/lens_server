import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
import { createError } from "../utils/error";
import { Workspace } from "../models/workspace.model";
import slugify from "slugify";
import { generateSignedUrl } from "../utils/s3";
import { deleteFileFromS3 } from "./s3.controller";
import { File } from "../models/file.model";

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

    const url = `${process.env.CLIENT_URL}/photos/${workspace._id}/${slug}`;

    const newCollection = new Collection({
      name,
      slug,
      description,
      workspaceId,
      creatorId: decodedUser.id,
      url,
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

    const allowedUpdates = ["name", "description", "coverPhoto"];
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
  const { workspaceId, slug } = req.params;

  try {
    const collection = await Collection.findOne({ slug, workspaceId });

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    const collectionData = collection.toObject();

    // Fetch workspace name
    const workspace = await Workspace.findById(workspaceId).select("name");

    if (!workspace) {
      return next(createError(404, "Workspace not found."));
    }

    // Combine collection data with workspace name
    const response = {
      ...collectionData,
      workspaceName: workspace.name,
    };

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

export const updateFieldsToStrings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await Workspace.updateMany({}, [
      {
        $set: {
          storageUsed: { $toString: "$storageUsed" },
          storageLimit: { $toString: "$storageLimit" },
        },
      },
    ]);

    res.status(200).json({
      message: "Fields successfully updated to strings.",
    });
  } catch (error) {
    next(error);
  }
};
