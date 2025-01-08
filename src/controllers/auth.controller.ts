import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { createError } from "../utils/error";
import { User } from "../models/user.model";
import jwt from "jsonwebtoken";

export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return next(createError(400, "All fields are required."));
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError(400, "User with this email already exists."));
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully.",
      user: { fullName, email },
    });
  } catch (error) {
    next(createError(500, "Server error. Please try again later."));
  }
};

export const loginUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User does not exist"));

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return next(createError(404, "Wrong email or password"));

    const token = jwt.sign(
      { id: user._id, role: user.role },
      `${process.env.JWT}`,
      {
        expiresIn: "1y",
      }
    );

    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
};
