import express from "express";
import { createWorkspace } from "../controllers/workspace.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = express.Router();

// Route for creating an onboarding entry
router.post("/", verifyToken, createWorkspace);

export default router;
