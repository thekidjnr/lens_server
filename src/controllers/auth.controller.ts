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
    // Extract user details from the request body
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return next(createError(400, "All fields are required."));
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError(400, "User with this email already exists."));
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    // Respond with success
    res.status(201).json({
      message: "User registered successfully.",
      user: { name, email },
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
