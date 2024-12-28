import mongoose, { Schema, Document } from "mongoose";

interface ICollection extends Document {
  name: string;
  description: string;
  creatorId: mongoose.Schema.Types.ObjectId;
  workspaceId: mongoose.Schema.Types.ObjectId;
  noOfFiles: number;
  coverPhotoUrl: string;
  createdAt: Date;
}

const collectionSchema = new Schema<ICollection>({
  name: { type: String, required: true },
  description: { type: String },
  creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: "Workspace",
    required: false,
  },
  coverPhotoUrl: {
    type: String,
    default:
      "https://lenslyst.s3.us-east-2.amazonaws.com/Image_Placeholder.png",
  },
  noOfFiles: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export const Collection = mongoose.model<ICollection>(
  "Collection",
  collectionSchema
);
