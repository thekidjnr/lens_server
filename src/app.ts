import express, { Express, ErrorRequestHandler } from "express";

import cors, { CorsOptions } from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import { apiReference } from "@scalar/express-api-reference";
import winston from "winston";
dotenv.config();
import "./utils/watermarkProcessor";

// Import routes
import authRoute from "./routes/auth.routes";
import userRoute from "./routes/user.routes";
import collectionRoute from "./routes/collection.routes";
import fileRoute from "./routes/file.routes";
import workspaceRoute from "./routes/workspace.routes";
import s3Route from "./routes/s3.routes";

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

const app: Express = express();
const httpServer = createServer(app);

//MONGODB CONNECTION
mongoose.set("strictQuery", false);
const connect = async () => {
  const mongoUri = process.env.MONGO_URI!;
  try {
    await mongoose.connect(mongoUri);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection error:", err);
    throw err;
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB Disconnected");
});

//MIDDLEWARES
app.use(express.json());
app.use(cookieParser());

// CORS POLICIES
const corsOptions: CorsOptions = {
  origin: [
    "https://www.lenslyst.com",
    "https://dashboard.lenslyst.com",
    "http://localhost:3000",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  exposedHeaders: ["Set-Cookie", "Date", "ETag"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

//ROUTES
app.get("/", (req, res) => {
  res.send("Welcome Lenslyst");
});

app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/workspace", workspaceRoute);
app.use("/collections", collectionRoute);
app.use("/files", fileRoute);
app.use("/s3", s3Route);

// Serve the OpenAPI spec
app.get("/api-spec.json", (req, res) => {
  res.sendFile("api-spec.json", { root: "./public" });
});

// API reference route
app.use(
  "/api-docs",
  apiReference({
    theme: "purple",
    url: "/api-spec.json",
  })
);

//ERROR HANDLERS
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const errorStatus = err.status || 500;
  const errorMessage = err.message || "Something went wrong";

  logger.error(`${errorStatus} - ${errorMessage}`, { stack: err.stack });

  res.status(errorStatus).json({
    success: false,
    status: errorStatus,
    message: errorMessage,
    stack: err.stack,
  });
};

// Use the error handler
app.use(errorHandler);

//PORT FOR LISTENING TO APP
httpServer.listen(parseInt(process.env.PORT as string), () => {
  connect();
  logger.info(`Server is running on port ${process.env.PORT}`);
});
