import { Request, Response, NextFunction } from "express";
import { Project } from "../models/project.model";
import { createError } from "../utils/error";

export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, creatorId, clientId } = req.body;

    const newProject = new Project({
      name,
      description,
      creatorId,
      clientId,
    });

    await newProject.save();
    res.status(201).json(newProject);
  } catch (err) {
    next(err);
  }
};

export const getProjectsByCreator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const projects = await Project.find({ creatorId: req.params.creatorId });
    if (!projects.length) {
      return next(createError(404, "No projects found for this creator."));
    }
    res.status(200).json(projects);
  } catch (err) {
    next(err);
  }
};

export const getProjectById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const project = await Project.findById(req.params.projectId);

    // Handle case where the project is not found
    if (!project) {
      return next(createError(404, "Project not found."));
    }

    res.status(200).json(project);
  } catch (err) {
    // Pass error to the error handler middleware
    next(err);
  }
};

export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.projectId,
      req.body,
      { new: true }
    );
    if (!updatedProject) {
      return next(createError(404, "Project not found."));
    }
    res.status(200).json(updatedProject);
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(
      req.params.projectId
    );
    if (!deletedProject) {
      return next(createError(404, "Project not found."));
    }
    res.status(200).json({ message: "Project deleted successfully." });
  } catch (err) {
    next(err);
  }
};
