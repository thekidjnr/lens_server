import { NextFunction, Request, Response } from "express";
import { File } from "../models/file.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { Collection } from "../models/collection.model";
import { Workspace } from "../models/workspace.model";

export const addFileToCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { collectionSlug, fileData } = req.body;

  if (!collectionSlug || !fileData) {
    return next(createError(400, "Missing collectionSlug or fileData"));
  }

  try {
    const { name, url, key, expirationTime, size, type } = fileData;

    if (!name || !url || !key || !expirationTime || !size || !type) {
      return next(createError(400, "Invalid file data"));
    }

    const newFile = new File({
      name,
      url,
      key,
      expirationTime,
      size,
      type,
      collectionSlug,
    });

    await newFile.save();

    const collection = await Collection.findOne({ slug: collectionSlug });

    if (collection) {
      collection.noOfFiles += 1;

      const defaultCoverPhotoUrl = process.env.COLLECTION_COVER_PLACEHOLDER!;

      if (collection.coverPhotoUrl === defaultCoverPhotoUrl) {
        collection.coverPhotoUrl = url;
      }

      await collection.save();

      const workspace = await Workspace.findById(collection.workspaceId);
      if (workspace) {
        workspace.storageUsed += size;
        await workspace.save();
      }
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
  const { slug } = req.params;

  try {
    const files = await File.find({ collectionSlug: slug });
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
  const { fileId } = req.params;

  try {
    const file = await File.findById(fileId);
    if (!file) {
      return next(createError(404, "File not found"));
    }

    const { collectionSlug, url, size } = file;

    await File.findByIdAndDelete(fileId);

    const collection = await Collection.findOne({ slug: collectionSlug });
    if (collection) {
      collection.noOfFiles -= 1;

      const defaultCoverPhotoUrl = process.env.COLLECTION_COVER_PLACEHOLDER!;

      if (collection.coverPhotoUrl === url) {
        const nextFile = await File.findOne({ collectionSlug });

        collection.coverPhotoUrl = nextFile
          ? nextFile.url
          : defaultCoverPhotoUrl;
      }

      await collection.save();

      const workspace = await Workspace.findById(collection.workspaceId);
      if (workspace) {
        workspace.storageUsed = Math.max(0, workspace.storageUsed - size);
        await workspace.save();
      }
    }

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    next(error);
  }
};
