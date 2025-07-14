import sharp from "sharp";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { allowedMimeTypes } from "./s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const processWatermark = async (
  fileKey: string,
  watermarkConfig: any,
  applyBlur: boolean = false
) => {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: fileKey,
  });
  const response = await s3Client.send(command);
  let imageBuffer = await response.Body?.transformToByteArray();

  let watermarkedBuffer = sharp(imageBuffer);

  if (applyBlur) {
    watermarkedBuffer = watermarkedBuffer.blur(5); // Apply blur effect
  } else {
    let watermarkBuffer;
    if (watermarkConfig.type === "image" && watermarkConfig.imageKey) {
      const watermarkCommand = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: watermarkConfig.imageKey,
      });
      const watermarkResponse = await s3Client.send(watermarkCommand);
      watermarkBuffer = await watermarkResponse.Body?.transformToByteArray();
    } else {
      watermarkBuffer = Buffer.from(watermarkConfig.text || "Lenslyst");
    }

    const watermarkImage = sharp(watermarkBuffer);

    const { width, height } = await watermarkedBuffer.metadata();
    const watermarkMetadata = await watermarkImage.metadata();
    const watermarkWidth = Math.round(
      watermarkMetadata.width! * watermarkConfig.size
    );
    const watermarkHeight = Math.round(
      watermarkMetadata.height! * watermarkConfig.size
    );

    const compositeOptions = {
      input: await watermarkImage
        .resize(watermarkWidth, watermarkHeight)
        .rotate(watermarkConfig.rotation)
        .toBuffer(),
      top: getAlignmentTop(watermarkConfig.alignment, height!, watermarkHeight),
      left: getAlignmentLeft(watermarkConfig.alignment, width!, watermarkWidth),
      tile: watermarkConfig.tileType !== "single",
      opacity: watermarkConfig.opacity,
    };

    watermarkedBuffer = watermarkedBuffer.composite([compositeOptions]);
  }

  return await watermarkedBuffer.toBuffer();
};

// Type definitions for alignment
type VerticalAlignment = "north" | "south" | "center";
type HorizontalAlignment = "west" | "east" | "center";

const getAlignmentTop = (
  alignment: string,
  height: number,
  watermarkHeight: number
): number => {
  const alignments: Record<VerticalAlignment, number> = {
    north: 0,
    south: height - watermarkHeight,
    center: (height - watermarkHeight) / 2,
  };
  return alignments[alignment.split(/(?=[a-z])/)[0] as VerticalAlignment] || 0;
};

const getAlignmentLeft = (
  alignment: string,
  width: number,
  watermarkWidth: number
): number => {
  const alignments: Record<HorizontalAlignment, number> = {
    west: 0,
    east: width - watermarkWidth,
    center: (width - watermarkWidth) / 2,
  };
  return (
    alignments[alignment.split(/(?=[a-z])/).pop()! as HorizontalAlignment] || 0
  );
};
