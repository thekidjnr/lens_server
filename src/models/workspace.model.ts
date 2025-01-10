import mongoose, { Schema, Document } from "mongoose";

// Interface for Workspace
export interface IWorkspace extends Document {
  name: string;
  domain: string;
  logo: {
    name: string;
    key: string;
    type: string;
    size: number;
    url: string;
  } | null;
  creatorId: mongoose.Schema.Types.ObjectId;
  storageUsed: number;
  storageLimit: number;
  members: {
    userId: mongoose.Schema.Types.ObjectId;
    role: "admin" | "editor" | "viewer";
  }[];
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    domain: { type: String, required: true, unique: true },
    logo: {
      name: { type: String, required: false },
      key: { type: String, required: false },
      type: { type: String, required: false },
      size: { type: Number, required: false },
      url: { type: String, required: false },
    },
    creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storageUsed: { type: Number, default: 0 },
    storageLimit: {
      type: Number,
      required: true,
      default: 5 * 1024 * 1024 * 1024, // 5GB
    },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: {
          type: String,
          enum: ["admin", "editor", "viewer"], // Workspace-specific roles
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Workspace = mongoose.model<IWorkspace>(
  "Workspace",
  workspaceSchema
);
