import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import { createError } from "../utils/error";

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
    next(createError(500, "Server error. Please try again later."));
  }
};
