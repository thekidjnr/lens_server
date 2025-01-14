import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import { createError } from "../utils/error";
import { generateSignedUrl } from "../utils/s3";
import { deleteFileFromS3 } from "./s3.controller";
import bcrypt from "bcryptjs";

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    if (!decodedUser || !decodedUser.id) {
      return next(createError(401, "User not authenticated"));
    }

    const user = await User.findById(decodedUser?.id).lean();
    if (!user) {
      return next(createError(404, "User not found!"));
    }

    if (user.profilePhoto?.key) {
      user.profilePhoto.url = generateSignedUrl(user.profilePhoto.key);
    }

    const { password, ...otherDetails } = user;
    res.status(200).json(otherDetails);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    if (!decodedUser || !decodedUser.id) {
      return next(createError(401, "User not authenticated"));
    }

    const { fullName, profilePhoto } = req.body;
    const user = await User.findById(decodedUser.id);
    if (!user) {
      return next(createError(404, "User not found."));
    }
    if (user.profilePhoto?.key) {
      const deleteReq = { body: { key: user.profilePhoto.key } } as Request;
      await deleteFileFromS3(deleteReq, res, next);
    }

    if (fullName) user.fullName = fullName;
    if (profilePhoto) {
      user.profilePhoto = profilePhoto;
    }

    await user.save();

    res.status(200).json({
      message: "User updated successfully.",
      user: { fullName: user.fullName, profilePhoto: user.profilePhoto?.url },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as { id: string };

    if (!decodedUser || !decodedUser.id) {
      return next(createError(401, "User not authenticated"));
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(
        createError(400, "Both current and new passwords are required")
      );
    }

    const user = await User.findById(decodedUser.id);
    if (!user) {
      return next(createError(404, "User not found"));
    }

    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordCorrect) {
      return next(createError(401, "Current password is incorrect"));
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};
