import mongoose, { Schema, Document } from "mongoose";

interface IFile extends Document {
  name: string;
  key: string;
  size: number;
  type: string;
  url: string;
  collectionSlug: string;
}

const fileSchema = new Schema<IFile>({
  name: { type: String, required: true },
  key: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String },
  collectionSlug: { type: String, required: true },
});

export const File = mongoose.model<IFile>("File", fileSchema);
