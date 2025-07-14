import Queue from "bull";
import { Collection } from "../models/collection.model";
import { File } from "../models/file.model";
import { WatermarkConfig } from "../models/watermark.model";
import { allowedMimeTypes, uploadToS3 } from "../utils/s3";
import { processWatermark } from "./sharp";
import path from "path";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined in environment variables");
}

const watermarkQueue = new Queue("watermarkQueue", process.env.REDIS_URL as string);

// Add queue event listeners for monitoring
watermarkQueue.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed for collection ${job.data.collectionId}`
  );
});

watermarkQueue.on("failed", (job, err) => {
  console.error(
    `Job ${job?.id} failed for collection ${job?.data.collectionId}:`,
    err
  );
});

watermarkQueue.on("active", (job) => {
  console.log(
    `Processing job ${job.id} for collection ${job.data.collectionId}`
  );
});

watermarkQueue.process(async (job) => {
  const { collectionId, watermarkConfigId } = job.data;

  try {
    const collection = await Collection.findById(collectionId);
    if (!collection) throw new Error("Collection not found");



    collection.isWatermarkingLocked = true;
    collection.watermarkingProgress.status = "in_progress";
    collection.watermarkingProgress.totalFiles = await File.countDocuments({
      collectionSlug: collection.slug,
    });
    collection.watermarkingProgress.watermarkedFiles = 0;
    collection.watermarkingProgress.lastUpdated = new Date();
    await collection.save();

    const files = await File.find({ collectionSlug: collection.slug });
    const watermarkConfig = await WatermarkConfig.findById(watermarkConfigId);
    if (!watermarkConfig) throw new Error("Watermark config not found");

    for (const file of files) {
      if (allowedMimeTypes.includes(file.type)) {
        let watermarkedBuffer;
        if (watermarkConfig.previewMode === "blurred") {
          watermarkedBuffer = await processWatermark(
            file.key,
            watermarkConfig,
            true
          ); // Apply blur
        } else {
          watermarkedBuffer = await processWatermark(file.key, watermarkConfig); // Apply watermark
        }

        // Save watermarked image to S3
        const watermarkedKey = `watermark/${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${path.extname(file.name)}`;
        await uploadToS3(
          process.env.AWS_BUCKET_NAME!,
          watermarkedKey,
          watermarkedBuffer,
          file.type
        );

        // Create new File entry for the watermarked image
        const newFile = new File({
          name: `${file.name}_watermarked`,
          key: watermarkedKey,
          size: watermarkedBuffer.length,
          type: file.type,
          collectionSlug: collection.slug,
          workspaceId: collection.workspaceId,
        });
        await newFile.save();

        collection.watermarkingProgress.watermarkedFiles += 1;
        await collection.save();
      }
    }

    collection.watermarkingProgress.status = "completed";
    collection.isWatermarkingLocked = false;
    collection.watermarkingProgress.lastUpdated = new Date();
    await collection.save();
  } catch (error) {
    const collection = await Collection.findById(collectionId);
    if (collection) {
      collection.watermarkingProgress.status = "failed";
      collection.isWatermarkingLocked = false;
      collection.watermarkingProgress.lastUpdated = new Date();
      await collection.save();
    }
    throw error;
  }
});

export const addWatermarkJob = async (
  collectionId: string,
  watermarkConfigId: string
) => {
  await watermarkQueue.add({ collectionId, watermarkConfigId });
};
