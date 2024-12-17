import express from "express";
import { loginUser, registerUser } from "../controllers/auth.controller";
import { validateRegister, verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/login", loginUser);

router.post("/signup", validateRegister, registerUser);

export default router;
