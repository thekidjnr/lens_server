import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
import { createError } from "../utils/error";
import { Workspace } from "../models/workspace.model";
import slugify from "slugify";

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

    const url = `${workspace.domain}/${slug}`;

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

export const getCollectionsByCreator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const decodedUser = req.user as UserPayload;

  try {
    const Collections = await Collection.find({ creatorId: decodedUser.id });
    if (!Collections.length) {
      return next(createError(404, "No Collections found for this creator."));
    }

    res.status(200).json(Collections);
  } catch (err) {
    next(err);
  }
};

export const getCollectionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const collection = await Collection.findById(req.params.id);
    console.log(req.params.id);

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    res.status(200).json(collection);
  } catch (err) {
    next(err);
  }
};

export const getCollectionBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;
    const { slug } = req.params;

    const collection = await Collection.findOne({ slug, workspaceId });

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    res.status(200).json(collection);
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
    const updatedCollection = await Collection.findByIdAndUpdate(
      req.params.CollectionId,
      req.body,
      { new: true }
    );
    if (!updatedCollection) {
      return next(createError(404, "Collection not found."));
    }
    res.status(200).json(updatedCollection);
  } catch (err) {
    next(err);
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
    next(error);
  }
};

export const deleteCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deletedCollection = await Collection.findByIdAndDelete(
      req.params.CollectionId
    );
    if (!deletedCollection) {
      return next(createError(404, "Collection not found."));
    }
    res.status(200).json({ message: "Collection deleted successfully." });
  } catch (err) {
    next(err);
  }
};
