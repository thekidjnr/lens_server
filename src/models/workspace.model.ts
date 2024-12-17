import mongoose, { Schema, Document } from "mongoose";

// Interface for Workspace
export interface IWorkspace extends Document {
  name: string;
  domain: string;
  logo: {
    name: string;
    url: string;
    size: number;
    type: string;
  } | null;
  creatorId: mongoose.Schema.Types.ObjectId;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    domain: { type: String, required: true, unique: true },
    logo: {
      name: { type: String, required: false },
      url: { type: String, required: false },
      size: { type: Number, required: false },
      type: { type: String, required: false },
    },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  }
);

export const Workspace = mongoose.model<IWorkspace>(
  "Workspace",
  workspaceSchema
);
