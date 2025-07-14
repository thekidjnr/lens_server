import mongoose, { Schema, Document } from "mongoose";

export interface IWatermarkConfig extends Document {
  type: "text" | "image";
  text?: string;
  imageKey?: string;
  alignment:
    | "northwest"
    | "north"
    | "northeast"
    | "west"
    | "center"
    | "east"
    | "southwest"
    | "south"
    | "southeast";
  opacity: number;
  size: number;
  rotation: number;
  tileType: "single" | "grid" | "diagonal";
  textColor?: string;
  previewMode: "watermarked" | "blurred" | "none";
  createdAt: Date;
}

const watermarkConfigSchema = new Schema<IWatermarkConfig>({
  type: { type: String, enum: ["text", "image"], required: true },
  text: { type: String, default: "Lenslyst" },
  imageKey: { type: String },
  alignment: {
    type: String,
    enum: [
      "northwest",
      "north",
      "northeast",
      "west",
      "center",
      "east",
      "southwest",
      "south",
      "southeast",
    ],
    default: "center",
  },
  opacity: { type: Number, default: 0.6, min: 0, max: 1 },
  size: { type: Number, default: 0.3, min: 0, max: 1 },
  rotation: { type: Number, default: 0, min: 0, max: 360 },
  tileType: {
    type: String,
    enum: ["single", "grid", "diagonal"],
    default: "single",
  },
  textColor: { type: String, default: "#000000" },
  previewMode: {
    type: String,
    enum: ["watermarked", "blurred", "none"],
    default: "none",
  },
  createdAt: { type: Date, default: Date.now },
});

export const WatermarkConfig = mongoose.model<IWatermarkConfig>(
  "WatermarkConfig",
  watermarkConfigSchema
);
