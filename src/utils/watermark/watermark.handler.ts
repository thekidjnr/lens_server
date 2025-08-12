import { Request, Response, NextFunction } from "express";
import {
  Collection,
  WatermarkConfig,
  WatermarkProgressResponse,
} from "../../models/collection.model";
import { createError } from "../common/error";
import { Workspace } from "../../models/workspace.model";
import slugify from "slugify";

import { File } from "../../models/file.model";
import { S3Client } from "@aws-sdk/client-s3";
import { allowedMimeTypes, uploadToS3 } from "../common/s3";
import path from "path";

import { redis } from "../common/queue";
import logger from "../common/logger";
import { WatermarkedFile } from "../../models/watermarkedfile.model";


export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const getQueuePosition = async (
  collectionId: string
): Promise<number | undefined> => {
  try {
    const queueItems = await redis.lrange("watermark-processing", 0, -1);
    const position = queueItems.findIndex((item) => {
      const parsedItem = JSON.parse(item);
      return parsedItem.collectionId === collectionId;
    });
    return position >= 0 ? position + 1 : undefined;
  } catch (error) {
    logger.error("Error getting queue position:", error);
    return undefined;
  }
};

export const removeFromQueue = async (collectionId: string): Promise<void> => {
  try {
    const queueItems = await redis.lrange("watermark-processing", 0, -1);
    for (let i = 0; i < queueItems.length; i++) {
      const parsedItem = JSON.parse(queueItems[i]);
      if (parsedItem.collectionId === collectionId) {
        await redis.lrem("watermark-processing", 1, queueItems[i]);
        logger.info(`Removed collection ${collectionId} from queue`);
        break;
      }
    }
  } catch (error) {
    logger.error("Error removing from queue:", error);
  }
};
