import { Router } from "express";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionById,
  getCollectionBySlug,
  getCollectionsByWorkspace,
  collectionStatus,
} from "../controllers/collection.controller";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifyToken, createCollection);

router.get("/workspace/:workspaceId", verifyToken, getCollectionsByWorkspace);

router.get("/workspace/:workspaceSlug/slug/:slug", getCollectionBySlug);

router.get("/:id", getCollectionById);

router.put("/:collectionId", updateCollection);

router.patch("/:slug/isPublished", collectionStatus);

router.delete("/:collectionId", deleteCollection);

export default router;
