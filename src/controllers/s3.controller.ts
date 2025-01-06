import { NextFunction, Request, Response } from "express";
import { createError } from "../utils/error";
import path from "path";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { uploadToS3 } from "../utils/s3";
import { File } from "../models/file.model";

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
      return next(new Error("No files provided."));
    }

    const files = req.files as unknown as Express.Multer.File[];
    const uploadedFiles = [];

    for (const file of files) {
      const fileKey = `photos/${Date.now()}-${Math.round(
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

// export const refreshPresignedUrl = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   const { fileId } = req.body;

//   if (!fileId) {
//     return next(createError(400, "File ID is required"));
//   }

//   try {
//     const file = await File.findById(fileId);
//     if (!file) {
//       return next(createError(404, "File not found"));
//     }

//     const { url, expirationTime } = await generateSignedUrl(
//       process.env.AWS_BUCKET_NAME!,
//       file.key,
//       file.name
//     );

//     // Update the database with the new expiration time
//     file.url = url;
//     file.expirationTime = expirationTime;
//     await file.save();

//     res.status(200).json({ url, expirationTime });
//   } catch (error) {
//     next(error);
//   }
// };

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
