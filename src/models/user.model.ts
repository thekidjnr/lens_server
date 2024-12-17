import mongoose, { Schema, Document } from "mongoose";

interface User extends Document {
  fullName: string;
  email: string;
  password: string;
  role: string;
  isOnboarded: boolean;
}

export interface UserDocument extends User {
  createdAt: Date;
  updatedAt: Date;
  _doc?: any;
}

const userSchema = new Schema<User>({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "creator"],
    default: "creator",
  },
  isOnboarded: {
    type: Boolean,
    default: false,
  },
});

export const User = mongoose.model<User>("User", userSchema);
