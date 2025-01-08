import express from "express";
import { getUser, updateUser } from "../controllers/user.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

router.get("/", verifyToken, getUser);
router.put("/", verifyToken, updateUser);

export default router;
