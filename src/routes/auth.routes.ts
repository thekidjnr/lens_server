import express from "express";
import { loginUser, registerUser } from "../controllers/auth.controller";
import {
  handleValidationErrors,
  validateRegister,
  verifyToken,
} from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", loginUser);

router.post(
  "/register",
  validateRegister,
  handleValidationErrors,
  registerUser
);

export default router;
