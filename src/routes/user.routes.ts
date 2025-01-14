import express from "express";
import {
  changePassword,
  getUser,
  updateUser,
} from "../controllers/user.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", verifyToken, getUser);
router.put("/", verifyToken, updateUser);
router.post("/changePassword", verifyToken, changePassword);

export default router;
