import multer from "multer";

// Configure multer to handle file uploads
const storage = multer.memoryStorage(); // Store files in memory for further processing

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});
