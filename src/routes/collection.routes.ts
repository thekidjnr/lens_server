import { Router } from "express";
import {
  updateCollection,
  deleteCollection,
  createCollection,
  getCollectionBySlug,
  collectionStatus,
  getCollectionsByWorkspace,
  updateFieldsToStrings,
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Routes for handling Collections
router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);
router.get("/workspace/:workspaceId/slug/:slug", getCollectionBySlug);

router.post("/update-fields", updateFieldsToStrings);

router.patch("/:slug/isPublished", collectionStatus);
router.put("/:collectionId", updateCollection);

router.delete("/:collectionId", deleteCollection);

export default router;
