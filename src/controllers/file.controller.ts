import { NextFunction, Request, Response } from "express";
import { File } from "../models/file.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { Collection } from "../models/collection.model";
import { Workspace } from "../models/workspace.model";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

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
    const { name, key, size, type } = fileData;

    if (!name || !key || !size || !type) {
      return next(createError(400, "Invalid file data"));
    }

    const newFile = new File({
      name,
      key,
      size,
      type,
      collectionSlug,
    });

    await newFile.save();

    const collection = await Collection.findOne({ slug: collectionSlug });

    if (collection) {
      collection.noOfFiles += 1;

      if (!collection.coverPhotoKey) {
        collection.coverPhotoKey = key;
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

    for (const file of files) {
      file.url = getSignedUrl({
        url: `${process.env.CLOUDFRONT_DOMAIN}/` + file.key,
        dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID!,
        privateKey: process.env.CLOUDFRONT_PRIVATE_KEY!,
      });
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const file = await File.findById(fileId).session(session);
    if (!file) {
      await session.abortTransaction();
      return next(createError(404, "File not found"));
    }

    const { collectionSlug, key, size } = file;

    await File.findByIdAndDelete(fileId).session(session);

    const collection = await Collection.findOne({
      slug: collectionSlug,
    }).session(session);
    if (collection) {
      collection.noOfFiles -= 1;

      if (collection.coverPhotoKey === key) {
        const nextFile = await File.findOne({ collectionSlug }).session(
          session
        );
        collection.coverPhotoKey = nextFile ? nextFile.key : key;
      }

      await collection.save({ session });

      const workspace = await Workspace.findById(
        collection.workspaceId
      ).session(session);
      if (workspace) {
        workspace.storageUsed = Math.max(0, workspace.storageUsed - size);
        await workspace.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
