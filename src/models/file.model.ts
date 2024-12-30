import mongoose, { Schema, Document } from "mongoose";

interface IFile extends Document {
  name: string;
  url: string;
  size: number;
  type: string;
  collectionSlug: string;
}

const fileSchema = new Schema<IFile>({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  collectionSlug: { type: String, required: true },
});

export const File = mongoose.model<IFile>("File", fileSchema);
