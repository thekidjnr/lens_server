import { Router } from "express";
import {
  updateCollection,
  deleteCollection,
  createCollection,
  getCollectionBySlug,
  collectionStatus,
  getCollectionsByWorkspace,
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);
router.get("/workspace/:workspaceId/slug/:slug", getCollectionBySlug);

router.patch("/:slug/isPublished", collectionStatus);
router.put("/:collectionId", updateCollection);

router.delete("/:collectionId", deleteCollection);

export default router;
