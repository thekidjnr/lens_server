import { Request, Response, NextFunction } from "express";
import { Workspace } from "../models/workspace.model";
import { User } from "../models/user.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { deleteFileFromS3 } from "./s3.controller";
import { WorkspaceResponse } from "../types/custom";

export const createWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;
    const { name, logo } = req.body;
    let { domain } = req.body;

    const sanitizedDomain = domain.toLowerCase().replace(/\s+/g, "-");
    domain = `${sanitizedDomain}.lenslyst.com`;

    const existingWorkspace = await Workspace.findOne({ domain });
    if (existingWorkspace) {
      return next(
        createError(400, "Domain is already taken. Please choose another name.")
      );
    }

    const workspace = new Workspace({
      name,
      domain,
      logo,
      creatorId: decodedUser.id,
    });

    await workspace.save();

    const user = await User.findById(decodedUser.id);

    if (user) {
      if (!user.workspaces) {
        user.workspaces = [];
      }

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

