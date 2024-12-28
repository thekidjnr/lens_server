import { NextFunction, Request, Response } from "express";
import { File } from "../models/file.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { Collection } from "../models/collection.model";

export const addFileToCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { collectionId, fileData } = req.body;

  if (!collectionId || !fileData) {
    return next(createError(400, "Missing collectionId or fileData"));
  }

  try {
    const { name, url, size, type } = fileData;

    if (!name || !url || !size || !type) {
      return next(createError(400, "Invalid file data"));
    }

    const newFile = new File({
      name,
      url,
      size,
      type,
      collectionId,
    });

    await newFile.save();

    const collection = await Collection.findById(collectionId);
    if (collection) {
      collection.noOfFiles += 1;

      const defaultCoverPhotoUrl =
        "https://micbucket123.s3.amazonaws.com/uploads/1735265105205-664574714.png";

      if (collection.coverPhotoUrl === defaultCoverPhotoUrl) {
        collection.coverPhotoUrl = url;
      }

      await collection.save();
    }

    res.status(201).json({ file: newFile });
  } catch (error) {
    next(error);
  }
};

export const getFilesByCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { collectionId } = req.params;

  try {
    const files = await File.find({ collectionId });
    if (!files.length) {
      return next(createError(404, "No files found for this collection."));
    }

    res.status(200).json(files);
  } catch (err) {
    next(err);
  }
};

export const deleteFileFromCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    const file = await File.findById(id);
    if (!file) {
      return next(createError(404, "No file found"));
    }

    const { collectionId, url } = file;

    // Delete the file
    await File.findByIdAndDelete(id);

    // Update the collection
    const collection = await Collection.findById(collectionId);
    if (collection) {
      // Decrement the file count
      collection.noOfFiles -= 1;

      const defaultCoverPhotoUrl =
        "https://micbucket123.s3.amazonaws.com/uploads/1735265105205-664574714.png";

      // If the deleted file was the current cover photo
      if (collection.coverPhotoUrl === url) {
        // Set the cover photo to the default or choose another file from the collection
        const nextFile = await File.findOne({ collectionId });

        collection.coverPhotoUrl = nextFile
          ? nextFile.url // Use another file's URL as the new cover photo
          : defaultCoverPhotoUrl; // Default cover photo if no files are left
      }

      await collection.save();
    }

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    next(error);
  }
};
