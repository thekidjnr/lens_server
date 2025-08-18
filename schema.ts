// Watermark Configuration Types
type WatermarkAlignment =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "center"
  | "east"
  | "southwest"
  | "south"
  | "southeast";

type WatermarkTileType = "single" | "grid" | "diagonal";
type WatermarkPreviewMode = "watermarked" | "blurred" | "none";

interface BaseWatermarkConfig {
  type: "text" | "image";
  alignment: WatermarkAlignment;
  opacity: number; // 0-1
  size: number; // pixels
  rotation: number; // degrees
  tileType: WatermarkTileType;
  previewMode: WatermarkPreviewMode;
  requirePayment?: boolean;
  amount?: number; // if requirePayment is true
}

interface TextWatermarkConfig extends BaseWatermarkConfig {
  type: "text";
  text: string;
  textColor: string; // hex color code e.g. "#ffffff"
}

interface ImageWatermarkConfig extends BaseWatermarkConfig {
  type: "image";
  imageKey: string; // path to the image in S3
}

type WatermarkConfig = TextWatermarkConfig | ImageWatermarkConfig;
