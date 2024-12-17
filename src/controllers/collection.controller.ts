import { Request, Response, NextFunction } from "express";
import { Collection } from "../models/collection.model";
import { createError } from "../utils/error";
import { File } from "../models/file.model";

export const createCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    const { name, description, clientId } = req.body;

    const newCollection = new Collection({
      name,
      description,
      creatorId: decodedUser.id,
      clientId,
    });

    await newCollection.save();
    res.status(201).json(newCollection);
  } catch (err) {
    next(err);
  }
};

export const uploadFilesToCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { files, collectionId } = req.body;
    console.log(files, collectionId);
    // if (!collectionId) {
    //   return next(createError(400, "Collection ID is required."));
    // }

    // if (!files || !Array.isArray(files) || files.length === 0) {
    //   return next(createError(400, "No files uploaded"));
    // }

    // const collection = await Collection.findById(collectionId);
    // if (!collection) {
    //   return next(createError(401, "Collection not found"));
    // }

    // const uploadedFiles = [];

    // for (const file of files) {
    //   const { name, url, type, size } = file;

    //   const newFile = new File({
    //     name,
    //     url,
    //     type,
    //     size,
    //     collectionId,
    //   });

    //   await newFile.save();
    //   uploadedFiles.push(newFile);
    // }

    // res.status(200).json({
    //   message: "Files uploaded successfully",
    //   uploadedFiles,
    // });
  } catch (error) {
    console.error("Error uploading files:", error);
    next(error);
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
    const collection = await Collection.findById(req.params.CollectionId);

    // Handle case where the Collection is not found
    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    res.status(200).json(collection);
  } catch (err) {
    // Pass error to the error handler middleware
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
