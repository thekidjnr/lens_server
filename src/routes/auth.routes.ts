import express from "express";
import {
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  verifyResetCode,
} from "../controllers/auth.controller";
import { validateRegister, verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", loginUser);

router.post("/signup", validateRegister, registerUser);

router.post("/forgotpassword", forgotPassword);
router.post("/verifyresetcode", verifyResetCode);
router.post("/resetpassword", resetPassword);

export default router;
