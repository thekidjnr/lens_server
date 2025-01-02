import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  logger: console,
});

// Function to upload a file to S3
export const uploadToS3 = async (
  bucketName: string,
  fileKey: string,
  fileBuffer: Buffer,
  mimeType: string
) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return fileKey;
};

// Function to generate a signed URL for a file in S3
export const generateSignedUrl = async (
  bucketName: string,
  fileKey: string,
  fileName: string,
  expiresIn: number = 3600
) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileKey,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};
