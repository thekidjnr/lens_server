import multer from "multer";

// Configure multer to handle file uploads
const storage = multer.memoryStorage(); // Store files in memory for further processing

export const upload = multer({
  storage,
});
