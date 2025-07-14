import mongoose, { Schema, Document } from "mongoose";

interface ICollection extends Document {
  name: string;
  slug: string;
  url: string;
  description: string;
  creatorId: mongoose.Schema.Types.ObjectId;
  workspaceId: mongoose.Schema.Types.ObjectId;
  noOfFiles: number;
  isPublished: boolean;
  coverPhotoKey: string;
  template: string;
  createdAt: Date;
  requiresPayment: boolean;
  watermarkingProgress: {
    totalFiles: number;
    watermarkedFiles: number;
    status: "idle" | "pending" | "in_progress" | "completed" | "failed";
    lastUpdated: Date;
  };
  isWatermarkingLocked: boolean;
  watermarkConfigId: mongoose.Schema.Types.ObjectId;
  watermarked: boolean;
}

const collectionSchema = new Schema<ICollection>({
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String },
  creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: "Workspace",
    required: true,
  },
  coverPhotoKey: {
    type: String,
  },
  noOfFiles: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: false },
  url: { type: String },
  template: {
    type: String,
    enum: ["classic", "lumen", "zest", "muse"],
    default: "classic",
  },
  createdAt: { type: Date, default: Date.now },
  requiresPayment: { type: Boolean, default: false },
  watermarkingProgress: {
    totalFiles: { type: Number, default: 0 },
    watermarkedFiles: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["idle", "pending", "in_progress", "completed", "failed"],
      default: "idle",
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  isWatermarkingLocked: { type: Boolean, default: false },
  watermarkConfigId: {
    type: Schema.Types.ObjectId,
    ref: "WatermarkConfig",
    default: null,
  },
  watermarked: { type: Boolean, default: false },
});

collectionSchema.index({ slug: 1, workspaceId: 1 }, { unique: true });

export const Collection = mongoose.model<ICollection>(
  "Collection",
  collectionSchema
);
