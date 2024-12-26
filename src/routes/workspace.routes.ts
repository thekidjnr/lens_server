import express from "express";
import {
  createWorkspace,
  getWorkspace,
} from "../controllers/workspace.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

// Route for creating an onboarding entry
router.post("/", verifyToken, createWorkspace);
router.get("/", verifyToken, getWorkspace);

export default router;
