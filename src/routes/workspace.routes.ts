import express from "express";
import {
  createWorkspace,
  getWorkspaceById,
} from "../controllers/workspace.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

// Route for creating an onboarding entry
router.post("/", verifyToken, createWorkspace);
router.get("/:workspaceId", verifyToken, getWorkspaceById);

export default router;
