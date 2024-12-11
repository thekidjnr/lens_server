import mongoose, { Schema, Document } from "mongoose";

interface IFile extends Document {
  name: string;
  url: string;
  size: number;
  type: string;
  projectId: mongoose.Schema.Types.ObjectId;
}

const fileSchema = new Schema<IFile>({
  name: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: Number, required: true },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
  },
});

export const File = mongoose.model<IFile>("File", fileSchema);
