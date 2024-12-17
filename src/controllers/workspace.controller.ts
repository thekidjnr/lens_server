import { Request, Response, NextFunction } from "express";
import { Workspace } from "../models/workspace.model";
import { User } from "../models/user.model";

export const createWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const decodedUser = req.user as UserPayload;

    const { name, domain, logo } = req.body;
    const workspace = new Workspace({
      name,
      domain,
      logo,
      creatorId: decodedUser.id,
    });

    await workspace.save();

    const user = await User.findById(decodedUser.id);

    if (user && !user.isOnboarded) {
      user.isOnboarded = true;
      await user.save();
    }

    res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    console.error("Error creating workspace:", error);
    next(error);
  }
};

// Retrieve onboarding entry by ID
export const getWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id).populate("logo");

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    res.status(200).json(workspace);
  } catch (error) {
    console.error("Error fetching Workspace", error);
    next(error);
  }
};
