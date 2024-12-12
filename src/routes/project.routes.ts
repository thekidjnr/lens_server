import { Router } from "express";
import {
  getProjectsByCreator,
  getProjectById,
  updateProject,
  deleteProject,
  createProject,
} from "../controllers/project.controller";
import multer from "multer"; // For file upload
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Multer configuration for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Routes for handling projects
router.post("/", verifyToken, createProject); // Create a new project
router.get("/creator", verifyToken, getProjectsByCreator); // Get all projects for a specific creator
router.get("/:projectId", getProjectById); // Get a specific project by ID
router.put("/:projectId", updateProject); // Update a project
router.delete("/:projectId", deleteProject); // Delete a project

export default router;
