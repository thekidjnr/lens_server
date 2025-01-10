import { Request, Response, NextFunction } from "express";
import { Workspace } from "../models/workspace.model";
import { User } from "../models/user.model";
import { createError } from "../utils/error";
import mongoose from "mongoose";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

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

    // If there's a logo, generate a signed URL
    if (workspace.logo && workspace.logo.key) {
      workspace.logo.url = getSignedUrl({
        url: `${process.env.CLOUDFRONT_DOMAIN}/` + workspace.logo.key,
        dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID!,
        privateKey: process.env.CLOUDFRONT_PRIVATE_KEY!,
      });
    }

    res.status(200).json(workspace);
  } catch (error) {
    next(error);
  }
};
