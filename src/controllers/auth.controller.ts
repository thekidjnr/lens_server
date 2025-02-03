import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { createError } from "../utils/error";
import { User } from "../models/user.model";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

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

    const user = await User.findOne({ email })
    if (!user) return next(createError(404, "User does not exist"));

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return next(createError(404, "Wrong email or password"));

    const token = jwt.sign(
      { id: user._id, role: user.role },
      `${process.env.JWT_SECRET}`,
      {
        expiresIn: "1y",
      }
    );

    res.status(200).json({ token, subdomain: "mikestudios" });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User does not exist"));

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiration = Date.now() + 1000 * 60 * 15;

    user.resetPasswordCode = resetCode;
    user.resetPasswordCodeExpires = resetCodeExpiration;
    await user.save();

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Lenslyst" <${process.env.NODEMAILER_EMAIL}>`,
      to: user.email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${resetCode}. This code will expire in 15 minutes.`,
      html: `<p>Your password reset code is:</p>
             <h3>${resetCode}</h3>
             <p>This code will expire in 15 minutes.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Password reset code has been sent to your email address",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyResetCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, resetCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User not found"));

    if (user.resetPasswordCode !== resetCode) {
      return next(createError(400, "Reset code is incorrect"));
    }

    if (
      !user.resetPasswordCodeExpires ||
      user.resetPasswordCodeExpires < Date.now()
    ) {
      return next(createError(400, "Reset code has expired"));
    }

    user.resetPasswordCode = null;
    user.resetPasswordCodeExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Reset code verified. You can now reset your password.",
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return next(createError(404, "User not found"));

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetPasswordCode = null;
    user.resetPasswordCodeExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message:
        "Password reset successful. You can now log in with your new password.",
    });
  } catch (err) {
    next(err);
  }
};
