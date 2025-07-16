import { Request, Response, NextFunction } from "express";
import { Workspace } from "../models/workspace.model";
import { User } from "../models/user.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { deleteFileFromS3 } from "./s3.controller";
import logger from "../utils/logger";

export const createWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    const { name, logo, slug } = req.body;

    if (!slug || !name) {
      return next(createError(400, "Name and slug are required."));
    }

    // Sanitize and validate slug
    const sanitizedSlug = slug.toLowerCase().replace(/\s+/g, "-");

    const existingWorkspace = await Workspace.findOne({ slug: sanitizedSlug });
    if (existingWorkspace) {
      return next(
        createError(400, "That workspace name is taken. Try another.")
      );
    }

    // Create new workspace
    const workspace = new Workspace({
      name,
      slug: sanitizedSlug,
      logo,
      creatorId: decodedUser.id,
    });

    await workspace.save();

    // Add workspace to user
    const user = await User.findById(decodedUser.id);
    if (user) {
      if (!user.workspaces) user.workspaces = [];

      user.workspaces.push({
        workspaceId: workspace._id as mongoose.Types.ObjectId,
        role: "admin",
      });

      if (!user.isOnboarded) {
        user.isOnboarded = true;
      }

      await user.save();
    }

    res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceBySlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;

    if (!decodedUser?.id) {
      return next(createError(401, "User not authenticated"));
    }

    const { slug } = req.params;

    const workspace = await Workspace.findOne({ slug });

    if (!workspace) {
      return next(createError(404, "Workspace not found"));
    }

    const isCreator = workspace.creatorId.toString() === decodedUser.id;
    const isMember = workspace.members.some(
      (member) => member.userId.toString() === decodedUser.id
    );

    if (!isCreator && !isMember) {
      return next(createError(403, "Access denied: not a workspace member"));
    }

    res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return next(createError(404, "Workspace not found"));
    }

    res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};

export const updateWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    if (!decodedUser || !decodedUser.id) {
      return next(createError(401, "User not authenticated"));
    }

    const { workspaceId } = req.params;
    const { name, logo } = req.body;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return next(createError(404, "Workspace not found."));
    }

    const user = await User.findById(decodedUser.id);
    const isUserAdmin = user?.workspaces.some(
      (w) => w.workspaceId.toString() === workspaceId && w.role === "admin"
    );

    if (!isUserAdmin) {
      return next(
        createError(403, "You do not have permission to update this workspace.")
      );
    }

    if (workspace.logo?.key && logo) {
      const deleteReq = { body: { key: workspace.logo.key } } as Request;
      await deleteFileFromS3(deleteReq, res, next);
    }

    if (name) workspace.name = name;
    if (logo) workspace.logo = logo;

    await workspace.save();

    res.status(200).json({
      message: "Workspace updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const updateWorkspaceSlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaces = await Workspace.find({
      domain: { $exists: true, $ne: null },
    });

    let updatedCount = 0;
    let skipped = 0;

    for (const ws of workspaces) {
      const domain = ws.domain;

      if (typeof domain === "string" && domain.endsWith(".lenslyst.com")) {
        const proposedSlug = domain.replace(".lenslyst.com", "").toLowerCase();

        // Skip if slug already exists on this doc
        if (ws.slug === proposedSlug) {
          logger.info(`✅ Already has slug: ${proposedSlug}`);
          skipped++;
          continue;
        }

        // Skip if another workspace already has the same slug
        const existing = await Workspace.findOne({
          slug: proposedSlug,
          _id: { $ne: ws._id },
        });

        if (existing) {
          console.warn(`⚠️ Slug "${proposedSlug}" already exists. Skipping.`);
          skipped++;
          continue;
        }

        await Workspace.updateOne(
          { _id: ws._id },
          {
            $set: { slug: proposedSlug },
          }
        );

        logger.info(`✅ Set slug "${proposedSlug}" for ${domain}`);
        updatedCount++;
      } else {
        console.warn(`⚠️ Invalid or missing domain for workspace: ${ws._id}`);
        skipped++;
      }
    }

    res.json({
      message: "✅ Slug creation complete",
      updated: updatedCount,
      skipped,
      total: workspaces.length,
    });
  } catch (err) {
    logger.error("❌ Error creating slugs", err);
    next(err);
  }
};
