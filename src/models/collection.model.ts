import mongoose, { Schema, Document } from "mongoose";

interface ICollection extends Document {
  name: string;
  description: string;
  creatorId: mongoose.Schema.Types.ObjectId;
  clientId: mongoose.Schema.Types.ObjectId;
}

const collectionSchema = new Schema<ICollection>({
  name: { type: String, required: true },
  description: { type: String },
  creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: false },
});

export const Collection = mongoose.model<ICollection>(
  "Collection",
  collectionSchema
);
