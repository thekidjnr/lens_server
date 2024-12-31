import { NextFunction, Request, Response } from "express";
import { createError } from "../utils/error";
import path from "path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Initialize the AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  logger: console,
});

export const uploadFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.files) {
      return next(createError(404, "No files provided."));
    }

    const files = req.files as unknown as Express.Multer.File[];
    const uploadedFiles = [];

    for (const file of files) {
      const fileKey = `uploads/${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`;

      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      uploadedFiles.push({
        name: file.originalname,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`,
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
  const { url } = req.body;
  try {
    // Extract the key from the S3 URL
    const urlParts = url.split("/");
    const key = urlParts.slice(3).join("/");

    // Delete the file from S3
    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    next(error);
  }
};
