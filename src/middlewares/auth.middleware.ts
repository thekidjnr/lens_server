import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// 1. Validation Chain
export const validateRegister = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "No token provided!" });
    return; // Ensure we stop execution here
  }

  jwt.verify(token, `${process.env.JWT}`, (err, user) => {
    if (err) {
      res.status(403).json({ message: "Failed to authenticate token!" });
      return; // Ensure we stop execution here
    }

    if (user && typeof user !== "string") {
      req.user = user as UserPayload; // Attach user payload to request
    }

    next(); // Pass control to the next middleware
  });
};
