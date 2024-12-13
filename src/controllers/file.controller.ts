import { Request, Response, NextFunction } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createError } from "../utils/error";
import path from "path";
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

export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if files are provided
    if (!req.files) {
      return next(createError(404, "No files provided."));
    }

    // Type-cast files
    const files = req.files as unknown as Express.Multer.File[];

    // Iterate over files and upload each one to S3
    for (const file of files) {
      const fileKey = `projects/${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${path.extname(file.originalname)}`;

      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(uploadParams);

      // Upload to S3
      await s3Client.send(command);

      // Save file metadata to the database
      const newFile = new File({
        name: file.originalname,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${fileKey}`,
        size: file.size,
        type: file.mimetype,
        projectId: req.params.projectId, // Assuming you're passing the projectId in the URL
      });

      await newFile.save();
    }

    res.status(200).json({ message: "Files uploaded successfully!" });
  } catch (error) {
    console.error("Error during file upload:", error);
    next(error);
  }
};

export const getProjectFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const projectId = req.params.projectId;
  try {
    const projects = await File.find({ projectId });
    if (!projects.length) {
      res.status(200).json([]);
    }
    res.status(200).json(projects);
  } catch (err) {
    next(err);
  }
};
