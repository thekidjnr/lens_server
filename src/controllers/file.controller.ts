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

    const existingFile = await File.findOne({ key, collectionSlug });
    if (existingFile) {
      return next(
        createError(
          409,
          "File with the same key already exists in the collection"
        )
      );
    }

    const collection = await Collection.findOne({ slug: collectionSlug });
    if (!collection) {
      return next(createError(404, "Collection not found"));
    }

    const workspaceId = collection.workspaceId;
    if (!workspaceId) {
      return next(
        createError(500, "Workspace ID not associated with the collection")
      );
    }

    const newFile = new File({
      name,
      key,
      size,
      type,
      collectionSlug,
      workspaceId,
    });

    await newFile.save();

    const updateFields: any = { $inc: { noOfFiles: 1 } };
    if (!collection.coverPhotoKey) {
      updateFields.$set = { coverPhotoKey: key };
    }
    await Collection.updateOne({ slug: collectionSlug }, updateFields);

    const workspace = await Workspace.findById(workspaceId);
    if (workspace) {
      workspace.storageUsed += size;
      await workspace.save();
    } else {
      return next(createError(500, "Workspace not found for the collection"));
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
    const collection = await Collection.findOne({ slug });

    if (!collection) {
      return next(createError(404, "Collection not found."));
    }

    const workspaceId = collection.workspaceId;

    const files = await File.find({ workspaceId, collectionSlug: slug });

    if (!files.length) {
      return next(
        createError(
          404,
          "No files found for this collection in the specified workspace."
        )
      );
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
      console.log("File was not found");
      await session.abortTransaction();
      return next(createError(404, "File not found"));
    }

    const { collectionSlug, key, size } = file;

    console.log(file);
    const deletedFile = await File.findByIdAndDelete(fileId).session(session);
    console.log(deletedFile);
    if (!deletedFile) {
      console.log("file was not deleted");
      await session.abortTransaction();
      return next(createError(500, "Failed to delete file"));
    }

    const collection = await Collection.findOne({
      slug: collectionSlug,
    }).session(session);
    if (collection) {
      collection.noOfFiles = Math.max(0, collection.noOfFiles - 1);

      if (collection.coverPhotoKey === key) {
        const nextFile = await File.findOne({ collectionSlug }).session(
          session
        );
        collection.coverPhotoKey = nextFile ? nextFile.key : "";
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

    // Commit the transaction
    await session.commitTransaction();

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    // Rollback the transaction in case of error
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
