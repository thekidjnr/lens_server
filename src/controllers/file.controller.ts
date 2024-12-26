import { NextFunction, Request, Response } from "express";
import { File } from "../models/file.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";

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
