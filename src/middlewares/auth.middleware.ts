import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
    return;
  }

  jwt.verify(token, `${process.env.JWT}`, (err, user) => {
    if (err) {
      res.status(403).json({ message: "Failed to authenticate token!" });
      return;
    }

    if (user && typeof user !== "string") {
      req.user = user as UserPayload;
    }

    next();
  });
};
