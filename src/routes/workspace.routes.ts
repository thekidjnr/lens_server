import express from "express";
import {
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
} from "../controllers/workspace.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

// Route for creating an onboarding entry
router.post("/", verifyToken, createWorkspace);
router.get("/:workspaceId", verifyToken, getWorkspaceById);
router.put("/:workspaceId", verifyToken, updateWorkspace);

export default router;
