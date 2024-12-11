import express from "express";
import { uploadFile } from "../controllers/file.controller";
import { verifyToken } from "../middlewares/auth.middleware";
import { upload } from "../utils/multer"; // Import multer middleware

const router = express.Router();

// POST route to upload files for a creative
router.post(
  "/upload/:projectId",
  verifyToken, // Ensure the user is authenticated
  upload.array("files", 10), // Parse the files from the request (maximum 10 files)
  uploadFile // Handle the upload logic in the controller
);

export default router;
