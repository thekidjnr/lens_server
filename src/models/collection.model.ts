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
  createdAt: Date;
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
  createdAt: { type: Date, default: Date.now },
});

collectionSchema.index({ slug: 1, workspaceId: 1 }, { unique: true });

export const Collection = mongoose.model<ICollection>(
  "Collection",
  collectionSchema
);
