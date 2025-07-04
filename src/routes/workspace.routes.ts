import express from "express";
import {
  createWorkspace,
  getWorkspaceById,
  getWorkspaceBySlug,
  updateWorkspace,
  updateWorkspaceSlug,
} from "../controllers/workspace.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

// Route for creating an onboarding entry
router.post("/", verifyToken, createWorkspace);

router.get("/:workspaceId", verifyToken, getWorkspaceById);
router.get("/slug/:slug", verifyToken, getWorkspaceBySlug);

router.put("/:workspaceId", verifyToken, updateWorkspace);
router.put("/w/slug", updateWorkspaceSlug);

export default router;
