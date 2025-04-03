import { NextFunction, Request, Response } from "express";
import { createError } from "../utils/error";
import path from "path";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { allowedMimeTypes, uploadToS3 } from "../utils/s3";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";

// Initialize the AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const cloudFront = new CloudFrontClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const uploadFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.files) {
      return next(new Error("No files provided."));
    }

    const files = req.files as unknown as Express.Multer.File[];
    const uploadedFiles = [];

    // Get folder from request body (or use a default folder)
    const folder = req.body.folder || "photos"; // Default to 'photos' if not specified

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return next(
          createError(400, "Invalid file type. Only images are allowed.")
        );
      }

      // Dynamically set file key based on folder
      const fileKey = `${folder}/${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`;

      await uploadToS3(
        process.env.AWS_BUCKET_NAME!,
        fileKey,
        file.buffer,
        file.mimetype
      );

      uploadedFiles.push({
        name: file.originalname,
        key: fileKey,
        size: file.size,
        type: file.mimetype,
      });
    }

    res.status(200).json({ data: uploadedFiles });
  } catch (error) {
    next(error);
  }
};

export const deleteFileFromS3 = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { key } = req.body;

  if (!key) {
    return next(createError(400, "File key is required."));
  }

  try {
    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
    };
    await s3Client.send(new DeleteObjectCommand(deleteParams));

    return { success: true };
  } catch (error) {
    return next(error);
  }
};
